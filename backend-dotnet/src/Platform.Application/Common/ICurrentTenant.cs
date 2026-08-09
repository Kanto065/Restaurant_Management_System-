namespace Platform.Application.Common;

/// <summary>
/// Scoped per-request tenant context, populated by tenant-resolution middleware
/// (host-header lookup for public storefront traffic, JWT claims for admin/POS traffic).
/// </summary>
public interface ICurrentTenant
{
    Guid? RestaurantId { get; }
    Guid? OrganizationId { get; }
    string? RestaurantSlug { get; }
    bool IsResolved { get; }

    void Set(Guid restaurantId, Guid organizationId, string? slug);
}
