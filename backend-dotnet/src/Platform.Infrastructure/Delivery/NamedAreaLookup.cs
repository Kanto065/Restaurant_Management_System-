using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Platform.Application.Delivery;

namespace Platform.Infrastructure.Delivery;

public record AreaLookupResult(AreaReference? Area, bool ServiceUnavailable = false);

/// <summary>
/// Finds where a named area (a zone's name, e.g. "Hafod") really is, near the restaurant:
/// 1. an OpenStreetMap outline - an official boundary or a mapped place area (Nominatim);
/// 2. otherwise the Ordnance Survey place-name extent (via postcodes.io) - a rectangle.
/// Roads, harbours and bare points are not accepted: in testing they were the unreliable
/// answers ("Waun Wen" came back as a railway station). Answers are cached for a week.
/// </summary>
public class NamedAreaLookup(IHttpClientFactory httpFactory, IMemoryCache cache, ILogger<NamedAreaLookup> logger)
{
    public const string NominatimClient = "nominatim";
    public const string PostcodesClient = "postcodes-places";

    // OpenStreetMap's usage policy: at most one request a second, from the whole app.
    private static readonly SemaphoreSlim NominatimGate = new(1, 1);
    private static DateTimeOffset _lastNominatimCall = DateTimeOffset.MinValue;

    /// <summary>Other spellings worth trying for names seen in the owner's zones. Kept small and
    /// explicit - a typo ("St Tomas") or a Welsh hyphenation ("Bon-y-maen") can't be guessed.</summary>
    private static readonly Dictionary<string, string[]> KnownSpellings = new()
    {
        ["sttomas"] = ["St Thomas"],
        ["bonymaen"] = ["Bon-y-maen", "Bôn-y-maen"],
        ["plasmarl"] = ["Plas-marl"],
    };

    /// <param name="withinMiles">Only areas centred this close to the restaurant count - the
    /// delivery limit plus a margin, so "Sandfields" can't pick up Port Talbot's.</param>
    public async Task<AreaLookupResult> FindAsync(string zoneName, GeoPoint near, string town, double withinMiles, CancellationToken ct = default)
    {
        var name = zoneName.Trim();
        var key = $"named-area:{Normalise(name)}:{Math.Round(near.Latitude, 2)}:{Math.Round(near.Longitude, 2)}:{Math.Round(withinMiles)}";
        if (cache.TryGetValue(key, out AreaLookupResult? cached) && cached is not null)
            return cached;

        var unavailable = false;
        foreach (var variant in Variants(name))
        {
            var outline = await OsmOutlineAsync(variant, near, town, withinMiles, ct);
            if (outline.Unavailable) unavailable = true;
            if (outline.Area is not null) return cache.Set(key, new AreaLookupResult(outline.Area), TimeSpan.FromDays(7));
        }
        foreach (var variant in Variants(name))
        {
            var extent = await OsPlaceExtentAsync(variant, near, withinMiles, ct);
            if (extent.Unavailable) unavailable = true;
            if (extent.Area is not null) return cache.Set(key, new AreaLookupResult(extent.Area), TimeSpan.FromDays(7));
        }

        var none = new AreaLookupResult(null, unavailable);
        // "Not found" is worth remembering; "couldn't ask" isn't.
        return unavailable ? none : cache.Set(key, none, TimeSpan.FromDays(7));
    }

    private static IEnumerable<string> Variants(string name)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        IEnumerable<string> All()
        {
            yield return name;
            if (KnownSpellings.TryGetValue(Normalise(name), out var extra)) foreach (var e in extra) yield return e;
            yield return name.Replace(" ", "");                                  // "May hill" -> "Mayhill"
            if (!name.EndsWith('s')) yield return name + "s";                    // "Upland" -> "Uplands"
            yield return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(name.ToLowerInvariant()); // "waun wen" -> "Waun Wen"
        }
        return All().Where(v => seen.Add(v));
    }

    public static string Normalise(string s) => new string(s.ToLowerInvariant().Where(char.IsLetter).ToArray());

    // ---- OpenStreetMap (Nominatim) ----

    private async Task<(AreaReference? Area, bool Unavailable)> OsmOutlineAsync(string name, GeoPoint near, string town, double withinMiles, CancellationToken ct)
    {
        // Only look within ~10 km of the restaurant, so "Sandfields" doesn't find Port Talbot's.
        var box = FormattableString.Invariant(
            $"{near.Longitude - 0.15},{near.Latitude + 0.09},{near.Longitude + 0.15},{near.Latitude - 0.09}");
        var url = $"search?q={Uri.EscapeDataString($"{name}, {town}")}&format=jsonv2&polygon_geojson=1&limit=5&countrycodes=gb&viewbox={box}&bounded=1";

        await NominatimGate.WaitAsync(ct);
        try
        {
            var wait = _lastNominatimCall.AddMilliseconds(1100) - DateTimeOffset.UtcNow;
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            _lastNominatimCall = DateTimeOffset.UtcNow;

            using var response = await httpFactory.CreateClient(NominatimClient).GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Nominatim search for {Name} returned {Status}", name, (int)response.StatusCode);
                return (null, true);
            }

            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            foreach (var hit in doc.RootElement.EnumerateArray())
            {
                var category = hit.TryGetProperty("category", out var c) ? c.GetString() : null;
                if (category is not ("boundary" or "place")) continue;
                if (!NamesMatch(name, hit)) continue;
                if (!hit.TryGetProperty("geojson", out var geo)) continue;

                var rings = OuterRings(geo);
                if (rings.Count == 0) continue;
                var centre = new GeoPoint(rings.SelectMany(r => r).Average(p => p.Latitude), rings.SelectMany(r => r).Average(p => p.Longitude));
                if (DeliveryPricing.DistanceMiles(near, centre) > withinMiles) continue;
                var label = hit.TryGetProperty("name", out var n) && n.GetString() is { Length: > 0 } nm ? nm : name;
                var source = category == "boundary" ? "OpenStreetMap official boundary" : "OpenStreetMap place area";
                return (new AreaReference(label, source, rings), false);
            }
            return (null, false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "Nominatim search for {Name} failed", name);
            return (null, true);
        }
        finally
        {
            NominatimGate.Release();
        }
    }

    private static bool NamesMatch(string wanted, JsonElement hit)
    {
        var name = hit.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        // Exact (ignoring accents, spaces and punctuation): "Sketty" mustn't pick up "Sketty Park".
        var a = Normalise(RemoveAccents(wanted));
        return a.Length > 0 && a == Normalise(RemoveAccents(name));
    }

    private static string RemoveAccents(string s) =>
        new string(s.Normalize(System.Text.NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark).ToArray());

    /// <summary>GeoJSON Polygon / MultiPolygon -> outer rings as [lat, lng] points (holes dropped).</summary>
    private static List<IReadOnlyList<GeoPoint>> OuterRings(JsonElement geo)
    {
        var type = geo.TryGetProperty("type", out var t) ? t.GetString() : null;
        if (!geo.TryGetProperty("coordinates", out var coords)) return [];

        static IReadOnlyList<GeoPoint> Ring(JsonElement ring) =>
            ring.EnumerateArray().Select(p => new GeoPoint(p[1].GetDouble(), p[0].GetDouble())).ToList();

        return type switch
        {
            "Polygon" => coords.GetArrayLength() > 0 ? [Ring(coords[0])] : [],
            "MultiPolygon" => coords.EnumerateArray().Where(poly => poly.GetArrayLength() > 0).Select(poly => Ring(poly[0])).ToList(),
            _ => [],
        };
    }

    // ---- Ordnance Survey place names (via postcodes.io) ----

    private async Task<(AreaReference? Area, bool Unavailable)> OsPlaceExtentAsync(string name, GeoPoint near, double withinMiles, CancellationToken ct)
    {
        try
        {
            var client = httpFactory.CreateClient(PostcodesClient);
            var body = await client.GetFromJsonAsync<JsonElement>($"places?q={Uri.EscapeDataString(name)}&limit=20", ct);
            if (!body.TryGetProperty("result", out var results) || results.ValueKind != JsonValueKind.Array) return (null, false);

            foreach (var p in results.EnumerateArray())
            {
                var placeName = p.TryGetProperty("name_1", out var n1) ? n1.GetString() ?? "" : "";
                if (Normalise(RemoveAccents(placeName)) != Normalise(RemoveAccents(name))) continue;
                if (!TryDouble(p, "latitude", out var lat) || !TryDouble(p, "longitude", out var lng)) continue;
                var centre = new GeoPoint(lat, lng);
                if (DeliveryPricing.DistanceMiles(near, centre) > withinMiles) continue; // a different place with the same name

                if (!TryDouble(p, "eastings", out var e) || !TryDouble(p, "northings", out var nth)
                    || !TryDouble(p, "min_eastings", out var minE) || !TryDouble(p, "max_eastings", out var maxE)
                    || !TryDouble(p, "min_northings", out var minN) || !TryDouble(p, "max_northings", out var maxN))
                    continue;

                // OS grid metres around the place's centre -> lat/lng (flat approximation, town scale).
                var kx = 111_320 * Math.Cos(lat * Math.PI / 180);
                const double ky = 110_574;
                double s = lat - (nth - minN) / ky, nn = lat + (maxN - nth) / ky, w = lng - (e - minE) / kx, ea = lng + (maxE - e) / kx;
                if (nn - s < 0.0005 || ea - w < 0.0008) continue; // a spot, not an area
                IReadOnlyList<GeoPoint> ring = [new(s, w), new(nn, w), new(nn, ea), new(s, ea)];
                return (new AreaReference(placeName, "Ordnance Survey place area", [ring]), false);
            }
            return (null, false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning(ex, "postcodes.io places search for {Name} failed", name);
            return (null, true);
        }
    }

    private static bool TryDouble(JsonElement e, string prop, out double value)
    {
        value = 0;
        return e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out value);
    }
}
