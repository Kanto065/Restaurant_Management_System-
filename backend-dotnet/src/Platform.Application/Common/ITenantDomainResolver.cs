namespace Platform.Application.Common;

public record ResolvedTenant(Guid RestaurantId, Guid OrganizationId, string Slug);

/// <summary>Resolves a Host header to a tenant. Implementation caches lookups (short TTL).</summary>
public interface ITenantDomainResolver
{
    Task<ResolvedTenant?> ResolveByHostAsync(string host, CancellationToken ct = default);

    /// <summary>Call after any Domain create/update/delete so the cache doesn't serve stale data.</summary>
    void InvalidateHost(string host);
}
