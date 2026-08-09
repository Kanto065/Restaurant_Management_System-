using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Platform.Application.Common;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Multitenancy;

public class TenantDomainResolver(AppDbContext db, IMemoryCache cache) : ITenantDomainResolver
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private const string CacheKeyPrefix = "tenant-domain:";

    public async Task<ResolvedTenant?> ResolveByHostAsync(string host, CancellationToken ct = default)
    {
        var normalizedHost = host.Trim().ToLowerInvariant();
        var cacheKey = CacheKeyPrefix + normalizedHost;

        if (cache.TryGetValue(cacheKey, out ResolvedTenant? cached))
            return cached;

        var result = await db.Domains
            .IgnoreQueryFilters()
            .Where(d => d.Host == normalizedHost)
            .Select(d => new ResolvedTenant(d.RestaurantId, d.Restaurant!.OrganizationId, d.Restaurant.Slug))
            .FirstOrDefaultAsync(ct);

        cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    public void InvalidateHost(string host) => cache.Remove(CacheKeyPrefix + host.Trim().ToLowerInvariant());
}
