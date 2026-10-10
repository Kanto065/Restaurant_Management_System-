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

    /// <summary>
    /// Customer accounts are separate per restaurant: the same email can register at each
    /// restaurant with its own password, so the username (unique) is scoped by restaurant
    /// while Email is not unique. Staff keep UserName = email.
    /// Only characters in Identity's default AllowedUserNameCharacters are used.
    /// </summary>
    public static string CustomerUserName(Guid restaurantId, string email) =>
        $"customer.{restaurantId:N}.{email.Trim().ToLowerInvariant()}";
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

    /// <summary>
    /// The restaurant the session was issued for, so refresh keeps a staff user on the restaurant
    /// they signed into (instead of their first one) and picks the right customer row.
    /// Null for tokens issued before this column existed.
    /// </summary>
    public Guid? RestaurantId { get; set; }

    public bool IsActive => RevokedAt is null && DateTimeOffset.UtcNow < ExpiresAt;

    /// <summary>Presented again after it was rotated away, beyond the grace for two tabs refreshing
    /// at once: the token was copied, so the whole session should be killed.</summary>
    public bool IsReplay(DateTimeOffset now) =>
        ReplacedByTokenHash is not null && RevokedAt is { } at && now - at > ReplayGrace;

    public static readonly TimeSpan ReplayGrace = TimeSpan.FromSeconds(60);
}
