using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Controllers.Admin;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;

namespace Platform.Application.Tests;

/// <summary>
/// A restaurant may run the till without the admin site, so the main POS edits the menu,
/// tables, staff and printers through the admin endpoints. Staff tokens must behave exactly as
/// before; Sunmi terminals and other tokens must stay out.
/// </summary>
public class TillManagementAccessTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private static ClaimsPrincipal Principal(params (string Type, string Value)[] claims) =>
        new(new ClaimsIdentity(claims.Select(c => new Claim(c.Type, c.Value)), "test"));

    private static readonly Guid RestaurantId = Guid.NewGuid();

    private static ClaimsPrincipal Staff(string role) => Principal(("token_type", "staff"), ("active_restaurant_id", RestaurantId.ToString()),
        ("restaurant", $"{RestaurantId}:{role}"));

    private static ClaimsPrincipal Device(Guid id) => Principal(("token_type", "device"), ("device_id", id.ToString()), ("scope", "pos"));

    private static IAuthorizationService Authorization()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Postgres"] = "Host=unused",
            ["Jwt:SigningKey"] = new string('k', 64),
            ["Jwt:Issuer"] = "test",
            ["Jwt:Audience"] = "test",
        }).Build();
        var services = new ServiceCollection().AddLogging().AddInfrastructure(config);
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    [Fact]
    public async Task Policy_AcceptsAdminStaffAndPosDevices_Only()
    {
        var auth = Authorization();
        async Task<bool> Ok(ClaimsPrincipal p) => (await auth.AuthorizeAsync(p, "StaffOrMainPos")).Succeeded;

        // Whatever StaffOnly lets in, the new policy lets in, and the reverse for staff tokens.
        foreach (var role in new[] { "Owner", "Manager", "Staff", "Waiter", "Cashier" })
            Assert.Equal((await auth.AuthorizeAsync(Staff(role), "StaffOnly")).Succeeded, await Ok(Staff(role)));

        Assert.True(await Ok(Device(Guid.NewGuid())));
        Assert.False(await Ok(Principal(("token_type", "customer"))));
        Assert.False(await Ok(Principal(("token_type", "platform"))));
        Assert.False(await Ok(Principal(("token_type", "device"), ("device_id", Guid.NewGuid().ToString())))); // no pos scope
    }

    private static async Task<IActionResult?> RunFilter(RequireMainPosDeviceAttribute filter, ClaimsPrincipal user, AppDbContext db)
    {
        var http = new DefaultHttpContext { User = user, RequestServices = new ServiceCollection().AddSingleton(db).BuildServiceProvider() };
        var ctx = new ActionExecutingContext(new ActionContext(http, new RouteData(), new ActionDescriptor()), [], new Dictionary<string, object?>(), null!);
        var ran = false;
        await filter.OnActionExecutionAsync(ctx, () =>
        {
            ran = true;
            return Task.FromResult(new ActionExecutedContext(ctx, [], null!));
        });
        return ran ? null : ctx.Result;
    }

    [Fact]
    public async Task Filter_LetsStaffAndMainPosThrough_AndTurnsAwaySunmiTerminals()
    {
        var tenant = new CurrentTenant();
        tenant.Set(RestaurantId, Guid.NewGuid(), null);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, tenant, new SystemActor());
        var till = new Device { DeviceName = "Till", DeviceType = DeviceType.MainPos, DeviceSecretHash = "x" };
        var sunmi = new Device { DeviceName = "Sunmi", DeviceType = DeviceType.SunmiTerminal, DeviceSecretHash = "x" };
        db.Devices.AddRange(till, sunmi);
        await db.SaveChangesAsync();

        var management = new RequireMainPosDeviceAttribute { StaffAllowed = true };
        Assert.Null(await RunFilter(management, Staff("Manager"), db));
        Assert.Null(await RunFilter(management, Device(till.Id), db));
        Assert.Equal(403, Assert.IsType<ObjectResult>(await RunFilter(management, Device(sunmi.Id), db)).StatusCode);

        // /api/pos/* keeps refusing staff tokens.
        Assert.Equal(403, Assert.IsType<ObjectResult>(await RunFilter(new RequireMainPosDeviceAttribute(), Staff("Manager"), db)).StatusCode);
    }

    [Theory]
    [InlineData(typeof(MenuCategoriesController))]
    [InlineData(typeof(MenuItemsController))]
    [InlineData(typeof(ModifierGroupsController))]
    [InlineData(typeof(TablesController))]
    [InlineData(typeof(StaffController))]
    [InlineData(typeof(PrintersController))]
    public void TillManagedControllers_UseThePolicyAndTheMainPosCheck(Type controller)
    {
        Assert.Equal("StaffOrMainPos", controller.GetCustomAttribute<AuthorizeAttribute>()!.Policy);
        Assert.True(controller.GetCustomAttribute<RequireMainPosDeviceAttribute>()!.StaffAllowed);
    }
}
