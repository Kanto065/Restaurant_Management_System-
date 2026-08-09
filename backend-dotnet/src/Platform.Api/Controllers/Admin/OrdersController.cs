using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record OrderListItemDto(
    Guid Id, long OrderNumber, OrderType OrderType, OrderStatus Status, PaymentStatus PaymentStatus,
    PaymentMethod PaymentMethod, decimal TotalAmount, string? CustomerName, DateTimeOffset CreatedAt);

public record OrderStatusHistoryDto(OrderStatus Status, string? Note, DateTimeOffset Timestamp);

public record OrderDetailDto(
    Guid Id, long OrderNumber, OrderType OrderType, OrderStatus Status, PaymentStatus PaymentStatus,
    PaymentMethod PaymentMethod, decimal Subtotal, decimal DeliveryFee, decimal ProcessingFee,
    decimal DiscountAmount, decimal TotalAmount, string? CustomerName, string? CustomerPhone,
    string? CustomerEmail, string? SpecialRequests, DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt,
    List<OrderItemDto> Items, List<OrderStatusHistoryDto> StatusHistory);

public record OrderItemDto(Guid Id, string NameSnapshot, decimal UnitPriceSnapshot, int Quantity, decimal LineTotal);

public record UpdateOrderStatusRequest(OrderStatus Status, string? Note);
public record UpdateEstimatedTimeRequest(int EstimatedMinutesFromNow);
public record UpdatePaymentStatusRequest(PaymentStatus PaymentStatus);

public record OrderStatsDto(int TotalOrders, int PendingOrders, int CompletedOrders, decimal TotalRevenue);

[ApiController]
[Route("api/admin/orders")]
[Authorize(Policy = "StaffOnly")]
public class OrdersController(AppDbContext db, ICurrentTenant currentTenant, IOrderNotifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OrderListItemDto>>>> List(
        [FromQuery] OrderStatus? status, [FromQuery] PaymentStatus? paymentStatus, [FromQuery] PaymentMethod? paymentMethod)
    {
        var query = db.Orders.AsQueryable();
        if (status.HasValue) query = query.Where(o => o.Status == status.Value);
        if (paymentStatus.HasValue) query = query.Where(o => o.PaymentStatus == paymentStatus.Value);
        if (paymentMethod.HasValue) query = query.Where(o => o.PaymentMethod == paymentMethod.Value);

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.PaymentMethod, o.TotalAmount, o.CustomerName, o.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<OrderListItemDto>>.Ok(orders));
    }

    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<OrderStatsDto>>> Stats()
    {
        var totalOrders = await db.Orders.CountAsync();
        var pendingOrders = await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending || o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Preparing);
        var completedOrders = await db.Orders.CountAsync(o => o.Status == OrderStatus.Completed);
        var totalRevenue = await db.Orders.Where(o => o.Status == OrderStatus.Completed).SumAsync(o => (decimal?)o.TotalAmount) ?? 0;

        return Ok(ApiResponse<OrderStatsDto>.Ok(new OrderStatsDto(totalOrders, pendingOrders, completedOrders, totalRevenue)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> Get(Guid id)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateStatus(Guid id, UpdateOrderStatusRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.Status = request.Status;

        var changedByUserId = Guid.TryParse(
            User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub), out var userId)
            ? userId
            : (Guid?)null;

        var historyEntry = new OrderStatusHistory
        {
            RestaurantId = order.RestaurantId,
            OrderId = order.Id,
            Status = request.Status,
            ChangedByUserId = changedByUserId,
            Note = request.Note,
        };
        db.OrderStatusHistories.Add(historyEntry);
        order.StatusHistory.Add(historyEntry);

        await db.SaveChangesAsync();
        await notifier.OrderStatusChangedAsync(currentTenant.RestaurantId!.Value, order.Id, order.Status);

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/estimated-time")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> SetEstimatedTime(Guid id, UpdateEstimatedTimeRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.EstimatedReadyAt = DateTimeOffset.UtcNow.AddMinutes(request.EstimatedMinutesFromNow);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/payment-status")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdatePaymentStatus(Guid id, UpdatePaymentStatusRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.PaymentStatus = request.PaymentStatus;
        await db.SaveChangesAsync();
        await notifier.PaymentReceivedAsync(currentTenant.RestaurantId!.Value, order.Id);

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    private static OrderDetailDto ToDetailDto(Order o) => new(
        o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.PaymentMethod, o.Subtotal, o.DeliveryFee,
        o.ProcessingFee, o.DiscountAmount, o.TotalAmount, o.CustomerName, o.CustomerPhone, o.CustomerEmail,
        o.SpecialRequests, o.EstimatedReadyAt, o.CreatedAt,
        o.Items.Select(i => new OrderItemDto(i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.LineTotal)).ToList(),
        o.StatusHistory.OrderBy(h => h.Timestamp).Select(h => new OrderStatusHistoryDto(h.Status, h.Note, h.Timestamp)).ToList());
}
