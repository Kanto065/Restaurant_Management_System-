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
/// retrievable again after this response, same as an API key. The admin dashboard renders this
/// as a QR code (JSON.stringify({ deviceId, secret })) for the POS app to scan; DeviceId + Secret
/// can also be typed into the app's pairing screen by hand as a fallback.</summary>
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

        var secret = GenerateSecret();
        var device = new Device
        {
            RestaurantId = currentTenant.RestaurantId.Value,
            DeviceName = request.DeviceName,
            DeviceSecretHash = new PasswordHasher<object>().HashPassword(new object(), secret),
        };
        db.Devices.Add(device);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<DevicePairedDto>.Ok(
            new DevicePairedDto(device.Id, device.DeviceName, secret), statusCode: 201));
    }

    /// <summary>The old secret is a one-way hash on our side, so a lost/forgotten secret can't be
    /// recovered - this issues a new one for the same Device ID instead of forcing a full
    /// delete-and-re-register. Same one-time-reveal contract as Create.</summary>
    [HttpPut("{id:guid}/regenerate-secret")]
    public async Task<ActionResult<ApiResponse<DevicePairedDto>>> RegenerateSecret(Guid id)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id);
        if (device is null)
            return NotFound(ApiResponse<DevicePairedDto>.Fail("Device not found.", 404));

        var secret = GenerateSecret();
        device.DeviceSecretHash = new PasswordHasher<object>().HashPassword(new object(), secret);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<DevicePairedDto>.Ok(new DevicePairedDto(device.Id, device.DeviceName, secret)));
    }

    private static string GenerateSecret() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));

    /// <summary>Signs the device out and blocks it from pairing again with the same credentials,
    /// but keeps the row (and its order/audit history) around - distinct from Delete below.</summary>
    [HttpPut("{id:guid}/deactivate")]
    public async Task<ActionResult<ApiResponse<object>>> Deactivate(Guid id)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id);
        if (device is null)
            return NotFound(ApiResponse<object>.Fail("Device not found.", 404));

        device.IsActive = false;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Device deactivated."));
    }

    /// <summary>Removes the device from the list entirely (soft-delete via IsDeleted, same as every
    /// other entity - filtered out by the global query filter). For cleaning up mistaken/test
    /// registrations; a still-active device is deactivated as part of the same request first.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == id);
        if (device is null)
            return NotFound(ApiResponse<object>.Fail("Device not found.", 404));

        device.IsActive = false;
        device.IsDeleted = true;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Device deleted."));
    }
}
