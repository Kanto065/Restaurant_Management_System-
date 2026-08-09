using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<AppUser> userManager,
    IJwtTokenService tokenService,
    AppDbContext db,
    ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet("me")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<StaffMeResponse>>> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Unauthorized(ApiResponse<StaffMeResponse>.Fail("User not found.", 401));

        var staffRows = await db.RestaurantStaff
            .IgnoreQueryFilters()
            .Where(s => s.UserId == user.Id && s.IsActive)
            .Include(s => s.Restaurant)
            .ToListAsync();

        var restaurants = staffRows
            .Select(s => new StaffRestaurantSummary(s.RestaurantId, s.Restaurant!.Name, s.Role.ToString()))
            .ToList();

        var response = new StaffMeResponse(user.Id, user.Email!, user.FullName, currentTenant.RestaurantId, restaurants);
        return Ok(ApiResponse<StaffMeResponse>.Ok(response));
    }

    [HttpPost("staff/change-password")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword(ChangePasswordRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Unauthorized(ApiResponse<object>.Fail("User not found.", 401));

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            return BadRequest(ApiResponse<object>.Fail(errors, 400));
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Password changed successfully."));
    }

    [HttpPost("staff/login")]
    public async Task<ActionResult<ApiResponse<TokenResponse>>> StaffLogin(StaffLoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(ApiResponse<TokenResponse>.Fail("Invalid email or password.", 401));

        var staffRows = await db.RestaurantStaff
            .IgnoreQueryFilters()
            .Where(s => s.UserId == user.Id && s.IsActive)
            .Include(s => s.Restaurant)
            .ToListAsync();

        if (staffRows.Count == 0)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("This account has no active restaurant access.", 401));

        var active = request.RestaurantId.HasValue
            ? staffRows.FirstOrDefault(s => s.RestaurantId == request.RestaurantId.Value)
            : staffRows[0];

        if (active is null)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("No access to the requested restaurant.", 401));

        var restaurantClaims = staffRows
            .Select(s => new StaffRestaurantClaim(s.RestaurantId, s.Role))
            .ToList();

        var accessToken = tokenService.CreateStaffAccessToken(
            user.Id, user.Email!, restaurantClaims, active.RestaurantId, active.Restaurant!.OrganizationId);

        var tokens = await IssueRefreshTokenAsync(user.Id, accessToken);
        return Ok(ApiResponse<TokenResponse>.Ok(tokens));
    }

    /// <summary>
    /// Reissues a token for a different restaurant the already-authenticated staff user has
    /// access to (multi-branch switcher) — no password required since they're already signed in.
    /// </summary>
    [HttpPost("staff/switch-restaurant")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<TokenResponse>>> SwitchRestaurant(SwitchRestaurantRequest request)
    {
        var userId = Guid.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

        var staffRows = await db.RestaurantStaff
            .IgnoreQueryFilters()
            .Where(s => s.UserId == userId && s.IsActive)
            .Include(s => s.Restaurant)
            .ToListAsync();

        var active = staffRows.FirstOrDefault(s => s.RestaurantId == request.RestaurantId);
        if (active is null)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("No access to the requested restaurant.", 401));

        var user = await userManager.FindByIdAsync(userId.ToString());
        var restaurantClaims = staffRows.Select(s => new StaffRestaurantClaim(s.RestaurantId, s.Role)).ToList();

        var accessToken = tokenService.CreateStaffAccessToken(
            userId, user!.Email!, restaurantClaims, active.RestaurantId, active.Restaurant!.OrganizationId);

        var tokens = await IssueRefreshTokenAsync(userId, accessToken);
        return Ok(ApiResponse<TokenResponse>.Ok(tokens));
    }

    [HttpPost("customer/register")]
    public async Task<ActionResult<ApiResponse<TokenResponse>>> CustomerRegister(CustomerRegisterRequest request)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<TokenResponse>.Fail("Could not resolve restaurant from this domain.", 400));

        var restaurantId = currentTenant.RestaurantId.Value;

        var existing = await db.Customers.FirstOrDefaultAsync(c => c.Email == request.Email);
        if (existing is not null)
            return Conflict(ApiResponse<TokenResponse>.Fail("An account with this email already exists.", 409));

        var user = new AppUser { UserName = request.Email, Email = request.Email, FullName = request.FullName };
        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join("; ", createResult.Errors.Select(e => e.Description));
            return BadRequest(ApiResponse<TokenResponse>.Fail(errors, 400));
        }

        var customer = new Customer
        {
            RestaurantId = restaurantId,
            IdentityUserId = user.Id,
            Email = request.Email,
            FullName = request.FullName,
            Phone = request.Phone,
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var accessToken = tokenService.CreateCustomerAccessToken(user.Id, customer.Id, restaurantId);
        var tokens = await IssueRefreshTokenAsync(user.Id, accessToken);
        return Ok(ApiResponse<TokenResponse>.Ok(tokens, statusCode: 201));
    }

    [HttpPost("customer/login")]
    public async Task<ActionResult<ApiResponse<TokenResponse>>> CustomerLogin(CustomerLoginRequest request)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<TokenResponse>.Fail("Could not resolve restaurant from this domain.", 400));

        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null || !await userManager.CheckPasswordAsync(user, request.Password))
            return Unauthorized(ApiResponse<TokenResponse>.Fail("Invalid email or password.", 401));

        var customer = await db.Customers
            .FirstOrDefaultAsync(c => c.IdentityUserId == user.Id && c.RestaurantId == currentTenant.RestaurantId.Value);
        if (customer is null)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("No customer account for this restaurant.", 401));

        var accessToken = tokenService.CreateCustomerAccessToken(user.Id, customer.Id, currentTenant.RestaurantId.Value);
        var tokens = await IssueRefreshTokenAsync(user.Id, accessToken);
        return Ok(ApiResponse<TokenResponse>.Ok(tokens));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<TokenResponse>>> Refresh(RefreshRequest request)
    {
        var hash = tokenService.HashRefreshToken(request.RefreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (stored is null || !stored.IsActive)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("Refresh token is invalid or expired.", 401));

        var user = await userManager.FindByIdAsync(stored.UserId.ToString());
        if (user is null)
            return Unauthorized(ApiResponse<TokenResponse>.Fail("Refresh token is invalid or expired.", 401));

        // Rotate: revoke the presented token, mint a new pair.
        stored.RevokedAt = DateTimeOffset.UtcNow;

        var staffRows = await db.RestaurantStaff
            .IgnoreQueryFilters()
            .Where(s => s.UserId == user.Id && s.IsActive)
            .Include(s => s.Restaurant)
            .ToListAsync();

        string accessToken;
        if (staffRows.Count > 0)
        {
            var active = staffRows[0];
            var restaurantClaims = staffRows.Select(s => new StaffRestaurantClaim(s.RestaurantId, s.Role)).ToList();
            accessToken = tokenService.CreateStaffAccessToken(
                user.Id, user.Email!, restaurantClaims, active.RestaurantId, active.Restaurant!.OrganizationId);
        }
        else
        {
            var customer = await db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.IdentityUserId == user.Id);
            if (customer is null)
                return Unauthorized(ApiResponse<TokenResponse>.Fail("No account found for this token.", 401));

            accessToken = tokenService.CreateCustomerAccessToken(user.Id, customer.Id, customer.RestaurantId);
        }

        var tokens = await IssueRefreshTokenAsync(user.Id, accessToken, replacesHash: hash);
        return Ok(ApiResponse<TokenResponse>.Ok(tokens));
    }

    private async Task<TokenResponse> IssueRefreshTokenAsync(Guid userId, string accessToken, string? replacesHash = null)
    {
        var refreshToken = tokenService.GenerateRefreshToken();
        var refreshTokenHash = tokenService.HashRefreshToken(refreshToken);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
        });

        if (replacesHash is not null)
        {
            var previous = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == replacesHash);
            if (previous is not null)
                previous.ReplacedByTokenHash = refreshTokenHash;
        }

        await db.SaveChangesAsync();

        return new TokenResponse(accessToken, refreshToken, DateTimeOffset.UtcNow.AddMinutes(30));
    }
}
