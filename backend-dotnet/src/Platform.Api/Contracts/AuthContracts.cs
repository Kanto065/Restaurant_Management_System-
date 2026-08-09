namespace Platform.Api.Contracts;

public record StaffLoginRequest(string Email, string Password, Guid? RestaurantId);

public record CustomerRegisterRequest(string Email, string Password, string FullName, string? Phone);

public record CustomerLoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record TokenResponse(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt);

public record StaffRestaurantSummary(Guid RestaurantId, string RestaurantName, string Role);

public record StaffMeResponse(Guid UserId, string Email, string FullName, Guid? ActiveRestaurantId, List<StaffRestaurantSummary> Restaurants);
