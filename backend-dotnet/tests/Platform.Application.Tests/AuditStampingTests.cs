using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Xunit;

namespace Platform.Application.Tests;

/// <summary>
/// Proves the audit-column convention: CreatedBy/UpdatedBy get stamped from ICurrentActor on
/// every save, and soft-deleted rows disappear from normal queries without being removed.
/// </summary>
public class AuditStampingTests
{
    private class FixedCurrentActor(Guid actorId) : ICurrentActor
    {
        public Guid ActorId => actorId;
    }

    private static AppDbContext CreateContext(string dbName, Guid restaurantId, Guid actorId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        var tenant = new CurrentTenant();
        tenant.Set(restaurantId, Guid.NewGuid(), "restaurant-a");
        return new AppDbContext(options, tenant, new FixedCurrentActor(actorId));
    }

    [Fact]
    public async Task SaveChanges_StampsCreatedByAndUpdatedByOnInsert()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        await using var db = CreateContext(dbName, restaurantId, actorId);

        var item = new MenuItem { RestaurantId = restaurantId, CategoryId = Guid.NewGuid(), Name = "Chicken Tikka", BasePrice = 8.5m };
        db.MenuItems.Add(item);
        await db.SaveChangesAsync();

        Assert.Equal(actorId, item.CreatedBy);
        Assert.Equal(actorId, item.UpdatedBy);
        Assert.NotEqual(default, item.CreatedAt);
        Assert.NotEqual(default, item.UpdatedAt);
    }

    [Fact]
    public async Task SaveChanges_StampsUpdatedByOnModifyWithoutTouchingCreatedBy()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var editorId = Guid.NewGuid();

        var itemId = Guid.NewGuid();
        await using (var createDb = CreateContext(dbName, restaurantId, creatorId))
        {
            createDb.MenuItems.Add(new MenuItem { Id = itemId, RestaurantId = restaurantId, CategoryId = Guid.NewGuid(), Name = "Lamb Rogan Josh", BasePrice = 9.5m });
            await createDb.SaveChangesAsync();
        }

        await using var editDb = CreateContext(dbName, restaurantId, editorId);
        var item = await editDb.MenuItems.SingleAsync(i => i.Id == itemId);
        item.Name = "Lamb Rogan Josh (Updated)";
        await editDb.SaveChangesAsync();

        Assert.Equal(creatorId, item.CreatedBy);
        Assert.Equal(editorId, item.UpdatedBy);
    }

    [Fact]
    public async Task Query_ExcludesSoftDeletedRows()
    {
        var dbName = Guid.NewGuid().ToString();
        var restaurantId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        await using (var seedDb = CreateContext(dbName, restaurantId, Guid.NewGuid()))
        {
            seedDb.MenuItems.Add(new MenuItem { Id = itemId, RestaurantId = restaurantId, CategoryId = Guid.NewGuid(), Name = "Onion Bhaji", BasePrice = 4m });
            await seedDb.SaveChangesAsync();
        }

        await using (var deleteDb = CreateContext(dbName, restaurantId, Guid.NewGuid()))
        {
            var item = await deleteDb.MenuItems.SingleAsync(i => i.Id == itemId);
            item.IsDeleted = true;
            await deleteDb.SaveChangesAsync();
        }

        await using var readDb = CreateContext(dbName, restaurantId, Guid.NewGuid());
        var found = await readDb.MenuItems.SingleOrDefaultAsync(i => i.Id == itemId);

        Assert.Null(found);
    }
}
