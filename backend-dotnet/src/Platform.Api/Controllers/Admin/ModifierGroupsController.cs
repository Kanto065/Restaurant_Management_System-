using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record ModifierOptionDto(Guid Id, string Name, decimal PriceDelta, bool IsDefault, bool IsAvailable);
public record ModifierGroupDto(Guid Id, string Name, int MinSelect, int MaxSelect, bool IsRequired, List<ModifierOptionDto> Options);

public record UpsertModifierOptionRequest(Guid? Id, string Name, decimal PriceDelta, bool IsDefault, bool IsAvailable);
public record UpsertModifierGroupRequest(string Name, int MinSelect, int MaxSelect, bool IsRequired, List<UpsertModifierOptionRequest> Options);

/// <summary>
/// Manages the modifier groups (e.g. "Choose Type": Plain/Spicy) that give a menu item its
/// variants. Groups are created scoped to a single item for simplicity - nothing here stops
/// the same group id from being linked to a second item later if sharing is ever needed, but
/// the UI only ever creates one-group-per-item today.
/// </summary>
[ApiController]
[Authorize(Policy = "StaffOnly")]
public class ModifierGroupsController(AppDbContext db) : ControllerBase
{
    [HttpGet("~/api/admin/menu-items/{itemId:guid}/modifier-groups")]
    public async Task<ActionResult<ApiResponse<List<ModifierGroupDto>>>> ListForItem(Guid itemId)
    {
        var groups = await db.MenuItemModifierGroups
            .Where(l => l.MenuItemId == itemId)
            .Include(l => l.ModifierGroup!).ThenInclude(g => g.Options)
            .Select(l => l.ModifierGroup!)
            .ToListAsync();

        return Ok(ApiResponse<List<ModifierGroupDto>>.Ok(groups.Select(ToDto).ToList()));
    }

    [HttpPost("~/api/admin/menu-items/{itemId:guid}/modifier-groups")]
    public async Task<ActionResult<ApiResponse<ModifierGroupDto>>> CreateForItem(Guid itemId, UpsertModifierGroupRequest request)
    {
        var itemExists = await db.MenuItems.AnyAsync(i => i.Id == itemId);
        if (!itemExists)
            return BadRequest(ApiResponse<ModifierGroupDto>.Fail("Unknown menu item.", 400));

        var group = new ModifierGroup
        {
            Name = request.Name, MinSelect = request.MinSelect, MaxSelect = request.MaxSelect, IsRequired = request.IsRequired,
            Options = request.Options.Select(o => new ModifierOption
            {
                Name = o.Name, PriceDelta = o.PriceDelta, IsDefault = o.IsDefault, IsAvailable = o.IsAvailable,
            }).ToList(),
        };
        db.ModifierGroups.Add(group);
        db.MenuItemModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = itemId, ModifierGroup = group });
        await db.SaveChangesAsync();

        return Ok(ApiResponse<ModifierGroupDto>.Ok(ToDto(group), statusCode: 201));
    }

    [HttpPut("~/api/admin/modifier-groups/{id:guid}")]
    public async Task<ActionResult<ApiResponse<ModifierGroupDto>>> Update(Guid id, UpsertModifierGroupRequest request)
    {
        var group = await db.ModifierGroups.Include(g => g.Options).FirstOrDefaultAsync(g => g.Id == id);
        if (group is null)
            return NotFound(ApiResponse<ModifierGroupDto>.Fail("Modifier group not found.", 404));

        group.Name = request.Name;
        group.MinSelect = request.MinSelect;
        group.MaxSelect = request.MaxSelect;
        group.IsRequired = request.IsRequired;

        var keepIds = request.Options.Where(o => o.Id.HasValue).Select(o => o.Id!.Value).ToHashSet();
        foreach (var stale in group.Options.Where(o => !keepIds.Contains(o.Id)).ToList())
            db.ModifierOptions.Remove(stale);

        foreach (var o in request.Options)
        {
            if (o.Id.HasValue)
            {
                var existing = group.Options.First(x => x.Id == o.Id.Value);
                existing.Name = o.Name;
                existing.PriceDelta = o.PriceDelta;
                existing.IsDefault = o.IsDefault;
                existing.IsAvailable = o.IsAvailable;
            }
            else
            {
                group.Options.Add(new ModifierOption
                {
                    Name = o.Name, PriceDelta = o.PriceDelta, IsDefault = o.IsDefault, IsAvailable = o.IsAvailable,
                });
            }
        }

        await db.SaveChangesAsync();
        return Ok(ApiResponse<ModifierGroupDto>.Ok(ToDto(group)));
    }

    [HttpDelete("~/api/admin/modifier-groups/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var group = await db.ModifierGroups.FirstOrDefaultAsync(g => g.Id == id);
        if (group is null)
            return NotFound(ApiResponse<object>.Fail("Modifier group not found.", 404));

        db.ModifierGroups.Remove(group);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    private static ModifierGroupDto ToDto(ModifierGroup g) => new(
        g.Id, g.Name, g.MinSelect, g.MaxSelect, g.IsRequired,
        g.Options.Select(o => new ModifierOptionDto(o.Id, o.Name, o.PriceDelta, o.IsDefault, o.IsAvailable)).ToList());
}
