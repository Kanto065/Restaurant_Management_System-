using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Platform.Api.Controllers.PlatformAdmin;
using Platform.Api.Controllers.Public;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Delivery;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Payments;
using Platform.Infrastructure.Persistence;

namespace Platform.Application.Tests;

/// <summary>
/// Guards for the two live restaurants (design section 2): the POS work must not change what
/// today's web checkout and super-admin POS switch do.
/// </summary>
public class BackwardCompatGuardTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private class NoStripe : IStripeAccountProvider
    {
        public StripeAccount? ConfigAccount => null;
        public Task<StripeAccount?> ForRestaurantAsync(Guid restaurantId, CancellationToken ct = default) =>
            Task.FromResult<StripeAccount?>(null);
    }

    private class RecordingNotifier : IOrderNotifier
    {
        public List<Guid> Created { get; } = [];
        public Task OrderCreatedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default)
        {
            Created.Add(orderId);
            return Task.CompletedTask;
        }
        public Task OrderStatusChangedAsync(Guid restaurantId, Guid orderId, string status, CancellationToken ct = default) => Task.CompletedTask;
        public Task PaymentReceivedAsync(Guid restaurantId, Guid orderId, CancellationToken ct = default) => Task.CompletedTask;
        public Task EstimatedTimeChangedAsync(Guid restaurantId, Guid orderId, DateTimeOffset? estimatedReadyAt, CancellationToken ct = default) => Task.CompletedTask;
    }

    [Fact]
    public async Task WebCheckout_StillCreatesAWebOrder_AndRaisesTheNewOrderEvent()
    {
        var restaurantId = Guid.NewGuid();
        var tenant = new CurrentTenant();
        tenant.Set(restaurantId, Guid.NewGuid(), "live");
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options, tenant, new SystemActor());

        var category = new MenuCategory { Name = "Mains" };
        var item = new MenuItem { CategoryId = category.Id, Name = "Chicken Tikka Masala", BasePrice = 9.95m };
        db.AddRange(
            new Restaurant { Id = restaurantId, Name = "Live", Slug = "live", AddressLine1 = "1", City = "C", Postcode = "SA1 1AA" },
            category, item,
            new OrderStatusDefinition { Name = "Pending", IsDefault = true, CountsAsPending = true },
            new PaymentStatusDefinition { Name = "Pending", IsDefault = true });
        await db.SaveChangesAsync();

        var notifier = new RecordingNotifier();
        var controller = new PublicOrdersController(db, tenant, notifier, new NoStripe(), new DeliveryQuoteService(db, null!))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        var response = await controller.Create(new CreatePublicOrderRequest(
            OrderType.Collection, null, "Guest", "07000000000", "guest@example.test", null,
            [new CreateOrderItemRequest(item.Id, 2, [], null)], null, PaymentMethod.Cash, null));

        var created = Assert.IsType<OkObjectResult>(response.Result);
        var order = await db.Orders.Include(o => o.Items).SingleAsync();
        Assert.Equal(OrderSource.Web, order.Source);
        Assert.Equal("Pending", order.Status);
        Assert.Equal(19.90m, order.Subtotal);
        Assert.Null(order.ClientId);
        Assert.All(order.Items, i => Assert.Equal(OrderItemStatus.Pending, i.ItemStatus));
        Assert.Equal([order.Id], notifier.Created);
        Assert.NotNull(created.Value);
    }

    [Fact]
    public void PosEnabledContract_IsUnchanged() =>
        Assert.Equal("""{"posEnabled":true}""",
            JsonSerializer.Serialize(new TenantFeaturesDto(true), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
}
