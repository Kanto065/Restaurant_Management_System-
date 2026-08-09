using Microsoft.EntityFrameworkCore;
using Platform.Domain.Entities;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Xunit;

namespace Platform.Application.Tests;

/// <summary>
/// Proves the core multi-tenancy guarantee: a query only ever returns rows belonging
/// to the currently resolved tenant, even when both tenants' rows exist in the same table.
/// </summary>
public class TenantQueryFilterTests
{
    private static AppDbContext CreateContext(string dbName, CurrentTenant tenant)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new AppDbContext(options, tenant);
    }

    [Fact]
    public async Task Query_OnlyReturnsRowsForTheResolvedTenant()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantA = Guid.NewGuid();
        var restaurantB = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var seedTenant = new CurrentTenant();
        await using (var seedDb = CreateContext(dbName, seedTenant))
        {
            seedDb.MenuItems.AddRange(
                new MenuItem { RestaurantId = restaurantA, CategoryId = categoryId, Name = "Chicken Tikka", BasePrice = 8.5m },
                new MenuItem { RestaurantId = restaurantB, CategoryId = categoryId, Name = "Lamb Rogan Josh", BasePrice = 9.5m });
            await seedDb.SaveChangesAsync();
        }

        var tenantA = new CurrentTenant();
        tenantA.Set(restaurantA, Guid.NewGuid(), "restaurant-a");
        await using var dbForA = CreateContext(dbName, tenantA);

        var items = await dbForA.MenuItems.ToListAsync();

        Assert.Single(items);
        Assert.Equal("Chicken Tikka", items[0].Name);
    }

    [Fact]
    public async Task SaveChanges_ThrowsOnCrossTenantWrite()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantA = Guid.NewGuid();
        var restaurantB = Guid.NewGuid();

        var tenantA = new CurrentTenant();
        tenantA.Set(restaurantA, Guid.NewGuid(), "restaurant-a");
        await using var db = CreateContext(dbName, tenantA);

        db.MenuItems.Add(new MenuItem { RestaurantId = restaurantB, CategoryId = Guid.NewGuid(), Name = "Wrong tenant", BasePrice = 1m });

        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task SaveChanges_AutoStampsRestaurantIdWhenNotSet()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantA = Guid.NewGuid();

        var tenantA = new CurrentTenant();
        tenantA.Set(restaurantA, Guid.NewGuid(), "restaurant-a");
        await using var db = CreateContext(dbName, tenantA);

        var item = new MenuItem { CategoryId = Guid.NewGuid(), Name = "Auto-stamped", BasePrice = 1m };
        db.MenuItems.Add(item);
        await db.SaveChangesAsync();

        Assert.Equal(restaurantA, item.RestaurantId);
    }
}
