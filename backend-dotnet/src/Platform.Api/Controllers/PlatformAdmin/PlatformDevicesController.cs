using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.PlatformAdmin;

public record PlatformDeviceDto(Guid Id, Guid RestaurantId, string RestaurantName, string DeviceName, DeviceType DeviceType,
    bool IsActive, DateTimeOffset? LastSeenAt, string? AppVersion, string? LastIp, Guid? HubDeviceId);

/// <summary>Devices across every tenant. Deactivating cuts the device off immediately
/// (DeviceValidationMiddleware).</summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform/devices")]
[Authorize(Policy = "PlatformSuperAdmin")]
public class PlatformDevicesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformDeviceDto>>>> List(Guid? restaurantId)
    {
        var devices = await db.Devices.IgnoreQueryFilters()
            .Where(d => !d.IsDeleted && (restaurantId == null || d.RestaurantId == restaurantId))
            .OrderBy(d => d.Restaurant!.Name).ThenByDescending(d => d.CreatedAt)
            .Select(d => new PlatformDeviceDto(d.Id, d.RestaurantId, d.Restaurant!.Name, d.DeviceName, d.DeviceType,
                d.IsActive, d.LastSeenAt, d.AppVersion, d.LastIp, d.HubDeviceId))
            .ToListAsync();
        return Ok(ApiResponse<List<PlatformDeviceDto>>.Ok(devices));
    }

    [HttpPut("{id:guid}/deactivate")]
    public async Task<ActionResult<ApiResponse<object>>> Deactivate(Guid id)
    {
        var device = await db.Devices.IgnoreQueryFilters().FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);
        if (device is null)
            return NotFound(ApiResponse<object>.Fail("Device not found.", 404));
        device.IsActive = false;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Device deactivated."));
    }
}
