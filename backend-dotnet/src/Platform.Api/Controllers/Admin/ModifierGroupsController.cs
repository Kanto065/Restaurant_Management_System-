using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record ModifierOptionDto(Guid Id, string Name, decimal PriceDelta, bool IsDefault, bool IsAvailable);
public record ModifierGroupDto(Guid Id, string Name, int MinSelect, int MaxSelect, bool IsRequired, ModifierGroupType GroupType, List<ModifierOptionDto> Options);

public record UpsertModifierOptionRequest(Guid? Id, string Name, decimal PriceDelta, bool IsDefault, bool IsAvailable);
public record UpsertModifierGroupRequest(string Name, int MinSelect, int MaxSelect, bool IsRequired, ModifierGroupType GroupType, List<UpsertModifierOptionRequest> Options);

public record ReorderModifierGroupsRequest(List<Guid> OrderedIds);
public record ReorderModifierOptionsRequest(List<Guid> OrderedIds);

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
        var links = await db.MenuItemModifierGroups
            .Where(l => l.MenuItemId == itemId)
            .OrderBy(l => l.DisplayOrder)
            .Include(l => l.ModifierGroup!).ThenInclude(g => g.Options)
            .ToListAsync();

        var groups = links.Select(l => l.ModifierGroup!).ToList();
        return Ok(ApiResponse<List<ModifierGroupDto>>.Ok(groups.Select(ToDto).ToList()));
    }

    /// <summary>Reassigns each group's DisplayOrder (on the item's link row) to match the given id order.</summary>
    [HttpPut("~/api/admin/menu-items/{itemId:guid}/modifier-groups/reorder")]
    public async Task<ActionResult<ApiResponse<List<ModifierGroupDto>>>> ReorderForItem(Guid itemId, ReorderModifierGroupsRequest request)
    {
        var links = await db.MenuItemModifierGroups.Where(l => l.MenuItemId == itemId).ToListAsync();
        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            var link = links.FirstOrDefault(l => l.ModifierGroupId == request.OrderedIds[i]);
            if (link is not null)
                link.DisplayOrder = i;
        }
        await db.SaveChangesAsync();
        return await ListForItem(itemId);
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
            GroupType = request.GroupType,
            Options = request.Options.Select((o, i) => new ModifierOption
            {
                Name = o.Name, PriceDelta = o.PriceDelta, IsDefault = o.IsDefault, IsAvailable = o.IsAvailable, DisplayOrder = i,
            }).ToList(),
        };
        db.ModifierGroups.Add(group);

        var nextOrder = await db.MenuItemModifierGroups.Where(l => l.MenuItemId == itemId).CountAsync();
        db.MenuItemModifierGroups.Add(new MenuItemModifierGroup { MenuItemId = itemId, ModifierGroup = group, DisplayOrder = nextOrder });
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
        group.GroupType = request.GroupType;

        var keepIds = request.Options.Where(o => o.Id.HasValue).Select(o => o.Id!.Value).ToHashSet();
        foreach (var stale in group.Options.Where(o => !keepIds.Contains(o.Id)).ToList())
            db.ModifierOptions.Remove(stale);

        for (var i = 0; i < request.Options.Count; i++)
        {
            var o = request.Options[i];
            if (o.Id.HasValue)
            {
                var existing = group.Options.First(x => x.Id == o.Id.Value);
                existing.Name = o.Name;
                existing.PriceDelta = o.PriceDelta;
                existing.IsDefault = o.IsDefault;
                existing.IsAvailable = o.IsAvailable;
                existing.DisplayOrder = i;
            }
            else
            {
                group.Options.Add(new ModifierOption
                {
                    Name = o.Name, PriceDelta = o.PriceDelta, IsDefault = o.IsDefault, IsAvailable = o.IsAvailable, DisplayOrder = i,
                });
            }
        }

        await db.SaveChangesAsync();
        return Ok(ApiResponse<ModifierGroupDto>.Ok(ToDto(group)));
    }

    /// <summary>Reassigns each option's DisplayOrder to match the given id order.</summary>
    [HttpPut("~/api/admin/modifier-groups/{id:guid}/options/reorder")]
    public async Task<ActionResult<ApiResponse<ModifierGroupDto>>> ReorderOptions(Guid id, ReorderModifierOptionsRequest request)
    {
        var group = await db.ModifierGroups.Include(g => g.Options).FirstOrDefaultAsync(g => g.Id == id);
        if (group is null)
            return NotFound(ApiResponse<ModifierGroupDto>.Fail("Modifier group not found.", 404));

        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            var option = group.Options.FirstOrDefault(o => o.Id == request.OrderedIds[i]);
            if (option is not null)
                option.DisplayOrder = i;
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
        g.Id, g.Name, g.MinSelect, g.MaxSelect, g.IsRequired, g.GroupType,
        g.Options.OrderBy(o => o.DisplayOrder).Select(o => new ModifierOptionDto(o.Id, o.Name, o.PriceDelta, o.IsDefault, o.IsAvailable)).ToList());
}
