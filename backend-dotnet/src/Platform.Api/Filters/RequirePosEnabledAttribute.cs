using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Filters;

/// <summary>
/// Blocks an action (e.g. pairing a new POS terminal) when the current restaurant has the POS
/// app switched off in the super admin panel (Restaurant.PosEnabled).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequirePosEnabledAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var services = context.HttpContext.RequestServices;
        var currentTenant = services.GetRequiredService<ICurrentTenant>();
        var db = services.GetRequiredService<AppDbContext>();

        var enabled = currentTenant.RestaurantId.HasValue && await db.Restaurants
            .Where(r => r.Id == currentTenant.RestaurantId.Value)
            .Select(r => r.PosEnabled)
            .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        if (!enabled)
        {
            context.Result = new ObjectResult(
                ApiResponse<object>.Fail("The POS app isn't enabled for this restaurant.", 403)) { StatusCode = 403 };
            return;
        }

        await next();
    }
}
