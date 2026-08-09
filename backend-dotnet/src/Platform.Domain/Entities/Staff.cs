using Platform.Domain.Common;
using Platform.Domain.Enums;

namespace Platform.Domain.Entities;

/// <summary>
/// Join entity: a user acting as staff for a restaurant, with a role.
/// UserId points at the ASP.NET Identity user (defined in Infrastructure) — kept as a
/// plain Guid FK here so Domain has no dependency on the Identity framework.
/// </summary>
public class RestaurantStaff : TenantEntity
{
    public Guid UserId { get; set; }
    public StaffRole Role { get; set; }
    public DateTimeOffset InvitedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? AcceptedAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Restaurant? Restaurant { get; set; }
}

/// <summary>A paired Sunmi POS terminal. Authenticates via device secret, not a user login.</summary>
public class Device : TenantEntity
{
    public string DeviceName { get; set; } = default!;
    public string DeviceSecretHash { get; set; } = default!;
    public DateTimeOffset? LastSeenAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Restaurant? Restaurant { get; set; }
}
