using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

/// <summary>
/// A member account. Guests are allowed (IdentityUserId is null and orders carry
/// denormalized name/phone/email directly instead of a Customer link).
/// </summary>
public class Customer : TenantEntity
{
    public Guid? IdentityUserId { get; set; }
    public string? Title { get; set; }
    public string Email { get; set; } = default!;
    public string? Phone { get; set; }
    public string? LandlinePhone { get; set; }
    public string FullName { get; set; } = default!;
    public DateOnly? DateOfBirth { get; set; }
    public bool MarketingEmailOptIn { get; set; }
    public bool MarketingSmsOptIn { get; set; }
    public int LoyaltyPointsBalance { get; set; }

    public Restaurant? Restaurant { get; set; }
    public List<CustomerAddress> Addresses { get; set; } = [];
}

public class CustomerAddress : TenantEntity
{
    /// <summary>Null for a guest's delivery address - stored against the order only, not saved
    /// to any account. (Was a required FK, so every guest delivery order failed to save.)</summary>
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string? Label { get; set; }
    public string Line1 { get; set; } = default!;
    public string? Line2 { get; set; }
    public string City { get; set; } = default!;
    public string? County { get; set; }
    public string Postcode { get; set; } = default!;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool IsDefault { get; set; }
}

public class LoyaltyTransaction : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? OrderId { get; set; }
    public int PointsDelta { get; set; }
    public LoyaltyTransactionReason Reason { get; set; }
}

/// <summary>A delivery area drawn on the admin map. A delivery address inside the shape pays
/// this zone's fee and minimum order; an address inside no zone pays the restaurant's
/// "anywhere else" fee (see Restaurant.OutsideZoneDeliveryFee).</summary>
public class DeliveryZone : TenantEntity
{
    public string Name { get; set; } = default!;
    /// <summary>Left over from the original mileage tiers. Not used for pricing any more -
    /// the owner's "miles" turned out to be area labels, so zones are matched by shape.</summary>
    public double MaxMileage { get; set; }
    /// <summary>The zone's outline as a JSON array of [latitude, longitude] points, e.g.
    /// [[51.62,-3.93],[51.63,-3.92],...]. Null until the owner draws it - an undrawn zone
    /// never matches.</summary>
    public string? BoundaryJson { get; set; }
    /// <summary>Map colour for the admin page (hex, e.g. "#e8823c").</summary>
    public string Colour { get; set; } = "#e8823c";
    public decimal DeliveryFee { get; set; }
    public decimal MinimumOrderAmount { get; set; }
    public bool IsActive { get; set; } = true;
}
