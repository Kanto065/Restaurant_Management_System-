using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

/// <summary>Every switchable feature. The super admin UI renders one switch per key.</summary>
public static class FeatureKeys
{
    public const string Pos = "pos";
    public const string PosWaiter = "pos.waiter";
    public const string PosKitchenPrint = "pos.kitchenPrint";
    public const string PosBarPrint = "pos.barPrint";
    public const string PosDiscounts = "pos.discounts";
    public const string PosRefunds = "pos.refunds";
    public const string PosReports = "pos.reports";
    public const string PosPrintOnlineOrders = "pos.printOnlineOrders";
    public const string OnlineOrdering = "online.ordering";

    public static readonly string[] All =
        [Pos, PosWaiter, PosKitchenPrint, PosBarPrint, PosDiscounts, PosRefunds, PosReports, PosPrintOnlineOrders, OnlineOrdering];
}

public class FeatureService(AppDbContext db)
{
    /// <summary>
    /// Resolution per key: "pos" is Restaurant.PosEnabled (unchanged legacy switch); any other key
    /// is the restaurant's override row, else the plan default, else off. "pos.*" keys are off
    /// whenever "pos" is off. "online.ordering" is reserved and reported on (today's behaviour).
    /// </summary>
    public static Dictionary<string, bool> Resolve(
        bool posEnabled, string? planFlagsJson, IReadOnlyDictionary<string, bool> overrides)
    {
        var plan = ParsePlanFlags(planFlagsJson);
        var map = new Dictionary<string, bool>();
        foreach (var key in FeatureKeys.All)
        {
            map[key] = key switch
            {
                FeatureKeys.Pos => posEnabled,
                FeatureKeys.OnlineOrdering => true,
                _ => overrides.TryGetValue(key, out var o) ? o : plan.GetValueOrDefault(key),
            };
            if (key.StartsWith("pos.") && !posEnabled)
                map[key] = false;
        }
        return map;
    }

    public async Task<Dictionary<string, bool>> GetMapAsync(Guid restaurantId, CancellationToken ct = default)
    {
        var restaurant = await db.Restaurants.IgnoreQueryFilters()
            .Where(r => r.Id == restaurantId)
            .Select(r => new { r.PosEnabled, r.OrganizationId })
            .FirstAsync(ct);

        var planFlags = await db.Subscriptions.IgnoreQueryFilters()
            .Where(s => s.OrganizationId == restaurant.OrganizationId && !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => s.Plan!.FeatureFlagsJson)
            .FirstOrDefaultAsync(ct);

        var overrides = await db.RestaurantFeatures.IgnoreQueryFilters()
            .Where(f => f.RestaurantId == restaurantId && !f.IsDeleted)
            .ToDictionaryAsync(f => f.Key, f => f.IsEnabled, ct);

        return Resolve(restaurant.PosEnabled, planFlags, overrides);
    }

    public async Task<bool> IsEnabledAsync(Guid restaurantId, string key, CancellationToken ct = default) =>
        (await GetMapAsync(restaurantId, ct)).GetValueOrDefault(key);

    /// <summary>Stores explicit switches. "pos" writes Restaurant.PosEnabled; unknown keys throw.</summary>
    public async Task SetAsync(Guid restaurantId, IReadOnlyDictionary<string, bool> changes, CancellationToken ct = default)
    {
        var unknown = changes.Keys.Except(FeatureKeys.All).ToList();
        if (unknown.Count > 0)
            throw new ArgumentException($"Unknown feature key(s): {string.Join(", ", unknown)}");

        var restaurant = await db.Restaurants.IgnoreQueryFilters().FirstAsync(r => r.Id == restaurantId, ct);
        var rows = await db.RestaurantFeatures.IgnoreQueryFilters()
            .Where(f => f.RestaurantId == restaurantId)
            .ToListAsync(ct);

        foreach (var (key, enabled) in changes)
        {
            if (key == FeatureKeys.Pos)
            {
                restaurant.PosEnabled = enabled;
                continue;
            }
            var row = rows.FirstOrDefault(f => f.Key == key);
            if (row is null)
                db.RestaurantFeatures.Add(new RestaurantFeature { RestaurantId = restaurantId, Key = key, IsEnabled = enabled });
            else
            {
                row.IsEnabled = enabled;
                row.IsDeleted = false;
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private static Dictionary<string, bool> ParsePlanFlags(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, bool>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
