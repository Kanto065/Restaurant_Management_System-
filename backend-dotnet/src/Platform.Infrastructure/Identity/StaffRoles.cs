using System.Security.Claims;
using Platform.Domain.Enums;

namespace Platform.Infrastructure.Identity;

public static class StaffRoles
{
    /// <summary>Roles that only use the POS (PIN login on the shop hub), never the admin panel.</summary>
    private static readonly string[] PosOnly = [nameof(StaffRole.Waiter), nameof(StaffRole.Cashier)];

    /// <summary>False only when the token's role for its active restaurant is Waiter or Cashier.
    /// Everything else - Owner/Manager/Staff/KitchenDisplay, or a token without a matching
    /// "restaurant" claim - keeps the access it had before these roles existed.</summary>
    public static bool CanUseAdminPanel(ClaimsPrincipal user)
    {
        var role = ActiveRoleName(user);
        return role is null || !PosOnly.Contains(role);
    }

    /// <summary>The token's role at its active restaurant, or null if it has none.</summary>
    public static StaffRole? ActiveRole(ClaimsPrincipal user) =>
        Enum.TryParse<StaffRole>(ActiveRoleName(user), out var role) ? role : null;

    private static string? ActiveRoleName(ClaimsPrincipal user)
    {
        var active = user.FindFirstValue("active_restaurant_id");
        return active is null
            ? null
            : user.FindAll("restaurant")
                .Select(c => c.Value.Split(':'))
                .FirstOrDefault(parts => parts.Length == 2 && parts[0] == active)?[1];
    }
}
