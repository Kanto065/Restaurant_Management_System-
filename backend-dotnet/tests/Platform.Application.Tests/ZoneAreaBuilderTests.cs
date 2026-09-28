using Platform.Application.Delivery;

namespace Platform.Application.Tests;

public class ZoneAreaBuilderTests
{
    private static readonly GeoPoint Restaurant = new(51.622011, -3.925698);

    private static IReadOnlyList<GeoPoint> Box(double south, double west, double north, double east) =>
        [new(south, west), new(north, west), new(north, east), new(south, east)];

    private static AreaReference Area(string name, params IReadOnlyList<GeoPoint>[] rings) => new(name, "test", rings);

    private static DeliveryZoneShape Shape(Guid id, string name, decimal fee, List<IReadOnlyList<GeoPoint>> rings) =>
        new(id, name, fee, 15m, rings);

    /// <summary>Samples a grid of points; returns how many fall inside 0, 1 or 2+ of the shapes.</summary>
    private static (int None, int One, int Many) Coverage(IReadOnlyList<DeliveryZoneShape> shapes, double s, double w, double n, double e)
    {
        int none = 0, one = 0, many = 0;
        for (var lat = s; lat <= n; lat += (n - s) / 60)
        for (var lng = w; lng <= e; lng += (e - w) / 60)
        {
            var hits = shapes.Count(z => DeliveryPricing.Contains(z.Rings, new GeoPoint(lat, lng)));
            if (hits == 0) none++; else if (hits == 1) one++; else many++;
        }
        return (none, one, many);
    }

    [Fact]
    public void NeighbouringAreas_ShareABorder_WithoutGapsOrOverlaps()
    {
        // Two areas with a 150 m gap between them - the gap is filled from the nearest side.
        var west = Guid.NewGuid();
        var east = Guid.NewGuid();
        var built = ZoneAreaBuilder.Build(Restaurant, 5,
            [new(Area("West", Box(51.615, -3.945, 51.630, -3.928)), [west]),
             new(Area("East", Box(51.615, -3.926, 51.630, -3.910)), [east])],
            keptZones: []);

        var shapes = new[] { Shape(west, "West", 2, built[west]), Shape(east, "East", 3, built[east]) };
        var (none, _, many) = Coverage(shapes, 51.617, -3.943, 51.628, -3.912);

        Assert.Equal(0, none);
        Assert.True(many <= 60, $"only border slivers may overlap, got {many} samples"); // one sample row's worth at most
        Assert.Equal("West", DeliveryPricing.ZoneAt(shapes, new GeoPoint(51.622, -3.940))?.Name);
        Assert.Equal("East", DeliveryPricing.ZoneAt(shapes, new GeoPoint(51.622, -3.915))?.Name);
    }

    [Fact]
    public void SmallerArea_WinsInsideALargerOne_LeavingAHole()
    {
        // Port Tennant inside the (larger) official St Thomas area.
        var stThomas = Guid.NewGuid();
        var portTennant = Guid.NewGuid();
        var built = ZoneAreaBuilder.Build(Restaurant, 5,
            [new(Area("St Thomas", Box(51.610, -3.945, 51.635, -3.890)), [stThomas]),
             new(Area("Port Tennant", Box(51.615, -3.915, 51.628, -3.895)), [portTennant])],
            keptZones: []);

        var st = Shape(stThomas, "St Thomas", 1m, built[stThomas]); // even cheaper - still mustn't cover Port Tennant
        var pt = Shape(portTennant, "Port Tennant", 1.5m, built[portTennant]);
        var inPortTennant = new GeoPoint(51.6213, -3.9051);

        Assert.True(built[stThomas].Count >= 2, "St Thomas should have an outer ring plus a hole");
        Assert.False(DeliveryPricing.Contains(st.Rings, inPortTennant));
        Assert.Equal("Port Tennant", DeliveryPricing.ZoneAt([st, pt], inPortTennant)?.Name);
        Assert.Equal("St Thomas", DeliveryPricing.ZoneAt([st, pt], new GeoPoint(51.630, -3.930))?.Name);
    }

    [Fact]
    public void KeptZones_AreLeftAlone()
    {
        var kept = new DeliveryZoneShape(Guid.NewGuid(), "Marina", 2m, 15m, [Box(51.615, -3.935, 51.622, -3.925)]);
        var hafod = Guid.NewGuid();
        var built = ZoneAreaBuilder.Build(Restaurant, 5,
            [new(Area("Hafod", Box(51.612, -3.945, 51.632, -3.915)), [hafod])],
            keptZones: [kept]);

        var drawn = Shape(hafod, "Hafod", 2m, built[hafod]);
        Assert.False(DeliveryPricing.Contains(drawn.Rings, new GeoPoint(51.618, -3.930)), "must not cover the kept Marina shape");
        Assert.True(DeliveryPricing.Contains(drawn.Rings, new GeoPoint(51.628, -3.940)));
    }

    [Fact]
    public void OneNameAtTwoPrices_CheaperHalfIsNearer()
    {
        var near = Guid.NewGuid();
        var far = Guid.NewGuid();
        // Bonymaen-like area north-east of the restaurant.
        var built = ZoneAreaBuilder.Build(Restaurant, 5,
            [new(Area("Bonymaen", Box(51.630, -3.915, 51.660, -3.880)), [near, far])],
            keptZones: []);

        var cheap = Shape(near, "Bonymaen", 3m, built[near]);
        var dear = Shape(far, "Bonymaen", 4m, built[far]);
        Assert.Equal(3m, DeliveryPricing.ZoneAt([cheap, dear], new GeoPoint(51.633, -3.912))?.DeliveryFee);
        Assert.Equal(4m, DeliveryPricing.ZoneAt([cheap, dear], new GeoPoint(51.657, -3.883))?.DeliveryFee);
    }

    [Fact]
    public void NothingIsDrawnBeyondTheDeliveryLimit()
    {
        var zone = Guid.NewGuid();
        var built = ZoneAreaBuilder.Build(Restaurant, 1,
            [new(Area("Big", Box(51.58, -3.99, 51.66, -3.86)), [zone])], keptZones: []);

        var shape = Shape(zone, "Big", 2m, built[zone]);
        Assert.True(DeliveryPricing.Contains(shape.Rings, new GeoPoint(51.625, -3.925)));
        Assert.False(DeliveryPricing.Contains(shape.Rings, new GeoPoint(51.650, -3.925))); // ~1.9 miles north
    }

    [Fact]
    public void Trim_CutsOnlyTheGroundBeyondTheStatedRoadMiles()
    {
        IReadOnlyList<IReadOnlyList<GeoPoint>> zone = [Box(51.615, -3.945, 51.630, -3.905)];
        // Postcodes on the west side are 1.2 road miles away, the east side 2.6 - limit is 2.
        var samples = new List<ZoneAreaBuilder.RoadSample>();
        for (var lat = 51.616; lat < 51.630; lat += 0.002)
        {
            samples.Add(new(new GeoPoint(lat, -3.940), 1.2));
            samples.Add(new(new GeoPoint(lat, -3.910), 2.6));
        }

        var trimmed = ZoneAreaBuilder.TrimToRoadMiles(Restaurant, zone, samples, limitMiles: 2);

        Assert.NotNull(trimmed);
        Assert.True(DeliveryPricing.Contains(trimmed, new GeoPoint(51.622, -3.940)));
        Assert.False(DeliveryPricing.Contains(trimmed, new GeoPoint(51.622, -3.910)));
        Assert.False(DeliveryPricing.Contains(trimmed, new GeoPoint(51.640, -3.940)), "never adds ground");
    }

    [Fact]
    public void Trim_LeavesAZoneAlone_WhenEverythingIsWithinItsMiles()
    {
        IReadOnlyList<IReadOnlyList<GeoPoint>> zone = [Box(51.615, -3.945, 51.630, -3.905)];
        var samples = new List<ZoneAreaBuilder.RoadSample> { new(new GeoPoint(51.62, -3.93), 1.9), new(new GeoPoint(51.62, -3.91), 2.04) };

        Assert.Null(ZoneAreaBuilder.TrimToRoadMiles(Restaurant, zone, samples, limitMiles: 2));
        Assert.Null(ZoneAreaBuilder.TrimToRoadMiles(Restaurant, zone, [], limitMiles: 2));
    }

    [Fact]
    public void AreaIndex_PicksTheMostSpecificArea()
    {
        var index = new ZoneAreaBuilder.AreaIndex(
            [Area("St Thomas", Box(51.610, -3.945, 51.635, -3.890)), Area("Port Tennant", Box(51.615, -3.915, 51.628, -3.895))],
            Restaurant);

        Assert.Equal(1, index.MostSpecific(new GeoPoint(51.6213, -3.9051)));
        Assert.Equal(0, index.MostSpecific(new GeoPoint(51.630, -3.930)));
        Assert.Equal(-1, index.MostSpecific(new GeoPoint(51.70, -3.70)));
    }
}
