namespace Platform.Infrastructure.Payments;

public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = "";

    /// <summary>Signing secret for the /api/public/stripe/webhook endpoint - from the Stripe
    /// Dashboard once the webhook is registered (or `stripe listen` for local dev).</summary>
    public string WebhookSecret { get; set; } = "";
}
