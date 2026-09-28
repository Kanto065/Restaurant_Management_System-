using Microsoft.Extensions.Caching.Memory;
using Platform.Application.Delivery;

namespace Platform.Infrastructure.Delivery;

/// <summary>
/// Every real postcode inside a map box. postcodes.io is asked about a fixed ~250 m grid of
/// points (so panning and repeated checks reuse cached grid squares for a day).
/// </summary>
public class PostcodeGrid(IPostcodeLookup postcodes, IMemoryCache cache)
{
    private const double LatStep = 0.0025, LngStep = 0.004;

    /// <returns>Null when the postcode service isn't answering.</returns>
    public async Task<List<PostcodeLocation>?> InBoxAsync(double south, double west, double north, double east, CancellationToken ct = default)
    {
        var cells = new List<GeoPoint>();
        for (var la = Math.Floor(south / LatStep) * LatStep; la <= north + LatStep / 2; la += LatStep)
            for (var ln = Math.Floor(west / LngStep) * LngStep; ln <= east + LngStep / 2; ln += LngStep)
                cells.Add(new GeoPoint(Math.Round(la, 4), Math.Round(ln, 4)));

        var found = new Dictionary<string, PostcodeLocation>();
        var missing = new List<GeoPoint>();
        foreach (var cell in cells)
        {
            if (cache.TryGetValue(Key(cell), out List<PostcodeLocation>? hit) && hit is not null)
                foreach (var p in hit) found.TryAdd(p.Postcode, p);
            else
                missing.Add(cell);
        }

        if (missing.Count > 0)
        {
            var fetched = await postcodes.AroundAsync(missing, 250, ct);
            if (fetched is null) return null;

            foreach (var cell in missing)
            {
                // A postcode belongs to the grid square it sits in, so each square caches its own.
                var inCell = fetched.Where(p =>
                    p.Point.Latitude >= cell.Latitude - LatStep / 2 && p.Point.Latitude < cell.Latitude + LatStep / 2
                    && p.Point.Longitude >= cell.Longitude - LngStep / 2 && p.Point.Longitude < cell.Longitude + LngStep / 2).ToList();
                cache.Set(Key(cell), inCell, TimeSpan.FromHours(24));
            }
            foreach (var p in fetched) found.TryAdd(p.Postcode, p);
        }

        return found.Values
            .Where(p => p.Point.Latitude >= south && p.Point.Latitude <= north && p.Point.Longitude >= west && p.Point.Longitude <= east)
            .ToList();
    }

    private static string Key(GeoPoint cell) => $"postcode-cell:{cell.Latitude}:{cell.Longitude}";
}
