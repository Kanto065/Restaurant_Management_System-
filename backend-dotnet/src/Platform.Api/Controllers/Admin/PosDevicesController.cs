using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.Admin;

/// <summary>Registers a main POS (shop hub). Separate from POST /api/admin/devices, which keeps
/// creating Sunmi terminals exactly as before. The hub then signs in with
/// POST /api/auth/device/login like any device. List/deactivate/delete use the existing routes.</summary>
[ApiController]
[Route("api/admin/pos-devices")]
[Authorize(Policy = "StaffOnly")]
public class PosDevicesController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpPost]
    [RequirePosEnabled]
    public async Task<ActionResult<ApiResponse<DevicePairedDto>>> Create(CreateDeviceRequest request)
    {
        var restaurantId = currentTenant.RestaurantId!.Value;
        if (!await DeviceLimits.CanAddPosDeviceAsync(db, restaurantId, HttpContext.RequestAborted))
            return BadRequest(ApiResponse<DevicePairedDto>.Fail(
                "Your plan's device limit is reached. Remove a device or upgrade the plan.", 400, "DEVICE_LIMIT"));

        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var device = new Device
        {
            RestaurantId = restaurantId,
            DeviceName = request.DeviceName,
            DeviceType = DeviceType.MainPos,
            DeviceSecretHash = new PasswordHasher<object>().HashPassword(new object(), secret),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<DevicePairedDto>.Ok(new DevicePairedDto(device.Id, device.DeviceName, secret), statusCode: 201));
    }
}
