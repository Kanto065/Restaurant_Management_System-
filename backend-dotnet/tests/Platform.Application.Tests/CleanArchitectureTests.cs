using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Platform.Application;
using Platform.Application.Abstractions;
using Platform.Application.Common;
using Platform.Application.Orders;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;
using Xunit;

namespace Platform.Application.Tests;

/// <summary>Orders use cases resolved from DI (as the controller gets them), the role-permission
/// map, and refresh-token replay detection.</summary>
public class CleanArchitectureTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private class NoopNotifier : IOrderNotifier
    {
        public int Status, Estimate;
        public Task OrderCreatedAsync(Guid r, Guid o, CancellationToken ct = default) => Task.CompletedTask;
        public Task OrderStatusChangedAsync(Guid r, Guid o, string s, CancellationToken ct = default) { Status++; return Task.CompletedTask; }
        public Task PaymentReceivedAsync(Guid r, Guid o, CancellationToken ct = default) => Task.CompletedTask;
        public Task EstimatedTimeChangedAsync(Guid r, Guid o, DateTimeOffset? e, CancellationToken ct = default) { Estimate++; return Task.CompletedTask; }
    }

    private static (ServiceProvider Sp, Guid RestaurantId, NoopNotifier Notifier) Setup()
    {
        var restaurantId = Guid.NewGuid();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = "Host=unused",
            ["Jwt:SigningKey"] = new string('k', 64), ["Jwt:Issuer"] = "t", ["Jwt:Audience"] = "t",
        }).Build();
        var notifier = new NoopNotifier();
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection().AddLogging().AddApplication().AddInfrastructure(config);
        services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>(); // drop Npgsql
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddScoped<ICurrentActor, SystemActor>();
        services.AddSingleton<IOrderNotifier>(notifier);
        var sp = services.BuildServiceProvider();
        sp.GetRequiredService<ICurrentTenant>().Set(restaurantId, Guid.NewGuid(), "r");
        return (sp, restaurantId, notifier);
    }

    private static async Task<Guid> AddOrder(ServiceProvider sp, Guid restaurantId, int? estimatedMinutes = 20)
    {
        var db = sp.GetRequiredService<AppDbContext>();
        db.OrderStatusDefinitions.Add(new OrderStatusDefinition { RestaurantId = restaurantId, Name = "Pending", IsDefault = true });
        var order = new Order { RestaurantId = restaurantId, OrderNumber = "A1", Status = "Pending", PaymentStatus = "Unpaid", EstimatedMinutes = estimatedMinutes };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order.Id;
    }

    [Fact]
    public async Task UnknownOrder_IsNotFound()
    {
        var (sp, _, _) = Setup();
        var r = await sp.GetRequiredService<IQueryHandler<GetOrderQuery, OrderDetailDto>>().Handle(new GetOrderQuery(Guid.NewGuid()), default);
        Assert.Equal(ErrorType.NotFound, r.Error!.Type);
    }

    [Fact]
    public async Task ConfirmingAnOrder_StartsTheClockAndNotifies()
    {
        var (sp, rid, notifier) = Setup();
        var id = await AddOrder(sp, rid);

        var r = await sp.GetRequiredService<ICommandHandler<UpdateOrderStatusCommand, OrderDetailDto>>()
            .Handle(new UpdateOrderStatusCommand(id, "Preparing", "ok"), default);

        Assert.True(r.IsSuccess);
        Assert.NotNull(r.Value!.EstimatedReadyAt);
        Assert.Single(r.Value.StatusHistory);
        Assert.Equal((1, 1), (notifier.Status, notifier.Estimate));
    }

    [Fact]
    public async Task Cancelling_DoesNotStartTheClock()
    {
        var (sp, rid, _) = Setup();
        var id = await AddOrder(sp, rid);
        var r = await sp.GetRequiredService<ICommandHandler<UpdateOrderStatusCommand, OrderDetailDto>>()
            .Handle(new UpdateOrderStatusCommand(id, "Cancelled", null), default);
        Assert.Null(r.Value!.EstimatedReadyAt);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(601)]
    public async Task EstimateOutOfRange_IsValidationError(int minutes)
    {
        var (sp, rid, _) = Setup();
        var id = await AddOrder(sp, rid);
        var r = await sp.GetRequiredService<ICommandHandler<SetEstimatedTimeCommand, OrderDetailDto>>()
            .Handle(new SetEstimatedTimeCommand(id, minutes), default);
        Assert.Equal(ErrorType.Validation, r.Error!.Type);
    }

    [Fact]
    public async Task DeletedOrder_DisappearsFromList()
    {
        var (sp, rid, _) = Setup();
        var id = await AddOrder(sp, rid);
        Assert.True((await sp.GetRequiredService<ICommandHandler<DeleteOrderCommand, bool>>().Handle(new DeleteOrderCommand(id), default)).IsSuccess);

        var page = await sp.GetRequiredService<IQueryHandler<ListOrdersQuery, OrderListPageDto>>()
            .Handle(new ListOrdersQuery(null, null, null, null, null, null, null, 1, 25), default);
        Assert.Equal(0, page.Value!.TotalCount);
    }

    private static ClaimsPrincipal Staff(StaffRole role)
    {
        var rid = Guid.NewGuid();
        return new(new ClaimsIdentity([new Claim("token_type", "staff"), new Claim("active_restaurant_id", rid.ToString()),
            new Claim("restaurant", $"{rid}:{role}")], "test"));
    }

    [Theory]
    [InlineData(StaffRole.Owner, Permissions.OrdersDelete, true)]
    [InlineData(StaffRole.Manager, Permissions.OrdersDelete, true)]
    [InlineData(StaffRole.Staff, Permissions.OrdersDelete, true)]
    [InlineData(StaffRole.KitchenDisplay, Permissions.OrdersUpdate, true)]
    [InlineData(StaffRole.KitchenDisplay, Permissions.OrdersDelete, false)]
    public async Task HasPermission_FollowsRoleMap(StaffRole role, string permission, bool expected)
    {
        var (sp, _, _) = Setup();
        var auth = sp.GetRequiredService<IAuthorizationService>();
        var policy = await sp.GetRequiredService<IAuthorizationPolicyProvider>().GetPolicyAsync(HasPermissionAttribute.Prefix + permission);
        Assert.Equal(expected, (await auth.AuthorizeAsync(Staff(role), null, policy!)).Succeeded);
    }

    [Fact]
    public async Task HasPermission_LetsDevicesThroughAndCustomersOut()
    {
        var (sp, _, _) = Setup();
        var auth = sp.GetRequiredService<IAuthorizationService>();
        var policy = (await sp.GetRequiredService<IAuthorizationPolicyProvider>().GetPolicyAsync("perm:" + Permissions.OrdersDelete))!;
        var device = new ClaimsPrincipal(new ClaimsIdentity([new Claim("token_type", "device")], "test"));
        var customer = new ClaimsPrincipal(new ClaimsIdentity([new Claim("token_type", "customer")], "test"));
        Assert.True((await auth.AuthorizeAsync(device, null, policy)).Succeeded);
        Assert.False((await auth.AuthorizeAsync(customer, null, policy)).Succeeded);
    }

    [Fact]
    public void RotatedToken_IsReplayOnlyAfterTheGraceWindow()
    {
        var now = DateTimeOffset.UtcNow;
        var rotated = new RefreshToken { RevokedAt = now.AddSeconds(-5), ReplacedByTokenHash = "x" };
        Assert.False(rotated.IsReplay(now));                                     // two tabs racing
        Assert.True(rotated.IsReplay(now.AddMinutes(5)));                        // copied token
        Assert.False(new RefreshToken { RevokedAt = now.AddHours(-1) }.IsReplay(now)); // plain sign-out
    }

    private static async Task<(ServiceProvider Sp, Guid ItemId)> CheckoutSetup()
    {
        var (sp, rid, _) = Setup();
        var db = sp.GetRequiredService<AppDbContext>();
        var category = new MenuCategory { Name = "Mains" };
        var item = new MenuItem { CategoryId = category.Id, Name = "Tikka", BasePrice = 10m };
        db.AddRange(
            new Restaurant { Id = rid, Name = "R", Slug = "r", AddressLine1 = "1", City = "C", Postcode = "SA1 1AA" },
            category, item,
            new OrderStatusDefinition { Name = "Pending", IsDefault = true },
            new PaymentStatusDefinition { Name = "Pending", IsDefault = true },
            new Voucher { Code = "TEN", IsActive = true, DiscountType = VoucherDiscountType.Percentage, DiscountValue = 10, MinimumOrderAmount = 15m });
        await db.SaveChangesAsync();
        return (sp, item.Id);
    }

    private static Task<Result<CreatedOrderDto>> Place(ServiceProvider sp, Guid itemId, int qty = 2, string? voucher = null, OrderType type = OrderType.Collection) =>
        sp.GetRequiredService<ICommandHandler<PlaceOrderCommand, CreatedOrderDto>>().Handle(new PlaceOrderCommand(
            new CreatePublicOrderRequest(type, null, "G", null, null, null,
                [new CreateOrderItemRequest(itemId, qty, [], null)], null, PaymentMethod.Cash, voucher), null), default);

    [Fact]
    public async Task Checkout_AppliesPercentageVoucherToServerSidePrices()
    {
        var (sp, itemId) = await CheckoutSetup();
        var r = await Place(sp, itemId, qty: 2, voucher: "TEN");
        Assert.Equal((20m, 2m, 18m), (r.Value!.Subtotal, r.Value.DiscountAmount, r.Value.TotalAmount));
    }

    [Fact]
    public async Task Checkout_RejectsVoucherBelowMinimum_AndUnknownItems_AndTablelessDineIn()
    {
        var (sp, itemId) = await CheckoutSetup();
        Assert.Equal(ErrorType.Validation, (await Place(sp, itemId, qty: 1, voucher: "TEN")).Error!.Type);
        Assert.Equal(ErrorType.Validation, (await Place(sp, Guid.NewGuid())).Error!.Type);
        Assert.Equal(ErrorType.Validation, (await Place(sp, itemId, type: OrderType.DineIn)).Error!.Type);
        Assert.Equal(ErrorType.Validation, (await Place(sp, itemId, qty: 0)).Error!.Type);
    }
}
