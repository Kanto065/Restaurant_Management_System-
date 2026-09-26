using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Tenancy;

namespace Platform.Api.Controllers.PlatformAdmin;

public record TenantDomainDto(Guid Id, string Host, DomainKind Kind, bool IsPrimary);

public record TenantOwnerDto(Guid UserId, string Email, string FullName, StaffRole Role, bool IsActive);

public record TenantSummaryDto(
    Guid RestaurantId, Guid OrganizationId, string Name, string Slug, string City, bool IsActive,
    IReadOnlyList<TenantDomainDto> Domains, int OrderCount, DateTimeOffset? LastOrderAt, DateTimeOffset CreatedAt);

public record TenantDetailDto(
    Guid RestaurantId, Guid OrganizationId, string Name, string Slug, bool IsActive,
    string AddressLine1, string City, string Postcode, string? Phone, string? Email,
    IReadOnlyList<TenantDomainDto> Domains, IReadOnlyList<TenantOwnerDto> Staff,
    int OrderCount, DateTimeOffset? LastOrderAt, DateTimeOffset CreatedAt,
    TenantFeaturesDto Features);

/// <summary>Platform-controlled switches per restaurant (restaurant staff can't change these).</summary>
public record TenantFeaturesDto(bool PosEnabled);

public record CreateTenantRequest(
    string RestaurantName, string Slug, string AddressLine1, string City, string Postcode,
    string? Phone, string? Email, string? StorefrontHost, string? AdminHost,
    string OwnerEmail, string OwnerFullName, string OwnerPassword);

public record UpdateTenantRequest(
    string Name, string AddressLine1, string City, string Postcode, string? Phone, string? Email);

public record SetTenantStatusRequest(bool IsActive);

public record AddDomainRequest(string Host, DomainKind Kind, bool IsPrimary);

public record AddOwnerRequest(string Email, string FullName, string Password);

public record ResetPasswordRequest(string Password);

public record UpdateStaffRequest(string Email, string FullName);

/// <summary>
/// Super admin panel: create and manage restaurants (tenants). No tenant is resolved on the
/// superadmin host, so every tenant-scoped query here uses IgnoreQueryFilters() and filters by
/// RestaurantId explicitly.
/// </summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform/tenants")]
[Authorize(Policy = "PlatformSuperAdmin")]
public class PlatformTenantsController(
    AppDbContext db,
    UserManager<AppUser> userManager,
    TenantProvisioningService provisioning,
    ITenantDomainResolver domainResolver) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<TenantSummaryDto>>>> List()
    {
        var restaurants = await db.Restaurants.IgnoreQueryFilters()
            .Where(r => !r.IsDeleted)
            .Include(r => r.Domains)
            .OrderBy(r => r.Name)
            .ToListAsync();

        var orderStats = await OrderStatsAsync(restaurants.Select(r => r.Id).ToList());

        var result = restaurants.Select(r =>
        {
            orderStats.TryGetValue(r.Id, out var stats);
            return new TenantSummaryDto(
                r.Id, r.OrganizationId, r.Name, r.Slug, r.City, r.IsActive, ToDomainDtos(r.Domains),
                stats.Count, stats.LastOrderAt, r.CreatedAt);
        }).ToList();

        return Ok(ApiResponse<List<TenantSummaryDto>>.Ok(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> Get(Guid id)
    {
        var detail = await BuildDetailAsync(id);
        return detail is null
            ? NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404))
            : Ok(ApiResponse<TenantDetailDto>.Ok(detail));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> Create(CreateTenantRequest request)
    {
        try
        {
            var restaurant = await provisioning.ProvisionAsync(new ProvisionTenantRequest(
                request.RestaurantName, request.Slug, request.AddressLine1, request.City, request.Postcode,
                request.Phone, request.Email, request.StorefrontHost, request.AdminHost,
                request.OwnerEmail, request.OwnerFullName, request.OwnerPassword));

            await StatusDefinitionSeeder.EnsureDefaultsAsync(HttpContext.RequestServices);

            return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(restaurant.Id))!, statusCode: 201));
        }
        catch (TenantProvisioningException ex)
        {
            return BadRequest(ApiResponse<TenantDetailDto>.Fail(ex.Message, 400));
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> Update(Guid id, UpdateTenantRequest request)
    {
        var restaurant = await db.Restaurants.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (restaurant is null)
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404));

        restaurant.Name = request.Name;
        restaurant.AddressLine1 = request.AddressLine1;
        restaurant.City = request.City;
        restaurant.Postcode = request.Postcode;
        restaurant.Phone = request.Phone;
        restaurant.Email = request.Email;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    /// <summary>Suspend/reactivate. A suspended restaurant's domains answer 503 (TenantResolutionMiddleware).</summary>
    /// <summary>Switch platform features on/off for a restaurant, e.g. the POS terminal app.
    /// Turning POS off cuts off its paired terminals immediately (DeviceValidationMiddleware).</summary>
    [HttpPut("{id:guid}/features")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> SetFeatures(Guid id, TenantFeaturesDto request)
    {
        var restaurant = await db.Restaurants.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (restaurant is null)
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404));

        restaurant.PosEnabled = request.PosEnabled;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    /// <summary>
    /// Put a restaurant back on the standard order + payment status lists (what new restaurants
    /// get), moving any orders on custom statuses to the nearest standard one.
    /// </summary>
    [HttpPost("{id:guid}/statuses/reset-to-standard")]
    public async Task<ActionResult<ApiResponse<StatusDefinitionSeeder.ResetSummary>>> ResetStatuses(Guid id)
    {
        if (!await RestaurantExistsAsync(id))
            return NotFound(ApiResponse<StatusDefinitionSeeder.ResetSummary>.Fail("Restaurant not found.", 404));

        var summary = await StatusDefinitionSeeder.ResetToStandardAsync(db, id, HttpContext.RequestAborted);
        return Ok(ApiResponse<StatusDefinitionSeeder.ResetSummary>.Ok(summary));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> SetStatus(Guid id, SetTenantStatusRequest request)
    {
        var restaurant = await db.Restaurants.IgnoreQueryFilters()
            .Include(r => r.Domains)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (restaurant is null)
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404));

        restaurant.IsActive = request.IsActive;
        await db.SaveChangesAsync();
        foreach (var domain in restaurant.Domains)
            domainResolver.InvalidateHost(domain.Host);

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    [HttpPost("{id:guid}/domains")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> AddDomain(Guid id, AddDomainRequest request)
    {
        if (!await RestaurantExistsAsync(id))
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404));

        try
        {
            await provisioning.AddDomainAsync(id, request.Host, request.Kind, request.IsPrimary);
        }
        catch (TenantProvisioningException ex)
        {
            return BadRequest(ApiResponse<TenantDetailDto>.Fail(ex.Message, 400));
        }

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    [HttpDelete("{id:guid}/domains/{domainId:guid}")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> RemoveDomain(Guid id, Guid domainId)
    {
        try
        {
            await provisioning.RemoveDomainAsync(id, domainId);
        }
        catch (TenantProvisioningException ex)
        {
            return NotFound(ApiResponse<TenantDetailDto>.Fail(ex.Message, 404));
        }

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    [HttpPost("{id:guid}/owners")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> AddOwner(Guid id, AddOwnerRequest request)
    {
        if (!await RestaurantExistsAsync(id))
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Restaurant not found.", 404));

        try
        {
            await provisioning.AddOwnerAsync(id, request.Email, request.FullName, request.Password);
        }
        catch (TenantProvisioningException ex)
        {
            return BadRequest(ApiResponse<TenantDetailDto>.Fail(ex.Message, 400));
        }

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    [HttpPost("{id:guid}/staff/{userId:guid}/reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetStaffPassword(Guid id, Guid userId, ResetPasswordRequest request)
    {
        var isStaffHere = await db.RestaurantStaff.IgnoreQueryFilters()
            .AnyAsync(s => s.RestaurantId == id && s.UserId == userId && !s.IsDeleted);
        if (!isStaffHere)
            return NotFound(ApiResponse<object>.Fail("Staff member not found for this restaurant.", 404));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return NotFound(ApiResponse<object>.Fail("User not found.", 404));

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.Password);
        if (!result.Succeeded)
            return BadRequest(ApiResponse<object>.Fail(string.Join("; ", result.Errors.Select(e => e.Description)), 400));

        return Ok(ApiResponse<object>.Ok(new { }));
    }

    /// <summary>
    /// Change a staff member's login email (their UserName) and name. The login is per person,
    /// so if they also work at another restaurant the new email applies there too.
    /// </summary>
    [HttpPut("{id:guid}/staff/{userId:guid}")]
    public async Task<ActionResult<ApiResponse<TenantDetailDto>>> UpdateStaff(Guid id, Guid userId, UpdateStaffRequest request)
    {
        var isStaffHere = await db.RestaurantStaff.IgnoreQueryFilters()
            .AnyAsync(s => s.RestaurantId == id && s.UserId == userId && !s.IsDeleted);
        if (!isStaffHere)
            return NotFound(ApiResponse<TenantDetailDto>.Fail("Staff member not found for this restaurant.", 404));

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return NotFound(ApiResponse<TenantDetailDto>.Fail("User not found.", 404));

        var email = request.Email.Trim();
        if (!string.Equals(user.UserName, email, StringComparison.OrdinalIgnoreCase))
        {
            if (await userManager.FindByNameAsync(email) is not null)
                return BadRequest(ApiResponse<TenantDetailDto>.Fail($"{email} is already used by another login.", 400));

            var oldEmail = user.Email;
            var renamed = await userManager.SetUserNameAsync(user, email);
            if (!renamed.Succeeded)
                return BadRequest(ApiResponse<TenantDetailDto>.Fail(string.Join("; ", renamed.Errors.Select(e => e.Description)), 400));
            await userManager.SetEmailAsync(user, email);
            user.EmailConfirmed = true;

            // Keep the organization's contact in step when it was this owner's address.
            var organization = await db.Restaurants.IgnoreQueryFilters()
                .Where(r => r.Id == id).Select(r => r.Organization).FirstAsync();
            if (organization is not null && string.Equals(organization.BillingEmail, oldEmail, StringComparison.OrdinalIgnoreCase))
                organization.BillingEmail = email;
        }

        user.FullName = request.FullName.Trim();
        await userManager.UpdateAsync(user);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<TenantDetailDto>.Ok((await BuildDetailAsync(id))!));
    }

    private Task<bool> RestaurantExistsAsync(Guid id) =>
        db.Restaurants.IgnoreQueryFilters().AnyAsync(r => r.Id == id && !r.IsDeleted);

    private async Task<TenantDetailDto?> BuildDetailAsync(Guid id)
    {
        var r = await db.Restaurants.IgnoreQueryFilters()
            .Include(x => x.Domains)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        if (r is null)
            return null;

        var staffRows = await db.RestaurantStaff.IgnoreQueryFilters()
            .Where(s => s.RestaurantId == id && !s.IsDeleted)
            .ToListAsync();
        var userIds = staffRows.Select(s => s.UserId).ToList();
        var users = await userManager.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);

        var staff = staffRows
            .Where(s => users.ContainsKey(s.UserId))
            .Select(s => new TenantOwnerDto(s.UserId, users[s.UserId].Email!, users[s.UserId].FullName, s.Role, s.IsActive))
            .OrderBy(s => s.Role)
            .ToList();

        var stats = (await OrderStatsAsync([id])).GetValueOrDefault(id);

        return new TenantDetailDto(
            r.Id, r.OrganizationId, r.Name, r.Slug, r.IsActive, r.AddressLine1, r.City, r.Postcode, r.Phone, r.Email,
            ToDomainDtos(r.Domains), staff, stats.Count, stats.LastOrderAt, r.CreatedAt,
            new TenantFeaturesDto(r.PosEnabled));
    }

    private async Task<Dictionary<Guid, (int Count, DateTimeOffset? LastOrderAt)>> OrderStatsAsync(List<Guid> restaurantIds)
    {
        var rows = await db.Orders.IgnoreQueryFilters()
            .Where(o => restaurantIds.Contains(o.RestaurantId) && !o.IsDeleted)
            .GroupBy(o => o.RestaurantId)
            .Select(g => new { RestaurantId = g.Key, Count = g.Count(), Last = g.Max(o => (DateTimeOffset?)o.CreatedAt) })
            .ToListAsync();

        return rows.ToDictionary(x => x.RestaurantId, x => (x.Count, x.Last));
    }

    private static List<TenantDomainDto> ToDomainDtos(IEnumerable<RestaurantDomain> domains) =>
        domains.Where(d => !d.IsDeleted)
            .OrderBy(d => d.Kind).ThenByDescending(d => d.IsPrimary).ThenBy(d => d.Host)
            .Select(d => new TenantDomainDto(d.Id, d.Host, d.Kind, d.IsPrimary))
            .ToList();
}
