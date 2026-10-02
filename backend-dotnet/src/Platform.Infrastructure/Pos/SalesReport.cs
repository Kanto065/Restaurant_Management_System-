using Microsoft.EntityFrameworkCore;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

public record ReportLine(string Name, int Count, decimal Amount);

public record SalesReportDto(
    DateOnly From, DateOnly To, int OrderCount, decimal GrossSales, decimal Discounts, decimal Sales,
    decimal Refunds, decimal Net, List<ReportLine> ByPaymentMethod, List<ReportLine> BySource,
    List<ReportLine> ByCategory, List<ReportLine> ByItem, List<ReportLine> RefundsByMethod);

public static class SalesReport
{
    /// <summary>
    /// Completed orders (web and POS) closed in [from, to] restaurant-local days. GrossSales is
    /// before discounts, Sales after; Refunds (by the day they were given) are subtracted for Net.
    /// Void lines are worth 0 so they drop out. A POS order counts each payment (split bills);
    /// a web order counts its PaymentMethod.
    /// </summary>
    public static SalesReportDto Calculate(DateOnly from, DateOnly to, IReadOnlyList<Order> orders,
        IReadOnlyList<Refund> refunds, IReadOnlyDictionary<Guid, string> categoryByMenuItem)
    {
        var lines = orders.SelectMany(o => o.Items).Where(i => i.ItemStatus != OrderItemStatus.Void).ToList();
        var payments = orders.SelectMany(o => o.Source == OrderSource.Pos
            ? o.Payments.Select(p => (Method: p.Provider.ToString(), p.Amount))
            : [(Method: o.PaymentMethod.ToString(), Amount: o.TotalAmount)]);

        var sales = orders.Sum(o => o.TotalAmount);
        var refunded = refunds.Sum(r => r.Amount);
        return new SalesReportDto(
            from, to, orders.Count,
            GrossSales: orders.Sum(o => o.Subtotal),
            Discounts: orders.Sum(o => o.DiscountAmount),
            Sales: sales,
            Refunds: refunded,
            Net: sales - refunded,
            ByPaymentMethod: Group(payments, p => p.Method, p => 1, p => p.Amount),
            BySource: Group(orders, o => o.Source.ToString(), _ => 1, o => o.TotalAmount),
            ByCategory: Group(lines, i => categoryByMenuItem.GetValueOrDefault(i.MenuItemId, "Other"), i => i.Quantity, i => i.LineTotal),
            ByItem: Group(lines, i => i.NameSnapshot, i => i.Quantity, i => i.LineTotal),
            RefundsByMethod: Group(refunds, r => r.Method.ToString(), _ => 1, r => r.Amount));
    }

    /// <summary>Loads the report for local days [from, to] in the restaurant's time zone.
    /// ponytail: loads the period's orders into memory; fine for one restaurant's range, move the
    /// grouping into SQL if ranges get to tens of thousands of orders.</summary>
    public static async Task<SalesReportDto> LoadAsync(AppDbContext db, Guid restaurantId, DateOnly from, DateOnly to,
        CancellationToken ct = default)
    {
        var tzId = await db.Restaurants.Where(r => r.Id == restaurantId).Select(r => r.TimeZone).FirstAsync(ct);
        var tz = TimeZoneInfo.FindSystemTimeZoneById(tzId);
        var start = LocalMidnightUtc(from, tz);
        var end = LocalMidnightUtc(to.AddDays(1), tz);

        var completed = await db.OrderStatusDefinitions.Where(d => d.CountsAsCompleted).Select(d => d.Name).ToListAsync(ct);
        var orders = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Payments)
            .Where(o => completed.Contains(o.Status) && (o.ClosedAt ?? o.CreatedAt) >= start && (o.ClosedAt ?? o.CreatedAt) < end)
            .ToListAsync(ct);
        var refunds = await db.Refunds.AsNoTracking().Where(r => r.CreatedAt >= start && r.CreatedAt < end).ToListAsync(ct);

        var itemIds = orders.SelectMany(o => o.Items).Select(i => i.MenuItemId).Distinct().ToList();
        var categories = await db.MenuItems.IgnoreQueryFilters()
            .Where(i => i.RestaurantId == restaurantId && itemIds.Contains(i.Id))
            .Select(i => new { i.Id, i.Category!.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        return Calculate(from, to, orders, refunds, categories);
    }

    private static DateTimeOffset LocalMidnightUtc(DateOnly day, TimeZoneInfo tz)
    {
        var local = day.ToDateTime(TimeOnly.MinValue);
        return new DateTimeOffset(local, tz.GetUtcOffset(local)).ToUniversalTime();
    }

    private static List<ReportLine> Group<T>(IEnumerable<T> rows, Func<T, string> key, Func<T, int> count, Func<T, decimal> amount) =>
        rows.GroupBy(key)
            .Select(g => new ReportLine(g.Key, g.Sum(count), g.Sum(amount)))
            .OrderByDescending(l => l.Amount)
            .ToList();
}
