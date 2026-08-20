using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Payments;
using Platform.Infrastructure.Persistence;
using Stripe;
using Stripe.Checkout;

namespace Platform.Api.Controllers.Public;

public record CreateCheckoutSessionResponse(string CheckoutUrl);

/// <summary>
/// Stripe Hosted Checkout for public "Card" orders: create a Checkout Session for an order
/// already placed via PublicOrdersController, then confirm payment server-side via webhook -
/// the client only ever sees a redirect URL, never a secret key or the payment result itself.
/// </summary>
[ApiController]
[Route("api/public")]
public class PaymentsController(
    AppDbContext db,
    IOrderNotifier notifier,
    StripeClient stripeClient,
    IOptions<StripeOptions> stripeOptions,
    ILogger<PaymentsController> logger) : ControllerBase
{
    [HttpPost("orders/{id:guid}/checkout-session")]
    public async Task<ActionResult<ApiResponse<CreateCheckoutSessionResponse>>> CreateCheckoutSession(Guid id)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound(ApiResponse<CreateCheckoutSessionResponse>.Fail("Order not found.", 404));

        if (order.PaymentMethod != Platform.Domain.Enums.PaymentMethod.Card)
            return BadRequest(ApiResponse<CreateCheckoutSessionResponse>.Fail("This order isn't set up for card payment.", 400));

        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == order.RestaurantId);
        var currencyCode = restaurant?.Currency ?? "GBP";

        // The storefront proxies /api/* to this service on its OWN domain (see
        // TenantResolutionMiddleware) - Request.Host here IS the customer-facing origin, so the
        // redirect lands back on the same tenant site rather than a hardcoded platform host.
        var origin = $"{Request.Scheme}://{Request.Host}";

        var sessionService = new SessionService(stripeClient);
        Session session;
        try
        {
            session = await sessionService.CreateAsync(new SessionCreateOptions
            {
                Mode = "payment",
                LineItems =
                [
                    new SessionLineItemOptions
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = currencyCode.ToLowerInvariant(),
                            UnitAmount = (long)Math.Round(order.TotalAmount * 100m, MidpointRounding.AwayFromZero),
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = $"Order #{order.OrderNumber}",
                            },
                        },
                    },
                ],
                ClientReferenceId = order.Id.ToString(),
                Metadata = new Dictionary<string, string> { ["orderId"] = order.Id.ToString() },
                SuccessUrl = $"{origin}/order/{order.Id}/track?payment=success",
                CancelUrl = $"{origin}/order/{order.Id}/track?payment=cancelled",
            });
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe checkout session creation failed for order {OrderId}", order.Id);
            return BadRequest(ApiResponse<CreateCheckoutSessionResponse>.Fail("Could not start card payment. Please try again.", 502));
        }

        // Recorded now (Status still whatever the order's current PaymentStatus is, e.g.
        // "Pending") so the webhook has a Payment row to update rather than having to create
        // one blind - StripePaymentIntentId holds the *Checkout Session* id for now (the
        // PaymentIntent itself doesn't exist until the customer actually pays) and gets
        // overwritten with the real PaymentIntent id once the webhook fires.
        db.Payments.Add(new Payment
        {
            OrderId = order.Id,
            Provider = PaymentProvider.Stripe,
            StripePaymentIntentId = session.Id,
            Amount = order.TotalAmount,
            Currency = currencyCode.ToUpperInvariant(),
            Status = order.PaymentStatus,
        });
        await db.SaveChangesAsync();

        return Ok(ApiResponse<CreateCheckoutSessionResponse>.Ok(new CreateCheckoutSessionResponse(session.Url)));
    }

    // Stripe calls this directly (no JWT, no tenant-resolving Host header) - authenticity comes
    // entirely from the Stripe-Signature header, verified against StripeOptions.WebhookSecret.
    [HttpPost("stripe/webhook")]
    public async Task<IActionResult> Webhook()
    {
        var signatureHeaderValues = Request.Headers["Stripe-Signature"];
        var signature = signatureHeaderValues.ToString();
        if (string.IsNullOrEmpty(signature))
            return BadRequest();

        // Temporary diagnostics for a live signature-format failure - the header value itself
        // is an HMAC output, safe to log (unlike the webhook secret it's verified against).
        logger.LogInformation(
            "Stripe webhook: {Count} Stripe-Signature header instance(s), joined value ({Length} chars): {Value}",
            signatureHeaderValues.Count, signature.Length, signature);

        var json = await new StreamReader(Request.Body).ReadToEndAsync();

        Event stripeEvent;
        try
        {
            // throwOnApiVersionMismatch: false - this Stripe account's configured API version
            // doesn't have to match whatever Stripe.net's own bundled version constant is, and a
            // mismatch there shouldn't ever block payment confirmation. Confirmed live: real
            // Stripe deliveries for this account crash inside EventUtility.ParseEvent's version
            // check with the default (true), which is why Stripe's dashboard shows this
            // endpoint's checkout.session.completed events stuck at pending_webhooks=1 - only
            // the signature itself needs to be trustworthy, not the API version string.
            stripeEvent = EventUtility.ConstructEvent(
                json, signature, stripeOptions.Value.WebhookSecret, tolerance: 300, throwOnApiVersionMismatch: false);
        }
        catch (Exception ex)
        {
            // Deliberately catches everything, not just StripeException - Stripe.net throws a
            // raw NullReferenceException (not StripeException) for some malformed signature
            // headers, and this endpoint is open to the internet with no other safety net.
            // Anything that isn't a validly-signed Stripe event should 400, never 500.
            logger.LogWarning(ex, "Stripe webhook signature verification failed");
            return BadRequest();
        }

        // Stripe retries webhooks on anything but a 2xx, so the same event can arrive more than
        // once - ProcessedPaymentEvent is a plain dedup table (see Payment/ProcessedPaymentEvent
        // in Ordering.cs) keyed on Stripe's own event id.
        if (await db.ProcessedPaymentEvents.AnyAsync(e => e.Provider == "stripe" && e.EventId == stripeEvent.Id))
            return Ok();

        if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted && stripeEvent.Data.Object is Session session)
        {
            await HandleCheckoutSessionCompletedAsync(session);
        }

        db.ProcessedPaymentEvents.Add(new ProcessedPaymentEvent { Provider = "stripe", EventId = stripeEvent.Id });
        await db.SaveChangesAsync();

        return Ok();
    }

    private async Task HandleCheckoutSessionCompletedAsync(Session session)
    {
        if (!Guid.TryParse(session.Metadata?.GetValueOrDefault("orderId") ?? session.ClientReferenceId, out var orderId))
        {
            logger.LogWarning("Stripe checkout.session.completed had no parseable orderId (session {SessionId})", session.Id);
            return;
        }

        // IgnoreQueryFilters() - the global tenant filter is keyed on ICurrentTenant.RestaurantId,
        // which is never resolved for this webhook (Stripe hits api.porttennanttandoori.co.uk
        // directly, not a tenant-resolving Host header, and carries no JWT). With a null
        // RestaurantId, EF Core still has to evaluate `_currentTenant.RestaurantId.Value` as a
        // query parameter to build the SQL "OR" - not just skip it - so the filter throws
        // InvalidOperationException before this ever reaches the database. The order/payment
        // rows are looked up by globally-unique Guid anyway, so tenant scoping adds nothing here.
        var order = await db.Orders.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null)
        {
            logger.LogWarning("Stripe checkout.session.completed referenced unknown order {OrderId}", orderId);
            return;
        }

        var paidStatus = await db.PaymentStatusDefinitions.IgnoreQueryFilters()
            .Where(d => d.RestaurantId == order.RestaurantId && d.Name.ToLower() == "paid")
            .Select(d => d.Name)
            .FirstOrDefaultAsync() ?? "Paid";

        order.PaymentStatus = paidStatus;

        var payment = await db.Payments.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.OrderId == order.Id && p.StripePaymentIntentId == session.Id);
        if (payment is not null)
        {
            payment.Status = paidStatus;
            if (!string.IsNullOrEmpty(session.PaymentIntentId))
                payment.StripePaymentIntentId = session.PaymentIntentId;
        }

        await db.SaveChangesAsync();
        await notifier.PaymentReceivedAsync(order.RestaurantId, order.Id);
    }
}
