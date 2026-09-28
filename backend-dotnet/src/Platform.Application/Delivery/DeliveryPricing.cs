using System.Text.Json;

namespace Platform.Application.Delivery;

public readonly record struct GeoPoint(double Latitude, double Longitude);

/// <summary>
/// A zone as the pricing logic sees it: its area plus its prices. The area is one or more
/// outlines (rings) read with the even-odd rule - a point is inside when it's inside an odd
/// number of rings - so a ring inside another is a hole, and separate rings are separate parts.
/// </summary>
public record DeliveryZoneShape(
    Guid Id, string Name, decimal DeliveryFee, decimal MinimumOrderAmount, IReadOnlyList<IReadOnlyList<GeoPoint>> Rings)
{
    public bool IsDrawn => Rings.Any(r => r.Count >= 3);
}

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
    /// <summary>The restaurant has delivery charges switched off: free, and nothing is checked.</summary>
    PricingOff,
}

public record DeliveryQuote(
    DeliveryQuoteOutcome Outcome, decimal DeliveryFee, decimal MinimumOrderAmount, Guid? ZoneId, string? ZoneName,
    double DistanceMiles)
{
    public bool CanDeliver => Outcome is DeliveryQuoteOutcome.InZone or DeliveryQuoteOutcome.OutsideZones or DeliveryQuoteOutcome.PricingOff;

    public static DeliveryQuote Free { get; } = new(DeliveryQuoteOutcome.PricingOff, 0, 0, null, null, 0);
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
    /// <summary>Corners allowed per zone, across all its rings (auto-drawn areas follow streets closely).</summary>
    public const int MaxCorners = 4000;

    public static DeliveryQuote Quote(
        GeoPoint restaurant, GeoPoint address, double maxDeliveryMiles,
        IReadOnlyCollection<DeliveryZoneShape> zones, decimal? outsideZoneFee, decimal? outsideZoneMinimum)
    {
        var distance = Math.Round(DistanceMiles(restaurant, address), 2);
        if (distance > maxDeliveryMiles)
            return new DeliveryQuote(DeliveryQuoteOutcome.TooFar, 0, 0, null, null, distance);

        var match = ZoneAt(zones, address);
        if (match is not null)
            return new DeliveryQuote(DeliveryQuoteOutcome.InZone, match.DeliveryFee, match.MinimumOrderAmount, match.Id, match.Name, distance);

        var fee = outsideZoneFee ?? (zones.Count > 0 ? zones.Max(z => z.DeliveryFee) : null);
        if (fee is null)
            return new DeliveryQuote(DeliveryQuoteOutcome.NotConfigured, 0, 0, null, null, distance);

        var minimum = outsideZoneMinimum ?? (zones.Count > 0 ? zones.Max(z => z.MinimumOrderAmount) : 0);
        return new DeliveryQuote(DeliveryQuoteOutcome.OutsideZones, fee.Value, minimum, null, OutsideZonesName, distance);
    }

    /// <summary>The zone that prices a point. Overlapping shapes: the cheaper zone wins, so a
    /// customer is never overcharged by a slightly-too-generous drawing. Ties go to the lower
    /// minimum, then the name.</summary>
    public static DeliveryZoneShape? ZoneAt(IEnumerable<DeliveryZoneShape> zones, GeoPoint point) =>
        zones
            .Where(z => z.IsDrawn && Contains(z.Rings, point))
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.MinimumOrderAmount).ThenBy(z => z.Name, StringComparer.Ordinal)
            .FirstOrDefault();

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

    /// <summary>Even-odd point-in-area over all of a zone's rings.</summary>
    public static bool Contains(IReadOnlyList<IReadOnlyList<GeoPoint>> rings, GeoPoint p)
    {
        var inside = false;
        foreach (var ring in rings)
            if (ring.Count >= 3 && Contains(ring, p))
                inside = !inside;
        return inside;
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

    /// <summary>Parses DeliveryZone.BoundaryJson: either one ring ([[lat,lng],...], the original
    /// format) or several ([[[lat,lng],...],...]). Returns no rings for null or malformed input,
    /// so a broken shape simply never matches rather than failing checkout.</summary>
    public static IReadOnlyList<IReadOnlyList<GeoPoint>> ParseBoundary(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() == 0) return [];

            var first = root[0];
            var isSingleRing = first.ValueKind == JsonValueKind.Array && first.GetArrayLength() > 0
                               && first[0].ValueKind == JsonValueKind.Number;
            var rings = isSingleRing ? [root] : root.EnumerateArray().ToList();

            return rings
                .Select(r => (IReadOnlyList<GeoPoint>)r.EnumerateArray()
                    .Where(p => p.ValueKind == JsonValueKind.Array && p.GetArrayLength() >= 2
                                && p[0].ValueKind == JsonValueKind.Number && p[1].ValueKind == JsonValueKind.Number)
                    .Select(p => new GeoPoint(p[0].GetDouble(), p[1].GetDouble()))
                    .ToList())
                .Where(r => r.Count >= 3)
                .ToList();
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException)
        {
            return [];
        }
    }

    /// <summary>Validates and normalises a zone's rings from the admin map. Returns an error
    /// message, or null when valid (with <paramref name="json"/> set to the stored form).</summary>
    public static string? NormaliseBoundary(IReadOnlyList<IReadOnlyList<double[]>>? rings, out string? json)
    {
        json = null;
        var nonEmpty = rings?.Where(r => r.Count > 0).ToList() ?? [];
        if (nonEmpty.Count == 0) return null; // no shape yet - allowed
        if (nonEmpty.Any(r => r.Count < 3)) return "A zone's shape needs at least 3 corners.";
        if (nonEmpty.Sum(r => r.Count) > MaxCorners) return $"A zone's shape can have at most {MaxCorners} corners.";
        foreach (var p in nonEmpty.SelectMany(r => r))
        {
            if (p.Length < 2 || double.IsNaN(p[0]) || double.IsNaN(p[1])
                || p[0] is < -90 or > 90 || p[1] is < -180 or > 180)
                return "The zone's shape has an invalid point.";
        }
        json = JsonSerializer.Serialize(nonEmpty.Select(r => r.Select(p => new[] { Math.Round(p[0], 6), Math.Round(p[1], 6) })));
        return null;
    }

    public static string SerializeRings(IEnumerable<IReadOnlyList<GeoPoint>> rings) =>
        JsonSerializer.Serialize(rings.Select(r => r.Select(p => new[] { Math.Round(p.Latitude, 6), Math.Round(p.Longitude, 6) })));
}
