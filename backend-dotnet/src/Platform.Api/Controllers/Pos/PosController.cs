using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Controllers.Admin;
using Platform.Api.Filters;
using Platform.Application.Common;
using Platform.Domain.Common;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.Pos;

public record RegisterTabletRequest(string DeviceName, string? AppVersion);

public record TabletDto(Guid Id, string DeviceName);

/// <summary>
/// The shop hub's cloud API: device token of a MainPos device, feature "pos" (also enforced by
/// DeviceValidationMiddleware, which signs devices out when POS is switched off).
/// </summary>
[ApiController]
[Route("api/pos")]
[Authorize(Policy = "PosDeviceOnly")]
[RequireMainPosDevice]
public class PosController(
    AppDbContext db,
    ICurrentTenant currentTenant,
    FeatureService features,
    LicenceSigner licenceSigner,
    PosOrderSync orderSync,
    UserManager<AppUser> userManager) : ControllerBase
{
    private Guid RestaurantId => currentTenant.RestaurantId!.Value;
    private Guid DeviceId => Guid.Parse(User.FindFirst("device_id")!.Value);

    /// <summary>Everything the hub mirrors locally. Pull on pairing (and to recover).</summary>
    [HttpGet("config-snapshot")]
    public async Task<ActionResult<ApiResponse<object>>> ConfigSnapshot() =>
        Ok(ApiResponse<object>.Ok(await BuildAsync(since: null)));

    /// <summary>Rows updated after `since` (use the previous response's serverTime), plus the ids
    /// of every live row: the hub drops any local row whose id is missing, which covers deletes
    /// (some existing admin screens hard-delete). Staff, printers, statuses, features and the
    /// licence are small and always sent in full.</summary>
    [HttpGet("changes")]
    public async Task<ActionResult<ApiResponse<object>>> Changes([FromQuery] DateTimeOffset since) =>
        Ok(ApiResponse<object>.Ok(await BuildAsync(since)));

    [HttpPost("orders/sync")]
    public async Task<ActionResult<ApiResponse<List<SyncResult>>>> SyncOrders(PosSyncRequest request)
    {
        if ((request.Orders?.Count ?? 0) + (request.Refunds?.Count ?? 0) > 200)
            return BadRequest(ApiResponse<List<SyncResult>>.Fail("Send at most 200 records per batch.", 400));
        var map = await features.GetMapAsync(RestaurantId, HttpContext.RequestAborted);
        return Ok(ApiResponse<List<SyncResult>>.Ok(
            await orderSync.SyncAsync(RestaurantId, request, map, HttpContext.RequestAborted)));
    }

    /// <summary>Registers a tablet the hub paired over the LAN, so it shows in device management
    /// and counts against the plan's device limit. The tablet never talks to the cloud itself, so
    /// its secret is random and never returned.</summary>
    [HttpPost("devices/tablets")]
    [RequireFeature(FeatureKeys.PosWaiter)]
    public async Task<ActionResult<ApiResponse<TabletDto>>> RegisterTablet(RegisterTabletRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceName))
            return BadRequest(ApiResponse<TabletDto>.Fail("Device name is required.", 400));
        if (!await DeviceLimits.CanAddPosDeviceAsync(db, RestaurantId, HttpContext.RequestAborted))
            return BadRequest(ApiResponse<TabletDto>.Fail(
                "The plan's device limit is reached.", 400, "DEVICE_LIMIT"));

        var tablet = new Device
        {
            RestaurantId = RestaurantId,
            DeviceName = request.DeviceName.Trim(),
            DeviceType = DeviceType.WaiterTablet,
            HubDeviceId = DeviceId,
            AppVersion = request.AppVersion,
            DeviceSecretHash = new PasswordHasher<object>().HashPassword(new object(),
                Convert.ToHexString(RandomNumberGenerator.GetBytes(24))),
        };
        db.Devices.Add(tablet);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<TabletDto>.Ok(new TabletDto(tablet.Id, tablet.DeviceName), statusCode: 201));
    }

    [HttpDelete("devices/tablets/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> UnpairTablet(Guid id)
    {
        var tablet = await db.Devices.FirstOrDefaultAsync(d => d.Id == id && d.DeviceType == DeviceType.WaiterTablet);
        if (tablet is null)
            return NotFound(ApiResponse<object>.Fail("Tablet not found.", 404));
        tablet.IsActive = false;
        tablet.IsDeleted = true;
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Tablet unpaired."));
    }

    [HttpGet("licence")]
    public async Task<ActionResult<ApiResponse<SignedLicence>>> Licence() =>
        Ok(ApiResponse<SignedLicence>.Ok(await licenceSigner.IssueAsync(db, features, RestaurantId, HttpContext.RequestAborted)));

    /// <summary>Backs up the hub's printer list (whole-list replace, same as the admin screen).</summary>
    [HttpPut("printers")]
    public async Task<ActionResult<ApiResponse<List<PrinterDto>>>> BackupPrinters(List<PrinterDto> printers)
    {
        var withHub = printers.Select(p => p with { HubDeviceId = p.HubDeviceId ?? DeviceId }).ToList();
        if (await PrintersController.ReplaceAsync(db, withHub) is { } error)
            return BadRequest(ApiResponse<List<PrinterDto>>.Fail(error, 400));
        return Ok(ApiResponse<List<PrinterDto>>.Ok(await PrintersController.ListAsync(db)));
    }

    private async Task<object> BuildAsync(DateTimeOffset? since)
    {
        var ct = HttpContext.RequestAborted;
        var serverTime = DateTimeOffset.UtcNow; // taken first, so nothing saved during the build is skipped next time
        IQueryable<T> Changed<T>(IQueryable<T> set) where T : Entity =>
            since is null ? set : set.Where(e => e.UpdatedAt > since);

        var restaurant = await db.Restaurants.Where(r => r.Id == RestaurantId)
            .Select(r => new
            {
                r.Id, r.Name, r.AddressLine1, r.AddressLine2, r.City, r.Postcode, r.Phone, r.Currency, r.TimeZone,
            }).FirstAsync(ct);

        var staffRows = await db.RestaurantStaff.ToListAsync(ct);
        var userIds = staffRows.Select(s => s.UserId).ToList();
        var names = await userManager.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        return new
        {
            serverTime,
            restaurant,
            categories = await Changed(db.MenuCategories).Select(c => new
            {
                c.Id, c.Name, c.DisplayOrder, c.IsActive, c.PrintRoute, c.AvailableFrom, c.AvailableTo,
            }).ToListAsync(ct),
            items = await Changed(db.MenuItems).Select(i => new
            {
                i.Id, i.CategoryId, i.Name, i.Description, i.BasePrice, i.IsAvailable, i.DisplayOrder, i.PrintRouteOverride,
                i.IsVegetarian, i.IsVegan, i.SpiceLevel, i.ContainsAllergens, i.AllergenInfo,
            }).ToListAsync(ct),
            itemModifierGroups = await Changed(db.MenuItemModifierGroups).Select(l => new
            {
                l.Id, l.MenuItemId, l.ModifierGroupId, l.DisplayOrder,
            }).ToListAsync(ct),
            modifierGroups = await Changed(db.ModifierGroups).Select(g => new
            {
                g.Id, g.Name, g.MinSelect, g.MaxSelect, g.IsRequired, g.GroupType,
            }).ToListAsync(ct),
            modifierOptions = await Changed(db.ModifierOptions).Select(o => new
            {
                o.Id, o.ModifierGroupId, o.Name, o.PriceDelta, o.IsDefault, o.IsAvailable, o.DisplayOrder,
            }).ToListAsync(ct),
            tables = await Changed(db.Tables).Select(t => new
            {
                t.Id, t.TableNumber, t.Capacity, t.Location, t.IsActive,
            }).ToListAsync(ct),
            liveIds = since is null ? null : new
            {
                categories = await db.MenuCategories.Select(x => x.Id).ToListAsync(ct),
                items = await db.MenuItems.Select(x => x.Id).ToListAsync(ct),
                itemModifierGroups = await db.MenuItemModifierGroups.Select(x => x.Id).ToListAsync(ct),
                modifierGroups = await db.ModifierGroups.Select(x => x.Id).ToListAsync(ct),
                modifierOptions = await db.ModifierOptions.Select(x => x.Id).ToListAsync(ct),
                tables = await db.Tables.Select(x => x.Id).ToListAsync(ct),
            },
            staff = staffRows.Where(s => s.IsActive && names.ContainsKey(s.UserId)).Select(s => new
            {
                s.Id, s.UserId, FullName = names[s.UserId], s.Role, s.PinHash,
            }),
            printers = await PrintersController.ListAsync(db),
            orderStatuses = await db.OrderStatusDefinitions.OrderBy(d => d.DisplayOrder).Select(d => new
            {
                d.Name, d.DisplayOrder, d.CountsAsPending, d.CountsAsCompleted, d.IsDefault,
            }).ToListAsync(ct),
            paymentStatuses = await db.PaymentStatusDefinitions.OrderBy(d => d.DisplayOrder).Select(d => new
            {
                d.Name, d.DisplayOrder, d.IsDefault,
            }).ToListAsync(ct),
            features = await features.GetMapAsync(RestaurantId, ct),
            licence = await licenceSigner.IssueAsync(db, features, RestaurantId, ct),
        };
    }
}
