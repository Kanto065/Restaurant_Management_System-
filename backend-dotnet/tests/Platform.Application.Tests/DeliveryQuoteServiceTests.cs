using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Application.Delivery;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Delivery;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;

namespace Platform.Application.Tests;

public class DeliveryQuoteServiceTests
{
    private class TestCurrentActor : ICurrentActor
    {
        public Guid ActorId => AuditConstants.SystemUserId;
    }

    private class FakePostcodes(Dictionary<string, GeoPoint> known, bool down = false) : IPostcodeLookup
    {
        public int Lookups { get; private set; }

        public Task<PostcodeLookupResult> LookupAsync(string postcode, CancellationToken ct = default)
        {
            Lookups++;
            if (down) return Task.FromResult(PostcodeLookupResult.Unavailable);
            var key = PostcodesIoLookup.Normalise(postcode);
            return Task.FromResult(known.TryGetValue(key, out var p)
                ? new PostcodeLookupResult(PostcodeLookupStatus.Found, new PostcodeLocation(key, p))
                : PostcodeLookupResult.NotFound);
        }

        public Task<PostcodeLookupResult> NearestAsync(GeoPoint point, CancellationToken ct = default) =>
            Task.FromResult(new PostcodeLookupResult(PostcodeLookupStatus.Found, new PostcodeLocation("SA1 2AB", point)));

        public Task<List<PostcodeLocation>?> AroundAsync(IReadOnlyList<GeoPoint> points, int radiusMetres, CancellationToken ct = default) =>
            Task.FromResult<List<PostcodeLocation>?>(known.Select(k => new PostcodeLocation(k.Key, k.Value)).ToList());
    }

    private static readonly Dictionary<string, GeoPoint> Swansea = new()
    {
        ["SA1 8JF"] = new(51.622011, -3.925698), // the restaurant
        ["SA1 2AB"] = new(51.6356, -3.9379),     // inside the Hafod box below
        ["SA1 7HU"] = new(51.6445, -3.9120),     // no zone
        ["CF10 1AA"] = new(51.4816, -3.1791),    // Cardiff
    };

    private static async Task<(AppDbContext Db, Guid RestaurantId)> SeedAsync()
    {
        var tenant = new CurrentTenant();
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            tenant, new TestCurrentActor());

        var restaurant = new Restaurant
        {
            OrganizationId = Guid.NewGuid(), Name = "Port Tennant Tandoori", Slug = "ptt",
            AddressLine1 = "1 Port Tennant Rd", City = "Swansea", Postcode = "SA1 8JF",
        };
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync();
        tenant.Set(restaurant.Id, restaurant.OrganizationId, "ptt");

        db.DeliveryZones.Add(new DeliveryZone
        {
            Name = "Hafod", DeliveryFee = 2m, MinimumOrderAmount = 15m,
            BoundaryJson = "[[51.628,-3.950],[51.642,-3.950],[51.642,-3.930],[51.628,-3.930]]",
        });
        db.DeliveryZones.Add(new DeliveryZone { Name = "Winch Wen", DeliveryFee = 4m, MinimumOrderAmount = 15m });
        db.DeliveryZones.Add(new DeliveryZone { Name = "Old zone", DeliveryFee = 9m, MinimumOrderAmount = 15m, IsActive = false });
        await db.SaveChangesAsync();
        return (db, restaurant.Id);
    }

    [Fact]
    public async Task PostcodeInAZone_IsPricedByThatZone_AndTheRestaurantIsPlacedOnce()
    {
        var (db, restaurantId) = await SeedAsync();
        var postcodes = new FakePostcodes(Swansea);
        var service = new DeliveryQuoteService(db, postcodes);

        var check = await service.CheckPostcodeAsync(restaurantId, "sa12ab");

        Assert.True(check.CanDeliver);
        Assert.Equal("SA1 2AB", check.Postcode);
        Assert.Equal("Hafod", check.Quote!.ZoneName);
        Assert.Equal(2m, check.Quote.DeliveryFee);

        var restaurant = await db.Restaurants.SingleAsync();
        Assert.Equal(51.622011, restaurant.Latitude);

        await service.CheckPostcodeAsync(restaurantId, "SA1 2AB");
        Assert.Equal(3, postcodes.Lookups); // restaurant once, customer twice
    }

    [Fact]
    public async Task PostcodeInNoZone_PaysTheHighestActiveZoneFee()
    {
        var (db, restaurantId) = await SeedAsync();
        var service = new DeliveryQuoteService(db, new FakePostcodes(Swansea));

        var check = await service.CheckPostcodeAsync(restaurantId, "SA1 7HU");

        Assert.True(check.CanDeliver);
        Assert.Equal(DeliveryPricing.OutsideZonesName, check.Quote!.ZoneName);
        Assert.Equal(4m, check.Quote.DeliveryFee); // not the inactive £9 zone
    }

    [Fact]
    public async Task FarAwayPostcode_CannotDeliver_WithAFriendlyReason()
    {
        var (db, restaurantId) = await SeedAsync();
        var service = new DeliveryQuoteService(db, new FakePostcodes(Swansea));

        var check = await service.CheckPostcodeAsync(restaurantId, "CF10 1AA");

        Assert.False(check.CanDeliver);
        Assert.Equal("Sorry, we only deliver within 5 miles. Collection is available.", check.Problem);
    }

    [Fact]
    public async Task UnknownPostcode_AndServiceDown_AreReportedDifferently()
    {
        var (db, restaurantId) = await SeedAsync();

        var unknown = await new DeliveryQuoteService(db, new FakePostcodes(Swansea)).CheckPostcodeAsync(restaurantId, "ZZ9 9ZZ");
        var down = await new DeliveryQuoteService(db, new FakePostcodes(Swansea, down: true)).CheckPostcodeAsync(restaurantId, "SA1 2AB");

        Assert.Equal(DeliveryCheckStatus.InvalidPostcode, unknown.Status);
        Assert.Equal(DeliveryCheckStatus.LookupUnavailable, down.Status);
        Assert.False(unknown.CanDeliver);
        Assert.False(down.CanDeliver);
    }

    [Fact]
    public async Task PricingSwitchedOff_DeliveryIsFreeAndNothingIsChecked()
    {
        var (db, restaurantId) = await SeedAsync();
        (await db.Restaurants.SingleAsync()).DeliveryPricingEnabled = false;
        await db.SaveChangesAsync();
        var postcodes = new FakePostcodes(Swansea, down: true); // even with the postcode service down
        var service = new DeliveryQuoteService(db, postcodes);

        var far = await service.CheckPostcodeAsync(restaurantId, "cf101aa");

        Assert.True(far.CanDeliver);
        Assert.Equal(DeliveryQuoteOutcome.PricingOff, far.Quote!.Outcome);
        Assert.Equal(0m, far.Quote.DeliveryFee);
        Assert.Equal(0m, far.Quote.MinimumOrderAmount);
        Assert.Equal("CF10 1AA", far.Postcode);
        Assert.Null(far.Problem);
        Assert.Equal(0, postcodes.Lookups);
    }

    [Theory]
    [InlineData("sa18jf", "SA1 8JF")]
    [InlineData(" SA1  8JF ", "SA1 8JF")]
    [InlineData("cf101aa", "CF10 1AA")]
    public void Normalise_TidiesPostcodes(string input, string expected)
    {
        Assert.Equal(expected, PostcodesIoLookup.Normalise(input));
    }
}
