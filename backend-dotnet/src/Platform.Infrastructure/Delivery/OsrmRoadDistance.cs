using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Platform.Application.Delivery;

namespace Platform.Infrastructure.Delivery;

/// <summary>
/// Road distances from OSRM's "table" service. The default is the public OSRM demo server,
/// which asks for light use only (about one request a second) - fine for the occasional admin
/// "trim to stated miles", never for checkout. Point Osrm:BaseUrl at a self-hosted OSRM for more.
/// </summary>
public class OsrmRoadDistance(HttpClient http, ILogger<OsrmRoadDistance> logger) : IRoadDistance
{
    private const int MaxPerRequest = 99; // plus the origin: the demo server's 100-point limit
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static DateTimeOffset _lastCall = DateTimeOffset.MinValue;

    public async Task<double?[]?> FromAsync(GeoPoint origin, IReadOnlyList<GeoPoint> destinations, CancellationToken ct = default)
    {
        var miles = new double?[destinations.Count];
        for (var start = 0; start < destinations.Count; start += MaxPerRequest)
        {
            var chunk = destinations.Skip(start).Take(MaxPerRequest).ToList();
            var coords = string.Join(';', new[] { origin }.Concat(chunk)
                .Select(p => string.Create(CultureInfo.InvariantCulture, $"{p.Longitude:0.#####},{p.Latitude:0.#####}")));

            await Gate.WaitAsync(ct);
            try
            {
                var wait = _lastCall.AddMilliseconds(1100) - DateTimeOffset.UtcNow;
                if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
                _lastCall = DateTimeOffset.UtcNow;

                using var response = await http.GetAsync($"table/v1/driving/{coords}?sources=0&annotations=distance", ct);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("OSRM table returned {Status}", (int)response.StatusCode);
                    return null;
                }
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var row = doc.RootElement.GetProperty("distances")[0];
                for (var i = 0; i < chunk.Count; i++)
                {
                    var metres = row[i + 1]; // [0] is the origin itself
                    miles[start + i] = metres.ValueKind == JsonValueKind.Number ? metres.GetDouble() / 1609.344 : null;
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
            {
                logger.LogWarning(ex, "OSRM table request failed");
                return null;
            }
            finally
            {
                Gate.Release();
            }
        }
        return miles;
    }
}
