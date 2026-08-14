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
    Guid Id, long OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
    PaymentMethod PaymentMethod, decimal TotalAmount, string? CustomerName, DateTimeOffset CreatedAt);

public record OrderStatusHistoryDto(string Status, string? Note, DateTimeOffset Timestamp);

public record OrderDetailDto(
    Guid Id, long OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
    PaymentMethod PaymentMethod, decimal Subtotal, decimal DeliveryFee, decimal ProcessingFee,
    decimal DiscountAmount, decimal TotalAmount, string? CustomerName, string? CustomerPhone,
    string? CustomerEmail, string? SpecialRequests, DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt,
    List<OrderItemDto> Items, List<OrderStatusHistoryDto> StatusHistory);

public record OrderItemModifierDto(Guid Id, string NameSnapshot, decimal PriceDeltaSnapshot);

public record OrderItemDto(
    Guid Id, string NameSnapshot, decimal UnitPriceSnapshot, int Quantity, string? SpecialInstructions,
    decimal LineTotal, List<OrderItemModifierDto> Modifiers);

public record UpdateOrderStatusRequest(string Status, string? Note);
public record UpdateEstimatedTimeRequest(int EstimatedMinutesFromNow);
public record UpdatePaymentStatusRequest(string PaymentStatus);

public record OrderStatsDto(int TotalOrders, int PendingOrders, int CompletedOrders, decimal TotalRevenue);

[ApiController]
[Route("api/admin/orders")]
// StaffOrDevice, not StaffOnly - paired Sunmi POS terminals need to list, read, and update
// orders the same as the admin dashboard does.
[Authorize(Policy = "StaffOrDevice")]
public class OrdersController(AppDbContext db, ICurrentTenant currentTenant, IOrderNotifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OrderListItemDto>>>> List(
        [FromQuery] string? status, [FromQuery] string? paymentStatus, [FromQuery] PaymentMethod? paymentMethod)
    {
        var query = db.Orders.AsQueryable();
        if (!string.IsNullOrEmpty(status)) query = query.Where(o => o.Status == status);
        if (!string.IsNullOrEmpty(paymentStatus)) query = query.Where(o => o.PaymentStatus == paymentStatus);
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
        var pendingNames = await db.OrderStatusDefinitions.Where(d => d.CountsAsPending).Select(d => d.Name).ToListAsync();
        var completedNames = await db.OrderStatusDefinitions.Where(d => d.CountsAsCompleted).Select(d => d.Name).ToListAsync();

        var totalOrders = await db.Orders.CountAsync();
        var pendingOrders = await db.Orders.CountAsync(o => pendingNames.Contains(o.Status));
        var completedOrders = await db.Orders.CountAsync(o => completedNames.Contains(o.Status));
        var totalRevenue = await db.Orders.Where(o => completedNames.Contains(o.Status)).SumAsync(o => (decimal?)o.TotalAmount) ?? 0;

        return Ok(ApiResponse<OrderStatsDto>.Ok(new OrderStatsDto(totalOrders, pendingOrders, completedOrders, totalRevenue)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> Get(Guid id)
    {
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateStatus(Guid id, UpdateOrderStatusRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
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
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.EstimatedReadyAt = DateTimeOffset.UtcNow.AddMinutes(request.EstimatedMinutesFromNow);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/payment-status")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdatePaymentStatus(Guid id, UpdatePaymentStatusRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
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
        o.Items.Select(i => new OrderItemDto(
            i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.SpecialInstructions, i.LineTotal,
            i.Modifiers.Select(m => new OrderItemModifierDto(m.Id, m.NameSnapshot, m.PriceDeltaSnapshot)).ToList())).ToList(),
        o.StatusHistory.OrderBy(h => h.Timestamp).Select(h => new OrderStatusHistoryDto(h.Status, h.Note, h.Timestamp)).ToList());
}
