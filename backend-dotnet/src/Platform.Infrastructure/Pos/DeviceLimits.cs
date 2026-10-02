using Microsoft.EntityFrameworkCore;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

public static class DeviceLimits
{
    /// <summary>True when another POS device (main POS or waiter tablet) fits the plan's
    /// MaxDevices. No subscription or no limit = unlimited. Sunmi terminals never count.</summary>
    public static async Task<bool> CanAddPosDeviceAsync(AppDbContext db, Guid restaurantId, CancellationToken ct = default)
    {
        var orgId = await db.Restaurants.IgnoreQueryFilters().Where(r => r.Id == restaurantId)
            .Select(r => r.OrganizationId).FirstAsync(ct);
        var max = await db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == orgId && !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => s.Plan!.MaxDevices)
            .FirstOrDefaultAsync(ct);
        if (max is null)
            return true;

        var used = await db.Devices.IgnoreQueryFilters().CountAsync(d => d.RestaurantId == restaurantId
            && d.IsActive && !d.IsDeleted && d.DeviceType != DeviceType.SunmiTerminal, ct);
        return used < max;
    }
}
