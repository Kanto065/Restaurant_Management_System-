using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Tenancy;

public record ProvisionTenantRequest(
    string RestaurantName,
    string Slug,
    string AddressLine1,
    string City,
    string Postcode,
    string? Phone,
    string? Email,
    string? StorefrontHost,
    string? AdminHost,
    string OwnerEmail,
    string OwnerFullName,
    string OwnerPassword);

public class TenantProvisioningException(string message) : Exception(message);

/// <summary>
/// Creates a new tenant from the super admin panel: Organization + Restaurant + its domains +
/// an Owner staff user, in one transaction. Runs with no tenant resolved, so every tenant-scoped
/// row sets RestaurantId explicitly. Callers run StatusDefinitionSeeder afterwards so the new
/// tenant gets default order/payment statuses immediately, not only after an API restart.
/// </summary>
public class TenantProvisioningService(
    AppDbContext db, UserManager<AppUser> userManager, ITenantDomainResolver domainResolver)
{
    public async Task<Restaurant> ProvisionAsync(ProvisionTenantRequest request, CancellationToken ct = default)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (await db.Restaurants.IgnoreQueryFilters().AnyAsync(r => r.Slug == slug, ct))
            throw new TenantProvisioningException($"Slug '{slug}' is already used by another restaurant.");

        var hosts = new[] { (request.StorefrontHost, DomainKind.Storefront), (request.AdminHost, DomainKind.Admin) }
            .Where(h => !string.IsNullOrWhiteSpace(h.Item1))
            .Select(h => (Host: NormalizeHost(h.Item1!), Kind: h.Item2))
            .ToList();
        foreach (var (host, _) in hosts)
            await EnsureHostIsFreeAsync(host, ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var organization = new Organization { Name = request.RestaurantName, BillingEmail = request.OwnerEmail };
        db.Organizations.Add(organization);

        var restaurant = new Restaurant
        {
            Organization = organization,
            Name = request.RestaurantName,
            Slug = slug,
            AddressLine1 = request.AddressLine1,
            City = request.City,
            Postcode = request.Postcode,
            Phone = request.Phone,
            Email = request.Email,
            // New restaurants start with ordering off - the menu is browsable, but nothing can be
            // ordered until the owner switches collection/delivery on in their admin.
            SupportsCollection = false,
            SupportsDelivery = false,
            SupportsDineIn = false,
        };
        db.Restaurants.Add(restaurant);

        foreach (var (host, kind) in hosts)
        {
            restaurant.Domains.Add(new RestaurantDomain
            {
                Host = host,
                Kind = kind,
                IsPrimary = true,
                VerifiedAt = DateTimeOffset.UtcNow,
            });
        }

        await db.SaveChangesAsync(ct);

        await AddOwnerAsync(restaurant.Id, request.OwnerEmail, request.OwnerFullName, request.OwnerPassword, ct);

        await transaction.CommitAsync(ct);

        foreach (var (host, _) in hosts)
            domainResolver.InvalidateHost(host);

        return restaurant;
    }

    /// <summary>
    /// Adds an Owner to a restaurant. Staff usernames are their email, so an existing staff user
    /// (e.g. the same person owning two restaurants) is reused and the password left unchanged.
    /// </summary>
    public async Task<AppUser> AddOwnerAsync(
        Guid restaurantId, string email, string fullName, string password, CancellationToken ct = default)
    {
        var user = await userManager.FindByNameAsync(email.Trim());
        if (user is null)
        {
            user = new AppUser
            {
                UserName = email.Trim(),
                Email = email.Trim(),
                EmailConfirmed = true,
                FullName = fullName,
            };
            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
                throw new TenantProvisioningException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        var alreadyStaff = await db.RestaurantStaff.IgnoreQueryFilters()
            .AnyAsync(s => s.UserId == user.Id && s.RestaurantId == restaurantId && !s.IsDeleted, ct);
        if (!alreadyStaff)
        {
            db.RestaurantStaff.Add(new RestaurantStaff
            {
                RestaurantId = restaurantId,
                UserId = user.Id,
                Role = StaffRole.Owner,
            });
            await db.SaveChangesAsync(ct);
        }

        return user;
    }

    public async Task<RestaurantDomain> AddDomainAsync(
        Guid restaurantId, string host, DomainKind kind, bool isPrimary, CancellationToken ct = default)
    {
        var normalized = NormalizeHost(host);
        await EnsureHostIsFreeAsync(normalized, ct);

        if (isPrimary)
        {
            var currentPrimaries = await db.Domains.IgnoreQueryFilters()
                .Where(d => d.RestaurantId == restaurantId && d.Kind == kind && d.IsPrimary && !d.IsDeleted)
                .ToListAsync(ct);
            currentPrimaries.ForEach(d => d.IsPrimary = false);
        }

        var domain = new RestaurantDomain
        {
            RestaurantId = restaurantId,
            Host = normalized,
            Kind = kind,
            IsPrimary = isPrimary,
            VerifiedAt = DateTimeOffset.UtcNow,
        };
        db.Domains.Add(domain);
        await db.SaveChangesAsync(ct);

        domainResolver.InvalidateHost(normalized);
        return domain;
    }

    /// <summary>Hard delete - the Host column is unique, so a soft-deleted row would block re-adding it.</summary>
    public async Task RemoveDomainAsync(Guid restaurantId, Guid domainId, CancellationToken ct = default)
    {
        var domain = await db.Domains.IgnoreQueryFilters()
            .FirstOrDefaultAsync(d => d.Id == domainId && d.RestaurantId == restaurantId, ct)
            ?? throw new TenantProvisioningException("Domain not found.");

        db.Domains.Remove(domain);
        await db.SaveChangesAsync(ct);
        domainResolver.InvalidateHost(domain.Host);
    }

    public static string NormalizeHost(string host)
    {
        var value = host.Trim().ToLowerInvariant();
        if (value.StartsWith("https://")) value = value["https://".Length..];
        if (value.StartsWith("http://")) value = value["http://".Length..];
        return value.TrimEnd('/');
    }

    private async Task EnsureHostIsFreeAsync(string host, CancellationToken ct)
    {
        if (await db.Domains.IgnoreQueryFilters().AnyAsync(d => d.Host == host, ct))
            throw new TenantProvisioningException($"Domain '{host}' is already assigned to a restaurant.");
    }
}
