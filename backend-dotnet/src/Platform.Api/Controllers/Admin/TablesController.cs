using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record TableDto(Guid Id, string TableNumber, int Capacity, string? Location, string QrToken, bool IsActive);
public record UpsertTableRequest(string TableNumber, int Capacity, string? Location, bool IsActive);

[ApiController]
[Route("api/admin/tables")]
[Authorize(Policy = "StaffOnly")]
public class TablesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<TableDto>>>> List()
    {
        var tables = await db.Tables
            .OrderBy(t => t.TableNumber)
            .Select(t => new TableDto(t.Id, t.TableNumber, t.Capacity, t.Location, t.QrToken, t.IsActive))
            .ToListAsync();

        return Ok(ApiResponse<List<TableDto>>.Ok(tables));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TableDto>>> Create(UpsertTableRequest request)
    {
        var table = new Table
        {
            TableNumber = request.TableNumber, Capacity = request.Capacity,
            Location = request.Location, IsActive = request.IsActive,
        };
        db.Tables.Add(table);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<TableDto>.Ok(
            new TableDto(table.Id, table.TableNumber, table.Capacity, table.Location, table.QrToken, table.IsActive),
            statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<TableDto>>> Update(Guid id, UpsertTableRequest request)
    {
        var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == id);
        if (table is null)
            return NotFound(ApiResponse<TableDto>.Fail("Table not found.", 404));

        table.TableNumber = request.TableNumber;
        table.Capacity = request.Capacity;
        table.Location = request.Location;
        table.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<TableDto>.Ok(
            new TableDto(table.Id, table.TableNumber, table.Capacity, table.Location, table.QrToken, table.IsActive)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == id);
        if (table is null)
            return NotFound(ApiResponse<object>.Fail("Table not found.", 404));

        db.Tables.Remove(table);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }
}
