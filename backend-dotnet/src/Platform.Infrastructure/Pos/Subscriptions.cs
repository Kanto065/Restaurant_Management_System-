using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

public enum SubscriptionAccess
{
    Active,
    /// <summary>Past the period end but inside GraceDays: POS warns, keeps working.</summary>
    Grace,
    /// <summary>Past end + grace (or cancelled): POS blocks new orders.</summary>
    Expired
}

public static class SubscriptionRules
{
    /// <summary>No subscription row = active, so restaurants never put on a plan can't be locked.
    /// Only the POS licence reads this; web ordering and the admin panel never do.</summary>
    public static SubscriptionAccess Evaluate(Subscription? s, DateTimeOffset now)
    {
        if (s is null)
            return SubscriptionAccess.Active;
        if (s.Status is SubscriptionStatus.Canceled or SubscriptionStatus.Expired)
            return SubscriptionAccess.Expired;

        var end = s.CurrentPeriodEnd ?? s.TrialEndsAt;
        if (end is null || now <= end)
            return SubscriptionAccess.Active;
        return now <= end.Value.AddDays(s.GraceDays) ? SubscriptionAccess.Grace : SubscriptionAccess.Expired;
    }

    public static Task<Subscription?> CurrentAsync(AppDbContext db, Guid organizationId, CancellationToken ct = default) =>
        db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(ct);
}

/// <summary>Daily: moves subscriptions past their end to PastDue, and past end + grace to
/// Expired. Restaurants without a subscription row are never touched.</summary>
public class SubscriptionExpiryService(IServiceScopeFactory scopes, ILogger<SubscriptionExpiryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var changed = await RunOnceAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(),
                    DateTimeOffset.UtcNow, stoppingToken);
                if (changed > 0)
                    logger.LogInformation("Subscription expiry: {Count} subscription(s) changed status", changed);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Subscription expiry run failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public static async Task<int> RunOnceAsync(AppDbContext db, DateTimeOffset now, CancellationToken ct = default)
    {
        var open = await db.Subscriptions.IgnoreQueryFilters()
            .Where(s => !s.IsDeleted && (s.Status == SubscriptionStatus.Trialing
                || s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.PastDue))
            .ToListAsync(ct);

        var changed = 0;
        foreach (var s in open)
        {
            var next = SubscriptionRules.Evaluate(s, now) switch
            {
                SubscriptionAccess.Expired => SubscriptionStatus.Expired,
                SubscriptionAccess.Grace => SubscriptionStatus.PastDue,
                _ => s.Status,
            };
            if (next != s.Status)
            {
                s.Status = next;
                changed++;
            }
        }
        await db.SaveChangesAsync(ct);
        return changed;
    }
}
