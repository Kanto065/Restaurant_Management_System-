using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record DeliveryZoneDto(Guid Id, string Name, double MaxMileage, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive);
public record UpsertDeliveryZoneRequest(string Name, double MaxMileage, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive);

[ApiController]
[Route("api/admin/delivery-zones")]
[Authorize(Policy = "StaffOnly")]
public class DeliveryZonesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<DeliveryZoneDto>>>> List()
    {
        var zones = await db.DeliveryZones
            .OrderBy(z => z.MaxMileage)
            .Select(z => new DeliveryZoneDto(z.Id, z.Name, z.MaxMileage, z.DeliveryFee, z.MinimumOrderAmount, z.IsActive))
            .ToListAsync();

        return Ok(ApiResponse<List<DeliveryZoneDto>>.Ok(zones));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> Create(UpsertDeliveryZoneRequest request)
    {
        var zone = new DeliveryZone
        {
            Name = request.Name,
            MaxMileage = request.MaxMileage,
            DeliveryFee = request.DeliveryFee,
            MinimumOrderAmount = request.MinimumOrderAmount,
            IsActive = request.IsActive,
        };
        db.DeliveryZones.Add(zone);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<DeliveryZoneDto>.Ok(ToDto(zone), statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> Update(Guid id, UpsertDeliveryZoneRequest request)
    {
        var zone = await db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == id);
        if (zone is null)
            return NotFound(ApiResponse<DeliveryZoneDto>.Fail("Delivery zone not found.", 404));

        zone.Name = request.Name;
        zone.MaxMileage = request.MaxMileage;
        zone.DeliveryFee = request.DeliveryFee;
        zone.MinimumOrderAmount = request.MinimumOrderAmount;
        zone.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<DeliveryZoneDto>.Ok(ToDto(zone)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var zone = await db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == id);
        if (zone is null)
            return NotFound(ApiResponse<object>.Fail("Delivery zone not found.", 404));

        db.DeliveryZones.Remove(zone);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    private static DeliveryZoneDto ToDto(DeliveryZone z) => new(z.Id, z.Name, z.MaxMileage, z.DeliveryFee, z.MinimumOrderAmount, z.IsActive);
}
