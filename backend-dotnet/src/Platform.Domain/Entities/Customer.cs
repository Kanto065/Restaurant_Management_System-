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
    public string Email { get; set; } = default!;
    public string? Phone { get; set; }
    public string FullName { get; set; } = default!;
    public int LoyaltyPointsBalance { get; set; }

    public Restaurant? Restaurant { get; set; }
    public List<CustomerAddress> Addresses { get; set; } = [];
}

public class CustomerAddress : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string? Label { get; set; }
    public string Line1 { get; set; } = default!;
    public string? Line2 { get; set; }
    public string City { get; set; } = default!;
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

/// <summary>Mileage-tiered delivery pricing, matching the reference site's delivery table.</summary>
public class DeliveryZone : TenantEntity
{
    public string Name { get; set; } = default!;
    public double MaxMileage { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal MinimumOrderAmount { get; set; }
    public bool IsActive { get; set; } = true;
}
