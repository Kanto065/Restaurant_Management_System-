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

/// <param name="Boundary">The zone's area as rings of [latitude, longitude] points (even-odd: a ring
/// inside another is a hole); null until drawn.</param>
/// <param name="HasPreviousBoundary">An automatic redraw can be undone ("Restore previous area").</param>
public record DeliveryZoneDto(
    Guid Id, string Name, double MaxMileage, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive,
    List<List<double[]>>? Boundary, string Colour, bool HasPreviousBoundary);

/// <param name="ZoneIds">Zones to redraw; omit to redraw every zone whose area can be found.</param>
/// <param name="KeepZoneIds">Zones never to touch, whatever else is asked.</param>
public record AutoDrawRequest(List<Guid>? ZoneIds, List<Guid>? KeepZoneIds);

public record UpsertDeliveryZoneRequest(
    string Name, decimal DeliveryFee, decimal MinimumOrderAmount, bool IsActive,
    List<List<double[]>>? Boundary = null, string? Colour = null, double? MaxMileage = null);

/// <param name="RestaurantLatitude">Null when the restaurant's postcode can't be placed on the map.</param>
public record DeliverySettingsDto(
    double MaxDeliveryMiles, decimal? OutsideZoneDeliveryFee, decimal? OutsideZoneMinimumOrder,
    string RestaurantPostcode, double? RestaurantLatitude, double? RestaurantLongitude);

public record UpdateDeliverySettingsRequest(double MaxDeliveryMiles, decimal? OutsideZoneDeliveryFee, decimal? OutsideZoneMinimumOrder);

public record MapPostcodeDto(string Postcode, double Latitude, double Longitude);

/// <summary>The admin "Test a postcode" result: the storefront quote plus where it landed on the map.</summary>
public record DeliveryTestDto(DeliveryQuoteDto Quote, double? Latitude, double? Longitude, double? DistanceMiles);

[ApiController]
[Route("api/admin/delivery-zones")]
[Authorize(Policy = "StaffOnly")]
public class DeliveryZonesController(
    AppDbContext db, ICurrentTenant currentTenant, DeliveryQuoteService quotes, PostcodeGrid postcodeGrid, ZoneToolsService zoneTools)
    : ControllerBase
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

    /// <summary>"Test a postcode": exactly what a customer at that postcode would be charged.
    /// Also takes a map point (lat/lng) - a click on the admin map - priced as its nearest postcode.</summary>
    [HttpGet("test")]
    public async Task<ActionResult<ApiResponse<DeliveryTestDto>>> Test(
        [FromQuery] string? postcode, [FromQuery] double? lat, [FromQuery] double? lng, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<DeliveryTestDto>.Fail("Restaurant not found.", 400));

        DeliveryCheck check;
        if (!string.IsNullOrWhiteSpace(postcode))
            check = await quotes.CheckPostcodeAsync(currentTenant.RestaurantId.Value, postcode, ct);
        else if (lat is { } la && lng is { } ln)
            check = await quotes.CheckPointAsync(currentTenant.RestaurantId.Value, new GeoPoint(la, ln), ct);
        else
            return BadRequest(ApiResponse<DeliveryTestDto>.Fail("Enter a postcode to test.", 400));
        return Ok(ApiResponse<DeliveryTestDto>.Ok(new DeliveryTestDto(
            PublicDeliveryController.ToDto(check), check.Point?.Latitude, check.Point?.Longitude, check.Quote?.DistanceMiles)));
    }

    /// <summary>
    /// Real postcodes inside a small map area, so the owner can see what a shape covers while
    /// drawing. Only for zoomed-in views (about 3.5 km across at most) - postcodes.io is asked
    /// about a ~250 m grid of points and each answer is cached for a day.
    /// </summary>
    [HttpGet("postcodes")]
    public async Task<ActionResult<ApiResponse<List<MapPostcodeDto>>>> Postcodes(
        [FromQuery] double south, [FromQuery] double west, [FromQuery] double north, [FromQuery] double east,
        CancellationToken ct)
    {
        if (north <= south || east <= west || north - south > 0.032 || east - west > 0.052)
            return BadRequest(ApiResponse<List<MapPostcodeDto>>.Fail("Zoom in further to see postcodes.", 400));

        var found = await postcodeGrid.InBoxAsync(south, west, north, east, ct);
        if (found is null)
            return StatusCode(503, ApiResponse<List<MapPostcodeDto>>.Fail("The postcode service isn't answering just now.", 503));

        return Ok(ApiResponse<List<MapPostcodeDto>>.Ok(found
            .OrderBy(p => p.Postcode)
            .Select(p => new MapPostcodeDto(p.Postcode, p.Point.Latitude, p.Point.Longitude))
            .ToList()));
    }

    /// <summary>"Check zones": for each zone name, the real postcodes of that named area and
    /// which zone they're charged at now. Slow the first time (area lookups), cached after.</summary>
    [HttpGet("check")]
    public async Task<ActionResult<ApiResponse<ZoneCheckReport>>> Check(CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<ZoneCheckReport>.Fail("Restaurant not found.", 400));
        return Ok(ApiResponse<ZoneCheckReport>.Ok(await zoneTools.CheckAsync(currentTenant.RestaurantId.Value, ct)));
    }

    /// <summary>"Auto-draw from name": draws zones from where their named areas really are.
    /// Each redrawn zone keeps its old shape for "Restore previous area".</summary>
    [HttpPost("auto-draw")]
    public async Task<ActionResult<ApiResponse<AutoDrawOutcome>>> AutoDraw(AutoDrawRequest request, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<AutoDrawOutcome>.Fail("Restaurant not found.", 400));
        var outcome = await zoneTools.AutoDrawAsync(
            currentTenant.RestaurantId.Value, request.ZoneIds, request.KeepZoneIds ?? [], ct);
        return Ok(ApiResponse<AutoDrawOutcome>.Ok(outcome));
    }

    /// <summary>Cuts zones back to their stated miles by road ("up to 2 miles"). Slow: one
    /// routing request per ~100 postcodes, a second apart.</summary>
    [HttpPost("trim-to-miles")]
    public async Task<ActionResult<ApiResponse<TrimOutcome>>> TrimToMiles(AutoDrawRequest request, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<TrimOutcome>.Fail("Restaurant not found.", 400));
        var outcome = await zoneTools.TrimToStatedMilesAsync(
            currentTenant.RestaurantId.Value, request.ZoneIds, request.KeepZoneIds ?? [], ct);
        return Ok(ApiResponse<TrimOutcome>.Ok(outcome));
    }

    [HttpPost("{id:guid}/restore-previous")]
    public async Task<ActionResult<ApiResponse<DeliveryZoneDto>>> RestorePrevious(Guid id, CancellationToken ct)
    {
        if (!await zoneTools.RestorePreviousAsync(id, ct))
            return BadRequest(ApiResponse<DeliveryZoneDto>.Fail("There's no earlier area to restore for this zone.", 400));
        var zone = await db.DeliveryZones.AsNoTracking().FirstAsync(z => z.Id == id, ct);
        return Ok(ApiResponse<DeliveryZoneDto>.Ok(ToDto(zone)));
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
        // Any change of shape keeps the one before, so "Restore previous area" can undo it -
        // hand edits and restores from a backup, not just automatic redraws.
        if (zone.BoundaryJson is not null && zone.BoundaryJson != boundaryJson)
            zone.PreviousBoundaryJson = zone.BoundaryJson;
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
            boundary.Count == 0 ? null : boundary.Select(r => r.Select(p => new[] { p.Latitude, p.Longitude }).ToList()).ToList(),
            z.Colour, z.PreviousBoundaryJson is not null);
    }
}
