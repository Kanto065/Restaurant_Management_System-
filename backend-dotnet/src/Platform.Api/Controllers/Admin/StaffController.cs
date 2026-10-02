using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.Admin;

public record StaffDto(Guid Id, Guid UserId, string FullName, string? Email, StaffRole Role, bool IsActive, bool HasPin);

/// <summary>Email + password are needed for roles that sign into the admin panel. Waiter and
/// Cashier only use a POS PIN, so they can be created with just a name.</summary>
public record CreateStaffRequest(string FullName, StaffRole Role, string? Email, string? Password);

public record UpdateStaffMemberRequest(string FullName, StaffRole Role, bool IsActive);

public record SetPinRequest(string Pin);

/// <summary>Staff CRUD for the restaurant's Owner or Manager. A Manager can't touch Owners.</summary>
[ApiController]
[Route("api/admin/staff")]
[Authorize(Policy = "StaffOnly")]
public class StaffController(AppDbContext db, UserManager<AppUser> userManager, ICurrentTenant currentTenant) : ControllerBase
{
    private static readonly StaffRole[] PinOnlyRoles = [StaffRole.Waiter, StaffRole.Cashier];

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<StaffDto>>>> List()
    {
        if (await CallerAsync() is null)
            return Forbidden<List<StaffDto>>();

        var rows = await db.RestaurantStaff.OrderBy(s => s.Role).ToListAsync();
        var userIds = rows.Select(r => r.UserId).ToList();
        var users = await userManager.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        return Ok(ApiResponse<List<StaffDto>>.Ok(rows.Where(r => users.ContainsKey(r.UserId))
            .Select(r => ToDto(r, users[r.UserId])).ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<StaffDto>>> Create(CreateStaffRequest request)
    {
        var caller = await CallerAsync();
        if (caller is null || !CanManage(caller.Role, request.Role))
            return Forbidden<StaffDto>();
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest(ApiResponse<StaffDto>.Fail("Name is required.", 400));

        var email = request.Email?.Trim();
        AppUser? user = null;
        if (!string.IsNullOrEmpty(email))
            user = await userManager.FindByNameAsync(email);
        else if (!PinOnlyRoles.Contains(request.Role))
            return BadRequest(ApiResponse<StaffDto>.Fail("Email and password are required for this role.", 400));

        if (user is null)
        {
            // PIN-only staff get an unguessable username and no password: they can never sign in by email.
            user = new AppUser
            {
                UserName = email ?? $"pos-{Guid.NewGuid():N}",
                Email = email,
                EmailConfirmed = email is not null,
                FullName = request.FullName.Trim(),
            };
            if (email is not null && string.IsNullOrEmpty(request.Password))
                return BadRequest(ApiResponse<StaffDto>.Fail("A password is required for a new login.", 400));
            var created = email is null ? await userManager.CreateAsync(user) : await userManager.CreateAsync(user, request.Password!);
            if (!created.Succeeded)
                return BadRequest(ApiResponse<StaffDto>.Fail(string.Join("; ", created.Errors.Select(e => e.Description)), 400));
        }

        if (await db.RestaurantStaff.AnyAsync(s => s.UserId == user.Id))
            return BadRequest(ApiResponse<StaffDto>.Fail("This person is already on your staff list.", 400));

        var row = new RestaurantStaff
        {
            RestaurantId = currentTenant.RestaurantId!.Value,
            UserId = user.Id,
            Role = request.Role,
            AcceptedAt = DateTimeOffset.UtcNow,
        };
        db.RestaurantStaff.Add(row);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<StaffDto>.Ok(ToDto(row, user), statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<StaffDto>>> Update(Guid id, UpdateStaffMemberRequest request)
    {
        var caller = await CallerAsync();
        var row = await db.RestaurantStaff.FirstOrDefaultAsync(s => s.Id == id);
        if (row is null)
            return NotFound(ApiResponse<StaffDto>.Fail("Staff member not found.", 404));
        if (caller is null || !CanManage(caller.Role, row.Role) || !CanManage(caller.Role, request.Role))
            return Forbidden<StaffDto>();
        if (row.Id == caller.Id && (!request.IsActive || request.Role != row.Role))
            return BadRequest(ApiResponse<StaffDto>.Fail("You can't change your own role or deactivate yourself.", 400));

        var user = await userManager.FindByIdAsync(row.UserId.ToString());
        if (user is null)
            return NotFound(ApiResponse<StaffDto>.Fail("User not found.", 404));

        row.Role = request.Role;
        row.IsActive = request.IsActive;
        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName.Trim();
            await userManager.UpdateAsync(user);
        }
        await db.SaveChangesAsync();
        return Ok(ApiResponse<StaffDto>.Ok(ToDto(row, user)));
    }

    /// <summary>Removes the person from this restaurant (soft delete). Their login, if any, stays
    /// for other restaurants they work at.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var caller = await CallerAsync();
        var row = await db.RestaurantStaff.FirstOrDefaultAsync(s => s.Id == id);
        if (row is null)
            return NotFound(ApiResponse<object>.Fail("Staff member not found.", 404));
        if (caller is null || !CanManage(caller.Role, row.Role))
            return Forbidden<object>();
        if (row.Id == caller.Id)
            return BadRequest(ApiResponse<object>.Fail("You can't remove yourself.", 400));

        row.IsActive = false;
        row.IsDeleted = true;
        row.PinHash = null;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Staff member removed."));
    }

    /// <summary>Sets or resets a POS PIN. PINs are unique within the restaurant so a PIN alone
    /// identifies who is logging in at the till.</summary>
    [HttpPost("{id:guid}/pin")]
    public async Task<ActionResult<ApiResponse<object>>> SetPin(Guid id, SetPinRequest request)
    {
        var caller = await CallerAsync();
        var row = await db.RestaurantStaff.FirstOrDefaultAsync(s => s.Id == id);
        if (row is null)
            return NotFound(ApiResponse<object>.Fail("Staff member not found.", 404));
        if (caller is null || (row.Id != caller.Id && !CanManage(caller.Role, row.Role)))
            return Forbidden<object>();
        if (!PinHasher.IsValidPin(request.Pin))
            return BadRequest(ApiResponse<object>.Fail("A PIN is 4 to 6 digits.", 400));

        var others = await db.RestaurantStaff.Where(s => s.Id != id && s.PinHash != null).Select(s => s.PinHash).ToListAsync();
        if (others.Any(h => PinHasher.Verify(request.Pin, h)))
            return BadRequest(ApiResponse<object>.Fail("That PIN is already used by someone else here.", 400));

        row.PinHash = PinHasher.Hash(request.Pin);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "PIN set."));
    }

    /// <summary>Owner manages anyone; Manager manages everyone except Owners.</summary>
    private static bool CanManage(StaffRole caller, StaffRole target) =>
        caller == StaffRole.Owner || (caller == StaffRole.Manager && target != StaffRole.Owner);

    /// <summary>The caller's current membership, read from the DB (not the token) so a demotion
    /// applies immediately. Null unless Owner or Manager.</summary>
    private async Task<RestaurantStaff?> CallerAsync()
    {
        if (!Guid.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var userId))
            return null;
        var me = await db.RestaurantStaff.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
        return me?.Role is StaffRole.Owner or StaffRole.Manager ? me : null;
    }

    private static StaffDto ToDto(RestaurantStaff r, AppUser u) =>
        new(r.Id, r.UserId, u.FullName, u.Email, r.Role, r.IsActive, r.PinHash is not null);

    private ObjectResult Forbidden<T>() =>
        StatusCode(403, ApiResponse<T>.Fail("Only the owner or a manager can manage staff.", 403, "FORBIDDEN_ROLE"));
}
