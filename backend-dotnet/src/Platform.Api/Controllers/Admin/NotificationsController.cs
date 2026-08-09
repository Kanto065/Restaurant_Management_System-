using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record NotificationDto(Guid Id, NotificationEventType Type, string PayloadJson, bool IsRead, DateTimeOffset CreatedAt);

[ApiController]
[Route("api/admin/notifications")]
[Authorize(Policy = "StaffOnly")]
public class NotificationsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<NotificationDto>>>> List()
    {
        var notifications = await db.NotificationEvents
            .OrderByDescending(n => n.CreatedAt)
            .Take(100)
            .Select(n => new NotificationDto(n.Id, n.Type, n.PayloadJson, n.ReadAt != null, n.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<NotificationDto>>.Ok(notifications));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResponse<int>>> UnreadCount()
    {
        var count = await db.NotificationEvents.CountAsync(n => n.ReadAt == null);
        return Ok(ApiResponse<int>.Ok(count));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkRead(Guid id)
    {
        var notification = await db.NotificationEvents.FirstOrDefaultAsync(n => n.Id == id);
        if (notification is null)
            return NotFound(ApiResponse<object>.Fail("Notification not found.", 404));

        notification.ReadAt ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Marked as read."));
    }

    [HttpPut("mark-all-read")]
    public async Task<ActionResult<ApiResponse<object>>> MarkAllRead()
    {
        var unread = await db.NotificationEvents.Where(n => n.ReadAt == null).ToListAsync();
        foreach (var n in unread) n.ReadAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "All notifications marked as read."));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var notification = await db.NotificationEvents.FirstOrDefaultAsync(n => n.Id == id);
        if (notification is null)
            return NotFound(ApiResponse<object>.Fail("Notification not found.", 404));

        db.NotificationEvents.Remove(notification);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }
}
