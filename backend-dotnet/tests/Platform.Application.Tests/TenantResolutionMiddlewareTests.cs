using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Platform.Application.Common;
using Platform.Infrastructure.Multitenancy;
using Xunit;

namespace Platform.Application.Tests;

/// <summary>
/// A token issued for one restaurant must never act on another restaurant's host.
/// </summary>
public class TenantResolutionMiddlewareTests
{
    private static readonly Guid RestaurantA = Guid.NewGuid();
    private static readonly Guid RestaurantB = Guid.NewGuid();
    private static readonly Guid OrgA = Guid.NewGuid();
    private static readonly Guid OrgB = Guid.NewGuid();

    private class FakeResolver : ITenantDomainResolver
    {
        public Task<ResolvedTenant?> ResolveByHostAsync(string host, CancellationToken ct = default) =>
            Task.FromResult<ResolvedTenant?>(host switch
            {
                "a.test" => new ResolvedTenant(RestaurantA, OrgA, "a"),
                "b.test" => new ResolvedTenant(RestaurantB, OrgB, "b"),
                "suspended.test" => new ResolvedTenant(Guid.NewGuid(), Guid.NewGuid(), "s", IsActive: false),
                _ => null,
            });

        public void InvalidateHost(string host) { }
    }

    private static async Task<(HttpContext Context, CurrentTenant Tenant, bool NextCalled)> Run(
        string host, string? tokenType = null, Guid? tokenRestaurant = null, Guid? tokenOrg = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Host = new HostString(host);
        context.Response.Body = new MemoryStream();
        if (tokenType is not null)
        {
            var claims = new List<Claim> { new("token_type", tokenType) };
            if (tokenRestaurant is not null) claims.Add(new("active_restaurant_id", tokenRestaurant.Value.ToString()));
            if (tokenOrg is not null) claims.Add(new("active_organization_id", tokenOrg.Value.ToString()));
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        }

        var nextCalled = false;
        var middleware = new TenantResolutionMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        var tenant = new CurrentTenant();
        await middleware.InvokeAsync(context, new FakeResolver(), tenant);
        return (context, tenant, nextCalled);
    }

    [Theory]
    [InlineData("staff")]
    [InlineData("customer")]
    [InlineData("device")]
    public async Task TokenForOtherRestaurant_OnTenantHost_IsForbidden(string tokenType)
    {
        var (context, tenant, nextCalled) = await Run("a.test", tokenType, RestaurantB, OrgB);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.False(tenant.IsResolved);
    }

    [Fact]
    public async Task TokenForSameRestaurant_OnTenantHost_Passes()
    {
        var (_, tenant, nextCalled) = await Run("a.test", "staff", RestaurantA, OrgA);

        Assert.True(nextCalled);
        Assert.Equal(RestaurantA, tenant.RestaurantId);
    }

    [Fact]
    public async Task Anonymous_OnTenantHost_ResolvesByHost()
    {
        var (_, tenant, nextCalled) = await Run("b.test");

        Assert.True(nextCalled);
        Assert.Equal(RestaurantB, tenant.RestaurantId);
    }

    [Fact]
    public async Task SuspendedRestaurant_Returns503()
    {
        var (context, tenant, nextCalled) = await Run("suspended.test");

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);
        Assert.False(tenant.IsResolved);
    }

    [Fact]
    public async Task Token_OnUnknownHost_FallsBackToClaim()
    {
        var (_, tenant, nextCalled) = await Run("api.platform.test", "staff", RestaurantB, OrgB);

        Assert.True(nextCalled);
        Assert.Equal(RestaurantB, tenant.RestaurantId);
    }
}
