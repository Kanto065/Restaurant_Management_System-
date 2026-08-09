using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record OpeningHourDto(Guid Id, DayOfWeek DayOfWeek, string? OpenTime, string? CloseTime, bool IsClosed);
public record UpsertOpeningHourRequest(DayOfWeek DayOfWeek, string? OpenTime, string? CloseTime, bool IsClosed);

public record OpeningHourExceptionDto(Guid Id, DateOnly Date, string? OpenTime, string? CloseTime, bool IsClosed, string? Note);
public record UpsertOpeningHourExceptionRequest(DateOnly Date, string? OpenTime, string? CloseTime, bool IsClosed, string? Note);

[ApiController]
[Route("api/admin/opening-hours")]
[Authorize(Policy = "StaffOnly")]
public class OpeningHoursController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OpeningHourDto>>>> List()
    {
        var hours = await db.OpeningHours
            .OrderBy(h => h.DayOfWeek)
            .Select(h => new OpeningHourDto(h.Id, h.DayOfWeek, h.OpenTime.HasValue ? h.OpenTime.Value.ToString("HH:mm") : null,
                h.CloseTime.HasValue ? h.CloseTime.Value.ToString("HH:mm") : null, h.IsClosed))
            .ToListAsync();

        return Ok(ApiResponse<List<OpeningHourDto>>.Ok(hours));
    }

    /// <summary>Replaces the full weekly schedule (upserts by DayOfWeek) in one call.</summary>
    [HttpPut]
    public async Task<ActionResult<ApiResponse<List<OpeningHourDto>>>> ReplaceWeek(List<UpsertOpeningHourRequest> request)
    {
        var existing = await db.OpeningHours.ToListAsync();

        foreach (var day in request)
        {
            var row = existing.FirstOrDefault(h => h.DayOfWeek == day.DayOfWeek);
            if (row is null)
            {
                row = new OpeningHour { DayOfWeek = day.DayOfWeek };
                db.OpeningHours.Add(row);
            }

            row.OpenTime = string.IsNullOrEmpty(day.OpenTime) ? null : TimeOnly.Parse(day.OpenTime);
            row.CloseTime = string.IsNullOrEmpty(day.CloseTime) ? null : TimeOnly.Parse(day.CloseTime);
            row.IsClosed = day.IsClosed;
        }

        await db.SaveChangesAsync();
        return await List();
    }

    [HttpGet("exceptions")]
    public async Task<ActionResult<ApiResponse<List<OpeningHourExceptionDto>>>> ListExceptions()
    {
        var exceptions = await db.OpeningHourExceptions
            .OrderBy(e => e.Date)
            .Select(e => new OpeningHourExceptionDto(e.Id, e.Date, e.OpenTime.HasValue ? e.OpenTime.Value.ToString("HH:mm") : null,
                e.CloseTime.HasValue ? e.CloseTime.Value.ToString("HH:mm") : null, e.IsClosed, e.Note))
            .ToListAsync();

        return Ok(ApiResponse<List<OpeningHourExceptionDto>>.Ok(exceptions));
    }

    [HttpPost("exceptions")]
    public async Task<ActionResult<ApiResponse<OpeningHourExceptionDto>>> CreateException(UpsertOpeningHourExceptionRequest request)
    {
        var entity = new OpeningHourException
        {
            Date = request.Date,
            OpenTime = string.IsNullOrEmpty(request.OpenTime) ? null : TimeOnly.Parse(request.OpenTime),
            CloseTime = string.IsNullOrEmpty(request.CloseTime) ? null : TimeOnly.Parse(request.CloseTime),
            IsClosed = request.IsClosed,
            Note = request.Note,
        };
        db.OpeningHourExceptions.Add(entity);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OpeningHourExceptionDto>.Ok(
            new OpeningHourExceptionDto(entity.Id, entity.Date, request.OpenTime, request.CloseTime, entity.IsClosed, entity.Note),
            statusCode: 201));
    }

    [HttpDelete("exceptions/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteException(Guid id)
    {
        var entity = await db.OpeningHourExceptions.FirstOrDefaultAsync(e => e.Id == id);
        if (entity is null)
            return NotFound(ApiResponse<object>.Fail("Not found.", 404));

        db.OpeningHourExceptions.Remove(entity);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }
}
