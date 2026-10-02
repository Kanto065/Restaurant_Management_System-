using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Application.Tests;

public class DeviceLimitsTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private static (AppDbContext db, Guid restaurantId) Seed(int? maxDevices, bool withSubscription = true)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, new CurrentTenant(), new SystemActor());
        var org = new Organization { Name = "Org", BillingEmail = "o@x.test" };
        var restaurant = new Restaurant { OrganizationId = org.Id, Name = "R", Slug = "r", AddressLine1 = "1", City = "C", Postcode = "P" };
        var plan = new Plan { Name = "Basic", MaxDevices = maxDevices };
        db.AddRange(org, restaurant, plan);
        if (withSubscription)
            db.Subscriptions.Add(new Subscription { OrganizationId = org.Id, PlanId = plan.Id, Status = SubscriptionStatus.Active });
        db.Devices.Add(new Device { RestaurantId = restaurant.Id, DeviceName = "Sunmi", DeviceSecretHash = "x" });
        db.SaveChanges();
        return (db, restaurant.Id);
    }

    [Fact]
    public async Task NoSubscription_IsUnlimited()
    {
        var (db, id) = Seed(0, withSubscription: false);
        Assert.True(await DeviceLimits.CanAddPosDeviceAsync(db, id));
    }

    [Fact]
    public async Task SunmiDoesNotCount_ButPosDevicesDo()
    {
        var (db, id) = Seed(1);
        Assert.True(await DeviceLimits.CanAddPosDeviceAsync(db, id));
        db.Devices.Add(new Device { RestaurantId = id, DeviceName = "Hub", DeviceSecretHash = "x", DeviceType = DeviceType.MainPos });
        await db.SaveChangesAsync();
        Assert.False(await DeviceLimits.CanAddPosDeviceAsync(db, id));
    }
}
