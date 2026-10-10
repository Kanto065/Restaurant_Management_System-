using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;

namespace Platform.Application.Orders;

public record OrderListItemDto(
    Guid Id, string OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
    PaymentMethod PaymentMethod, decimal TotalAmount, string? CustomerName, DateTimeOffset CreatedAt, int ItemCount,
    DateTimeOffset? EstimatedReadyAt, int? EstimatedMinutes);

public record OrderStatusHistoryDto(string Status, string? Note, DateTimeOffset Timestamp);

public record OrderDeliveryAddressDto(string Line1, string? Line2, string City, string Postcode);

public record OrderDetailDto(
    Guid Id, string OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
    PaymentMethod PaymentMethod, decimal Subtotal, decimal DeliveryFee, decimal ProcessingFee,
    decimal DiscountAmount, decimal TotalAmount, string? CustomerName, string? CustomerPhone,
    string? CustomerEmail, string? SpecialRequests, OrderDeliveryAddressDto? DeliveryAddress,
    DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt,
    List<OrderItemDto> Items, List<OrderStatusHistoryDto> StatusHistory,
    int? EstimatedMinutes,
    // Which delivery zone priced it ("Hafod", or "Anywhere else"); null for non-delivery/older orders.
    string? DeliveryZoneName);

public record OrderItemModifierDto(Guid Id, string NameSnapshot, decimal PriceDeltaSnapshot);

public record OrderItemDto(
    Guid Id, string NameSnapshot, decimal UnitPriceSnapshot, int Quantity, string? SpecialInstructions,
    decimal LineTotal, List<OrderItemModifierDto> Modifiers);

public record OrderStatsDto(int TotalOrders, int PendingOrders, int CompletedOrders, decimal TotalRevenue);
public record OrderListPageDto(List<OrderListItemDto> Items, int TotalCount);

internal static class OrderMapping
{
    public static IQueryable<Order> WithDetails(this IQueryable<Order> orders) => orders
        .Include(o => o.Items).ThenInclude(i => i.Modifiers)
        .Include(o => o.StatusHistory)
        .Include(o => o.DeliveryAddress);

    public static OrderDetailDto ToDetailDto(this Order o) => new(
        o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.PaymentMethod, o.Subtotal, o.DeliveryFee,
        o.ProcessingFee, o.DiscountAmount, o.TotalAmount, o.CustomerName, o.CustomerPhone, o.CustomerEmail,
        o.SpecialRequests,
        o.DeliveryAddress is null ? null : new OrderDeliveryAddressDto(o.DeliveryAddress.Line1, o.DeliveryAddress.Line2, o.DeliveryAddress.City, o.DeliveryAddress.Postcode),
        o.EstimatedReadyAt, o.CreatedAt,
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.SpecialInstructions, i.LineTotal,
            i.Modifiers.Select(m => new OrderItemModifierDto(m.Id, m.NameSnapshot, m.PriceDeltaSnapshot)).ToList())).ToList(),
        o.StatusHistory.OrderBy(h => h.Timestamp).Select(h => new OrderStatusHistoryDto(h.Status, h.Note, h.Timestamp)).ToList(),
        o.EstimatedMinutes,
        o.DeliveryZoneName);
}

internal static class OrderErrors
{
    public static readonly Error NotFound = Error.NotFound("Order.NotFound", "Order not found.");
}
