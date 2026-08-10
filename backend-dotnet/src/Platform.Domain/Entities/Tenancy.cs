using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

/// <summary>Top-level billing/owner entity. Maps 1:1 to a future Stripe Customer.</summary>
public class Organization : Entity
{
    public string Name { get; set; } = default!;
    public string? LegalName { get; set; }
    public string BillingEmail { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public string? StripeCustomerId { get; set; }

    public List<Restaurant> Restaurants { get; set; } = [];
    public List<Subscription> Subscriptions { get; set; } = [];
}

/// <summary>A physical restaurant location/branch — the operational tenant boundary.</summary>
public class Restaurant : Entity
{
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? HeroImageUrl { get; set; }
    public string ThemeColorPrimary { get; set; } = "#0b3d2e";
    public string ThemeColorSecondary { get; set; } = "#e8823c";

    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string AddressLine1 { get; set; } = default!;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = default!;
    public string Postcode { get; set; } = default!;
    public string Country { get; set; } = "GB";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string TimeZone { get; set; } = "Europe/London";
    public bool IsActive { get; set; } = true;

    /// <summary>ISO 4217 currency code (e.g. "GBP", "USD", "EUR") — drives the currency symbol
    /// shown for all prices across admin and storefront.</summary>
    public string Currency { get; set; } = "GBP";

    /// <summary>Which order types this restaurant currently accepts online - admin-controlled,
    /// drives the storefront's "Menu &amp; Ordering" dropdown (matches the reference site's
    /// "Order for Home Delivery" / "Order for Collection" options).</summary>
    public bool SupportsDelivery { get; set; } = true;
    public bool SupportsCollection { get; set; } = true;
    public bool SupportsDineIn { get; set; } = true;

    /// <summary>Flat processing fee added at checkout (matches the reference site's "Processing Fee").</summary>
    public decimal ProcessingFeeFlat { get; set; }
    /// <summary>Percentage processing fee (0-100), applied on top of ProcessingFeeFlat if both are set.</summary>
    public decimal ProcessingFeePercentage { get; set; }
    /// <summary>Loyalty points earned per £1 spent (e.g. 1 = "spend £1, earn 1 point").</summary>
    public decimal LoyaltyPointsPerCurrencyUnit { get; set; } = 1;

    /// <summary>Serialized HomepageContent (hero slides + editable section copy).
    /// Null means "use default hardcoded storefront copy".</summary>
    public string? HomepageContentJson { get; set; }

    public List<RestaurantDomain> Domains { get; set; } = [];
    public List<OpeningHour> OpeningHours { get; set; } = [];
    public List<RestaurantStaff> Staff { get; set; } = [];
}

/// <summary>A custom domain bound to a Restaurant. Resolved from the incoming Host header.</summary>
public class RestaurantDomain : Entity
{
    public Guid RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }

    public string Host { get; set; } = default!;
    public bool IsPrimary { get; set; }
    public bool TlsProvisioned { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
}

public class OpeningHour : Entity
{
    public Guid RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }

    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly? OpenTime { get; set; }
    public TimeOnly? CloseTime { get; set; }
    public bool IsClosed { get; set; }
}

/// <summary>Modeled now for future SaaS billing; no live Stripe Billing integration yet.</summary>
public class Plan : Entity
{
    public string Name { get; set; } = default!;
    public decimal PriceMonthly { get; set; }
    public int MaxRestaurants { get; set; }
    public int MaxStaffUsers { get; set; }
    public string FeatureFlagsJson { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
}

public class Subscription : Entity
{
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public Guid PlanId { get; set; }
    public Plan? Plan { get; set; }

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trialing;
    public string? StripeSubscriptionId { get; set; }
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
    public DateTimeOffset? TrialEndsAt { get; set; }
}
