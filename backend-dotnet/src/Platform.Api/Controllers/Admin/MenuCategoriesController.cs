using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record MenuCategoryDto(Guid Id, string Name, string? ImageUrl, int DisplayOrder, bool IsActive);
public record UpsertMenuCategoryRequest(string Name, string? ImageUrl, int DisplayOrder, bool IsActive);

[ApiController]
[Route("api/admin/menu-categories")]
[Authorize(Policy = "StaffOnly")]
public class MenuCategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<MenuCategoryDto>>>> List()
    {
        var categories = await db.MenuCategories
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new MenuCategoryDto(c.Id, c.Name, c.ImageUrl, c.DisplayOrder, c.IsActive))
            .ToListAsync();

        return Ok(ApiResponse<List<MenuCategoryDto>>.Ok(categories));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<MenuCategoryDto>>> Create(UpsertMenuCategoryRequest request)
    {
        var category = new MenuCategory
        {
            Name = request.Name, ImageUrl = request.ImageUrl,
            DisplayOrder = request.DisplayOrder, IsActive = request.IsActive,
        };
        db.MenuCategories.Add(category);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<MenuCategoryDto>.Ok(
            new MenuCategoryDto(category.Id, category.Name, category.ImageUrl, category.DisplayOrder, category.IsActive), statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MenuCategoryDto>>> Update(Guid id, UpsertMenuCategoryRequest request)
    {
        var category = await db.MenuCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null)
            return NotFound(ApiResponse<MenuCategoryDto>.Fail("Menu category not found.", 404));

        category.Name = request.Name;
        category.ImageUrl = request.ImageUrl;
        category.DisplayOrder = request.DisplayOrder;
        category.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<MenuCategoryDto>.Ok(
            new MenuCategoryDto(category.Id, category.Name, category.ImageUrl, category.DisplayOrder, category.IsActive)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var category = await db.MenuCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null)
            return NotFound(ApiResponse<object>.Fail("Menu category not found.", 404));

        db.MenuCategories.Remove(category);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }
}
