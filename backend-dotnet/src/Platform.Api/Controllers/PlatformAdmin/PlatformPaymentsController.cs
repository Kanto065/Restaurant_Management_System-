using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Domain.Entities;
using Platform.Infrastructure.Payments;
using Platform.Infrastructure.Persistence;
using Stripe;

namespace Platform.Api.Controllers.PlatformAdmin;

/// <param name="ActiveAccount">Where this restaurant's card payments go right now:
/// "Restaurant" (its own keys), "Config" (the server-config Stripe account), or "None".</param>
/// <param name="Mode">"test" or "live", from the stored secret key's prefix; null when none stored.</param>
public record PaymentSettingsDto(
    bool IsEnabled, bool UseConfigAccount, string? PublishableKey, string? SecretKeyLast4, bool HasWebhookSecret,
    string? Mode, string ActiveAccount, string WebhookUrl, bool EncryptionConfigured, bool ConfigAccountAvailable);

/// <summary>Secrets: null or empty = keep the stored value.</summary>
public record UpdatePaymentSettingsRequest(
    bool IsEnabled, bool UseConfigAccount, string? PublishableKey, string? SecretKey, string? WebhookSecret);

/// <summary>
/// A restaurant's own Stripe account, managed from the super admin panel. Secret key and
/// webhook secret are write-only: stored encrypted, never returned (only the key's last 4).
/// </summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform/tenants/{id:guid}/payments")]
[Authorize(Policy = "PlatformSuperAdmin")]
public class PlatformPaymentsController(
    AppDbContext db,
    ISecretProtector protector,
    IStripeAccountProvider stripeAccounts,
    IOptions<StripeOptions> stripeOptions,
    ILogger<PlatformPaymentsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaymentSettingsDto>>> Get(Guid id)
    {
        if (!await RestaurantExistsAsync(id))
            return NotFound(ApiResponse<PaymentSettingsDto>.Fail("Restaurant not found.", 404));

        return Ok(ApiResponse<PaymentSettingsDto>.Ok(await BuildDtoAsync(id)));
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse<PaymentSettingsDto>>> Update(Guid id, UpdatePaymentSettingsRequest request)
    {
        if (!await RestaurantExistsAsync(id))
            return NotFound(ApiResponse<PaymentSettingsDto>.Fail("Restaurant not found.", 404));

        var secretKey = request.SecretKey?.Trim();
        var webhookSecret = request.WebhookSecret?.Trim();
        var publishableKey = string.IsNullOrWhiteSpace(request.PublishableKey) ? null : request.PublishableKey.Trim();

        if ((!string.IsNullOrEmpty(secretKey) || !string.IsNullOrEmpty(webhookSecret)) && !protector.IsConfigured)
            return BadRequest(ApiResponse<PaymentSettingsDto>.Fail(new SecretNotConfiguredException().Message, 400));

        if (!string.IsNullOrEmpty(secretKey) && !(secretKey.StartsWith("sk_") || secretKey.StartsWith("rk_")))
            return BadRequest(ApiResponse<PaymentSettingsDto>.Fail("Secret key should start with sk_ (or rk_ for a restricted key).", 400));
        if (!string.IsNullOrEmpty(webhookSecret) && !webhookSecret.StartsWith("whsec_"))
            return BadRequest(ApiResponse<PaymentSettingsDto>.Fail("Webhook signing secret should start with whsec_.", 400));
        if (publishableKey is not null && !publishableKey.StartsWith("pk_"))
            return BadRequest(ApiResponse<PaymentSettingsDto>.Fail("Publishable key should start with pk_.", 400));

        if (!string.IsNullOrEmpty(secretKey))
        {
            var problem = await VerifySecretKeyAsync(secretKey);
            if (problem is not null)
                return BadRequest(ApiResponse<PaymentSettingsDto>.Fail(problem, 400));
        }

        var settings = await db.RestaurantPaymentSettings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.RestaurantId == id && !s.IsDeleted);
        if (settings is null)
        {
            settings = new RestaurantPaymentSettings { RestaurantId = id };
            db.RestaurantPaymentSettings.Add(settings);
        }

        if (!string.IsNullOrEmpty(secretKey))
        {
            settings.StripeSecretKeyEncrypted = protector.Protect(secretKey);
            settings.StripeSecretKeyLast4 = secretKey[^4..];
        }
        if (!string.IsNullOrEmpty(webhookSecret))
            settings.StripeWebhookSecretEncrypted = protector.Protect(webhookSecret);
        settings.StripePublishableKey = publishableKey;

        if (request.IsEnabled && (settings.StripeSecretKeyEncrypted is null || settings.StripeWebhookSecretEncrypted is null))
            return BadRequest(ApiResponse<PaymentSettingsDto>.Fail(
                "Enter both the secret key and the webhook signing secret before enabling the restaurant's own Stripe account.", 400));

        settings.IsEnabled = request.IsEnabled;
        settings.UseConfigAccount = request.UseConfigAccount;
        await db.SaveChangesAsync();

        logger.LogInformation("Stripe settings updated for restaurant {RestaurantId} (enabled {Enabled}, config account {UseConfig})",
            id, settings.IsEnabled, settings.UseConfigAccount);

        return Ok(ApiResponse<PaymentSettingsDto>.Ok(await BuildDtoAsync(id)));
    }

    /// <summary>Returns a problem message, or null when Stripe accepts the key.</summary>
    private async Task<string?> VerifySecretKeyAsync(string secretKey)
    {
        try
        {
            await new BalanceService(new StripeClient(secretKey)).GetAsync();
            return null;
        }
        catch (StripeException ex) when (ex.StripeError?.Type == "invalid_request_error" && ex.HttpStatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            return "Stripe rejected this secret key. Check it was copied in full from the right Stripe account.";
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            // Restricted key without balance read access - the key itself is valid.
            return null;
        }
        catch (StripeException ex)
        {
            logger.LogWarning(ex, "Could not verify a Stripe secret key");
            return "Couldn't verify the key with Stripe right now. Please try again.";
        }
    }

    private Task<bool> RestaurantExistsAsync(Guid id) =>
        db.Restaurants.IgnoreQueryFilters().AnyAsync(r => r.Id == id && !r.IsDeleted);

    private async Task<PaymentSettingsDto> BuildDtoAsync(Guid id)
    {
        var settings = await db.RestaurantPaymentSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.RestaurantId == id && !s.IsDeleted);

        string? mode = null;
        if (settings?.StripeSecretKeyEncrypted is not null && protector.IsConfigured)
        {
            try
            {
                mode = protector.Unprotect(settings.StripeSecretKeyEncrypted).Contains("_live_") ? "live" : "test";
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Stored Stripe key for restaurant {RestaurantId} can't be decrypted (encryption key changed?)", id);
                mode = "unreadable";
            }
        }

        var account = await SafeActiveAccountAsync(id);
        var baseUrl = (stripeOptions.Value.WebhookBaseUrl ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');

        return new PaymentSettingsDto(
            settings?.IsEnabled ?? false,
            settings?.UseConfigAccount ?? false,
            settings?.StripePublishableKey,
            settings?.StripeSecretKeyLast4,
            settings?.StripeWebhookSecretEncrypted is not null,
            mode,
            account,
            $"{baseUrl}/api/public/stripe/webhook/{id}",
            protector.IsConfigured,
            stripeAccounts.ConfigAccount is not null);
    }

    private async Task<string> SafeActiveAccountAsync(Guid id)
    {
        try
        {
            var account = await stripeAccounts.ForRestaurantAsync(id);
            return account is null ? "None" : account.IsRestaurantOwned ? "Restaurant" : "Config";
        }
        catch (Exception)
        {
            return "None";
        }
    }
}
