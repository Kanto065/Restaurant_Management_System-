using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Application.Tests;

public class PosOrderSyncTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private static readonly Guid RestaurantId = Guid.NewGuid();
    private static readonly Dictionary<string, bool> AllOn = FeatureKeys.All.ToDictionary(k => k, _ => true);

    private static AppDbContext Db()
    {
        var tenant = new CurrentTenant();
        tenant.Set(RestaurantId, Guid.NewGuid(), "r");
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, tenant, new SystemActor());
        db.OrderStatusDefinitions.AddRange(
            new OrderStatusDefinition { Name = "Pending", IsDefault = true, CountsAsPending = true },
            new OrderStatusDefinition { Name = "Completed", CountsAsCompleted = true });
        db.PaymentStatusDefinitions.Add(new PaymentStatusDefinition { Name = "Paid" });
        db.SaveChangesAsync().GetAwaiter().GetResult(); // the async override is what stamps RestaurantId
        return db;
    }

    // 2 x (8.50 + 1.00 modifier) + 1 void line = 19.00, less 2.00 discount = 17.00
    private static SyncOrder Order(Guid? clientId = null, decimal discount = 2m, decimal total = 17m, string status = "Completed",
        string number = "P0001") =>
        new(clientId ?? Guid.NewGuid(), number, OrderType.DineIn, null, 2, null, null, null, null,
            [
                new(Guid.NewGuid(), "Chicken Tikka", 8.50m, 2, "no onion", OrderItemStatus.Served, null, null,
                    [new(Guid.NewGuid(), "Pilau rice", 1.00m)]),
                new(Guid.NewGuid(), "Naan", 3m, 1, null, OrderItemStatus.Void, null, "Wrong item", null),
            ],
            discount, "Regular", null, total, PaymentMethod.Cash, [new(PaymentProvider.Cash, total)], status, "Paid",
            DateTimeOffset.UtcNow);

    [Fact]
    public async Task SameClientIdTwice_IsOneOrder()
    {
        await using var db = Db();
        var sync = new PosOrderSync(db);
        var order = Order();

        var first = await sync.SyncAsync(RestaurantId, new([order], null), AllOn);
        var second = await sync.SyncAsync(RestaurantId, new([order], null), AllOn);

        Assert.True(first[0].Ok, first[0].Error);
        Assert.Equal(first[0].Id, second[0].Id);
        var stored = await db.Orders.Include(o => o.Items).SingleAsync();
        Assert.Equal(OrderSource.Pos, stored.Source);
        Assert.Equal(19m, stored.Subtotal);
        Assert.Equal(17m, stored.TotalAmount);
        Assert.Equal(0m, stored.Items.Single(i => i.ItemStatus == OrderItemStatus.Void).LineTotal);
    }

    [Fact]
    public async Task WrongTotal_OpenStatus_AndDisabledDiscount_AreRejected_WithoutBlockingOthers()
    {
        await using var db = Db();
        var results = await new PosOrderSync(db).SyncAsync(RestaurantId, new(
        [
            Order(discount: 0, total: 18m, number: "P1"),
            Order(discount: 0, total: 19m, status: "Pending", number: "P2"),
            Order(number: "P3"),
        ], null), FeatureKeys.All.ToDictionary(k => k, k => k != FeatureKeys.PosDiscounts));

        Assert.Contains("Total mismatch", results[0].Error);
        Assert.Contains("completed", results[1].Error);
        Assert.Equal("FEATURE_DISABLED", results[2].ErrorCode);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task Refunds_AreIdempotent_AndNeverExceedWhatWasPaid()
    {
        await using var db = Db();
        var sync = new PosOrderSync(db);
        var order = Order();
        var refund = new SyncRefund(Guid.NewGuid(), order.ClientId, 10m, RefundMethod.Cash, "Cold food", null, null, null);

        var results = await sync.SyncAsync(RestaurantId, new([order], [refund, refund,
            refund with { ClientId = Guid.NewGuid(), Amount = 7.01m }]), AllOn);

        Assert.True(results[1].Ok);
        Assert.Equal(results[1].Id, results[2].Id);
        Assert.False(results[3].Ok);
        Assert.Equal(10m, await db.Refunds.SumAsync(r => r.Amount));
    }
}
