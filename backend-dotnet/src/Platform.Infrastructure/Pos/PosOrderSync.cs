using Microsoft.EntityFrameworkCore;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

public record SyncModifier(Guid ModifierOptionId, string Name, decimal PriceDelta);

public record SyncItem(Guid MenuItemId, string Name, decimal UnitPrice, int Quantity, string? Notes,
    OrderItemStatus ItemStatus, DateTimeOffset? SentAt, string? VoidReason, List<SyncModifier>? Modifiers);

public record SyncPayment(PaymentProvider Provider, decimal Amount);

/// <summary>A closed order from the hub. TotalAmount is what the hub charged; the server
/// recomputes it and rejects the record if they differ.</summary>
public record SyncOrder(Guid ClientId, string OrderNumber, OrderType OrderType, Guid? TableId, int? GuestCount,
    Guid? WaiterUserId, string? CustomerName, string? CustomerPhone, string? SpecialRequests, List<SyncItem> Items,
    decimal DiscountAmount, string? DiscountReason, Guid? DiscountApprovedByUserId, decimal TotalAmount,
    PaymentMethod PaymentMethod, List<SyncPayment> Payments, string Status, string PaymentStatus,
    DateTimeOffset ClosedAt);

public record SyncRefund(Guid ClientId, Guid OrderClientId, decimal Amount, RefundMethod Method, string? Reason,
    string? ItemsJson, Guid? RefundedByUserId, Guid? ApprovedByUserId);

public record PosSyncRequest(List<SyncOrder>? Orders, List<SyncRefund>? Refunds);

public record SyncResult(string Kind, Guid ClientId, bool Ok, Guid? Id, string? Error = null, string? ErrorCode = null);

public static class RefundRules
{
    /// <summary>Error message, or null when the refund fits: positive and never more than paid.</summary>
    public static string? Check(decimal paid, decimal alreadyRefunded, decimal amount) =>
        amount <= 0 ? "Refund amount must be more than zero."
        : alreadyRefunded + amount > paid ? $"Refunds can't exceed the {paid:0.00} paid ({alreadyRefunded:0.00} already refunded)."
        : null;
}

/// <summary>
/// Idempotent upsert of hub orders and refunds keyed by ClientId: a repeat returns the stored
/// row, never a duplicate. Each record is validated and saved on its own, so one bad record is
/// reported back without blocking the rest. Synced orders never raise SSE events and must be in
/// a completed status, so the Sunmi terminal and the admin "active orders" list never see them
/// as new work.
/// </summary>
public class PosOrderSync(AppDbContext db)
{
    public async Task<List<SyncResult>> SyncAsync(Guid restaurantId, PosSyncRequest request,
        IReadOnlyDictionary<string, bool> features, CancellationToken ct = default)
    {
        var completed = await db.OrderStatusDefinitions.Where(d => d.CountsAsCompleted).Select(d => d.Name).ToListAsync(ct);
        var paymentStatuses = await db.PaymentStatusDefinitions.Select(d => d.Name).ToListAsync(ct);
        var results = new List<SyncResult>();

        foreach (var o in request.Orders ?? [])
            results.Add(await SyncOrderAsync(restaurantId, o, completed, paymentStatuses, features, ct));
        foreach (var r in request.Refunds ?? [])
            results.Add(await SyncRefundAsync(restaurantId, r, features, ct));
        return results;
    }

    private async Task<SyncResult> SyncOrderAsync(Guid restaurantId, SyncOrder o, List<string> completed,
        List<string> paymentStatuses, IReadOnlyDictionary<string, bool> features, CancellationToken ct)
    {
        SyncResult Fail(string error, string? code = null) => new("order", o.ClientId, false, null, error, code ?? "VALIDATION");

        var existingId = await db.Orders.Where(x => x.ClientId == o.ClientId).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (existingId is not null)
            return new("order", o.ClientId, true, existingId);

        if (o.ClientId == Guid.Empty || string.IsNullOrWhiteSpace(o.OrderNumber))
            return Fail("ClientId and OrderNumber are required.");
        if (!completed.Contains(o.Status))
            return Fail($"Only completed orders are synced; '{o.Status}' isn't a completed status.");
        if (!paymentStatuses.Contains(o.PaymentStatus))
            return Fail($"Unknown payment status '{o.PaymentStatus}'.");
        if (o.Items is not { Count: > 0 } || o.Items.Any(i => i.Quantity < 1 || i.UnitPrice < 0))
            return Fail("An order needs items with quantity 1+ and no negative prices.");
        if (o.Payments is null || o.Payments.Any(p => p.Provider is not (PaymentProvider.Cash or PaymentProvider.Card) || p.Amount < 0))
            return Fail("Payments must be Cash or Card with no negative amounts.");
        if (o.DiscountAmount > 0 && !features.GetValueOrDefault(FeatureKeys.PosDiscounts))
            return Fail("Discounts aren't enabled for this restaurant.", "FEATURE_DISABLED");
        if (await db.Orders.AnyAsync(x => x.OrderNumber == o.OrderNumber, ct))
            return Fail($"Order number {o.OrderNumber} is already used.");

        var order = new Order
        {
            RestaurantId = restaurantId,
            ClientId = o.ClientId,
            OrderNumber = o.OrderNumber.Trim(),
            OrderType = o.OrderType,
            TableId = o.TableId,
            GuestCount = o.GuestCount,
            WaiterUserId = o.WaiterUserId,
            CustomerName = o.CustomerName,
            CustomerPhone = o.CustomerPhone,
            SpecialRequests = o.SpecialRequests,
            DiscountAmount = o.DiscountAmount,
            DiscountReason = o.DiscountReason,
            DiscountApprovedByUserId = o.DiscountApprovedByUserId,
            PaymentMethod = o.PaymentMethod,
            Status = o.Status,
            PaymentStatus = o.PaymentStatus,
            ClosedAt = o.ClosedAt,
            Source = OrderSource.Pos,
        };
        foreach (var i in o.Items)
        {
            var mods = i.Modifiers ?? [];
            order.Items.Add(new OrderItem
            {
                RestaurantId = restaurantId,
                MenuItemId = i.MenuItemId,
                NameSnapshot = i.Name,
                UnitPriceSnapshot = i.UnitPrice,
                Quantity = i.Quantity,
                SpecialInstructions = i.Notes,
                ItemStatus = i.ItemStatus,
                SentAt = i.SentAt,
                VoidReason = i.VoidReason,
                // Void lines stay on the record but are worth nothing.
                LineTotal = i.ItemStatus == OrderItemStatus.Void ? 0 : (i.UnitPrice + mods.Sum(m => m.PriceDelta)) * i.Quantity,
                Modifiers = mods.Select(m => new OrderItemModifier
                {
                    RestaurantId = restaurantId, ModifierOptionId = m.ModifierOptionId,
                    NameSnapshot = m.Name, PriceDeltaSnapshot = m.PriceDelta,
                }).ToList(),
            });
        }
        order.Subtotal = order.Items.Sum(i => i.LineTotal);
        order.TotalAmount = order.Subtotal - order.DiscountAmount;

        if (o.DiscountAmount < 0 || o.DiscountAmount > order.Subtotal)
            return Fail("The discount must be between zero and the subtotal.");
        if (Math.Abs(order.TotalAmount - o.TotalAmount) > 0.005m)
            return Fail($"Total mismatch: the items add up to {order.TotalAmount:0.00}, the POS sent {o.TotalAmount:0.00}.");
        if (Math.Abs(o.Payments.Sum(p => p.Amount) - order.TotalAmount) > 0.005m)
            return Fail("Payments must add up to the order total.");

        foreach (var p in o.Payments)
            order.Payments.Add(new Payment
            {
                RestaurantId = restaurantId, Provider = p.Provider, Amount = p.Amount, Status = o.PaymentStatus,
            });
        order.StatusHistory.Add(new OrderStatusHistory
        {
            RestaurantId = restaurantId, Status = o.Status, Note = "Synced from the POS.", Timestamp = o.ClosedAt,
        });

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        return new("order", o.ClientId, true, order.Id);
    }

    private async Task<SyncResult> SyncRefundAsync(Guid restaurantId, SyncRefund r, IReadOnlyDictionary<string, bool> features,
        CancellationToken ct)
    {
        SyncResult Fail(string error, string? code = null) => new("refund", r.ClientId, false, null, error, code ?? "VALIDATION");

        var existingId = await db.Refunds.Where(x => x.ClientId == r.ClientId).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (existingId is not null)
            return new("refund", r.ClientId, true, existingId);
        if (!features.GetValueOrDefault(FeatureKeys.PosRefunds))
            return Fail("Refunds aren't enabled for this restaurant.", "FEATURE_DISABLED");

        var order = await db.Orders.Where(x => x.ClientId == r.OrderClientId)
            .Select(x => new { x.Id, Paid = x.Payments.Sum(p => p.Amount), Refunded = x.Refunds.Sum(f => f.Amount) })
            .FirstOrDefaultAsync(ct);
        if (order is null)
            return Fail("The refunded order hasn't been synced.", "ORDER_NOT_FOUND");
        if (RefundRules.Check(order.Paid, order.Refunded, r.Amount) is { } error)
            return Fail(error);

        var refund = new Refund
        {
            RestaurantId = restaurantId, OrderId = order.Id, ClientId = r.ClientId, Amount = r.Amount, Method = r.Method,
            Reason = r.Reason, ItemsJson = r.ItemsJson, RefundedByUserId = r.RefundedByUserId, ApprovedByUserId = r.ApprovedByUserId,
        };
        db.Refunds.Add(refund);
        await db.SaveChangesAsync(ct);
        return new("refund", r.ClientId, true, refund.Id);
    }
}
