using System.Text.Json;

namespace Platform.Application.Delivery;

public readonly record struct GeoPoint(double Latitude, double Longitude);

/// <summary>A zone as the pricing logic sees it: an outline plus its prices.</summary>
public record DeliveryZoneShape(Guid Id, string Name, decimal DeliveryFee, decimal MinimumOrderAmount, IReadOnlyList<GeoPoint> Boundary);

public enum DeliveryQuoteOutcome
{
    /// <summary>Inside a drawn zone - that zone's fee applies.</summary>
    InZone,
    /// <summary>Within the delivery radius but inside no zone - the "anywhere else" fee applies.</summary>
    OutsideZones,
    /// <summary>Further than the restaurant delivers.</summary>
    TooFar,
    /// <summary>The restaurant hasn't set up delivery pricing (no zones and no "anywhere else" fee).</summary>
    NotConfigured,
}

public record DeliveryQuote(
    DeliveryQuoteOutcome Outcome, decimal DeliveryFee, decimal MinimumOrderAmount, Guid? ZoneId, string? ZoneName,
    double DistanceMiles)
{
    public bool CanDeliver => Outcome is DeliveryQuoteOutcome.InZone or DeliveryQuoteOutcome.OutsideZones;
}

/// <summary>
/// Prices a delivery by which drawn zone the address falls inside. Distance is only used for
/// the "we don't deliver beyond N miles" limit, never for the price - the owner's zones are
/// areas (St Thomas is next door but costs more than Port Tennant), not mileage rings.
/// </summary>
public static class DeliveryPricing
{
    public const string OutsideZonesName = "Anywhere else";
    private const double EarthRadiusMiles = 3958.8;

    public static DeliveryQuote Quote(
        GeoPoint restaurant, GeoPoint address, double maxDeliveryMiles,
        IReadOnlyCollection<DeliveryZoneShape> zones, decimal? outsideZoneFee, decimal? outsideZoneMinimum)
    {
        var distance = Math.Round(DistanceMiles(restaurant, address), 2);
        if (distance > maxDeliveryMiles)
            return new DeliveryQuote(DeliveryQuoteOutcome.TooFar, 0, 0, null, null, distance);

        // Overlapping shapes: the cheaper zone wins, so a customer is never overcharged by an
        // owner's slightly-too-generous drawing. Ties go to the lower minimum, then the name.
        var match = zones
            .Where(z => z.Boundary.Count >= 3 && Contains(z.Boundary, address))
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.MinimumOrderAmount).ThenBy(z => z.Name, StringComparer.Ordinal)
            .FirstOrDefault();
        if (match is not null)
            return new DeliveryQuote(DeliveryQuoteOutcome.InZone, match.DeliveryFee, match.MinimumOrderAmount, match.Id, match.Name, distance);

        var fee = outsideZoneFee ?? (zones.Count > 0 ? zones.Max(z => z.DeliveryFee) : null);
        if (fee is null)
            return new DeliveryQuote(DeliveryQuoteOutcome.NotConfigured, 0, 0, null, null, distance);

        var minimum = outsideZoneMinimum ?? (zones.Count > 0 ? zones.Max(z => z.MinimumOrderAmount) : 0);
        return new DeliveryQuote(DeliveryQuoteOutcome.OutsideZones, fee.Value, minimum, null, OutsideZonesName, distance);
    }

    /// <summary>Great-circle (straight-line) distance.</summary>
    public static double DistanceMiles(GeoPoint a, GeoPoint b)
    {
        static double Rad(double deg) => deg * Math.PI / 180;
        var dLat = Rad(b.Latitude - a.Latitude);
        var dLng = Rad(b.Longitude - a.Longitude);
        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(Rad(a.Latitude)) * Math.Cos(Rad(b.Latitude)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * EarthRadiusMiles * Math.Asin(Math.Sqrt(h));
    }

    /// <summary>Ray-casting point-in-polygon. Treating lat/lng as flat is fine at town scale.</summary>
    public static bool Contains(IReadOnlyList<GeoPoint> polygon, GeoPoint p)
    {
        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var a = polygon[i];
            var b = polygon[j];
            if ((a.Latitude > p.Latitude) != (b.Latitude > p.Latitude)
                && p.Longitude < (b.Longitude - a.Longitude) * (p.Latitude - a.Latitude) / (b.Latitude - a.Latitude) + a.Longitude)
                inside = !inside;
        }
        return inside;
    }

    /// <summary>Parses DeliveryZone.BoundaryJson ([[lat,lng],...]). Returns empty for null or
    /// malformed input, so a broken shape simply never matches rather than failing checkout.</summary>
    public static IReadOnlyList<GeoPoint> ParseBoundary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            var raw = JsonSerializer.Deserialize<double[][]>(json);
            if (raw is null) return [];
            return raw.Where(p => p.Length >= 2).Select(p => new GeoPoint(p[0], p[1])).ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>Validates and normalises an outline from the admin map. Returns an error message,
    /// or null when valid (with <paramref name="json"/> set to the stored form).</summary>
    public static string? NormaliseBoundary(IReadOnlyList<double[]>? points, out string? json)
    {
        json = null;
        if (points is null || points.Count == 0) return null; // no shape yet - allowed
        if (points.Count < 3) return "A zone's shape needs at least 3 corners.";
        if (points.Count > 500) return "A zone's shape can have at most 500 corners.";
        foreach (var p in points)
        {
            if (p.Length < 2 || double.IsNaN(p[0]) || double.IsNaN(p[1])
                || p[0] is < -90 or > 90 || p[1] is < -180 or > 180)
                return "The zone's shape has an invalid point.";
        }
        json = JsonSerializer.Serialize(points.Select(p => new[] { Math.Round(p[0], 6), Math.Round(p[1], 6) }));
        return null;
    }
}
