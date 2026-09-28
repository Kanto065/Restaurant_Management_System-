using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Application.Delivery;
using Platform.Infrastructure.Delivery;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

/// <param name="CanDeliver">False when the postcode is invalid, too far, or delivery pricing isn't set up - see Message.</param>
/// <param name="Postcode">The postcode as priced (tidied, or found from the customer's location).</param>
/// <param name="ZoneName">The matching zone, or "Anywhere else" for an address inside no zone.</param>
/// <param name="Message">Why delivery isn't possible; null when it is.</param>
/// <param name="PricingEnabled">False when the restaurant has delivery charges switched off -
/// delivery is then free and unchecked, and storefronts show no delivery price.</param>
public record DeliveryQuoteDto(
    bool CanDeliver, string? Postcode, decimal DeliveryFee, decimal MinimumOrderAmount, string? ZoneName, bool InZone,
    string? Message, bool PricingEnabled = true);

public record PublicDeliveryZoneDto(string Name, decimal DeliveryFee, decimal MinimumOrderAmount);

/// <param name="OutsideZoneFee">Fee for anywhere within MaxDeliveryMiles that's inside no zone; null = none set up.</param>
public record PublicDeliveryInfoDto(
    List<PublicDeliveryZoneDto> Zones, decimal? OutsideZoneFee, decimal? OutsideZoneMinimumOrder, double MaxDeliveryMiles,
    bool PricingEnabled = true);

/// <summary>Storefront delivery pricing: the price list for Contact Us, and a live quote for a postcode.</summary>
[ApiController]
[Route("api/public")]
public class PublicDeliveryController(AppDbContext db, ICurrentTenant currentTenant, DeliveryQuoteService quotes) : ControllerBase
{
    [HttpGet("delivery-info")]
    public async Task<ActionResult<ApiResponse<PublicDeliveryInfoDto>>> GetInfo(CancellationToken ct)
    {
        var restaurant = await db.Restaurants.AsNoTracking().FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId, ct);
        if (restaurant is null)
            return NotFound(ApiResponse<PublicDeliveryInfoDto>.Fail("Could not resolve a restaurant for this domain.", 404));

        var zones = await db.DeliveryZones.AsNoTracking()
            .Where(z => z.IsActive)
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.Name)
            .Select(z => new PublicDeliveryZoneDto(z.Name, z.DeliveryFee, z.MinimumOrderAmount))
            .ToListAsync(ct);

        var outsideFee = restaurant.OutsideZoneDeliveryFee ?? (zones.Count > 0 ? zones.Max(z => z.DeliveryFee) : null);
        var outsideMin = restaurant.OutsideZoneMinimumOrder ?? (zones.Count > 0 ? zones.Max(z => z.MinimumOrderAmount) : null);

        return Ok(ApiResponse<PublicDeliveryInfoDto>.Ok(
            new PublicDeliveryInfoDto(zones, outsideFee, outsideMin, restaurant.MaxDeliveryMiles, restaurant.DeliveryPricingEnabled)));
    }

    /// <summary>Price a delivery by postcode, or by the customer's location (lat/lng) - which
    /// is turned into the nearest postcode first, so it prices exactly as checkout will.</summary>
    [HttpGet("delivery-quote")]
    public async Task<ActionResult<ApiResponse<DeliveryQuoteDto>>> Quote(
        [FromQuery] string? postcode, [FromQuery] double? lat, [FromQuery] double? lng, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return NotFound(ApiResponse<DeliveryQuoteDto>.Fail("Could not resolve a restaurant for this domain.", 404));

        DeliveryCheck check;
        if (!string.IsNullOrWhiteSpace(postcode))
            check = await quotes.CheckPostcodeAsync(currentTenant.RestaurantId.Value, postcode, ct);
        else if (lat is { } la && lng is { } ln && la is >= -90 and <= 90 && ln is >= -180 and <= 180)
            check = await quotes.CheckPointAsync(currentTenant.RestaurantId.Value, new GeoPoint(la, ln), ct);
        else
            return BadRequest(ApiResponse<DeliveryQuoteDto>.Fail("Give a postcode, or lat and lng.", 400));

        return Ok(ApiResponse<DeliveryQuoteDto>.Ok(ToDto(check)));
    }

    public static DeliveryQuoteDto ToDto(DeliveryCheck check) => new(
        check.CanDeliver, check.Postcode,
        check.CanDeliver ? check.Quote!.DeliveryFee : 0,
        check.CanDeliver ? check.Quote!.MinimumOrderAmount : 0,
        check.CanDeliver ? check.Quote!.ZoneName : null,
        check.Quote?.Outcome == DeliveryQuoteOutcome.InZone,
        check.Problem,
        check.Quote?.Outcome != DeliveryQuoteOutcome.PricingOff);
}
