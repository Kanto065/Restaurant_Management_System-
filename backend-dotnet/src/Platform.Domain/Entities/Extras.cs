using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

/// <summary>Customer review shown publicly on the storefront, admin-moderated (IsPublished).</summary>
public class Review : TenantEntity
{
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string AuthorName { get; set; } = default!;
    public string? AuthorLocation { get; set; }
    public int Rating { get; set; } // 1-5
    public string? Comment { get; set; }
    public bool IsPublished { get; set; } = true;
}

public class Voucher : TenantEntity
{
    public string Code { get; set; } = default!;
    public VoucherDiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal MinimumOrderAmount { get; set; }
    public DateTimeOffset? ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public int? MaxRedemptions { get; set; }
    public int TimesRedeemed { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// One-off override of a Restaurant's regular OpeningHour for a specific date
/// (holidays, early closures) - matches the reference site's "This week only" hours.
/// </summary>
public class OpeningHourException : TenantEntity
{
    public DateOnly Date { get; set; }
    public TimeOnly? OpenTime { get; set; }
    public TimeOnly? CloseTime { get; set; }
    public bool IsClosed { get; set; }
    public string? Note { get; set; }
}

/// <summary>A customer's saved favourite menu item, for storefront quick-reorder.</summary>
public class CustomerFavoriteMenuItem : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }
}
