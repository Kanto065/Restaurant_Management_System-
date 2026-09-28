using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Controllers.Public;
using Platform.Application.Common;
using Platform.Application.Delivery;
using Platform.Domain.Entities;
using Platform.Infrastructure.Delivery;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

/// <param name="Boundary">The zone's outline as [latitude, longitude] points; null until drawn.</param>
public record DeliveryZoneDto(
    Guid Id, string Name, double MaxMileage, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive,
    List<double[]>? Boundary, string Colour);

public record UpsertDeliveryZoneRequest(
    string Name, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive,
    List<double[]>? Boundary = null, string? Colour = null, double? MaxMileage = null);

/// <param name="RestaurantLatitude">Null when the restaurant's postcode can't be placed on the map.</param>
public record DeliverySettingsDto(
    double MaxDeliveryMiles, decimal? OutsideZoneDeliveryFee, decimal? OutsideZoneMinimumOrder,
    string RestaurantPostcode, double? RestaurantLatitude, double? RestaurantLongitude);

public record UpdateDeliverySettingsRequest(double MaxDeliveryMiles, decimal? OutsideZoneDeliveryFee, decimal? OutsideZoneMinimumOrder);

/// <summary>The admin "Test a postcode" result: the storefront quote plus where it landed on the map.</summary>
public record DeliveryTestDto(DeliveryQuoteDto Quote, double? Latitude, double? Longitude, double? DistanceMiles);

[ApiController]
[Route("api/admin/delivery-zones")]
[Authorize(Policy = "StaffOnly")]
public class DeliveryZonesController(AppDbContext db, ICurrentTenant currentTenant, DeliveryQuoteService quotes) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<DeliveryZoneDto>>>> List()
    {
        var zones = await db.DeliveryZones
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.Name)
            .ToListAsync();

        return Ok(ApiResponse<List<DeliveryZoneDto>>.Ok(zones.Select(ToDto).ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> Create(UpsertDeliveryZoneRequest request)
    {
        var zone = new DeliveryZone();
        var error = Apply(zone, request);
        if (error is not null)
            return BadRequest(ApiResponse<DeliveryZoneDto>.Fail(error, 400));

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

        var error = Apply(zone, request);
        if (error is not null)
            return BadRequest(ApiResponse<DeliveryZoneDto>.Fail(error, 400));

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

    /// <summary>The 5-mile limit, the "anywhere else" price, and where the restaurant sits on the map.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<DeliverySettingsDto>>> GetSettings(CancellationToken ct)
    {
        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId, ct);
        if (restaurant is null)
            return NotFound(ApiResponse<DeliverySettingsDto>.Fail("Restaurant not found.", 404));

        var location = await quotes.RestaurantLocationAsync(restaurant, ct);
        return Ok(ApiResponse<DeliverySettingsDto>.Ok(new DeliverySettingsDto(
            restaurant.MaxDeliveryMiles, restaurant.OutsideZoneDeliveryFee, restaurant.OutsideZoneMinimumOrder,
            restaurant.Postcode, location?.Latitude, location?.Longitude)));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<DeliverySettingsDto>>> UpdateSettings(UpdateDeliverySettingsRequest request, CancellationToken ct)
    {
        if (request.MaxDeliveryMiles is < 0.5 or > 50)
            return BadRequest(ApiResponse<DeliverySettingsDto>.Fail("The delivery limit must be between 0.5 and 50 miles.", 400));
        if (request.OutsideZoneDeliveryFee < 0 || request.OutsideZoneMinimumOrder < 0)
            return BadRequest(ApiResponse<DeliverySettingsDto>.Fail("Prices can't be negative.", 400));

        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId, ct);
        if (restaurant is null)
            return NotFound(ApiResponse<DeliverySettingsDto>.Fail("Restaurant not found.", 404));

        restaurant.MaxDeliveryMiles = request.MaxDeliveryMiles;
        restaurant.OutsideZoneDeliveryFee = request.OutsideZoneDeliveryFee;
        restaurant.OutsideZoneMinimumOrder = request.OutsideZoneMinimumOrder;
        await db.SaveChangesAsync(ct);

        return await GetSettings(ct);
    }

    /// <summary>"Test a postcode": exactly what a customer at that postcode would be charged.</summary>
    [HttpGet("test")]
    public async Task<ActionResult<ApiResponse<DeliveryTestDto>>> Test([FromQuery] string postcode, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue || string.IsNullOrWhiteSpace(postcode))
            return BadRequest(ApiResponse<DeliveryTestDto>.Fail("Enter a postcode to test.", 400));

        var check = await quotes.CheckPostcodeAsync(currentTenant.RestaurantId.Value, postcode, ct);
        return Ok(ApiResponse<DeliveryTestDto>.Ok(new DeliveryTestDto(
            PublicDeliveryController.ToDto(check), check.Point?.Latitude, check.Point?.Longitude, check.Quote?.DistanceMiles)));
    }

    private static string? Apply(DeliveryZone zone, UpsertDeliveryZoneRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Give the zone a name.";
        if (request.DeliveryFee < 0 || request.MinimumOrderAmount < 0)
            return "Prices can't be negative.";
        var boundaryError = DeliveryPricing.NormaliseBoundary(request.Boundary, out var boundaryJson);
        if (boundaryError is not null)
            return boundaryError;

        zone.Name = request.Name.Trim();
        zone.DeliveryFee = request.DeliveryFee;
        zone.MinimumOrderAmount = request.MinimumOrderAmount;
        zone.IsActive = request.IsActive;
        zone.BoundaryJson = boundaryJson;
        if (!string.IsNullOrWhiteSpace(request.Colour) && System.Text.RegularExpressions.Regex.IsMatch(request.Colour, "^#[0-9a-fA-F]{6}$"))
            zone.Colour = request.Colour;
        if (request.MaxMileage is { } miles)
            zone.MaxMileage = miles;
        return null;
    }

    private static DeliveryZoneDto ToDto(DeliveryZone z)
    {
        var boundary = DeliveryPricing.ParseBoundary(z.BoundaryJson);
        return new DeliveryZoneDto(
            z.Id, z.Name, z.MaxMileage, z.DeliveryFee, z.MinimumOrderAmount, z.IsActive,
            boundary.Count == 0 ? null : boundary.Select(p => new[] { p.Latitude, p.Longitude }).ToList(),
            z.Colour);
    }
}
