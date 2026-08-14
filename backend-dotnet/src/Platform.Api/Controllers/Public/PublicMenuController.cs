using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

public record ModifierOptionPublicDto(Guid Id, string Name, decimal PriceDelta, bool IsDefault);
public record ModifierGroupPublicDto(Guid Id, string Name, int MinSelect, int MaxSelect, bool IsRequired, List<ModifierOptionPublicDto> Options);

public record MenuItemPublicDto(
    Guid Id, string Name, string? Description, decimal BasePrice, string? ImageUrl,
    bool IsVegetarian, bool IsVegan, bool IsBestSeller, SpiceLevel SpiceLevel, int PreparationTimeMinutes,
    bool ShowVariantsAsRows, List<ModifierGroupPublicDto> ModifierGroups);

public record MenuCategoryPublicDto(Guid Id, string Name, string? Description, int DisplayOrder, List<MenuItemPublicDto> Items);

public record DealComponentPublicDto(Guid? MenuItemId, Guid? CategoryId, int Quantity);
public record DealPublicDto(Guid Id, string Name, string? Description, string? ImageUrl, decimal Price, List<DealComponentPublicDto> Components);

public record MenuPublicDto(List<MenuCategoryPublicDto> Categories, List<DealPublicDto> Deals);

/// <summary>Anonymous, host-resolved menu browse endpoint — relies entirely on the tenant query filter for isolation.</summary>
[ApiController]
[Route("api/public/menu")]
public class PublicMenuController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<MenuPublicDto>>> GetMenu()
    {
        var categories = await db.MenuCategories
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Include(c => c.Items.Where(i => i.IsAvailable))
                .ThenInclude(i => i.ModifierGroupLinks)
                    .ThenInclude(l => l.ModifierGroup!)
                        .ThenInclude(g => g.Options)
            .ToListAsync();

        var deals = await db.Deals
            .Where(d => d.IsActive)
            .Include(d => d.Components)
            .ToListAsync();

        var dto = new MenuPublicDto(
            categories.Select(c => new MenuCategoryPublicDto(
                c.Id, c.Name, c.Description, c.DisplayOrder,
                c.Items.OrderBy(i => i.DisplayOrder).Select(i => new MenuItemPublicDto(
                    i.Id, i.Name, i.Description, i.BasePrice, i.ImageUrl, i.IsVegetarian, i.IsVegan, i.IsBestSeller,
                    i.SpiceLevel, i.PreparationTimeMinutes, i.ShowVariantsAsRows,
                    i.ModifierGroupLinks.Select(l => l.ModifierGroup!).Distinct().Select(g => new ModifierGroupPublicDto(
                        g.Id, g.Name, g.MinSelect, g.MaxSelect, g.IsRequired,
                        g.Options.Where(o => o.IsAvailable).Select(o => new ModifierOptionPublicDto(o.Id, o.Name, o.PriceDelta, o.IsDefault)).ToList()
                    )).ToList()
                )).ToList()
            )).ToList(),
            deals.Select(d => new DealPublicDto(
                d.Id, d.Name, d.Description, d.ImageUrl, d.Price,
                d.Components.Select(c => new DealComponentPublicDto(c.MenuItemId, c.CategoryId, c.Quantity)).ToList()
            )).ToList());

        return Ok(ApiResponse<MenuPublicDto>.Ok(dto));
    }
}
