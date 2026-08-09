using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Platform.Application.Common;

namespace Platform.Infrastructure.Identity;

public class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;

    public string CreateStaffAccessToken(Guid userId, string email, IReadOnlyList<StaffRestaurantClaim> restaurants,
        Guid activeRestaurantId, Guid activeOrganizationId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new("token_type", "staff"),
            new("active_restaurant_id", activeRestaurantId.ToString()),
            new("active_organization_id", activeOrganizationId.ToString()),
        };

        claims.AddRange(restaurants.Select(r => new Claim("restaurant", $"{r.RestaurantId}:{r.Role}")));

        return CreateToken(claims, TimeSpan.FromMinutes(_options.AccessTokenMinutes));
    }

    public string CreateCustomerAccessToken(Guid userId, Guid customerId, Guid restaurantId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("token_type", "customer"),
            new("customer_id", customerId.ToString()),
            new("active_restaurant_id", restaurantId.ToString()),
        };

        return CreateToken(claims, TimeSpan.FromMinutes(_options.AccessTokenMinutes));
    }

    public string CreateDeviceAccessToken(Guid deviceId, Guid restaurantId, Guid organizationId)
    {
        var claims = new List<Claim>
        {
            new("token_type", "device"),
            new("device_id", deviceId.ToString()),
            new("active_restaurant_id", restaurantId.ToString()),
            new("active_organization_id", organizationId.ToString()),
            new("scope", "pos"),
        };

        return CreateToken(claims, TimeSpan.FromMinutes(_options.DeviceAccessTokenMinutes));
    }

    public string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    public string HashRefreshToken(string refreshToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(bytes);
    }

    private string CreateToken(List<Claim> claims, TimeSpan lifetime)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(lifetime),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
