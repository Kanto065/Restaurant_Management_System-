using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.Admin;

public record RefundDto(Guid Id, decimal Amount, RefundMethod Method, string? Reason, string? ItemsJson,
    Guid? RefundedByUserId, Guid? ApprovedByUserId, DateTimeOffset CreatedAt);

public record CreateRefundRequest(decimal Amount, RefundMethod Method, string? Reason, string? ItemsJson);

/// <summary>Refunds and sales reports for the restaurant's managers (Owner, Manager, or the
/// existing Staff role, which acts as a manager on admin routes).</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = "StaffOnly")]
public class PosAdminController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet("orders/{orderId:guid}/refunds")]
    [RequireFeature(FeatureKeys.PosRefunds)]
    public async Task<ActionResult<ApiResponse<List<RefundDto>>>> Refunds(Guid orderId)
    {
        if (!IsManager())
            return Forbidden<List<RefundDto>>();
        if (!await db.Orders.AnyAsync(o => o.Id == orderId))
            return NotFound(ApiResponse<List<RefundDto>>.Fail("Order not found.", 404));
        return Ok(ApiResponse<List<RefundDto>>.Ok(await db.Refunds.Where(r => r.OrderId == orderId)
            .OrderBy(r => r.CreatedAt).Select(r => ToDto(r)).ToListAsync()));
    }

    /// <summary>POS orders only: a web card payment is refunded through Stripe, not recorded here.</summary>
    [HttpPost("orders/{orderId:guid}/refunds")]
    [RequireFeature(FeatureKeys.PosRefunds)]
    public async Task<ActionResult<ApiResponse<RefundDto>>> CreateRefund(Guid orderId, CreateRefundRequest request)
    {
        if (!IsManager())
            return Forbidden<RefundDto>();
        var order = await db.Orders.Where(o => o.Id == orderId)
            .Select(o => new { o.Source, Paid = o.Payments.Sum(p => p.Amount), Refunded = o.Refunds.Sum(r => r.Amount) })
            .FirstOrDefaultAsync();
        if (order is null)
            return NotFound(ApiResponse<RefundDto>.Fail("Order not found.", 404));
        if (order.Source != OrderSource.Pos)
            return BadRequest(ApiResponse<RefundDto>.Fail("Only POS orders can be refunded here.", 400));
        if (RefundRules.Check(order.Paid, order.Refunded, request.Amount) is { } error)
            return BadRequest(ApiResponse<RefundDto>.Fail(error, 400));

        var userId = Guid.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var uid) ? uid : (Guid?)null;
        var refund = new Refund
        {
            OrderId = orderId, Amount = request.Amount, Method = request.Method, Reason = request.Reason,
            ItemsJson = request.ItemsJson, RefundedByUserId = userId, ApprovedByUserId = userId,
        };
        db.Refunds.Add(refund);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<RefundDto>.Ok(ToDto(refund), statusCode: 201));
    }

    /// <summary>One local day (restaurant time zone); defaults to today.</summary>
    [HttpGet("reports/daily")]
    [RequireFeature(FeatureKeys.PosReports)]
    public async Task<ActionResult<ApiResponse<SalesReportDto>>> Daily(DateOnly? date)
    {
        if (!IsManager())
            return Forbidden<SalesReportDto>();
        var day = date ?? await TodayAsync();
        return Ok(ApiResponse<SalesReportDto>.Ok(
            await SalesReport.LoadAsync(db, currentTenant.RestaurantId!.Value, day, day, HttpContext.RequestAborted)));
    }

    /// <summary>Inclusive local days, at most 366.</summary>
    [HttpGet("reports/range")]
    [RequireFeature(FeatureKeys.PosReports)]
    public async Task<ActionResult<ApiResponse<SalesReportDto>>> Range(DateOnly from, DateOnly to)
    {
        if (!IsManager())
            return Forbidden<SalesReportDto>();
        if (to < from || to.DayNumber - from.DayNumber > 366)
            return BadRequest(ApiResponse<SalesReportDto>.Fail("Pick a range of up to a year, 'from' before 'to'.", 400));
        return Ok(ApiResponse<SalesReportDto>.Ok(
            await SalesReport.LoadAsync(db, currentTenant.RestaurantId!.Value, from, to, HttpContext.RequestAborted)));
    }

    private async Task<DateOnly> TodayAsync()
    {
        var tz = await db.Restaurants.Where(r => r.Id == currentTenant.RestaurantId).Select(r => r.TimeZone).FirstAsync();
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById(tz)).DateTime);
    }

    private bool IsManager() => StaffRoles.ActiveRole(User) is StaffRole.Owner or StaffRole.Manager or StaffRole.Staff;

    private static RefundDto ToDto(Refund r) =>
        new(r.Id, r.Amount, r.Method, r.Reason, r.ItemsJson, r.RefundedByUserId, r.ApprovedByUserId, r.CreatedAt);

    private ObjectResult Forbidden<T>() =>
        StatusCode(403, ApiResponse<T>.Fail("Only the owner or a manager can do this.", 403, "FORBIDDEN_ROLE"));
}
