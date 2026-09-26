using Platform.Domain.Common;

namespace Platform.Domain.Entities;

/// <summary>
/// A restaurant's own Stripe account, so card payments go straight to that restaurant.
/// At most one row per restaurant. Which account a restaurant's card payments use:
///   1. its own keys, when IsEnabled and both secrets are set;
///   2. else the config-level Stripe account (StripeOptions) - but ONLY if UseConfigAccount.
///      That account is really Port Tennant's, so it's opt-in (set for restaurants that
///      existed before per-restaurant keys) and never a silent fallback for new tenants;
///   3. else none - card payment is unavailable.
/// Secrets are stored encrypted (see ISecretProtector); only the last 4 characters of the
/// secret key are kept in clear, for display.
/// </summary>
public class RestaurantPaymentSettings : TenantEntity
{
    public Restaurant? Restaurant { get; set; }

    public bool IsEnabled { get; set; }
    public bool UseConfigAccount { get; set; }
    public string? StripePublishableKey { get; set; }
    public string? StripeSecretKeyEncrypted { get; set; }
    public string? StripeSecretKeyLast4 { get; set; }
    public string? StripeWebhookSecretEncrypted { get; set; }
}
