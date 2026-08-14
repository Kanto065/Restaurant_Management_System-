using Platform.Domain.Common;

namespace Platform.Domain.Entities;

/// <summary>
/// Admin-configurable replacement for the old fixed OrderStatus enum. Order.Status now stores
/// this Name directly (a plain string) rather than an enum ordinal, so the set of statuses,
/// their order, and which ones count as "pending"/"completed" for dashboard stats are all
/// editable per restaurant instead of hardcoded.
/// </summary>
public class OrderStatusDefinition : TenantEntity
{
    public string Name { get; set; } = default!;
    public int DisplayOrder { get; set; }
    public bool CountsAsPending { get; set; }
    public bool CountsAsCompleted { get; set; }
    public bool IsDefault { get; set; }
}

/// <summary>Admin-configurable replacement for the old fixed PaymentStatus enum - see OrderStatusDefinition.</summary>
public class PaymentStatusDefinition : TenantEntity
{
    public string Name { get; set; } = default!;
    public int DisplayOrder { get; set; }
    public bool IsDefault { get; set; }
}
