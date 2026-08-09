using Platform.Application.Common;

namespace Platform.Infrastructure.Multitenancy;

/// <summary>Scoped (per-request) implementation of ICurrentTenant. Set once by tenant-resolution middleware.</summary>
public class CurrentTenant : ICurrentTenant
{
    public Guid? RestaurantId { get; private set; }
    public Guid? OrganizationId { get; private set; }
    public string? RestaurantSlug { get; private set; }
    public bool IsResolved => RestaurantId.HasValue;

    public void Set(Guid restaurantId, Guid organizationId, string? slug)
    {
        RestaurantId = restaurantId;
        OrganizationId = organizationId;
        RestaurantSlug = slug;
    }
}
