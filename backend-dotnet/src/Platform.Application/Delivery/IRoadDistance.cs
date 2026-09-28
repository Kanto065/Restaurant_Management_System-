namespace Platform.Application.Delivery;

/// <summary>Driving distances from one point to many (OSRM in production).</summary>
public interface IRoadDistance
{
    /// <returns>Miles by road to each destination (null where no route was found), or null
    /// when the routing service isn't answering.</returns>
    Task<double?[]?> FromAsync(GeoPoint origin, IReadOnlyList<GeoPoint> destinations, CancellationToken ct = default);
}
