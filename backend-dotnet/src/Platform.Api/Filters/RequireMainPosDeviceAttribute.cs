using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Filters;

/// <summary>/api/pos/* is for the shop hub only: a Sunmi terminal's device token gets a 403.
/// Also records the hub's last IP and app version (X-App-Version header) for device management.</summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class RequireMainPosDeviceAttribute : Attribute, IAsyncActionFilter
{
    /// <summary>Lets staff (admin panel) tokens through untouched; only device tokens are checked.</summary>
    public bool StaffAllowed { get; init; }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (StaffAllowed && http.User.HasClaim("token_type", "staff"))
        {
            await next();
            return;
        }
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        var device = Guid.TryParse(http.User.FindFirst("device_id")?.Value, out var id)
            ? await db.Devices.FirstOrDefaultAsync(d => d.Id == id, http.RequestAborted)
            : null;

        if (device?.DeviceType != DeviceType.MainPos)
        {
            context.Result = new ObjectResult(ApiResponse<object>.Fail(
                "Only a main POS device can use this.", 403, "FORBIDDEN_DEVICE")) { StatusCode = 403 };
            return;
        }

        device.LastSeenAt = DateTimeOffset.UtcNow;
        device.LastIp = http.Connection.RemoteIpAddress?.ToString();
        if (http.Request.Headers.TryGetValue("X-App-Version", out var version))
            device.AppVersion = version.ToString();
        await db.SaveChangesAsync(http.RequestAborted);

        await next();
    }
}
