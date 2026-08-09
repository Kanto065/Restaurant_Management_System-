using Microsoft.AspNetCore.Identity;

namespace Platform.Infrastructure.Identity;

/// <summary>
/// Shared Identity user for both staff and customer accounts — differentiated by
/// their RestaurantStaff / Customer association, not by separate user tables.
/// </summary>
public class AppUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = default!;
    public bool IsPlatformSuperAdmin { get; set; }
}

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = default!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }

    public bool IsActive => RevokedAt is null && DateTimeOffset.UtcNow < ExpiresAt;
}
