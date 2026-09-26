using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Platform.Infrastructure.Persistence;
using Stripe;

namespace Platform.Infrastructure.Payments;

/// <param name="IsRestaurantOwned">True when the keys are the restaurant's own Stripe account,
/// false for the config-level account (StripeOptions).</param>
public record StripeAccount(StripeClient Client, string WebhookSecret, bool IsRestaurantOwned);

public interface IStripeAccountProvider
{
    /// <summary>
    /// The Stripe account this restaurant's card payments go to (see RestaurantPaymentSettings
    /// for the rules). Null = card payment unavailable for this restaurant.
    /// </summary>
    Task<StripeAccount?> ForRestaurantAsync(Guid restaurantId, CancellationToken ct = default);

    /// <summary>The config-level account from StripeOptions, or null when not configured.</summary>
    StripeAccount? ConfigAccount { get; }
}

public class StripeAccountProvider(
    AppDbContext db,
    ISecretProtector protector,
    IOptions<StripeOptions> stripeOptions) : IStripeAccountProvider
{
    public StripeAccount? ConfigAccount =>
        string.IsNullOrWhiteSpace(stripeOptions.Value.SecretKey)
            ? null
            : new StripeAccount(new StripeClient(stripeOptions.Value.SecretKey), stripeOptions.Value.WebhookSecret, false);

    public async Task<StripeAccount?> ForRestaurantAsync(Guid restaurantId, CancellationToken ct = default)
    {
        // IgnoreQueryFilters: also called from the webhook, where no tenant is resolved.
        var settings = await db.RestaurantPaymentSettings.IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.RestaurantId == restaurantId && !s.IsDeleted, ct);

        if (settings is { IsEnabled: true, StripeSecretKeyEncrypted: not null, StripeWebhookSecretEncrypted: not null })
        {
            return new StripeAccount(
                new StripeClient(protector.Unprotect(settings.StripeSecretKeyEncrypted)),
                protector.Unprotect(settings.StripeWebhookSecretEncrypted),
                IsRestaurantOwned: true);
        }

        return settings?.UseConfigAccount == true ? ConfigAccount : null;
    }
}
