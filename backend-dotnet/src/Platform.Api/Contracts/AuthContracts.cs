namespace Platform.Api.Contracts;

public record StaffLoginRequest(string Email, string Password, Guid? RestaurantId);

public record CustomerRegisterRequest(string Email, string Password, string FullName, string? Phone);

public record CustomerLoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record TokenResponse(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt);
