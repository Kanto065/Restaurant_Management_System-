using System.Reflection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Identity;

namespace Platform.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentTenant currentTenant)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    private readonly ICurrentTenant _currentTenant = currentTenant;

    // Tenancy / platform
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<RestaurantDomain> Domains => Set<RestaurantDomain>();
    public DbSet<OpeningHour> OpeningHours => Set<OpeningHour>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    // Staff / devices
    public DbSet<RestaurantStaff> RestaurantStaff => Set<RestaurantStaff>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Menu
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();
    public DbSet<MenuCategoryAvailableDay> MenuCategoryAvailableDays => Set<MenuCategoryAvailableDay>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<ModifierGroup> ModifierGroups => Set<ModifierGroup>();
    public DbSet<ModifierOption> ModifierOptions => Set<ModifierOption>();
    public DbSet<MenuItemModifierGroup> MenuItemModifierGroups => Set<MenuItemModifierGroup>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<DealComponent> DealComponents => Set<DealComponent>();

    // Ordering
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<ProcessedPaymentEvent> ProcessedPaymentEvents => Set<ProcessedPaymentEvent>();

    // Customer / loyalty
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();
    public DbSet<LoyaltyTransaction> LoyaltyTransactions => Set<LoyaltyTransaction>();
    public DbSet<DeliveryZone> DeliveryZones => Set<DeliveryZone>();
    public DbSet<CustomerFavoriteMenuItem> CustomerFavoriteMenuItems => Set<CustomerFavoriteMenuItem>();

    // Reviews, vouchers, opening-hour overrides
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Voucher> Vouchers => Set<Voucher>();
    public DbSet<OpeningHourException> OpeningHourExceptions => Set<OpeningHourException>();

    // Realtime
    public DbSet<NotificationEvent> NotificationEvents => Set<NotificationEvent>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        ApplyTenantConfiguration(builder);
        ConfigureIndexesAndPrecision(builder);
    }

    /// <summary>
    /// Applies a RestaurantId global query filter to every IHasTenant entity, wired once
    /// via reflection instead of repeating HasQueryFilter(...) per entity type.
    /// </summary>
    private void ApplyTenantConfiguration(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (!typeof(IHasTenant).IsAssignableFrom(entityType.ClrType))
                continue;

            builder.Entity(entityType.ClrType).HasIndex(nameof(IHasTenant.RestaurantId));

            var method = typeof(AppDbContext)
                .GetMethod(nameof(SetTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!
                .MakeGenericMethod(entityType.ClrType);
            method.Invoke(this, [builder]);
        }
    }

    private void SetTenantFilter<TEntity>(ModelBuilder builder) where TEntity : class, IHasTenant
    {
        builder.Entity<TEntity>().HasQueryFilter(e =>
            !_currentTenant.RestaurantId.HasValue || e.RestaurantId == _currentTenant.RestaurantId.Value);
    }

    private static void ConfigureIndexesAndPrecision(ModelBuilder builder)
    {
        foreach (var property in builder.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetPrecision(10);
            property.SetScale(2);
        }

        builder.Entity<RestaurantDomain>().HasIndex(d => d.Host).IsUnique();
        builder.Entity<Restaurant>().HasIndex(r => r.Slug).IsUnique();
        builder.Entity<Restaurant>().Property(r => r.Currency).HasDefaultValue("GBP");
        builder.Entity<Order>().HasIndex(o => new { o.RestaurantId, o.OrderNumber }).IsUnique();
        builder.Entity<Table>().HasIndex(t => t.QrToken).IsUnique();
        builder.Entity<Customer>().HasIndex(c => new { c.RestaurantId, c.Email }).IsUnique();
        builder.Entity<ProcessedPaymentEvent>().HasIndex(e => new { e.Provider, e.EventId }).IsUnique();
        builder.Entity<Voucher>().HasIndex(v => new { v.RestaurantId, v.Code }).IsUnique();
        builder.Entity<CustomerFavoriteMenuItem>().HasIndex(f => new { f.CustomerId, f.MenuItemId }).IsUnique();
        builder.Entity<OpeningHourException>().HasIndex(e => new { e.RestaurantId, e.Date }).IsUnique();

        // Avoid multiple-cascade-path errors: Order → OrderStatusHistory/Payment cascade,
        // but Order → Table/Customer/DeliveryAddress should not cascade-delete the order's parents.
        builder.Entity<Order>()
            .HasOne(o => o.Table).WithMany().OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Order>()
            .HasOne(o => o.Customer).WithMany().OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Order>()
            .HasOne(o => o.DeliveryAddress).WithMany().OnDelete(DeleteBehavior.Restrict);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTenantAndTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Defense in depth: auto-stamps RestaurantId on new tenant-scoped entities from the
    /// resolved tenant context, and rejects attempts to save a row for a different tenant.
    /// </summary>
    private void StampTenantAndTimestamps()
    {
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added)
                entry.Entity.CreatedAt = DateTimeOffset.UtcNow;
            else if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
        }

        foreach (var entry in ChangeTracker.Entries<IHasTenant>())
        {
            if (!_currentTenant.RestaurantId.HasValue)
                continue;

            if (entry.State == EntityState.Added && entry.Entity.RestaurantId == Guid.Empty)
            {
                entry.Entity.RestaurantId = _currentTenant.RestaurantId.Value;
            }
            else if (entry.State is EntityState.Added or EntityState.Modified &&
                     entry.Entity.RestaurantId != _currentTenant.RestaurantId.Value)
            {
                throw new InvalidOperationException(
                    $"Cross-tenant write blocked: entity {entry.Entity.GetType().Name} " +
                    $"has RestaurantId {entry.Entity.RestaurantId} but current tenant is {_currentTenant.RestaurantId.Value}.");
            }
        }
    }
}
