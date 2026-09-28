using Microsoft.EntityFrameworkCore;
using Platform.Application.Delivery;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Delivery;

public enum DeliveryCheckStatus
{
    /// <summary>Postcode found and priced - see Quote (which may still be TooFar/NotConfigured).</summary>
    Ok,
    InvalidPostcode,
    /// <summary>The postcode service is down - we can't tell where the address is.</summary>
    LookupUnavailable,
    /// <summary>The restaurant's own postcode couldn't be placed on the map.</summary>
    RestaurantLocationUnknown,
}

public record DeliveryCheck(DeliveryCheckStatus Status, string? Postcode, GeoPoint? Point, DeliveryQuote? Quote)
{
    public bool CanDeliver => Status == DeliveryCheckStatus.Ok && Quote is { CanDeliver: true };

    /// <summary>Customer-facing reason delivery isn't possible (null when it is). Prices are
    /// left to the storefront so it can use its own currency formatting.</summary>
    public string? Problem => Status switch
    {
        DeliveryCheckStatus.InvalidPostcode => "We couldn't find that postcode. Please check it and try again.",
        DeliveryCheckStatus.LookupUnavailable => "We couldn't check your postcode just now. Please try again in a moment, or call us to order.",
        DeliveryCheckStatus.RestaurantLocationUnknown => "Delivery isn't available online right now. Please call us to order.",
        _ => Quote?.Outcome switch
        {
            DeliveryQuoteOutcome.TooFar => $"Sorry, we only deliver within {MaxMilesText} miles. Collection is available.",
            DeliveryQuoteOutcome.NotConfigured => "Delivery isn't available online right now. Please call us to order.",
            _ => null,
        },
    };

    internal double MaxMiles { get; init; }
    private string MaxMilesText => MaxMiles.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture);
}

/// <summary>
/// Works out the delivery fee for an address: postcode -> map point -> which drawn zone it's in.
/// Used by the storefront's live quote, by order placement (the price that's actually
/// charged), and by the admin page's "Test a postcode".
/// </summary>
public class DeliveryQuoteService(AppDbContext db, IPostcodeLookup postcodes)
{
    public async Task<DeliveryCheck> CheckPostcodeAsync(Guid restaurantId, string postcode, CancellationToken ct = default)
    {
        // Delivery charges switched off: free, and no postcode/zone/distance checks - so a
        // restaurant without zones (or while the postcode service is down) still delivers.
        if (!await PricingEnabledAsync(restaurantId, ct))
            return Free(PostcodesIoLookup.Normalise(postcode));

        var lookup = await postcodes.LookupAsync(postcode, ct);
        return lookup.Status switch
        {
            PostcodeLookupStatus.Found => await PriceAsync(restaurantId, lookup.Location!, ct),
            PostcodeLookupStatus.NotFound => new DeliveryCheck(DeliveryCheckStatus.InvalidPostcode, null, null, null),
            _ => new DeliveryCheck(DeliveryCheckStatus.LookupUnavailable, null, null, null),
        };
    }

    /// <summary>"Use my location": finds the nearest postcode and prices that postcode, so the
    /// quote matches what checkout will charge for the same postcode.</summary>
    public async Task<DeliveryCheck> CheckPointAsync(Guid restaurantId, GeoPoint point, CancellationToken ct = default)
    {
        var lookup = await postcodes.NearestAsync(point, ct);
        var pricingOn = await PricingEnabledAsync(restaurantId, ct);
        return lookup.Status switch
        {
            // Still worth finding the postcode (it fills in the address), even when delivery is free.
            PostcodeLookupStatus.Found when !pricingOn => Free(lookup.Location!.Postcode),
            PostcodeLookupStatus.Found => await PriceAsync(restaurantId, lookup.Location!, ct),
            PostcodeLookupStatus.NotFound => new DeliveryCheck(DeliveryCheckStatus.InvalidPostcode, null, null, null),
            _ => new DeliveryCheck(DeliveryCheckStatus.LookupUnavailable, null, null, null),
        };
    }

    private Task<bool> PricingEnabledAsync(Guid restaurantId, CancellationToken ct) =>
        db.Restaurants.AsNoTracking().Where(r => r.Id == restaurantId).Select(r => r.DeliveryPricingEnabled).FirstOrDefaultAsync(ct);

    private static DeliveryCheck Free(string postcode) => new(DeliveryCheckStatus.Ok, postcode, null, DeliveryQuote.Free);

    /// <summary>The restaurant's map position, looking it up from its postcode the first time
    /// (and again after the postcode changes - the admin settings save clears it).</summary>
    public async Task<GeoPoint?> RestaurantLocationAsync(Restaurant restaurant, CancellationToken ct = default)
    {
        if (restaurant.Latitude is double lat && restaurant.Longitude is double lng)
            return new GeoPoint(lat, lng);

        var lookup = await postcodes.LookupAsync(restaurant.Postcode, ct);
        if (lookup.Status != PostcodeLookupStatus.Found)
            return null;

        restaurant.Latitude = lookup.Location!.Point.Latitude;
        restaurant.Longitude = lookup.Location.Point.Longitude;
        await db.SaveChangesAsync(ct);
        return lookup.Location.Point;
    }

    private async Task<DeliveryCheck> PriceAsync(Guid restaurantId, PostcodeLocation address, CancellationToken ct)
    {
        var restaurant = await db.Restaurants.FirstAsync(r => r.Id == restaurantId, ct);
        var origin = await RestaurantLocationAsync(restaurant, ct);
        if (origin is null)
            return new DeliveryCheck(DeliveryCheckStatus.RestaurantLocationUnknown, address.Postcode, address.Point, null);

        var zones = await LoadZonesAsync(restaurantId, ct);
        var quote = DeliveryPricing.Quote(origin.Value, address.Point, restaurant.MaxDeliveryMiles, zones,
            restaurant.OutsideZoneDeliveryFee, restaurant.OutsideZoneMinimumOrder);
        return new DeliveryCheck(DeliveryCheckStatus.Ok, address.Postcode, address.Point, quote) { MaxMiles = restaurant.MaxDeliveryMiles };
    }

    /// <summary>Active zones as pricing shapes. Undrawn zones still count towards the
    /// "highest zone fee" fallback - they're real prices the owner set.</summary>
    public async Task<List<DeliveryZoneShape>> LoadZonesAsync(Guid restaurantId, CancellationToken ct = default)
    {
        var zones = await db.DeliveryZones.AsNoTracking()
            .Where(z => z.RestaurantId == restaurantId && z.IsActive)
            .ToListAsync(ct);
        return zones
            .Select(z => new DeliveryZoneShape(z.Id, z.Name, z.DeliveryFee, z.MinimumOrderAmount, DeliveryPricing.ParseBoundary(z.BoundaryJson)))
            .ToList();
    }
}
