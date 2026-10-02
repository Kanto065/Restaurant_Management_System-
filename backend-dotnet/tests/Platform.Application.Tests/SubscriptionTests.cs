using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Multitenancy;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Application.Tests;

public class SubscriptionTests
{
    private class SystemActor : ICurrentActor { public Guid ActorId => AuditConstants.SystemUserId; }

    private static readonly DateTimeOffset Now = new(2026, 10, 2, 12, 0, 0, TimeSpan.Zero);

    private static Subscription Sub(DateTimeOffset? end, SubscriptionStatus status = SubscriptionStatus.Active) =>
        new() { OrganizationId = Guid.NewGuid(), PlanId = Guid.NewGuid(), Status = status, CurrentPeriodEnd = end, GraceDays = 7 };

    [Fact]
    public void NoSubscriptionRow_IsActive() =>
        Assert.Equal(SubscriptionAccess.Active, SubscriptionRules.Evaluate(null, Now));

    [Theory]
    [InlineData(1, SubscriptionAccess.Active)]
    [InlineData(-3, SubscriptionAccess.Grace)]
    [InlineData(-7, SubscriptionAccess.Grace)]
    [InlineData(-8, SubscriptionAccess.Expired)]
    public void PeriodEndAndGrace(int endInDays, SubscriptionAccess expected) =>
        Assert.Equal(expected, SubscriptionRules.Evaluate(Sub(Now.AddDays(endInDays)), Now));

    [Fact]
    public void Cancelled_IsExpired_EvenBeforeEnd() =>
        Assert.Equal(SubscriptionAccess.Expired, SubscriptionRules.Evaluate(Sub(Now.AddDays(30), SubscriptionStatus.Canceled), Now));

    [Fact]
    public async Task ExpiryJob_MovesStatuses_AndLeavesCurrentOnesAlone()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new AppDbContext(options, new CurrentTenant(), new SystemActor());
        Subscription current = Sub(Now.AddDays(5)), grace = Sub(Now.AddDays(-2)), expired = Sub(Now.AddDays(-30));
        db.Subscriptions.AddRange(current, grace, expired);
        await db.SaveChangesAsync();

        Assert.Equal(2, await SubscriptionExpiryService.RunOnceAsync(db, Now));
        Assert.Equal(SubscriptionStatus.Active, current.Status);
        Assert.Equal(SubscriptionStatus.PastDue, grace.Status);
        Assert.Equal(SubscriptionStatus.Expired, expired.Status);
    }

    [Fact]
    public void Licence_VerifiesWithItsPublicKey_AndRejectsTampering()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SigningKey"] = "test-signing-key-123" }).Build();
        var signer = new LicenceSigner(config);
        var licence = signer.Sign(new LicencePayload(Guid.NewGuid(), new() { ["pos"] = true }, Now, 7, "Active", Now));

        Assert.True(LicenceSigner.Verify(licence));
        Assert.Equal(signer.PublicKey, new LicenceSigner(config).PublicKey); // stable across restarts
        var forged = signer.Sign(new LicencePayload(Guid.NewGuid(), new() { ["pos"] = true }, Now.AddYears(5), 7, "Active", Now));
        Assert.False(LicenceSigner.Verify(licence with { Payload = forged.Payload }));
    }
}
