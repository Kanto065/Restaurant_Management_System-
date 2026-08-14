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
}
