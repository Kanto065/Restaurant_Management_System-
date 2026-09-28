using Platform.Application.Delivery;

namespace Platform.Application.Tests;

/// <summary>Area pricing rules agreed for Port Tennant: price by drawn zone, the highest zone
/// fee for anywhere else, and nothing beyond 5 miles.</summary>
public class DeliveryPricingTests
{
    // SA1 8JF - Port Tennant Tandoori.
    private static readonly GeoPoint Restaurant = new(51.622011, -3.925698);

    // A box around Hafod (SA1 2) and a smaller box around Port Tennant, east of the restaurant.
    private static readonly DeliveryZoneShape Hafod = Zone("Hafod", 2.00m, 15m, (51.628, -3.950), (51.642, -3.930));
    private static readonly DeliveryZoneShape PortTennant = Zone("Port Tennant", 1.50m, 15m, (51.615, -3.915), (51.628, -3.895));
    private static readonly DeliveryZoneShape Sketty = Zone("Sketty", 4.00m, 15m, (51.610, -4.000), (51.625, -3.975));

    private static readonly GeoPoint InHafod = new(51.6356, -3.9379);
    private static readonly GeoPoint InPortTennant = new(51.6213, -3.9051);
    private static readonly GeoPoint InNoZone = new(51.6445, -3.9120);   // Bonymaen - not drawn here
    private static readonly GeoPoint Cardiff = new(51.4816, -3.1791);

    private static DeliveryZoneShape Zone(string name, decimal fee, decimal min, (double Lat, double Lng) sw, (double Lat, double Lng) ne) =>
        new(Guid.NewGuid(), name, fee, min,
        [
            new GeoPoint(sw.Lat, sw.Lng), new GeoPoint(ne.Lat, sw.Lng),
            new GeoPoint(ne.Lat, ne.Lng), new GeoPoint(sw.Lat, ne.Lng),
        ]);

    private static DeliveryQuote Quote(GeoPoint address, IReadOnlyCollection<DeliveryZoneShape> zones,
        decimal? outsideFee = null, decimal? outsideMin = null, double maxMiles = 5) =>
        DeliveryPricing.Quote(Restaurant, address, maxMiles, zones, outsideFee, outsideMin);

    [Fact]
    public void AddressInsideAZone_PaysThatZonesFee()
    {
        var quote = Quote(InHafod, [Hafod, PortTennant, Sketty]);

        Assert.Equal(DeliveryQuoteOutcome.InZone, quote.Outcome);
        Assert.Equal("Hafod", quote.ZoneName);
        Assert.Equal(2.00m, quote.DeliveryFee);
        Assert.Equal(15m, quote.MinimumOrderAmount);
    }

    [Fact]
    public void PriceComesFromTheArea_NotTheDistance()
    {
        // Port Tennant is further from the restaurant than parts of Hafod but cheaper - the
        // whole reason for area pricing.
        var quote = Quote(InPortTennant, [Hafod, PortTennant, Sketty]);

        Assert.Equal("Port Tennant", quote.ZoneName);
        Assert.Equal(1.50m, quote.DeliveryFee);
    }

    [Fact]
    public void OverlappingZones_CheaperOneWins()
    {
        var bigExpensive = Zone("Big", 4.00m, 15m, (51.60, -3.97), (51.66, -3.88));

        var quote = Quote(InHafod, [bigExpensive, Hafod]);

        Assert.Equal("Hafod", quote.ZoneName);
        Assert.Equal(2.00m, quote.DeliveryFee);
    }

    [Fact]
    public void AddressInNoZone_PaysTheHighestZoneFee()
    {
        var quote = Quote(InNoZone, [Hafod, PortTennant, Sketty]);

        Assert.True(quote.CanDeliver);
        Assert.Equal(DeliveryQuoteOutcome.OutsideZones, quote.Outcome);
        Assert.Equal(DeliveryPricing.OutsideZonesName, quote.ZoneName);
        Assert.Equal(4.00m, quote.DeliveryFee);
        Assert.Equal(15m, quote.MinimumOrderAmount);
    }

    [Fact]
    public void AddressInNoZone_UsesTheOwnersAnywhereElsePrice_WhenSet()
    {
        var quote = Quote(InNoZone, [Hafod, Sketty], outsideFee: 3.50m, outsideMin: 20m);

        Assert.Equal(3.50m, quote.DeliveryFee);
        Assert.Equal(20m, quote.MinimumOrderAmount);
    }

    [Fact]
    public void BeyondTheDeliveryLimit_IsTooFar_EvenInsideAZone()
    {
        var hugeZone = Zone("Everywhere", 1m, 0m, (51.0, -4.5), (52.0, -3.0));

        var quote = Quote(Cardiff, [hugeZone]);

        Assert.False(quote.CanDeliver);
        Assert.Equal(DeliveryQuoteOutcome.TooFar, quote.Outcome);
        Assert.True(quote.DistanceMiles > 30);
    }

    [Fact]
    public void NoZonesAndNoAnywhereElsePrice_IsNotConfigured()
    {
        var quote = Quote(InHafod, []);

        Assert.False(quote.CanDeliver);
        Assert.Equal(DeliveryQuoteOutcome.NotConfigured, quote.Outcome);
    }

    [Fact]
    public void NoZonesButAnAnywhereElsePrice_StillDelivers()
    {
        var quote = Quote(InHafod, [], outsideFee: 3m);

        Assert.True(quote.CanDeliver);
        Assert.Equal(3m, quote.DeliveryFee);
        Assert.Equal(0m, quote.MinimumOrderAmount);
    }

    [Fact]
    public void UndrawnZone_NeverMatches_ButItsFeeCountsForAnywhereElse()
    {
        var undrawn = new DeliveryZoneShape(Guid.NewGuid(), "Winch Wen", 4.50m, 15m, []);

        var quote = Quote(InHafod, [undrawn]);

        Assert.Equal(DeliveryQuoteOutcome.OutsideZones, quote.Outcome);
        Assert.Equal(4.50m, quote.DeliveryFee);
    }

    [Fact]
    public void DistanceMiles_MatchesAKnownDistance()
    {
        // SA1 8JF to Hafod's centre: ~1.07 miles (checked against OS grid coordinates).
        Assert.InRange(DeliveryPricing.DistanceMiles(Restaurant, InHafod), 1.0, 1.15);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("{\"a\":1}")]
    public void ParseBoundary_BadInput_IsEmpty(string? json)
    {
        Assert.Empty(DeliveryPricing.ParseBoundary(json));
    }

    [Fact]
    public void Boundary_RoundTripsThroughStorage()
    {
        List<double[]> points = [[51.61, -3.93], [51.62, -3.92], [51.615, -3.91]];

        Assert.Null(DeliveryPricing.NormaliseBoundary(points, out var json));
        var parsed = DeliveryPricing.ParseBoundary(json);

        Assert.Equal(3, parsed.Count);
        Assert.Equal(new GeoPoint(51.62, -3.92), parsed[1]);
    }

    [Fact]
    public void NormaliseBoundary_RejectsTooFewCornersAndBadPoints()
    {
        Assert.NotNull(DeliveryPricing.NormaliseBoundary([[51.6, -3.9], [51.7, -3.8]], out _));
        Assert.NotNull(DeliveryPricing.NormaliseBoundary([[51.6, -3.9], [95, -3.8], [51.7, -3.7]], out _));
        Assert.Null(DeliveryPricing.NormaliseBoundary(null, out var json));
        Assert.Null(json);
    }
}
