using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Filters;

/// <summary>Generalised [RequirePosEnabled]: 403 FEATURE_DISABLED unless the current
/// restaurant has the feature on (see FeatureService for how a key resolves).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireFeatureAttribute(string key) : Attribute, IAsyncActionFilter
{
    public string Key { get; } = key;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var services = context.HttpContext.RequestServices;
        var tenant = services.GetRequiredService<ICurrentTenant>();
        var enabled = tenant.RestaurantId.HasValue && await services.GetRequiredService<FeatureService>()
            .IsEnabledAsync(tenant.RestaurantId.Value, Key, context.HttpContext.RequestAborted);

        if (!enabled)
        {
            context.Result = new ObjectResult(ApiResponse<object>.Fail(
                $"The '{Key}' feature isn't enabled for this restaurant.", 403, "FEATURE_DISABLED")) { StatusCode = 403 };
            return;
        }

        await next();
    }
}
