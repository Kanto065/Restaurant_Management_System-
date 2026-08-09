using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Platform.Infrastructure.Multitenancy;

namespace Platform.Infrastructure.Persistence;

/// <summary>
/// Used only by `dotnet ef migrations add` at design time — no real tenant/request context exists yet,
/// so a no-op CurrentTenant (unresolved, filters effectively disabled) is supplied.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Database=platform_design_time;Username=postgres;Password=postgres");

        return new AppDbContext(optionsBuilder.Options, new CurrentTenant());
    }
}
