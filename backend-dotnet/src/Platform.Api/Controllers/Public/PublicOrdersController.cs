using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

public record CreateOrderItemRequest(Guid MenuItemId, int Quantity, List<Guid> SelectedModifierOptionIds, string? SpecialInstructions);

public record CreateOrderAddressRequest(string Line1, string? Line2, string City, string Postcode);

public record CreatePublicOrderRequest(
    OrderType OrderType, string? TableQrToken, string? CustomerName, string? CustomerPhone, string? CustomerEmail,
    CreateOrderAddressRequest? DeliveryAddress, List<CreateOrderItemRequest> Items, string? SpecialRequests,
    PaymentMethod PaymentMethod, string? VoucherCode, bool RedeemLoyaltyPoints = false);

public record CreatedOrderDto(
    Guid Id, long OrderNumber, OrderStatus Status, decimal Subtotal, decimal DeliveryFee, decimal ProcessingFee,
    decimal DiscountAmount, decimal TotalAmount, int LoyaltyPointsEarned, int LoyaltyPointsRedeemed);

public record TrackOrderItemDto(string NameSnapshot, int Quantity, decimal LineTotal);
public record TrackOrderDto(
    Guid Id, long OrderNumber, OrderType OrderType, OrderStatus Status, PaymentStatus PaymentStatus,
    decimal TotalAmount, DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt, List<TrackOrderItemDto> Items);

/// <summary>Anonymous (guest) or customer-authenticated order placement and tracking, host-resolved tenant.</summary>
[ApiController]
[Route("api/public/orders")]
public class PublicOrdersController(AppDbContext db, ICurrentTenant currentTenant, IOrderNotifier notifier) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CreatedOrderDto>>> Create(CreatePublicOrderRequest request)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Could not resolve a restaurant for this domain.", 400));

        if (request.Items.Count == 0)
            return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Order must contain at least one item.", 400));

        Table? table = null;
        if (request.OrderType == OrderType.DineIn)
        {
            if (string.IsNullOrWhiteSpace(request.TableQrToken))
                return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Dine-in orders require a table QR token.", 400));

            table = await db.Tables.FirstOrDefaultAsync(t => t.QrToken == request.TableQrToken && t.IsActive);
            if (table is null)
                return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Table not found or inactive.", 400));
        }

        if (request.OrderType == OrderType.Delivery && request.DeliveryAddress is null)
            return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Delivery orders require a delivery address.", 400));

        // Never trust client-submitted prices - recompute every line from the current
        // MenuItem/ModifierOption rows, scoped to this tenant by the query filter.
        var menuItemIds = request.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems
            .Where(i => menuItemIds.Contains(i.Id) && i.IsAvailable)
            .Include(i => i.ModifierGroupLinks).ThenInclude(l => l.ModifierGroup!).ThenInclude(g => g.Options)
            .ToDictionaryAsync(i => i.Id);

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
        };

        var customerId = await TryResolveAuthenticatedCustomerAsync();
        if (customerId.HasValue)
        {
            order.CustomerId = customerId;
        }

        if (request.DeliveryAddress is not null)
        {
            var address = new CustomerAddress
            {
                CustomerId = customerId ?? Guid.Empty,
                Line1 = request.DeliveryAddress.Line1,
                Line2 = request.DeliveryAddress.Line2,
                City = request.DeliveryAddress.City,
                Postcode = request.DeliveryAddress.Postcode,
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
                return BadRequest(ApiResponse<CreatedOrderDto>.Fail($"Menu item {itemRequest.MenuItemId} is not available.", 400));

            if (itemRequest.Quantity < 1)
                return BadRequest(ApiResponse<CreatedOrderDto>.Fail("Item quantity must be at least 1.", 400));

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
                    return BadRequest(ApiResponse<CreatedOrderDto>.Fail($"Modifier option {optionId} is not valid for {menuItem.Name}.", 400));

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
        order.DeliveryFee = 0; // TODO: compute from DeliveryZone once postcode-distance lookup exists.

        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId);
        order.ProcessingFee = restaurant is null
            ? 0
            : Math.Round(restaurant.ProcessingFeeFlat + subtotal * restaurant.ProcessingFeePercentage / 100m, 2);

        if (!string.IsNullOrWhiteSpace(request.VoucherCode))
        {
            var voucher = await db.Vouchers.FirstOrDefaultAsync(v => v.Code == request.VoucherCode && v.IsActive);
            var now = DateTimeOffset.UtcNow;
            var valid = voucher is not null
                && (voucher.ValidFrom is null || voucher.ValidFrom <= now)
                && (voucher.ValidTo is null || voucher.ValidTo >= now)
                && (voucher.MaxRedemptions is null || voucher.TimesRedeemed < voucher.MaxRedemptions)
                && subtotal >= voucher.MinimumOrderAmount;

            if (!valid)
                return BadRequest(ApiResponse<CreatedOrderDto>.Fail("This voucher code is not valid for this order.", 400));

            order.DiscountAmount = voucher!.DiscountType == VoucherDiscountType.Percentage
                ? Math.Round(subtotal * voucher.DiscountValue / 100m, 2)
                : voucher.DiscountValue;
            order.VoucherId = voucher.Id;
            order.VoucherCodeSnapshot = voucher.Code;
            voucher.TimesRedeemed += 1;
        }

        var loyaltyPointsRedeemed = 0;
        if (request.RedeemLoyaltyPoints && customerId.HasValue)
        {
            var redeemingCustomer = await db.Customers.FirstAsync(c => c.Id == customerId.Value);
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

        var lastOrderNumber = await db.Orders.OrderByDescending(o => o.OrderNumber).Select(o => o.OrderNumber).FirstOrDefaultAsync();
        order.OrderNumber = lastOrderNumber + 1;

        order.StatusHistory.Add(new OrderStatusHistory { Status = OrderStatus.Pending, Note = "Order placed." });

        db.Orders.Add(order);
        await db.SaveChangesAsync();

        if (order.CustomerId.HasValue && order.LoyaltyPointsEarned > 0)
        {
            db.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                RestaurantId = currentTenant.RestaurantId.Value,
                CustomerId = order.CustomerId.Value,
                OrderId = order.Id,
                PointsDelta = order.LoyaltyPointsEarned,
                Reason = LoyaltyTransactionReason.Earned,
            });
            var customer = await db.Customers.FirstAsync(c => c.Id == order.CustomerId.Value);
            customer.LoyaltyPointsBalance += order.LoyaltyPointsEarned;
            await db.SaveChangesAsync();
        }

        if (loyaltyPointsRedeemed > 0 && order.CustomerId.HasValue)
        {
            db.LoyaltyTransactions.Add(new LoyaltyTransaction
            {
                RestaurantId = currentTenant.RestaurantId.Value,
                CustomerId = order.CustomerId.Value,
                OrderId = order.Id,
                PointsDelta = -loyaltyPointsRedeemed,
                Reason = LoyaltyTransactionReason.Redeemed,
            });
            await db.SaveChangesAsync();
        }

        await notifier.OrderCreatedAsync(currentTenant.RestaurantId.Value, order.Id);

        return Ok(ApiResponse<CreatedOrderDto>.Ok(
            new CreatedOrderDto(order.Id, order.OrderNumber, order.Status, order.Subtotal, order.DeliveryFee,
                order.ProcessingFee, order.DiscountAmount, order.TotalAmount, order.LoyaltyPointsEarned, loyaltyPointsRedeemed),
            statusCode: 201));
    }

    [HttpGet("{id:guid}/track")]
    public async Task<ActionResult<ApiResponse<TrackOrderDto>>> Track(Guid id)
    {
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<TrackOrderDto>.Fail("Order not found.", 404));

        var dto = new TrackOrderDto(
            order.Id, order.OrderNumber, order.OrderType, order.Status, order.PaymentStatus, order.TotalAmount,
            order.EstimatedReadyAt, order.CreatedAt,
            order.Items.Select(i => new TrackOrderItemDto(i.NameSnapshot, i.Quantity, i.LineTotal)).ToList());

        return Ok(ApiResponse<TrackOrderDto>.Ok(dto));
    }

    private async Task<Guid?> TryResolveAuthenticatedCustomerAsync()
    {
        if (User.Identity?.IsAuthenticated != true)
            return null;

        var userIdClaim = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return null;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.IdentityUserId == userId);
        return customer?.Id;
    }
}
