using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record DeviceDto(Guid Id, string DeviceName, bool IsActive, DateTimeOffset? LastSeenAt);

/// <summary>Returned once, at creation time only - the plaintext secret is never stored or
/// retrievable again after this response, same as an API key. Pair the Sunmi terminal by
/// entering DeviceId + Secret into the POS app's login screen.</summary>
public record DevicePairedDto(Guid DeviceId, string DeviceName, string Secret);

public record CreateDeviceRequest(string DeviceName);

/// <summary>Registers and manages the Sunmi POS terminals paired to this restaurant.</summary>
[ApiController]
[Route("api/admin/devices")]
[Authorize(Policy = "StaffOnly")]
public class DevicesController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<DeviceDto>>>> List()
    {
        var devices = await db.Devices
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new DeviceDto(d.Id, d.DeviceName, d.IsActive, d.LastSeenAt))
            .ToListAsync();

        return Ok(ApiResponse<List<DeviceDto>>.Ok(devices));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<DevicePairedDto>>> Create(CreateDeviceRequest request)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<DevicePairedDto>.Fail("Could not resolve the current restaurant.", 400));

        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var hasher = new PasswordHasher<object>();

        var device = new Device
        {
            RestaurantId = currentTenant.RestaurantId.Value,
            DeviceName = request.DeviceName,
            DeviceSecretHash = hasher.HashPassword(new object(), secret),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<DevicePairedDto>.Ok(
            new DevicePairedDto(device.Id, device.DeviceName, secret), statusCode: 201));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Deactivate(Guid id)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id);
        if (device is null)
            return NotFound(ApiResponse<object>.Fail("Device not found.", 404));

        device.IsActive = false;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Device deactivated."));
    }
}
