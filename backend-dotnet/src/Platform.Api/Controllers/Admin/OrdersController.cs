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
    decimal TotalAmount, string? CustomerName, DateTimeOffset CreatedAt);

public record OrderDetailDto(
    Guid Id, long OrderNumber, OrderType OrderType, OrderStatus Status, PaymentStatus PaymentStatus,
    decimal Subtotal, decimal DeliveryFee, decimal DiscountAmount, decimal TotalAmount,
    string? CustomerName, string? CustomerPhone, string? CustomerEmail, string? SpecialRequests,
    DateTimeOffset? EstimatedReadyAt, DateTimeOffset CreatedAt,
    List<OrderItemDto> Items);

public record OrderItemDto(Guid Id, string NameSnapshot, decimal UnitPriceSnapshot, int Quantity, decimal LineTotal);

public record UpdateOrderStatusRequest(OrderStatus Status, string? Note);

[ApiController]
[Route("api/admin/orders")]
[Authorize(Policy = "StaffOnly")]
public class OrdersController(AppDbContext db, ICurrentTenant currentTenant, IOrderNotifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OrderListItemDto>>>> List([FromQuery] OrderStatus? status)
    {
        var query = db.Orders.AsQueryable();
        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.TotalAmount, o.CustomerName, o.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<OrderListItemDto>>.Ok(orders));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> Get(Guid id)
    {
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateStatus(Guid id, UpdateOrderStatusRequest request)
    {
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<OrderDetailDto>.Fail("Order not found.", 404));

        order.Status = request.Status;

        var changedByUserId = Guid.TryParse(
            User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub), out var userId)
            ? userId
            : (Guid?)null;

        db.OrderStatusHistories.Add(new OrderStatusHistory
        {
            RestaurantId = order.RestaurantId,
            OrderId = order.Id,
            Status = request.Status,
            ChangedByUserId = changedByUserId,
            Note = request.Note,
        });

        await db.SaveChangesAsync();
        await notifier.OrderStatusChangedAsync(currentTenant.RestaurantId!.Value, order.Id, order.Status);

        return Ok(ApiResponse<OrderDetailDto>.Ok(ToDetailDto(order)));
    }

    private static OrderDetailDto ToDetailDto(Order o) => new(
        o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.Subtotal, o.DeliveryFee, o.DiscountAmount,
        o.TotalAmount, o.CustomerName, o.CustomerPhone, o.CustomerEmail, o.SpecialRequests, o.EstimatedReadyAt,
        o.CreatedAt, o.Items.Select(i => new OrderItemDto(i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.LineTotal)).ToList());
}
