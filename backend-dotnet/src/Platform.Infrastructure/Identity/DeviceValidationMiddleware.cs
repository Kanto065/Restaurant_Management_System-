using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Identity;

/// <summary>
/// Device access tokens are stateless JWTs, so deactivating or deleting a device in the admin
/// dashboard doesn't by itself invalidate a token the terminal already holds - the token stays
/// valid (and the terminal keeps receiving orders) until it naturally expires. Since the admin UI
/// promises "signed out immediately", this checks the device's current status on every
/// device-authenticated request and rejects it the moment the row is deactivated or deleted,
/// rather than waiting out the token's remaining lifetime.
/// </summary>
public class DeviceValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated == true && user.HasClaim(c => c.Type == "token_type" && c.Value == "device"))
        {
            if (!Guid.TryParse(user.FindFirstValue("device_id"), out var deviceId))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            // IgnoreQueryFilters: no tenant context is resolved yet at this point in the pipeline,
            // and IsDeleted/IsActive are checked explicitly here anyway.
            var isValid = await db.Devices.IgnoreQueryFilters()
                .AnyAsync(d => d.Id == deviceId && d.IsActive && !d.IsDeleted, context.RequestAborted);

            if (!isValid)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }
        }

        await next(context);
    }
}
