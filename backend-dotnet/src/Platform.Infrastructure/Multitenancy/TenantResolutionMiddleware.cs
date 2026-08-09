using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Platform.Application.Common;

namespace Platform.Infrastructure.Multitenancy;

/// <summary>
/// Resolves the current tenant early in the pipeline (before auth/routing runs).
///
/// - Public storefront traffic (the customer's branded custom domain) resolves purely by Host header.
/// - Admin/staff and POS traffic hits a fixed platform host and carries RestaurantId in JWT claims
///   instead; this middleware only sets the tenant from the host when a Domain row matches, and lets
///   downstream JWT-claim-based authorization establish the tenant otherwise (see StaffTenantAuthorizationHandler).
/// - Never trusts a client-supplied RestaurantId route/query value — only host or verified claims.
/// </summary>
public class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantDomainResolver resolver, ICurrentTenant currentTenant)
    {
        var host = context.Request.Host.Host;
        var resolved = await resolver.ResolveByHostAsync(host, context.RequestAborted);

        if (resolved is not null)
        {
            ((CurrentTenant)currentTenant).Set(resolved.RestaurantId, resolved.OrganizationId, resolved.Slug);
        }
        else if (context.User.Identity?.IsAuthenticated == true)
        {
            // Platform/admin host: fall back to the token's restaurant claim (single-restaurant
            // staff get exactly one; multi-restaurant staff pick one client-side per request/header).
            var claimRestaurantId = context.User.FindFirstValue("active_restaurant_id");
            var claimOrgId = context.User.FindFirstValue("active_organization_id");
            if (Guid.TryParse(claimRestaurantId, out var restaurantId) && Guid.TryParse(claimOrgId, out var orgId))
            {
                ((CurrentTenant)currentTenant).Set(restaurantId, orgId, null);
            }
        }

        await next(context);
    }
}
