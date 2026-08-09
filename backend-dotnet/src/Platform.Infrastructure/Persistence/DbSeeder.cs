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

        var owner = await userManager.FindByEmailAsync(options.OwnerEmail);
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
    public string RestaurantName { get; set; } = "Port Tennant Tandoori";
    public string RestaurantSlug { get; set; } = "port-tennant-tandoori";
    public string AddressLine1 { get; set; } = "TBC";
    public string City { get; set; } = "Swansea";
    public string Postcode { get; set; } = "TBC";
    public string OwnerEmail { get; set; } = "owner@porttennanttandoori.co.uk";
    public string OwnerFullName { get; set; } = "Restaurant Owner";
    public string OwnerPassword { get; set; } = "ChangeMe123!";
}
