using Microsoft.EntityFrameworkCore;
using Platform.Domain.Entities;

namespace Platform.Application.Common;

/// <summary>The slice of the database that Application use cases need. AppDbContext implements it,
/// so handlers get the same tenant filter and audit stamping as everything else. Add a DbSet
/// here when a use case needs it.</summary>
public interface IAppDbContext
{
    DbSet<Order> Orders { get; }
    DbSet<OrderStatusHistory> OrderStatusHistories { get; }
    DbSet<OrderStatusDefinition> OrderStatusDefinitions { get; }
    DbSet<PaymentStatusDefinition> PaymentStatusDefinitions { get; }
    DbSet<Restaurant> Restaurants { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<Table> Tables { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CustomerAddress> CustomerAddresses { get; }
    DbSet<LoyaltyTransaction> LoyaltyTransactions { get; }
    DbSet<Voucher> Vouchers { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
