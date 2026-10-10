using Microsoft.EntityFrameworkCore;
using Platform.Application.Abstractions;
using Platform.Application.Common;
using Platform.Application.Delivery;
using Platform.Domain.Entities;
using Platform.Domain.Enums;

namespace Platform.Application.Orders;

public record CreateOrderItemRequest(Guid MenuItemId, int Quantity, List<Guid> SelectedModifierOptionIds, string? SpecialInstructions);

public record CreateOrderAddressRequest(string Line1, string? Line2, string City, string Postcode);

public record CreatePublicOrderRequest(
    OrderType OrderType, string? TableQrToken, string? CustomerName, string? CustomerPhone, string? CustomerEmail,
    CreateOrderAddressRequest? DeliveryAddress, List<CreateOrderItemRequest> Items, string? SpecialRequests,
    PaymentMethod PaymentMethod, string? VoucherCode, bool RedeemLoyaltyPoints = false);

public record CreatedOrderDto(
    Guid Id, string OrderNumber, string Status, decimal Subtotal, decimal DeliveryFee, decimal ProcessingFee,
    decimal DiscountAmount, decimal TotalAmount, int LoyaltyPointsEarned, int LoyaltyPointsRedeemed);

/// <param name="UserId">The signed-in customer's identity user, or null for a guest.</param>
public record PlaceOrderCommand(CreatePublicOrderRequest Request, Guid? UserId) : ICommand<CreatedOrderDto>;

/// <summary>Web checkout. Prices are always recomputed here from the menu - nothing the client
/// sends for money is trusted.</summary>
internal sealed class PlaceOrderHandler(
    IAppDbContext db, ICurrentTenant tenant, IOrderNotifier notifier, ICardPayments cardPayments, IDeliveryQuoteService deliveryQuotes)
    : ICommandHandler<PlaceOrderCommand, CreatedOrderDto>
{
    private static Error Invalid(string message) => Error.Validation("Order.Invalid", message);

    public async Task<Result<CreatedOrderDto>> Handle(PlaceOrderCommand command, CancellationToken ct)
    {
        var request = command.Request;

        if (!tenant.RestaurantId.HasValue)
            return Invalid("Could not resolve a restaurant for this domain.");
        var restaurantId = tenant.RestaurantId.Value;

        if (request.Items.Count == 0)
            return Invalid("Order must contain at least one item.");

        // Refuse up front rather than create an order that can never be paid (checkout-session
        // would fail) - the storefront hides Card when RestaurantPublicDto.CardPaymentsAvailable is false.
        if (request.PaymentMethod == PaymentMethod.Card && !await cardPayments.IsAvailableAsync(restaurantId, ct))
            return Invalid("Card payment isn't available for this restaurant yet. Please choose another payment method.");

        Table? table = null;
        if (request.OrderType == OrderType.DineIn)
        {
            if (string.IsNullOrWhiteSpace(request.TableQrToken))
                return Invalid("Dine-in orders require a table QR token.");

            table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == request.TableQrToken && t.IsActive, ct);
            if (table is null)
                return Invalid("Table not found or inactive.");
        }

        if (request.OrderType == OrderType.Delivery && request.DeliveryAddress is null)
            return Invalid("Delivery orders require a delivery address.");

        // Priced here, before anything is added to the context: the quote service may save the
        // restaurant's map position on first use, which must not also flush a half-built order.
        DeliveryCheck? delivery = null;
        if (request.OrderType == OrderType.Delivery)
        {
            delivery = await deliveryQuotes.CheckPostcodeAsync(restaurantId, request.DeliveryAddress!.Postcode, ct);
            if (!delivery.CanDeliver)
                return Invalid(delivery.Problem ?? "We can't deliver to this address.");
        }

        // Never trust client-submitted prices - recompute every line from the current
        // MenuItem/ModifierOption rows, scoped to this tenant by the query filter.
        var menuItemIds = request.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems
            .Where(i => menuItemIds.Contains(i.Id) && i.IsAvailable)
            .Include(i => i.ModifierGroupLinks).ThenInclude(l => l.ModifierGroup!).ThenInclude(g => g.Options)
            .ToDictionaryAsync(i => i.Id, ct);

        var defaultOrderStatus = await db.OrderStatusDefinitions.Where(d => d.IsDefault).Select(d => d.Name).FirstOrDefaultAsync(ct) ?? "Pending";
        var defaultPaymentStatus = await db.PaymentStatusDefinitions.Where(d => d.IsDefault).Select(d => d.Name).FirstOrDefaultAsync(ct) ?? "Pending";

        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == restaurantId, ct);

        // The restaurant's configured default for this order type (admin -> Configurations,
        // 60/20/20 min out of the box) - a real estimate set at creation, so the customer sees
        // a time immediately and staff have a starting value to adjust rather than a blank.
        int? estimatedMinutes = request.OrderType switch
        {
            OrderType.Delivery => restaurant?.DeliveryMinutes ?? 60,
            OrderType.Collection => restaurant?.CollectionMinutes ?? 20,
            OrderType.DineIn => restaurant?.DineInMinutes ?? 20,
            _ => null,
        };

        var order = new Order
        {
            OrderType = request.OrderType,
            TableId = table?.Id,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            CustomerEmail = request.CustomerEmail,
            PaymentMethod = request.PaymentMethod,
            SpecialRequests = request.SpecialRequests,
            Source = OrderSource.Web,
            Status = defaultOrderStatus,
            PaymentStatus = defaultPaymentStatus,
            // Only the planned duration for now - the clock starts when the restaurant confirms
            // the order (UpdateOrderStatusHandler sets EstimatedReadyAt then).
            EstimatedMinutes = estimatedMinutes,
        };

        Guid? customerId = command.UserId is { } userId
            ? (await db.Customers.FirstOrDefaultAsync(c => c.IdentityUserId == userId, ct))?.Id
            : null;
        order.CustomerId = customerId;
        // CreatedBy/UpdatedBy are stamped automatically by AppDbContext from ICurrentActor.

        if (request.DeliveryAddress is not null)
        {
            var address = new CustomerAddress
            {
                CustomerId = customerId,
                Line1 = request.DeliveryAddress.Line1,
                Line2 = request.DeliveryAddress.Line2,
                City = request.DeliveryAddress.City,
                Postcode = delivery?.Postcode ?? request.DeliveryAddress.Postcode,
                Latitude = delivery?.Point?.Latitude,
                Longitude = delivery?.Point?.Longitude,
            };
            // Guest delivery addresses aren't linked to a Customer row (CustomerId stays empty
            // for guests) - stored denormalized against the order for the driver, not reused.
            db.CustomerAddresses.Add(address);
            order.DeliveryAddress = address;
        }

        decimal subtotal = 0;
        foreach (var itemRequest in request.Items)
        {
            if (!menuItems.TryGetValue(itemRequest.MenuItemId, out var menuItem))
                return Invalid($"Menu item {itemRequest.MenuItemId} is not available.");

            if (itemRequest.Quantity < 1)
                return Invalid("Item quantity must be at least 1.");

            var availableOptions = menuItem.ModifierGroupLinks
                .SelectMany(l => l.ModifierGroup!.Options)
                .ToDictionary(o => o.Id);

            var orderItem = new OrderItem
            {
                MenuItemId = menuItem.Id,
                NameSnapshot = menuItem.Name,
                UnitPriceSnapshot = menuItem.BasePrice,
                Quantity = itemRequest.Quantity,
                SpecialInstructions = itemRequest.SpecialInstructions,
            };

            var lineUnitPrice = menuItem.BasePrice;
            foreach (var optionId in itemRequest.SelectedModifierOptionIds)
            {
                if (!availableOptions.TryGetValue(optionId, out var option) || !option.IsAvailable)
                    return Invalid($"Modifier option {optionId} is not valid for {menuItem.Name}.");

                lineUnitPrice += option.PriceDelta;
                orderItem.Modifiers.Add(new OrderItemModifier
                {
                    ModifierOptionId = option.Id,
                    NameSnapshot = option.Name,
                    PriceDeltaSnapshot = option.PriceDelta,
                });
            }

            orderItem.LineTotal = lineUnitPrice * itemRequest.Quantity;
            subtotal += orderItem.LineTotal;
            order.Items.Add(orderItem);
        }

        order.Subtotal = subtotal;
        order.DeliveryFee = delivery?.Quote!.DeliveryFee ?? 0;
        order.DeliveryZoneName = delivery?.Quote!.ZoneName;

        order.ProcessingFee = restaurant is null
            ? 0
            : Math.Round(restaurant.ProcessingFeeFlat + subtotal * restaurant.ProcessingFeePercentage / 100m, 2);

        if (!string.IsNullOrWhiteSpace(request.VoucherCode))
        {
            var voucher = await db.Vouchers.FirstOrDefaultAsync(v => v.Code == request.VoucherCode && v.IsActive, ct);
            var now = DateTimeOffset.UtcNow;
            var valid = voucher is not null
                && (voucher.ValidFrom is null || voucher.ValidFrom <= now)
                && (voucher.ValidTo is null || voucher.ValidTo >= now)
                && (voucher.MaxRedemptions is null || voucher.TimesRedeemed < voucher.MaxRedemptions)
                && subtotal >= voucher.MinimumOrderAmount;

            if (!valid)
                return Invalid("This voucher code is not valid for this order.");

            order.DiscountAmount = voucher!.DiscountType == VoucherDiscountType.Percentage
                ? Math.Round(subtotal * voucher.DiscountValue / 100m, 2)
                : voucher.DiscountValue;
            order.VoucherId = voucher.Id;
            order.VoucherCodeSnapshot = voucher.Code;
            voucher.TimesRedeemed += 1;
        }

        // Same rule as the reference site: the minimum is on the food, after any voucher discount,
        // not counting delivery or processing fees (loyalty points are a way of paying, so they
        // don't count against it either).
        if (delivery is not null && order.Subtotal - order.DiscountAmount < delivery.Quote!.MinimumOrderAmount)
        {
            var symbol = restaurant?.Currency switch { "EUR" => "€", "USD" => "$", _ => "£" };
            var minimum = delivery.Quote.MinimumOrderAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
            return Invalid($"The minimum order for delivery to {delivery.Postcode} is {symbol}{minimum} of food, after discounts.");
        }

        var loyaltyPointsRedeemed = 0;
        if (request.RedeemLoyaltyPoints && customerId.HasValue)
        {
            var redeemingCustomer = await db.Customers.FirstAsync(c => c.Id == customerId.Value, ct);
            if (redeemingCustomer.LoyaltyPointsBalance > 0)
            {
                var remaining = Math.Max(0, order.Subtotal + order.DeliveryFee + order.ProcessingFee - order.DiscountAmount);
                var maxRedeemableValue = redeemingCustomer.LoyaltyPointsBalance * 0.01m;
                var redeemValue = Math.Min(maxRedeemableValue, remaining);
                loyaltyPointsRedeemed = (int)Math.Floor(redeemValue * 100m);
                if (loyaltyPointsRedeemed > 0)
                {
                    order.DiscountAmount += loyaltyPointsRedeemed * 0.01m;
                    redeemingCustomer.LoyaltyPointsBalance -= loyaltyPointsRedeemed;
                }
            }
        }

        order.TotalAmount = Math.Max(0, order.Subtotal + order.DeliveryFee + order.ProcessingFee - order.DiscountAmount);

        if (restaurant is not null)
            order.LoyaltyPointsEarned = (int)Math.Floor(order.TotalAmount * restaurant.LoyaltyPointsPerCurrencyUnit);

        string orderNumber;
        do
        {
            orderNumber = GenerateOrderCode();
        } while (await db.Orders.AnyAsync(o => o.OrderNumber == orderNumber, ct));
        order.OrderNumber = orderNumber;

        order.StatusHistory.Add(new OrderStatusHistory { Status = defaultOrderStatus, Note = "Order placed." });

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        if (order.CustomerId.HasValue && order.LoyaltyPointsEarned > 0)
        {
            db.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                RestaurantId = restaurantId,
                CustomerId = order.CustomerId.Value,
                OrderId = order.Id,
                PointsDelta = order.LoyaltyPointsEarned,
                Reason = LoyaltyTransactionReason.Earned,
            });
            var customer = await db.Customers.FirstAsync(c => c.Id == order.CustomerId.Value, ct);
            customer.LoyaltyPointsBalance += order.LoyaltyPointsEarned;
            await db.SaveChangesAsync(ct);
        }

        if (loyaltyPointsRedeemed > 0 && order.CustomerId.HasValue)
        {
            db.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                RestaurantId = restaurantId,
                CustomerId = order.CustomerId.Value,
                OrderId = order.Id,
                PointsDelta = -loyaltyPointsRedeemed,
                Reason = LoyaltyTransactionReason.Redeemed,
            });
            await db.SaveChangesAsync(ct);
        }

        await notifier.OrderCreatedAsync(restaurantId, order.Id, ct);

        return new CreatedOrderDto(order.Id, order.OrderNumber, order.Status, order.Subtotal, order.DeliveryFee,
            order.ProcessingFee, order.DiscountAmount, order.TotalAmount, order.LoyaltyPointsEarned, loyaltyPointsRedeemed);
    }

    // Excludes 0/O and 1/I so codes stay unambiguous when read aloud or handwritten on a ticket.
    private const string OrderCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static string GenerateOrderCode()
    {
        Span<byte> bytes = stackalloc byte[5];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        var chars = new char[5];
        for (var i = 0; i < 5; i++) chars[i] = OrderCodeChars[bytes[i] % OrderCodeChars.Length];
        return new string(chars);
    }
}

public record TrackOrderModifierDto(string NameSnapshot, decimal PriceDeltaSnapshot);
public record TrackOrderItemDto(
    string NameSnapshot, int Quantity, decimal LineTotal, string? SpecialInstructions, List<TrackOrderModifierDto> Modifiers);
public record TrackOrderDto(
    Guid Id, string OrderNumber, OrderType OrderType, string Status, string PaymentStatus, PaymentMethod PaymentMethod,
    decimal TotalAmount, DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt, string? SpecialRequests,
    List<TrackOrderItemDto> Items,
    // Planned minutes, shown as "about 20 min after we confirm" until EstimatedReadyAt is set.
    int? EstimatedMinutes);

public record TrackOrderQuery(Guid Id) : IQuery<TrackOrderDto>;

internal sealed class TrackOrderHandler(IAppDbContext db) : IQueryHandler<TrackOrderQuery, TrackOrderDto>
{
    public async Task<Result<TrackOrderDto>> Handle(TrackOrderQuery q, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).FirstOrDefaultAsync(o => o.Id == q.Id, ct);
        if (order is null) return OrderErrors.NotFound;

        return new TrackOrderDto(
            order.Id, order.OrderNumber, order.OrderType, order.Status, order.PaymentStatus, order.PaymentMethod, order.TotalAmount,
            order.EstimatedReadyAt, order.CreatedAt, order.SpecialRequests,
            order.Items.Select(i => new TrackOrderItemDto(
                i.NameSnapshot, i.Quantity, i.LineTotal, i.SpecialInstructions,
                i.Modifiers.Select(m => new TrackOrderModifierDto(m.NameSnapshot, m.PriceDeltaSnapshot)).ToList())).ToList(),
            order.EstimatedMinutes);
    }
}
