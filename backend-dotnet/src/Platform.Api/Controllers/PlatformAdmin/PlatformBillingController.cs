using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.PlatformAdmin;

public record PlanDto(Guid Id, string Name, decimal PriceMonthly, int MaxRestaurants, int MaxStaffUsers,
    int? MaxDevices, Dictionary<string, bool> Features, bool IsActive);

public record SavePlanRequest(string Name, decimal PriceMonthly, int MaxRestaurants, int MaxStaffUsers,
    int? MaxDevices, Dictionary<string, bool>? Features, bool IsActive = true);

public record SubscriptionPaymentDto(Guid Id, decimal Amount, DateTimeOffset PaidAt, DateTimeOffset PeriodFrom,
    DateTimeOffset PeriodTo, string? Method, string? Note);

public record SubscriptionDto(Guid Id, Guid PlanId, string PlanName, SubscriptionStatus Status,
    DateTimeOffset? CurrentPeriodEnd, DateTimeOffset? TrialEndsAt, int GraceDays, string Access,
    List<SubscriptionPaymentDto> Payments);

public record SetSubscriptionRequest(Guid PlanId, SubscriptionStatus Status, DateTimeOffset? CurrentPeriodEnd,
    DateTimeOffset? TrialEndsAt, int GraceDays = 7);

public record RecordPaymentRequest(decimal Amount, DateTimeOffset PeriodTo, DateTimeOffset? PaidAt, string? Method, string? Note);

/// <summary>Plans and manual subscriptions. An organisation with no subscription is treated as
/// active; it only gets one when the platform owner sets it here.</summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform")]
[Authorize(Policy = "PlatformSuperAdmin")]
public class PlatformBillingController(AppDbContext db) : ControllerBase
{
    [HttpGet("plans")]
    public async Task<ActionResult<ApiResponse<List<PlanDto>>>> Plans() =>
        Ok(ApiResponse<List<PlanDto>>.Ok((await db.Plans.OrderBy(p => p.PriceMonthly).ToListAsync()).Select(ToDto).ToList()));

    [HttpPost("plans")]
    public async Task<ActionResult<ApiResponse<PlanDto>>> CreatePlan(SavePlanRequest request)
    {
        var plan = new Plan();
        if (Apply(plan, request) is { } error)
            return BadRequest(ApiResponse<PlanDto>.Fail(error, 400));
        db.Plans.Add(plan);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<PlanDto>.Ok(ToDto(plan), statusCode: 201));
    }

    [HttpPut("plans/{id:guid}")]
    public async Task<ActionResult<ApiResponse<PlanDto>>> UpdatePlan(Guid id, SavePlanRequest request)
    {
        var plan = await db.Plans.FirstOrDefaultAsync(p => p.Id == id);
        if (plan is null)
            return NotFound(ApiResponse<PlanDto>.Fail("Plan not found.", 404));
        if (Apply(plan, request) is { } error)
            return BadRequest(ApiResponse<PlanDto>.Fail(error, 400));
        await db.SaveChangesAsync();
        return Ok(ApiResponse<PlanDto>.Ok(ToDto(plan)));
    }

    [HttpGet("organizations/{orgId:guid}/subscription")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto?>>> GetSubscription(Guid orgId)
    {
        if (!await db.Organizations.AnyAsync(o => o.Id == orgId))
            return NotFound(ApiResponse<SubscriptionDto?>.Fail("Organisation not found.", 404));
        return Ok(ApiResponse<SubscriptionDto?>.Ok(await LoadDtoAsync(orgId)));
    }

    [HttpPut("organizations/{orgId:guid}/subscription")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto?>>> SetSubscription(Guid orgId, SetSubscriptionRequest request)
    {
        if (!await db.Organizations.AnyAsync(o => o.Id == orgId))
            return NotFound(ApiResponse<SubscriptionDto?>.Fail("Organisation not found.", 404));
        if (!await db.Plans.AnyAsync(p => p.Id == request.PlanId))
            return BadRequest(ApiResponse<SubscriptionDto?>.Fail("Plan not found.", 400));
        if (request.GraceDays is < 0 or > 365)
            return BadRequest(ApiResponse<SubscriptionDto?>.Fail("Grace days must be 0-365.", 400));

        var sub = await SubscriptionRules.CurrentAsync(db, orgId);
        if (sub is null)
            db.Subscriptions.Add(sub = new Subscription { OrganizationId = orgId });
        sub.PlanId = request.PlanId;
        sub.Status = request.Status;
        sub.CurrentPeriodEnd = request.CurrentPeriodEnd;
        sub.TrialEndsAt = request.TrialEndsAt;
        sub.GraceDays = request.GraceDays;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<SubscriptionDto?>.Ok(await LoadDtoAsync(orgId)));
    }

    /// <summary>Records a manual renewal: extends CurrentPeriodEnd to PeriodTo and reactivates.</summary>
    [HttpPost("organizations/{orgId:guid}/subscription/payments")]
    public async Task<ActionResult<ApiResponse<SubscriptionDto?>>> RecordPayment(Guid orgId, RecordPaymentRequest request)
    {
        var sub = await SubscriptionRules.CurrentAsync(db, orgId);
        if (sub is null)
            return BadRequest(ApiResponse<SubscriptionDto?>.Fail("Set a plan for this organisation first.", 400));
        if (request.Amount < 0)
            return BadRequest(ApiResponse<SubscriptionDto?>.Fail("Amount can't be negative.", 400));

        var from = sub.CurrentPeriodEnd ?? DateTimeOffset.UtcNow;
        if (request.PeriodTo <= from)
            return BadRequest(ApiResponse<SubscriptionDto?>.Fail("The new period must end after the current one.", 400));

        db.SubscriptionPayments.Add(new SubscriptionPayment
        {
            SubscriptionId = sub.Id,
            Amount = request.Amount,
            PaidAt = request.PaidAt ?? DateTimeOffset.UtcNow,
            PeriodFrom = from,
            PeriodTo = request.PeriodTo,
            Method = request.Method,
            Note = request.Note,
            RecordedByUserId = Guid.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var uid) ? uid : null,
        });
        sub.CurrentPeriodEnd = request.PeriodTo;
        sub.Status = SubscriptionStatus.Active;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<SubscriptionDto?>.Ok(await LoadDtoAsync(orgId)));
    }

    private async Task<SubscriptionDto?> LoadDtoAsync(Guid orgId)
    {
        var sub = await db.Subscriptions.Include(s => s.Plan).Include(s => s.Payments)
            .Where(s => s.OrganizationId == orgId).OrderByDescending(s => s.CreatedAt).FirstOrDefaultAsync();
        if (sub is null)
            return null;
        return new SubscriptionDto(sub.Id, sub.PlanId, sub.Plan?.Name ?? "", sub.Status, sub.CurrentPeriodEnd,
            sub.TrialEndsAt, sub.GraceDays, SubscriptionRules.Evaluate(sub, DateTimeOffset.UtcNow).ToString(),
            sub.Payments.Where(p => !p.IsDeleted).OrderByDescending(p => p.PaidAt)
                .Select(p => new SubscriptionPaymentDto(p.Id, p.Amount, p.PaidAt, p.PeriodFrom, p.PeriodTo, p.Method, p.Note))
                .ToList());
    }

    private static string? Apply(Plan plan, SavePlanRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name))
            return "Name is required.";
        if (r.PriceMonthly < 0 || r.MaxRestaurants < 0 || r.MaxStaffUsers < 0 || r.MaxDevices < 0)
            return "Prices and limits can't be negative.";
        var unknown = (r.Features ?? []).Keys.Except(FeatureKeys.All).ToList();
        if (unknown.Count > 0)
            return $"Unknown feature key(s): {string.Join(", ", unknown)}";

        plan.Name = r.Name.Trim();
        plan.PriceMonthly = r.PriceMonthly;
        plan.MaxRestaurants = r.MaxRestaurants;
        plan.MaxStaffUsers = r.MaxStaffUsers;
        plan.MaxDevices = r.MaxDevices;
        plan.FeatureFlagsJson = JsonSerializer.Serialize(r.Features ?? []);
        plan.IsActive = r.IsActive;
        return null;
    }

    private static PlanDto ToDto(Plan p) => new(p.Id, p.Name, p.PriceMonthly, p.MaxRestaurants, p.MaxStaffUsers,
        p.MaxDevices, JsonSerializer.Deserialize<Dictionary<string, bool>>(p.FeatureFlagsJson) ?? [], p.IsActive);
}
