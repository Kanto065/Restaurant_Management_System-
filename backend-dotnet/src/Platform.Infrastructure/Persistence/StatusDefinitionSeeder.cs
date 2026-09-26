using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Domain.Entities;

namespace Platform.Infrastructure.Persistence;

/// <summary>
/// Ensures every restaurant has its built-in OrderStatusDefinition/PaymentStatusDefinition
/// rows. Runs on every boot (idempotent - only inserts for restaurants that have none yet),
/// so it covers restaurants that existed before this feature shipped and any created since.
/// </summary>
public static class StatusDefinitionSeeder
{
    private static readonly (string Name, bool Pending, bool Completed, bool Default)[] OrderStatuses =
    [
        ("Pending", true, false, true),
        ("Confirmed", true, false, false),
        ("Preparing", true, false, false),
        ("Ready", true, false, false),
        ("OutForDeliveryOrServed", false, false, false),
        ("Completed", false, true, false),
        ("Cancelled", false, false, false),
    ];

    private static readonly (string Name, bool Default)[] PaymentStatuses =
    [
        ("Pending", true),
        ("Authorized", false),
        ("Paid", false),
        ("Failed", false),
        ("Refunded", false),
        ("PartiallyRefunded", false),
    ];

    public static async Task EnsureDefaultsAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var restaurantIds = await db.Restaurants.IgnoreQueryFilters().Select(r => r.Id).ToListAsync();
        var restaurantsWithOrderStatuses = await db.OrderStatusDefinitions.IgnoreQueryFilters()
            .Select(d => d.RestaurantId).Distinct().ToListAsync();
        var restaurantsWithPaymentStatuses = await db.PaymentStatusDefinitions.IgnoreQueryFilters()
            .Select(d => d.RestaurantId).Distinct().ToListAsync();

        foreach (var restaurantId in restaurantIds)
        {
            if (!restaurantsWithOrderStatuses.Contains(restaurantId))
            {
                for (var i = 0; i < OrderStatuses.Length; i++)
                {
                    var (name, pending, completed, isDefault) = OrderStatuses[i];
                    db.OrderStatusDefinitions.Add(new OrderStatusDefinition
                    {
                        RestaurantId = restaurantId, Name = name, DisplayOrder = i,
                        CountsAsPending = pending, CountsAsCompleted = completed, IsDefault = isDefault,
                    });
                }
            }

            if (!restaurantsWithPaymentStatuses.Contains(restaurantId))
            {
                for (var i = 0; i < PaymentStatuses.Length; i++)
                {
                    var (name, isDefault) = PaymentStatuses[i];
                    db.PaymentStatusDefinitions.Add(new PaymentStatusDefinition
                    {
                        RestaurantId = restaurantId, Name = name, DisplayOrder = i, IsDefault = isDefault,
                    });
                }
            }
        }

        await db.SaveChangesAsync();
    }

    public record ResetSummary(int OrdersRemapped, int PaymentsRemapped, List<string> RemovedOrderStatuses, List<string> RemovedPaymentStatuses);

    /// <summary>
    /// Puts one restaurant back on the standard order + payment status lists (the same ones every
    /// new restaurant gets): restores/creates the standard statuses with their standard order and
    /// flags, moves orders on any custom status to the nearest standard one (anything
    /// "completed" -> Completed, "cancelled" -> Cancelled, otherwise Pending), then removes the
    /// custom statuses. Order history keeps its original entries.
    /// </summary>
    public static async Task<ResetSummary> ResetToStandardAsync(AppDbContext db, Guid restaurantId, CancellationToken ct = default)
    {
        // All-or-nothing: the order remaps below run as direct UPDATEs, outside SaveChanges.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        // Order statuses
        var orderDefs = await db.OrderStatusDefinitions.IgnoreQueryFilters()
            .Where(d => d.RestaurantId == restaurantId).ToListAsync(ct);
        var standardOrderNames = OrderStatuses.Select(s => s.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        string MapOrderStatus(OrderStatusDefinition custom) =>
            custom.CountsAsCompleted || custom.Name.Contains("complet", StringComparison.OrdinalIgnoreCase) ? "Completed"
            : custom.Name.Contains("cancel", StringComparison.OrdinalIgnoreCase) ? "Cancelled"
            : "Pending";

        var removedOrder = new List<string>();
        var ordersRemapped = 0;
        foreach (var custom in orderDefs.Where(d => !standardOrderNames.Contains(d.Name.Trim())))
        {
            var target = MapOrderStatus(custom);
            ordersRemapped += await db.Orders.IgnoreQueryFilters()
                .Where(o => o.RestaurantId == restaurantId && o.Status == custom.Name)
                .ExecuteUpdateAsync(u => u.SetProperty(o => o.Status, target), ct);
            if (!custom.IsDeleted) removedOrder.Add(custom.Name.Trim());
            db.OrderStatusDefinitions.Remove(custom);
        }

        for (var i = 0; i < OrderStatuses.Length; i++)
        {
            var (name, pending, completed, isDefault) = OrderStatuses[i];
            var def = orderDefs.FirstOrDefault(d => string.Equals(d.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
            if (def is null)
            {
                db.OrderStatusDefinitions.Add(new OrderStatusDefinition { RestaurantId = restaurantId, Name = name });
                def = db.OrderStatusDefinitions.Local.Last(d => d.RestaurantId == restaurantId && d.Name == name);
            }
            def.Name = name;
            def.DisplayOrder = i;
            def.CountsAsPending = pending;
            def.CountsAsCompleted = completed;
            def.IsDefault = isDefault;
            def.IsDeleted = false;
        }

        // Payment statuses
        var paymentDefs = await db.PaymentStatusDefinitions.IgnoreQueryFilters()
            .Where(d => d.RestaurantId == restaurantId).ToListAsync(ct);
        var standardPaymentNames = PaymentStatuses.Select(s => s.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var removedPayment = new List<string>();
        var paymentsRemapped = 0;
        foreach (var custom in paymentDefs.Where(d => !standardPaymentNames.Contains(d.Name.Trim())))
        {
            var target = custom.Name.Contains("paid", StringComparison.OrdinalIgnoreCase) ? "Paid"
                : custom.Name.Contains("refund", StringComparison.OrdinalIgnoreCase) ? "Refunded"
                : "Pending";
            paymentsRemapped += await db.Orders.IgnoreQueryFilters()
                .Where(o => o.RestaurantId == restaurantId && o.PaymentStatus == custom.Name)
                .ExecuteUpdateAsync(u => u.SetProperty(o => o.PaymentStatus, target), ct);
            if (!custom.IsDeleted) removedPayment.Add(custom.Name.Trim());
            db.PaymentStatusDefinitions.Remove(custom);
        }

        for (var i = 0; i < PaymentStatuses.Length; i++)
        {
            var (name, isDefault) = PaymentStatuses[i];
            var def = paymentDefs.FirstOrDefault(d => string.Equals(d.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
            if (def is null)
            {
                db.PaymentStatusDefinitions.Add(new PaymentStatusDefinition { RestaurantId = restaurantId, Name = name });
                def = db.PaymentStatusDefinitions.Local.Last(d => d.RestaurantId == restaurantId && d.Name == name);
            }
            def.Name = name;
            def.DisplayOrder = i;
            def.IsDefault = isDefault;
            def.IsDeleted = false;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new ResetSummary(ordersRemapped, paymentsRemapped, removedOrder, removedPayment);
    }
}
