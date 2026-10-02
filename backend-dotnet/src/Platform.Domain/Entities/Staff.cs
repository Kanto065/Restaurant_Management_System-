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

    /// <summary>Hashed 4-6 digit PIN for logging in at the POS. Null = no POS login.</summary>
    public string? PinHash { get; set; }

    public Restaurant? Restaurant { get; set; }
}

/// <summary>A paired terminal (Sunmi, main POS hub or waiter tablet). Authenticates via device
/// secret, not a user login.</summary>
public class Device : TenantEntity
{
    public string DeviceName { get; set; } = default!;
    public string DeviceSecretHash { get; set; } = default!;
    public DateTimeOffset? LastSeenAt { get; set; }
    public bool IsActive { get; set; } = true;

    public DeviceType DeviceType { get; set; } = DeviceType.SunmiTerminal;
    public string? AppVersion { get; set; }
    public string? LastIp { get; set; }
    /// <summary>For a waiter tablet: the main POS hub it was paired through.</summary>
    public Guid? HubDeviceId { get; set; }

    public Restaurant? Restaurant { get; set; }
}
