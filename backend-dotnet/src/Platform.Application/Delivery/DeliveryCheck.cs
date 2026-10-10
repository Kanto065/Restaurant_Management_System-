namespace Platform.Application.Delivery;

public enum DeliveryCheckStatus
{
    /// <summary>Postcode found and priced - see Quote (which may still be TooFar/NotConfigured).</summary>
    Ok,
    InvalidPostcode,
    /// <summary>The postcode service is down - we can't tell where the address is.</summary>
    LookupUnavailable,
    /// <summary>The restaurant's own postcode couldn't be placed on the map.</summary>
    RestaurantLocationUnknown,
}

public record DeliveryCheck(DeliveryCheckStatus Status, string? Postcode, GeoPoint? Point, DeliveryQuote? Quote)
{
    public bool CanDeliver => Status == DeliveryCheckStatus.Ok && Quote is { CanDeliver: true };

    /// <summary>Customer-facing reason delivery isn't possible (null when it is). Prices are
    /// left to the storefront so it can use its own currency formatting.</summary>
    public string? Problem => Status switch
    {
        DeliveryCheckStatus.InvalidPostcode => "We couldn't find that postcode. Please check it and try again.",
        DeliveryCheckStatus.LookupUnavailable => "We couldn't check your postcode just now. Please try again in a moment, or call us to order.",
        DeliveryCheckStatus.RestaurantLocationUnknown => "Delivery isn't available online right now. Please call us to order.",
        _ => Quote?.Outcome switch
        {
            DeliveryQuoteOutcome.TooFar => $"Sorry, we only deliver within {MaxMilesText} miles. Collection is available.",
            DeliveryQuoteOutcome.NotConfigured => "Delivery isn't available online right now. Please call us to order.",
            _ => null,
        },
    };

    public double MaxMiles { get; init; }
    private string MaxMilesText => MaxMiles.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture);
}

/// <summary>Prices a delivery address for a restaurant (postcode -> map point -> drawn zone).</summary>
public interface IDeliveryQuoteService
{
    Task<DeliveryCheck> CheckPostcodeAsync(Guid restaurantId, string postcode, CancellationToken ct = default);
}
