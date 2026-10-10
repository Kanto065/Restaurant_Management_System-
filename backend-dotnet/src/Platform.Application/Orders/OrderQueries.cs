using Microsoft.EntityFrameworkCore;
using Platform.Application.Abstractions;
using Platform.Application.Common;
using Platform.Domain.Enums;

namespace Platform.Application.Orders;

public record ListOrdersQuery(
    string? Status, string? PaymentStatus, PaymentMethod? PaymentMethod, string? Search,
    DateOnly? DateFrom, DateOnly? DateTo, bool? HistoryOnly, int Page, int PageSize) : IQuery<OrderListPageDto>;

internal sealed class ListOrdersHandler(IAppDbContext db) : IQueryHandler<ListOrdersQuery, OrderListPageDto>
{
    public async Task<Result<OrderListPageDto>> Handle(ListOrdersQuery q, CancellationToken ct)
    {
        var page = Math.Max(q.Page, 1);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        var query = db.Orders.AsQueryable();
        if (!string.IsNullOrEmpty(q.Status)) query = query.Where(o => o.Status == q.Status);
        if (!string.IsNullOrEmpty(q.PaymentStatus)) query = query.Where(o => o.PaymentStatus == q.PaymentStatus);
        if (q.PaymentMethod.HasValue) query = query.Where(o => o.PaymentMethod == q.PaymentMethod.Value);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim().ToLower();
            query = query.Where(o => o.OrderNumber.ToLower().Contains(term) || (o.CustomerName != null && o.CustomerName.ToLower().Contains(term)));
        }
        if (q.DateFrom.HasValue) query = query.Where(o => o.CreatedAt >= new DateTimeOffset(q.DateFrom.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (q.DateTo.HasValue) query = query.Where(o => o.CreatedAt < new DateTimeOffset(q.DateTo.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));

        // HistoryOnly splits orders between the "New Orders" (active/in-progress) and "Order
        // History" (Cancelled or CountsAsCompleted) POS tabs - see OrderStatusDefinition.
        if (q.HistoryOnly.HasValue)
        {
            var terminalNames = await db.OrderStatusDefinitions.Where(d => d.CountsAsCompleted).Select(d => d.Name).ToListAsync(ct);
            if (!terminalNames.Contains("Cancelled")) terminalNames.Add("Cancelled");
            query = q.HistoryOnly.Value ? query.Where(o => terminalNames.Contains(o.Status)) : query.Where(o => !terminalNames.Contains(o.Status));
        }

        var totalCount = await query.CountAsync(ct);
        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentStatus, o.PaymentMethod, o.TotalAmount, o.CustomerName, o.CreatedAt, o.Items.Count,
                o.EstimatedReadyAt, o.EstimatedMinutes))
            .ToListAsync(ct);

        return new OrderListPageDto(orders, totalCount);
    }
}

public record GetOrderStatsQuery : IQuery<OrderStatsDto>;

internal sealed class GetOrderStatsHandler(IAppDbContext db) : IQueryHandler<GetOrderStatsQuery, OrderStatsDto>
{
    public async Task<Result<OrderStatsDto>> Handle(GetOrderStatsQuery q, CancellationToken ct)
    {
        var pendingNames = await db.OrderStatusDefinitions.Where(d => d.CountsAsPending).Select(d => d.Name).ToListAsync(ct);
        var completedNames = await db.OrderStatusDefinitions.Where(d => d.CountsAsCompleted).Select(d => d.Name).ToListAsync(ct);

        var totalOrders = await db.Orders.CountAsync(ct);
        var pendingOrders = await db.Orders.CountAsync(o => pendingNames.Contains(o.Status), ct);
        var completedOrders = await db.Orders.CountAsync(o => completedNames.Contains(o.Status), ct);
        var totalRevenue = await db.Orders.Where(o => completedNames.Contains(o.Status)).SumAsync(o => (decimal?)o.TotalAmount, ct) ?? 0;

        return new OrderStatsDto(totalOrders, pendingOrders, completedOrders, totalRevenue);
    }
}

public record GetOrderQuery(Guid Id) : IQuery<OrderDetailDto>;

internal sealed class GetOrderHandler(IAppDbContext db) : IQueryHandler<GetOrderQuery, OrderDetailDto>
{
    public async Task<Result<OrderDetailDto>> Handle(GetOrderQuery q, CancellationToken ct)
    {
        var order = await db.Orders.WithDetails().FirstOrDefaultAsync(o => o.Id == q.Id, ct);
        return order is null ? OrderErrors.NotFound : order.ToDetailDto();
    }
}
