using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;

namespace Platform.Infrastructure.Persistence;

/// <summary>
/// Seeds the first live tenant (porttennanttandoori.co.uk) so there is an Owner account
/// to log into the admin dashboard with. Idempotent — safe to run on every startup.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedFirstTenantAsync(IServiceProvider services, SeedOptions options)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        await db.Database.MigrateAsync();

        var organization = await db.Organizations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.BillingEmail == options.OwnerEmail);

        if (organization is null)
        {
            organization = new Organization
            {
                Name = options.RestaurantName,
                BillingEmail = options.OwnerEmail,
            };
            db.Organizations.Add(organization);
            await db.SaveChangesAsync();
        }

        var restaurant = await db.Restaurants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Slug == options.RestaurantSlug);

        if (restaurant is null)
        {
            restaurant = new Restaurant
            {
                OrganizationId = organization.Id,
                Name = options.RestaurantName,
                Slug = options.RestaurantSlug,
                AddressLine1 = options.AddressLine1,
                City = options.City,
                Postcode = options.Postcode,
            };
            db.Restaurants.Add(restaurant);
            await db.SaveChangesAsync();
        }

        var domainExists = await db.Domains.IgnoreQueryFilters().AnyAsync(d => d.Host == options.Host);
        if (!domainExists)
        {
            db.Domains.Add(new RestaurantDomain
            {
                RestaurantId = restaurant.Id,
                Host = options.Host,
                IsPrimary = true,
                VerifiedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // The admin dashboard resolves its restaurant by host too (same-origin /api), so its
        // host needs a Domain row. Hosts are stored lowercase to match TenantDomainResolver.
        var adminHost = options.AdminHost?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(adminHost)
            && !await db.Domains.IgnoreQueryFilters().AnyAsync(d => d.Host == adminHost))
        {
            db.Domains.Add(new RestaurantDomain
            {
                RestaurantId = restaurant.Id,
                Host = adminHost,
                Kind = DomainKind.Admin,
                IsPrimary = true,
                VerifiedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var owner = await userManager.FindByNameAsync(options.OwnerEmail);
        if (owner is null)
        {
            owner = new AppUser
            {
                UserName = options.OwnerEmail,
                Email = options.OwnerEmail,
                EmailConfirmed = true,
                FullName = options.OwnerFullName,
            };
            var result = await userManager.CreateAsync(owner, options.OwnerPassword);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                throw new InvalidOperationException($"Failed to seed owner user: {errors}");
            }
        }

        var staffExists = await db.RestaurantStaff.IgnoreQueryFilters()
            .AnyAsync(s => s.UserId == owner.Id && s.RestaurantId == restaurant.Id);

        if (!staffExists)
        {
            db.RestaurantStaff.Add(new RestaurantStaff
            {
                RestaurantId = restaurant.Id,
                UserId = owner.Id,
                Role = StaffRole.Owner,
                AcceptedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        }
    }
}

public class SeedOptions
{
    public const string SectionName = "Seed";

    public string Host { get; set; } = "www.porttennanttandoori.co.uk";
    /// <summary>Admin dashboard host for this tenant (e.g. admin.porttennanttandoori.co.uk). Optional.</summary>
    public string? AdminHost { get; set; }
    public string RestaurantName { get; set; } = "Port Tennant Tandoori";
    public string RestaurantSlug { get; set; } = "port-tennant-tandoori";
    public string AddressLine1 { get; set; } = "TBC";
    public string City { get; set; } = "Swansea";
    public string Postcode { get; set; } = "TBC";
    public string OwnerEmail { get; set; } = "owner@porttennanttandoori.co.uk";
    public string OwnerFullName { get; set; } = "Restaurant Owner";
    public string OwnerPassword { get; set; } = "ChangeMe123!";
}

/// <summary>
/// The super admin panel's login (superadmin.porttennanttandoori.co.uk). Both values come from
/// env (PlatformAdmin__Email / PlatformAdmin__Password); nothing is seeded when Email is empty.
/// </summary>
public class PlatformAdminOptions
{
    public const string SectionName = "PlatformAdmin";

    public string? Email { get; set; }
    public string? Password { get; set; }
    public string FullName { get; set; } = "Platform Admin";
}

public static class PlatformAdminSeeder
{
    /// <summary>
    /// Ensures the configured user exists and is flagged IsPlatformSuperAdmin. If a staff user with
    /// that email already exists (e.g. you also own a restaurant) it is flagged, password untouched.
    /// Never resets an existing user's password from config.
    /// </summary>
    public static async Task EnsureAsync(IServiceProvider services, PlatformAdminOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.Email))
            return;

        using var scope = services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        var user = await userManager.FindByNameAsync(options.Email.Trim());
        if (user is null)
        {
            if (string.IsNullOrWhiteSpace(options.Password))
                throw new InvalidOperationException("PlatformAdmin:Password is required to create the platform admin user.");

            user = new AppUser
            {
                UserName = options.Email.Trim(),
                Email = options.Email.Trim(),
                EmailConfirmed = true,
                FullName = options.FullName,
                IsPlatformSuperAdmin = true,
            };
            var result = await userManager.CreateAsync(user, options.Password);
            if (!result.Succeeded)
                throw new InvalidOperationException(
                    "Failed to seed platform admin: " + string.Join("; ", result.Errors.Select(e => e.Description)));
            return;
        }

        if (!user.IsPlatformSuperAdmin)
        {
            user.IsPlatformSuperAdmin = true;
            await userManager.UpdateAsync(user);
        }
    }
}
