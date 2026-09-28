using Microsoft.EntityFrameworkCore;
using Platform.Application.Delivery;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Delivery;

/// <param name="ChargedAs">The zone those postcodes are charged at now ("Anywhere else" when none).</param>
public record ZoneCheckMiss(string ChargedAs, int Count, List<string> Postcodes, List<double[]> Points);

/// <summary>How well one zone name's drawn shape matches where that named area really is.</summary>
/// <param name="Found">False when the area couldn't be found on OpenStreetMap / Ordnance Survey.</param>
/// <param name="Checked">Real postcodes in the named area (within the delivery limit).</param>
/// <param name="Correct">...of which are charged at a zone with this name.</param>
public record ZoneCheckResult(
    string Name, List<Guid> ZoneIds, bool Found, string? AreaSource, string? AreaLabel,
    int Checked, int Correct, List<ZoneCheckMiss> Misses);

public record ZoneCheckReport(List<ZoneCheckResult> Zones, bool ServiceProblem);

public record AutoDrawOutcome(List<string> Drawn, List<string> NotFound, List<string> Kept, bool ServiceProblem);

/// <param name="Postcodes">Postcodes the zone charged before trimming (with a road distance).</param>
/// <param name="TooFar">...of which were further by road than the zone's stated miles.</param>
/// <param name="Outcome">"trimmed", "already within", "no stated miles", "no postcodes" or "all too far".</param>
public record ZoneTrimResult(string Name, double StatedMiles, int Postcodes, int TooFar, double FurthestRoadMiles, string Outcome);

public record TrimOutcome(List<ZoneTrimResult> Zones, bool ServiceProblem);

/// <summary>
/// "Check zones" and "Auto-draw from name": both look up where each zone's named area really is
/// (NamedAreaLookup), then either compare the real postcodes there with what the drawn shapes
/// charge them, or draw the shapes from those areas (ZoneAreaBuilder).
/// </summary>
public class ZoneToolsService(
    AppDbContext db, DeliveryQuoteService quotes, NamedAreaLookup areas, PostcodeGrid postcodeGrid, IRoadDistance roads)
{
    public async Task<ZoneCheckReport> CheckAsync(Guid restaurantId, CancellationToken ct = default)
    {
        var restaurant = await db.Restaurants.FirstAsync(r => r.Id == restaurantId, ct);
        var origin = await quotes.RestaurantLocationAsync(restaurant, ct);
        var zones = await ActiveZonesAsync(restaurantId, ct);
        if (origin is null || zones.Count == 0) return new ZoneCheckReport([], origin is null);

        var groups = zones.GroupBy(z => NamedAreaLookup.Normalise(z.Name)).ToList();
        var found = new List<(IGrouping<string, DeliveryZone> Group, AreaReference Area)>();
        var results = new Dictionary<string, ZoneCheckResult>();
        var serviceProblem = false;

        foreach (var g in groups)
        {
            var lookup = await areas.FindAsync(g.First().Name, origin.Value, restaurant.City, restaurant.MaxDeliveryMiles + 1, ct);
            serviceProblem |= lookup.ServiceUnavailable;
            if (lookup.Area is null)
                results[g.Key] = new ZoneCheckResult(g.First().Name.Trim(), g.Select(z => z.Id).ToList(), false, null, null, 0, 0, []);
            else
                found.Add((g, lookup.Area));
        }

        var shapes = zones.Select(ToShape).ToList();
        var index = new ZoneAreaBuilder.AreaIndex(found.Select(f => f.Area).ToList(), origin.Value);
        for (var i = 0; i < found.Count; i++)
        {
            var (group, area) = found[i];
            var (sw, ne) = index.Bounds(i);
            var inBox = await postcodeGrid.InBoxAsync(sw.Latitude, sw.Longitude, ne.Latitude, ne.Longitude, ct);
            if (inBox is null) { serviceProblem = true; inBox = []; }

            var correct = 0;
            var misses = new Dictionary<string, ZoneCheckMiss>();
            foreach (var pc in inBox)
            {
                // Only postcodes whose most specific named area is this one, within the delivery limit.
                if (index.MostSpecific(pc.Point) != i) continue;
                if (DeliveryPricing.DistanceMiles(origin.Value, pc.Point) > restaurant.MaxDeliveryMiles) continue;

                var chargedAs = DeliveryPricing.ZoneAt(shapes, pc.Point)?.Name.Trim() ?? DeliveryPricing.OutsideZonesName;
                if (NamedAreaLookup.Normalise(chargedAs) == group.Key) { correct++; continue; }

                if (!misses.TryGetValue(chargedAs, out var miss))
                    misses[chargedAs] = miss = new ZoneCheckMiss(chargedAs, 0, [], []);
                misses[chargedAs] = miss with { Count = miss.Count + 1 };
                if (miss.Postcodes.Count < 300)
                {
                    miss.Postcodes.Add(pc.Postcode);
                    miss.Points.Add([pc.Point.Latitude, pc.Point.Longitude]);
                }
            }

            var total = correct + misses.Values.Sum(m => m.Count);
            results[group.Key] = new ZoneCheckResult(
                group.First().Name.Trim(), group.Select(z => z.Id).ToList(), true, area.Source, area.Label,
                total, correct, misses.Values.OrderByDescending(m => m.Count).ToList());
        }

        // Keep the owner's zone order (by price) in the report.
        var ordered = groups.Select(g => results[g.Key]).ToList();
        return new ZoneCheckReport(ordered, serviceProblem);
    }

    /// <summary>
    /// Redraws zones from where their named areas really are. <paramref name="zoneIds"/> = the
    /// zones to redraw (null = every active zone); <paramref name="keepZoneIds"/> are never
    /// touched. Zones not redrawn keep their shapes and their ground: new shapes don't cover them.
    /// Each redrawn zone's old shape is kept for "Restore previous area".
    /// </summary>
    public async Task<AutoDrawOutcome> AutoDrawAsync(
        Guid restaurantId, IReadOnlyCollection<Guid>? zoneIds, IReadOnlyCollection<Guid> keepZoneIds, CancellationToken ct = default)
    {
        var restaurant = await db.Restaurants.FirstAsync(r => r.Id == restaurantId, ct);
        var origin = await quotes.RestaurantLocationAsync(restaurant, ct);
        var zones = await db.DeliveryZones.Where(z => z.RestaurantId == restaurantId && z.IsActive).ToListAsync(ct);
        if (origin is null) return new AutoDrawOutcome([], [], [], true);

        var wanted = zones.Where(z => (zoneIds is null || zoneIds.Contains(z.Id)) && !keepZoneIds.Contains(z.Id)).ToList();
        var targets = new List<ZoneDrawTarget>();
        var notFound = new List<string>();
        var serviceProblem = false;

        foreach (var g in wanted.GroupBy(z => NamedAreaLookup.Normalise(z.Name)))
        {
            var lookup = await areas.FindAsync(g.First().Name, origin.Value, restaurant.City, restaurant.MaxDeliveryMiles + 1, ct);
            serviceProblem |= lookup.ServiceUnavailable;
            if (lookup.Area is null) { notFound.Add(g.First().Name.Trim()); continue; }
            // Cheapest first: with two prices for one name, the cheaper gets the nearer half.
            targets.Add(new ZoneDrawTarget(lookup.Area, g.OrderBy(z => z.DeliveryFee).Select(z => z.Id).ToList()));
        }

        var redrawIds = targets.SelectMany(t => t.ZoneIds).ToHashSet();
        var kept = zones.Where(z => !redrawIds.Contains(z.Id)).ToList();
        // Redrawing everything fills the gaps between named areas from the nearest one; drawing
        // just one or two zones only takes their named area (never neighbours' leftover ground).
        var fill = zoneIds is null ? 300 : 0;
        var built = ZoneAreaBuilder.Build(origin.Value, restaurant.MaxDeliveryMiles, targets,
            kept.Select(ToShape).ToList(), fillMetres: fill);

        var drawn = new List<string>();
        foreach (var zone in zones.Where(z => built.ContainsKey(z.Id)))
        {
            zone.PreviousBoundaryJson = zone.BoundaryJson;
            zone.BoundaryJson = DeliveryPricing.SerializeRings(built[zone.Id]);
            drawn.Add(zone.Name.Trim());
        }
        await db.SaveChangesAsync(ct);

        // Zones we looked up but that ended up with no ground at all (e.g. all inside kept zones).
        notFound.AddRange(zones.Where(z => redrawIds.Contains(z.Id) && !built.ContainsKey(z.Id)).Select(z => z.Name.Trim()));
        return new AutoDrawOutcome(drawn, notFound.Distinct().ToList(),
            kept.Where(z => !notFound.Contains(z.Name.Trim())).Select(z => z.Name.Trim()).Distinct().ToList(), serviceProblem);
    }

    /// <summary>
    /// Cuts each zone back to its stated miles by road ("up to 2 miles"): the parts whose
    /// nearest postcodes are further by road are removed, so those addresses pay the "anywhere
    /// else" price (or get no delivery beyond the limit). Zones in <paramref name="keepZoneIds"/>
    /// and zones without stated miles are left alone. Old shapes are kept for "Restore previous area".
    /// </summary>
    public async Task<TrimOutcome> TrimToStatedMilesAsync(
        Guid restaurantId, IReadOnlyCollection<Guid>? zoneIds, IReadOnlyCollection<Guid> keepZoneIds, CancellationToken ct = default)
    {
        var restaurant = await db.Restaurants.FirstAsync(r => r.Id == restaurantId, ct);
        var origin = await quotes.RestaurantLocationAsync(restaurant, ct);
        var zones = await db.DeliveryZones.Where(z => z.RestaurantId == restaurantId && z.IsActive).ToListAsync(ct);
        if (origin is null) return new TrimOutcome([], true);

        var shapes = zones.Select(ToShape).Where(z => z.IsDrawn).ToList();
        var targets = zones
            .Where(z => (zoneIds is null || zoneIds.Contains(z.Id)) && !keepZoneIds.Contains(z.Id) && shapes.Any(s => s.Id == z.Id))
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.Name)
            .ToList();

        var results = new List<ZoneTrimResult>();
        var serviceProblem = false;
        foreach (var zone in targets)
        {
            var name = zone.Name.Trim();
            if (zone.MaxMileage <= 0) { results.Add(new(name, 0, 0, 0, 0, "no stated miles")); continue; }

            // The postcodes this zone actually charges (the cheaper zone wins where shapes overlap).
            var rings = shapes.First(s => s.Id == zone.Id).Rings;
            var all = rings.SelectMany(r => r).ToList();
            var inBox = await postcodeGrid.InBoxAsync(all.Min(p => p.Latitude), all.Min(p => p.Longitude),
                all.Max(p => p.Latitude), all.Max(p => p.Longitude), ct);
            if (inBox is null) { serviceProblem = true; continue; }
            var charged = inBox.Where(p => DeliveryPricing.ZoneAt(shapes, p.Point)?.Id == zone.Id).ToList();
            if (charged.Count == 0) { results.Add(new(name, zone.MaxMileage, 0, 0, 0, "no postcodes")); continue; }

            var road = await roads.FromAsync(origin.Value, charged.Select(p => p.Point).ToList(), ct);
            if (road is null) { serviceProblem = true; continue; }
            var samples = charged.Zip(road)
                .Where(x => x.Second is not null)
                .Select(x => new ZoneAreaBuilder.RoadSample(x.First.Point, x.Second!.Value))
                .ToList();
            var tooFar = samples.Count(s => s.RoadMiles > zone.MaxMileage + 0.05);
            var furthest = samples.Count > 0 ? Math.Round(samples.Max(s => s.RoadMiles), 2) : 0;

            var trimmed = ZoneAreaBuilder.TrimToRoadMiles(origin.Value, rings, samples, zone.MaxMileage);
            if (trimmed is null) { results.Add(new(name, zone.MaxMileage, samples.Count, tooFar, furthest, "already within")); continue; }

            zone.PreviousBoundaryJson = zone.BoundaryJson;
            zone.BoundaryJson = trimmed.Count == 0 ? null : DeliveryPricing.SerializeRings(trimmed);
            results.Add(new(name, zone.MaxMileage, samples.Count, tooFar, furthest, trimmed.Count == 0 ? "all too far" : "trimmed"));
        }
        await db.SaveChangesAsync(ct);
        return new TrimOutcome(results, serviceProblem);
    }

    /// <summary>Undo the last automatic redraw of one zone. False when there's nothing to restore.</summary>
    public async Task<bool> RestorePreviousAsync(Guid zoneId, CancellationToken ct = default)
    {
        var zone = await db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == zoneId, ct);
        if (zone?.PreviousBoundaryJson is null) return false;
        (zone.BoundaryJson, zone.PreviousBoundaryJson) = (zone.PreviousBoundaryJson, zone.BoundaryJson);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private Task<List<DeliveryZone>> ActiveZonesAsync(Guid restaurantId, CancellationToken ct) =>
        db.DeliveryZones.AsNoTracking()
            .Where(z => z.RestaurantId == restaurantId && z.IsActive)
            .OrderBy(z => z.DeliveryFee).ThenBy(z => z.Name)
            .ToListAsync(ct);

    private static DeliveryZoneShape ToShape(DeliveryZone z) =>
        new(z.Id, z.Name.Trim(), z.DeliveryFee, z.MinimumOrderAmount, DeliveryPricing.ParseBoundary(z.BoundaryJson));
}
