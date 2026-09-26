namespace Platform.Infrastructure.Payments;

public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = "";

    /// <summary>Signing secret for the /api/public/stripe/webhook endpoint - from the Stripe
    /// Dashboard once the webhook is registered (or `stripe listen` for local dev).</summary>
    public string WebhookSecret { get; set; } = "";

    /// <summary>Public base URL Stripe should call webhooks on (e.g. https://api.porttennanttandoori.co.uk).
    /// Used to show each restaurant the exact webhook URL to register in its own Stripe account.</summary>
    public string? WebhookBaseUrl { get; set; }
}
