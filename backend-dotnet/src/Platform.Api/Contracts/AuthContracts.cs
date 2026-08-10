namespace Platform.Api.Contracts;

public record StaffLoginRequest(string Email, string Password, Guid? RestaurantId);

public record SwitchRestaurantRequest(Guid RestaurantId);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record CustomerRegisterAddressRequest(string Line1, string? Line2, string City, string? County, string Postcode);

public record CustomerRegisterRequest(
    string Email, string Password, string FullName, string? Phone,
    string? Title = null, string? LandlinePhone = null, DateOnly? DateOfBirth = null,
    bool MarketingEmailOptIn = false, bool MarketingSmsOptIn = false,
    CustomerRegisterAddressRequest? DeliveryAddress = null);

public record CustomerLoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record TokenResponse(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt);

public record StaffRestaurantSummary(Guid RestaurantId, string RestaurantName, string Role);

public record StaffMeResponse(Guid UserId, string Email, string FullName, Guid? ActiveRestaurantId, List<StaffRestaurantSummary> Restaurants);

/// <summary>A device authenticates with the id + secret it was issued at pairing time (see
/// Admin/DevicesController) - no email/password, no host-based tenant resolution (the POS app
/// talks to the API host directly, not a customer's branded domain).</summary>
public record DeviceLoginRequest(Guid DeviceId, string Secret);

/// <summary>No refresh token - device tokens are short-lived (JwtOptions.DeviceAccessTokenMinutes)
/// and the device already holds its secret locally, so it just calls device/login again rather
/// than needing refresh-token rotation.</summary>
public record DeviceTokenResponse(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RestaurantName);
