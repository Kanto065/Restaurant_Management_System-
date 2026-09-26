using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Infrastructure.Identity;

namespace Platform.Api.Controllers.PlatformAdmin;

public record PlatformLoginRequest(string Email, string Password);

public record PlatformLoginResponse(string AccessToken, DateTimeOffset ExpiresAt, string Email, string FullName);

public record PlatformMeDto(Guid Id, string Email, string FullName);

/// <summary>
/// Login for the super admin panel. Only users flagged IsPlatformSuperAdmin (seeded from
/// PlatformAdmin:* config) get a "platform" token; restaurant staff logins never do.
/// </summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform/auth")]
public class PlatformAuthController(UserManager<AppUser> userManager, IJwtTokenService tokenService) : ControllerBase
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(8);

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<PlatformLoginResponse>>> Login(PlatformLoginRequest request)
    {
        var user = await userManager.FindByNameAsync(request.Email.Trim());
        if (user is null || !user.IsPlatformSuperAdmin || !await userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(ApiResponse<PlatformLoginResponse>.Fail("Invalid email or password.", 401));

        var token = tokenService.CreatePlatformAccessToken(user.Id, user.Email!, TokenLifetime);
        return Ok(ApiResponse<PlatformLoginResponse>.Ok(
            new PlatformLoginResponse(token, DateTimeOffset.UtcNow.Add(TokenLifetime), user.Email!, user.FullName)));
    }

    [HttpGet("me")]
    [Authorize(Policy = "PlatformSuperAdmin")]
    public async Task<ActionResult<ApiResponse<PlatformMeDto>>> Me()
    {
        var user = await userManager.FindByIdAsync(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
        if (user is null || !user.IsPlatformSuperAdmin)
            return Unauthorized(ApiResponse<PlatformMeDto>.Fail("Not a platform admin.", 401));

        return Ok(ApiResponse<PlatformMeDto>.Ok(new PlatformMeDto(user.Id, user.Email!, user.FullName)));
    }
}
