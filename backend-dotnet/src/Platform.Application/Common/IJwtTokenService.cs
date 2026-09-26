using Platform.Domain.Enums;

namespace Platform.Application.Common;

public record StaffRestaurantClaim(Guid RestaurantId, StaffRole Role);

public record TokenPair(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt);

public interface IJwtTokenService
{
    /// <param name="activeRestaurantId">The restaurant currently selected in the admin UI (restaurant switcher);
    /// defaults to the single restaurant when the staff user only has one.</param>
    string CreateStaffAccessToken(Guid userId, string email, IReadOnlyList<StaffRestaurantClaim> restaurants,
        Guid activeRestaurantId, Guid activeOrganizationId);

    string CreateCustomerAccessToken(Guid userId, Guid customerId, Guid restaurantId);

    string CreateDeviceAccessToken(Guid deviceId, Guid restaurantId, Guid organizationId);

    /// <summary>Super admin panel token - carries no restaurant, only usable on /api/platform/*.</summary>
    string CreatePlatformAccessToken(Guid userId, string email, TimeSpan lifetime);

    string GenerateRefreshToken();

    string HashRefreshToken(string refreshToken);
}
