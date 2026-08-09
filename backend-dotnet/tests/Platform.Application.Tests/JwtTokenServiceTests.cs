using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Options;
using Platform.Application.Common;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Xunit;

namespace Platform.Application.Tests;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService() => new(Options.Create(new JwtOptions
    {
        Issuer = "test-issuer",
        Audience = "test-audience",
        SigningKey = "this-is-a-test-signing-key-that-is-long-enough",
        AccessTokenMinutes = 30,
    }));

    [Fact]
    public void CreateStaffAccessToken_IncludesActiveRestaurantAndRestaurantListClaims()
    {
        var service = CreateService();
        var userId = Guid.NewGuid();
        var restaurantId = Guid.NewGuid();
        var organizationId = Guid.NewGuid();
        var restaurants = new List<StaffRestaurantClaim> { new(restaurantId, StaffRole.Owner) };

        var token = service.CreateStaffAccessToken(userId, "owner@example.com", restaurants, restaurantId, organizationId);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("staff", jwt.Claims.First(c => c.Type == "token_type").Value);
        Assert.Equal(restaurantId.ToString(), jwt.Claims.First(c => c.Type == "active_restaurant_id").Value);
        Assert.Equal($"{restaurantId}:Owner", jwt.Claims.First(c => c.Type == "restaurant").Value);
    }

    [Fact]
    public void CreateDeviceAccessToken_MarksPosScope()
    {
        var service = CreateService();
        var token = service.CreateDeviceAccessToken(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal("device", jwt.Claims.First(c => c.Type == "token_type").Value);
        Assert.Equal("pos", jwt.Claims.First(c => c.Type == "scope").Value);
    }

    [Fact]
    public void HashRefreshToken_IsDeterministicAndDoesNotLeakPlaintext()
    {
        var service = CreateService();
        var refreshToken = service.GenerateRefreshToken();

        var hash1 = service.HashRefreshToken(refreshToken);
        var hash2 = service.HashRefreshToken(refreshToken);

        Assert.Equal(hash1, hash2);
        Assert.NotEqual(refreshToken, hash1);
    }
}
