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
    Guid Id, string OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
    PaymentMethod PaymentMethod, decimal TotalAmount, string? CustomerName, DateTimeOffset CreatedAt);

public record OrderStatusHistoryDto(string Status, string? Note, DateTimeOffset Timestamp);

public record OrderDetailDto(
    Guid Id, string OrderNumber, OrderType OrderType, string Status, string PaymentStatus,
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
public record UpdateOrderDetailsRequest(string? CustomerName, string? CustomerPhone, string? CustomerEmail, string? SpecialRequests);

public record OrderStatsDto(int TotalOrders, int PendingOrders, int CompletedOrders, decimal TotalRevenue);
public record OrderListPageDto(List<OrderListItemDto> Items, int TotalCount);

[ApiController]
[Route("api/admin/orders")]
// StaffOrDevice, not StaffOnly - paired Sunmi POS terminals need to list, read, and update
// orders the same as the admin dashboard does.
[Authorize(Policy = "StaffOrDevice")]
public class OrdersController(AppDbContext db, ICurrentTenant currentTenant, IOrderNotifier notifier, ICurrentActor currentActor) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<OrderListPageDto>>> List(
        [FromQuery] string? status, [FromQuery] string? paymentStatus, [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] string? search, [FromQuery] DateOnly? dateFrom, [FromQuery] DateOnly? dateTo,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Orders.AsQueryable();
        if (!string.IsNullOrEmpty(status)) query = query.Where(o => o.Status == status);
        if (!string.IsNullOrEmpty(paymentStatus)) query = query.Where(o => o.PaymentStatus == paymentStatus);
        if (paymentMethod.HasValue) query = query.Where(o => o.PaymentMethod == paymentMethod.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(o => o.OrderNumber.ToLower().Contains(term) || (o.CustomerName != null && o.CustomerName.ToLower().Contains(term)));
        }
        if (dateFrom.HasValue) query = query.Where(o => o.CreatedAt >= new DateTimeOffset(dateFrom.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (dateTo.HasValue) query = query.Where(o => o.CreatedAt < new DateTimeOffset(dateTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));

        var totalCount = await query.CountAsync();
        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.PaymentMethod, o.TotalAmount, o.CustomerName, o.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<OrderListPageDto>.Ok(new OrderListPageDto(orders, totalCount)));
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

        var historyEntry = new OrderStatusHistory
        {
            RestaurantId = order.RestaurantId,
            OrderId = order.Id,
            Status = request.Status,
            ChangedByUserId = currentActor.ActorId,
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

    /// <summary>Only the contact/note fields are editable after placement - items, pricing, and
    /// loyalty/voucher effects are locked in at checkout and shouldn't be hand-edited afterward.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateDetails(Guid id, UpdateOrderDetailsRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).ThenInclude(i => i.Modifiers).Include(o => o.StatusHistory).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.CustomerName = request.CustomerName;
        order.CustomerPhone = request.CustomerPhone;
        order.CustomerEmail = request.CustomerEmail;
        order.SpecialRequests = request.SpecialRequests;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<object>.Fail("Order not found.", 404));

        order.IsDeleted = true;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Order deleted."));
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
