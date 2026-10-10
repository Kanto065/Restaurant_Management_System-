using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Platform.Domain.Enums;

namespace Platform.Infrastructure.Identity;

public static class Permissions
{
    public const string OrdersView = "orders.view";
    public const string OrdersUpdate = "orders.update";
    public const string OrdersDelete = "orders.delete";

    /// <summary>Everything a role may do. Add a permission here and tag the endpoint with
    /// [HasPermission(...)]; change who gets it by editing this map - nothing else.</summary>
    private static readonly string[] All = [OrdersView, OrdersUpdate, OrdersDelete];

    private static readonly Dictionary<StaffRole, string[]> ByRole = new()
    {
        [StaffRole.Owner] = All,
        [StaffRole.Manager] = All,
        [StaffRole.Staff] = All,
        // The kitchen screen works orders but can't remove them.
        [StaffRole.KitchenDisplay] = [OrdersView, OrdersUpdate],
        // Waiter/Cashier never reach the admin API with a staff token (StaffRoles.CanUseAdminPanel).
    };

    /// <summary>A staff token with no matching "restaurant" claim (role null) keeps the full
    /// access it had before roles existed - same rule as StaffRoles.CanUseAdminPanel.</summary>
    public static bool RoleHas(StaffRole? role, string permission) =>
        role is null || (ByRole.TryGetValue(role.Value, out var granted) && granted.Contains(permission));
}

/// <summary>Requires a permission on top of whatever policy the controller already has.</summary>
public class HasPermissionAttribute(string permission) : AuthorizeAttribute($"{Prefix}{permission}")
{
    public const string Prefix = "perm:";
}

public class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

/// <summary>Devices are already vetted by their own policy/filters, so only staff tokens are
/// checked against the role map.</summary>
public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var user = context.User;
        if (user.HasClaim("token_type", "device") ||
            (user.HasClaim("token_type", "staff") && Permissions.RoleHas(StaffRoles.ActiveRole(user), requirement.Permission)))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

/// <summary>Builds the "perm:xxx" policies on demand so each permission needs no AddPolicy line.</summary>
public class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName) =>
        policyName.StartsWith(HasPermissionAttribute.Prefix)
            ? new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(policyName[HasPermissionAttribute.Prefix.Length..])).Build()
            : await base.GetPolicyAsync(policyName);
}
