using System.Security.Claims;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;

namespace Platform.Application.Tests;

/// <summary>Backward-compat guard: existing roles keep admin access; only the new POS-only
/// roles (Waiter, Cashier) are blocked from the admin panel.</summary>
public class StaffRolesTests
{
    private static readonly Guid Active = Guid.NewGuid();

    private static ClaimsPrincipal Staff(params (Guid restaurant, StaffRole role)[] memberships) =>
        new(new ClaimsIdentity(
            memberships.Select(m => new Claim("restaurant", $"{m.restaurant}:{m.role}"))
                .Append(new Claim("token_type", "staff"))
                .Append(new Claim("active_restaurant_id", Active.ToString())),
            "test"));

    [Theory]
    [InlineData(StaffRole.Owner, true)]
    [InlineData(StaffRole.Manager, true)]
    [InlineData(StaffRole.Staff, true)]
    [InlineData(StaffRole.KitchenDisplay, true)]
    [InlineData(StaffRole.Waiter, false)]
    [InlineData(StaffRole.Cashier, false)]
    public void AdminAccess_ByRoleAtActiveRestaurant(StaffRole role, bool expected) =>
        Assert.Equal(expected, StaffRoles.CanUseAdminPanel(Staff((Active, role))));

    [Fact]
    public void WaiterElsewhere_DoesNotBlockOwnerHere() =>
        Assert.True(StaffRoles.CanUseAdminPanel(Staff((Guid.NewGuid(), StaffRole.Waiter), (Active, StaffRole.Owner))));

    [Fact]
    public void TokenWithoutRestaurantClaims_KeepsAccess() =>
        Assert.True(StaffRoles.CanUseAdminPanel(Staff()));
}

public class PinHasherTests
{
    [Theory]
    [InlineData("1234", true)]
    [InlineData("123456", true)]
    [InlineData("123", false)]
    [InlineData("1234567", false)]
    [InlineData("12a4", false)]
    [InlineData(null, false)]
    public void PinFormat(string? pin, bool valid) =>
        Assert.Equal(valid, Platform.Infrastructure.Pos.PinHasher.IsValidPin(pin));

    [Fact]
    public void HashVerifies_OnlyForTheSamePin()
    {
        var hash = Platform.Infrastructure.Pos.PinHasher.Hash("4321");
        Assert.StartsWith("pbkdf2-sha256$10000$", hash);
        Assert.True(Platform.Infrastructure.Pos.PinHasher.Verify("4321", hash));
        Assert.False(Platform.Infrastructure.Pos.PinHasher.Verify("1234", hash));
        Assert.False(Platform.Infrastructure.Pos.PinHasher.Verify("4321", null));
        Assert.NotEqual(hash, Platform.Infrastructure.Pos.PinHasher.Hash("4321")); // salted
    }
}
