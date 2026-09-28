using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Platform.Application.Delivery;

namespace Platform.Infrastructure.Delivery;

/// <summary>
/// postcodes.io: free UK postcode data (ONS/OS open data), no API key. Postcodes barely ever
/// move, so found/not-found answers are cached for a day; outages are never cached.
/// </summary>
public class PostcodesIoLookup(HttpClient http, IMemoryCache cache, ILogger<PostcodesIoLookup> logger) : IPostcodeLookup
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromHours(24);

    public async Task<PostcodeLookupResult> LookupAsync(string postcode, CancellationToken ct = default)
    {
        var normalised = Normalise(postcode);
        if (normalised.Length is < 5 or > 8)
            return PostcodeLookupResult.NotFound;

        var key = $"postcode:{normalised}";
        if (cache.TryGetValue(key, out PostcodeLookupResult? cached) && cached is not null)
            return cached;

        try
        {
            using var response = await http.GetAsync($"postcodes/{Uri.EscapeDataString(normalised)}", ct);
            if (response.StatusCode == HttpStatusCode.NotFound)
                return cache.Set(key, PostcodeLookupResult.NotFound, CacheFor);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("postcodes.io lookup for {Postcode} returned {Status}", normalised, (int)response.StatusCode);
                return PostcodeLookupResult.Unavailable;
            }

            var body = await response.Content.ReadFromJsonAsync<SingleResponse>(ct);
            var result = ToResult(body?.Result);
            return cache.Set(key, result, CacheFor);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "postcodes.io lookup for {Postcode} failed", normalised);
            return PostcodeLookupResult.Unavailable;
        }
    }

    public async Task<PostcodeLookupResult> NearestAsync(GeoPoint point, CancellationToken ct = default)
    {
        try
        {
            var url = FormattableString.Invariant(
                $"postcodes?lon={point.Longitude:0.######}&lat={point.Latitude:0.######}&limit=1&radius=500");
            using var response = await http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("postcodes.io reverse lookup returned {Status}", (int)response.StatusCode);
                return PostcodeLookupResult.Unavailable;
            }

            var body = await response.Content.ReadFromJsonAsync<ListResponse>(ct);
            return ToResult(body?.Result?.FirstOrDefault());
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "postcodes.io reverse lookup failed");
            return PostcodeLookupResult.Unavailable;
        }
    }

    public async Task<List<PostcodeLocation>?> AroundAsync(IReadOnlyList<GeoPoint> points, int radiusMetres, CancellationToken ct = default)
    {
        var found = new Dictionary<string, PostcodeLocation>();
        try
        {
            // Bulk reverse geocoding takes at most 100 points per request.
            foreach (var chunk in points.Chunk(100))
            {
                var body = new
                {
                    geolocations = chunk.Select(p => new { latitude = p.Latitude, longitude = p.Longitude, radius = radiusMetres, limit = 100 }),
                };
                using var response = await http.PostAsJsonAsync("postcodes", body, ct);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("postcodes.io bulk reverse lookup returned {Status}", (int)response.StatusCode);
                    return null;
                }

                var result = await response.Content.ReadFromJsonAsync<BulkReverseResponse>(ct);
                foreach (var dto in (result?.Result ?? []).SelectMany(r => r.Result ?? []))
                {
                    if (ToResult(dto).Location is { } location)
                        found.TryAdd(location.Postcode, location);
                }
            }
            return found.Values.ToList();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "postcodes.io bulk reverse lookup failed");
            return null;
        }
    }

    /// <summary>"sa1 8jf" / "SA18JF" -> "SA1 8JF".</summary>
    public static string Normalise(string postcode)
    {
        var compact = new string(postcode.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return compact.Length > 3 ? $"{compact[..^3]} {compact[^3..]}" : compact;
    }

    private static PostcodeLookupResult ToResult(PostcodeDto? dto) =>
        dto?.Latitude is double lat && dto.Longitude is double lng && dto.Postcode is not null
            ? new PostcodeLookupResult(PostcodeLookupStatus.Found, new PostcodeLocation(dto.Postcode, new GeoPoint(lat, lng)))
            : PostcodeLookupResult.NotFound; // e.g. a terminated postcode with no coordinates

    private sealed record SingleResponse([property: JsonPropertyName("result")] PostcodeDto? Result);
    private sealed record ListResponse([property: JsonPropertyName("result")] List<PostcodeDto>? Result);
    private sealed record BulkReverseResponse([property: JsonPropertyName("result")] List<ListResponse>? Result);
    private sealed record PostcodeDto(
        [property: JsonPropertyName("postcode")] string? Postcode,
        [property: JsonPropertyName("latitude")] double? Latitude,
        [property: JsonPropertyName("longitude")] double? Longitude);
}
