using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Infrastructure.Multitenancy;

namespace Platform.Infrastructure.Persistence;

/// <summary>
/// Used only by `dotnet ef migrations add` at design time — no real tenant/request context exists yet,
/// so a no-op CurrentTenant (unresolved, filters effectively disabled) and a System-only
/// CurrentActor are supplied.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    private class DesignTimeCurrentActor : ICurrentActor
    {
        public Guid ActorId => AuditConstants.SystemUserId;
    }

    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Database=platform_design_time;Username=postgres;Password=postgres");

        return new AppDbContext(optionsBuilder.Options, new CurrentTenant(), new DesignTimeCurrentActor());
    }
}
