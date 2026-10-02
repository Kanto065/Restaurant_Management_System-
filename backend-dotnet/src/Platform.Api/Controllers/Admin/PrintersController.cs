using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

/// <summary>Id null = new printer.</summary>
public record PrinterDto(Guid? Id, string Name, PrinterRole Role, PrinterConnection Connection, string? Address,
    int Port = 9100, int Columns = 42, Guid? HubDeviceId = null, bool IsActive = true);

public record SetPrintRouteRequest(PrintRoute PrintRoute);

public record SetPrintRouteOverrideRequest(PrintRoute? PrintRouteOverride);

/// <summary>Printers and where menu items print. The same list is backed up by the hub
/// (PUT /api/pos/printers); both replace the whole list.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "StaffOnly")]
public class PrintersController(AppDbContext db) : ControllerBase
{
    [HttpGet("printers")]
    public async Task<ActionResult<ApiResponse<List<PrinterDto>>>> List() =>
        Ok(ApiResponse<List<PrinterDto>>.Ok(await ListAsync(db)));

    [HttpPut("printers")]
    public async Task<ActionResult<ApiResponse<List<PrinterDto>>>> Replace(List<PrinterDto> printers)
    {
        if (await ReplaceAsync(db, printers) is { } error)
            return BadRequest(ApiResponse<List<PrinterDto>>.Fail(error, 400));
        return Ok(ApiResponse<List<PrinterDto>>.Ok(await ListAsync(db)));
    }

    /// <summary>Where each category and item prints (the existing menu DTOs stay unchanged).</summary>
    [HttpGet("print-routes")]
    public async Task<ActionResult<ApiResponse<object>>> PrintRoutes() =>
        Ok(ApiResponse<object>.Ok(new
        {
            categories = await db.MenuCategories.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
                .Select(c => new { c.Id, c.Name, c.PrintRoute }).ToListAsync(),
            items = await db.MenuItems.OrderBy(i => i.DisplayOrder).ThenBy(i => i.Name)
                .Select(i => new { i.Id, i.Name, i.CategoryId, i.PrintRouteOverride }).ToListAsync(),
        }));

    /// <summary>New route: the existing PUT menu-categories/{id} is unchanged.</summary>
    [HttpPut("menu-categories/{id:guid}/print-route")]
    public async Task<ActionResult<ApiResponse<object>>> SetCategoryRoute(Guid id, SetPrintRouteRequest request)
    {
        var category = await db.MenuCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (category is null)
            return NotFound(ApiResponse<object>.Fail("Category not found.", 404));
        category.PrintRoute = request.PrintRoute;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { category.Id, category.PrintRoute }));
    }

    /// <summary>Per-item exception; null = follow the category.</summary>
    [HttpPut("menu-items/{id:guid}/print-route")]
    public async Task<ActionResult<ApiResponse<object>>> SetItemRoute(Guid id, SetPrintRouteOverrideRequest request)
    {
        var item = await db.MenuItems.FirstOrDefaultAsync(i => i.Id == id);
        if (item is null)
            return NotFound(ApiResponse<object>.Fail("Menu item not found.", 404));
        item.PrintRouteOverride = request.PrintRouteOverride;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { item.Id, item.PrintRouteOverride }));
    }

    internal static Task<List<PrinterDto>> ListAsync(AppDbContext db) =>
        db.Printers.OrderBy(p => p.Role).ThenBy(p => p.Name)
            .Select(p => new PrinterDto(p.Id, p.Name, p.Role, p.Connection, p.Address, p.Port, p.Columns, p.HubDeviceId, p.IsActive))
            .ToListAsync();

    /// <summary>Upserts by Id and soft-deletes printers missing from the list. Returns an error message or null.</summary>
    internal static async Task<string?> ReplaceAsync(AppDbContext db, List<PrinterDto> printers)
    {
        foreach (var p in printers)
        {
            if (string.IsNullOrWhiteSpace(p.Name))
                return "Every printer needs a name.";
            if (p.Connection == PrinterConnection.Network && string.IsNullOrWhiteSpace(p.Address))
                return $"'{p.Name}' needs an IP address.";
            if (p.Port is < 1 or > 65535 || p.Columns is < 24 or > 64)
                return $"'{p.Name}' has an invalid port or column width.";
        }

        var existing = await db.Printers.ToListAsync();
        foreach (var row in existing.Where(e => printers.All(p => p.Id != e.Id)))
            row.IsDeleted = true;

        foreach (var p in printers)
        {
            var row = existing.FirstOrDefault(e => e.Id == p.Id);
            if (row is null)
                db.Printers.Add(row = new Printer());
            row.Name = p.Name.Trim();
            row.Role = p.Role;
            row.Connection = p.Connection;
            row.Address = p.Address?.Trim();
            row.Port = p.Port;
            row.Columns = p.Columns;
            row.HubDeviceId = p.HubDeviceId;
            row.IsActive = p.IsActive;
        }
        await db.SaveChangesAsync();
        return null;
    }
}
