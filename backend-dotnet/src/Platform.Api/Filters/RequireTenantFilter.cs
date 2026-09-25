using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Platform.Api.Contracts;
using Platform.Application.Common;

namespace Platform.Api.Filters;

/// <summary>
/// Opts a controller or action out of <see cref="RequireTenantFilter"/> - for endpoints that
/// legitimately run with no tenant (staff login on the platform host, the Stripe webhook).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AllowUnresolvedTenantAttribute : Attribute;

/// <summary>
/// Registered globally: every action needs a resolved tenant (by host or token claim) unless it
/// carries [AllowUnresolvedTenant]. Without this, a tenant-scoped query on an unknown host throws
/// inside the EF query filter and surfaces as a 500 instead of a clean 404.
/// </summary>
public class RequireTenantFilter(ICurrentTenant currentTenant) : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (currentTenant.IsResolved)
            return;

        if (context.ActionDescriptor.EndpointMetadata.OfType<AllowUnresolvedTenantAttribute>().Any())
            return;

        context.Result = new NotFoundObjectResult(
            ApiResponse<object>.Fail("Could not resolve a restaurant for this domain.", 404));
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
