using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record MenuItemDto(
    Guid Id, Guid CategoryId, string Name, string? Description, decimal BasePrice, string? ImageUrl,
    bool IsVegetarian, bool IsVegan, bool IsBestSeller, SpiceLevel SpiceLevel, bool IsAvailable, int DisplayOrder,
    int PreparationTimeMinutes, bool ShowVariantsAsRows, bool ContainsAllergens, string? AllergenInfo);

public record UpsertMenuItemRequest(
    Guid CategoryId, string Name, string? Description, decimal BasePrice, string? ImageUrl,
    bool IsVegetarian, bool IsVegan, bool IsBestSeller, SpiceLevel SpiceLevel, bool IsAvailable, int DisplayOrder,
    int PreparationTimeMinutes, bool ShowVariantsAsRows = false, bool ContainsAllergens = false, string? AllergenInfo = null);

[ApiController]
[Route("api/admin/menu-items")]
[Authorize(Policy = "StaffOnly")]
public class MenuItemsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<MenuItemDto>>>> List([FromQuery] Guid? categoryId)
    {
        var query = db.MenuItems.AsQueryable();
        if (categoryId.HasValue)
            query = query.Where(i => i.CategoryId == categoryId.Value);

        var items = await query
            .OrderBy(i => i.DisplayOrder)
            .Select(i => new MenuItemDto(i.Id, i.CategoryId, i.Name, i.Description, i.BasePrice, i.ImageUrl,
                i.IsVegetarian, i.IsVegan, i.IsBestSeller, i.SpiceLevel, i.IsAvailable, i.DisplayOrder, i.PreparationTimeMinutes,
                i.ShowVariantsAsRows, i.ContainsAllergens, i.AllergenInfo))
            .ToListAsync();

        return Ok(ApiResponse<List<MenuItemDto>>.Ok(items));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<MenuItemDto>>> Create(UpsertMenuItemRequest request)
    {
        var categoryExists = await db.MenuCategories.AnyAsync(c => c.Id == request.CategoryId);
        if (!categoryExists)
            return BadRequest(ApiResponse<MenuItemDto>.Fail("Unknown category.", 400));

        var item = new MenuItem
        {
            CategoryId = request.CategoryId, Name = request.Name, Description = request.Description,
            BasePrice = request.BasePrice, ImageUrl = request.ImageUrl, IsVegetarian = request.IsVegetarian,
            IsVegan = request.IsVegan, IsBestSeller = request.IsBestSeller, SpiceLevel = request.SpiceLevel, IsAvailable = request.IsAvailable,
            DisplayOrder = request.DisplayOrder, PreparationTimeMinutes = request.PreparationTimeMinutes,
            ShowVariantsAsRows = request.ShowVariantsAsRows,
            ContainsAllergens = request.ContainsAllergens, AllergenInfo = request.AllergenInfo,
        };
        db.MenuItems.Add(item);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<MenuItemDto>.Ok(ToDto(item), statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MenuItemDto>>> Update(Guid id, UpsertMenuItemRequest request)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null)
            return NotFound(ApiResponse<MenuItemDto>.Fail("Menu item not found.", 404));

        item.CategoryId = request.CategoryId;
        item.Name = request.Name;
        item.Description = request.Description;
        item.BasePrice = request.BasePrice;
        item.ImageUrl = request.ImageUrl;
        item.IsVegetarian = request.IsVegetarian;
        item.IsVegan = request.IsVegan;
        item.IsBestSeller = request.IsBestSeller;
        item.SpiceLevel = request.SpiceLevel;
        item.IsAvailable = request.IsAvailable;
        item.DisplayOrder = request.DisplayOrder;
        item.PreparationTimeMinutes = request.PreparationTimeMinutes;
        item.ShowVariantsAsRows = request.ShowVariantsAsRows;
        item.ContainsAllergens = request.ContainsAllergens;
        item.AllergenInfo = request.AllergenInfo;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<MenuItemDto>.Ok(ToDto(item)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null)
            return NotFound(ApiResponse<object>.Fail("Menu item not found.", 404));

        db.MenuItems.Remove(item);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    private static MenuItemDto ToDto(MenuItem i) => new(
        i.Id, i.CategoryId, i.Name, i.Description, i.BasePrice, i.ImageUrl, i.IsVegetarian, i.IsVegan, i.IsBestSeller,
        i.SpiceLevel, i.IsAvailable, i.DisplayOrder, i.PreparationTimeMinutes, i.ShowVariantsAsRows,
        i.ContainsAllergens, i.AllergenInfo);
}
