namespace Platform.Application.Delivery;

public record PostcodeLocation(string Postcode, GeoPoint Point);

public enum PostcodeLookupStatus { Found, NotFound, Unavailable }

public record PostcodeLookupResult(PostcodeLookupStatus Status, PostcodeLocation? Location)
{
    public static PostcodeLookupResult NotFound { get; } = new(PostcodeLookupStatus.NotFound, null);
    public static PostcodeLookupResult Unavailable { get; } = new(PostcodeLookupStatus.Unavailable, null);
}

/// <summary>UK postcode &lt;-&gt; map point lookups (postcodes.io in production).</summary>
public interface IPostcodeLookup
{
    Task<PostcodeLookupResult> LookupAsync(string postcode, CancellationToken ct = default);

    /// <summary>The nearest postcode to a point, e.g. from the customer's "Use my location".</summary>
    Task<PostcodeLookupResult> NearestAsync(GeoPoint point, CancellationToken ct = default);

    /// <summary>Every postcode near a set of points (within radiusMetres of each), for showing
    /// postcodes on the admin map. Null when the postcode service is unavailable.</summary>
    Task<List<PostcodeLocation>?> AroundAsync(IReadOnlyList<GeoPoint> points, int radiusMetres, CancellationToken ct = default);
}
