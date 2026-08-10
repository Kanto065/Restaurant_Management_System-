using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Application.Homepage;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

public record OpeningHourDto(DayOfWeek DayOfWeek, string? OpenTime, string? CloseTime, bool IsClosed);
public record OpeningHourExceptionDto(DateOnly Date, string? OpenTime, string? CloseTime, bool IsClosed, string? Note);

public record RestaurantPublicDto(
    Guid Id, string Name, string Slug, string? Description, string? LogoUrl, string? HeroImageUrl,
    string ThemeColorPrimary, string ThemeColorSecondary, string? Phone, string? Email,
    string AddressLine1, string? AddressLine2, string City, string Postcode,
    bool SupportsDelivery, bool SupportsCollection, bool SupportsDineIn,
    decimal ProcessingFeeFlat, decimal ProcessingFeePercentage, decimal LoyaltyPointsPerCurrencyUnit,
    string Currency, HomepageContent? HomepageContent,
    List<OpeningHourDto> OpeningHours, List<OpeningHourExceptionDto> OpeningHourExceptions);

public record DeliveryZoneDto(Guid Id, string Name, double MaxMileage, decimal DeliveryFee, decimal MinimumOrderAmount);

/// <summary>Anonymous, host-resolved storefront endpoints — restaurant profile, hours, delivery pricing.</summary>
[ApiController]
[Route("api/public")]
public class PublicRestaurantController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet("restaurant")]
    public async Task<ActionResult<ApiResponse<RestaurantPublicDto>>> GetRestaurant()
    {
        if (!currentTenant.RestaurantId.HasValue)
            return NotFound(ApiResponse<RestaurantPublicDto>.Fail("Could not resolve a restaurant for this domain.", 404));

        var restaurant = await db.Restaurants
            .Include(r => r.OpeningHours)
            .FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId && r.IsActive);

        if (restaurant is null)
            return NotFound(ApiResponse<RestaurantPublicDto>.Fail("Restaurant not found.", 404));

        // Only upcoming/current exceptions are relevant to the storefront - matches the
        // reference site's "This week only" override that disappears once it has passed.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var exceptions = await db.OpeningHourExceptions
            .Where(e => e.Date >= today)
            .OrderBy(e => e.Date)
            .Take(14)
            .ToListAsync();

        var dto = new RestaurantPublicDto(
            restaurant.Id, restaurant.Name, restaurant.Slug, restaurant.Description, restaurant.LogoUrl,
            restaurant.HeroImageUrl, restaurant.ThemeColorPrimary, restaurant.ThemeColorSecondary,
            restaurant.Phone, restaurant.Email, restaurant.AddressLine1, restaurant.AddressLine2,
            restaurant.City, restaurant.Postcode,
            restaurant.SupportsDelivery, restaurant.SupportsCollection, restaurant.SupportsDineIn,
            restaurant.ProcessingFeeFlat, restaurant.ProcessingFeePercentage, restaurant.LoyaltyPointsPerCurrencyUnit,
            restaurant.Currency,
            restaurant.HomepageContentJson is null
                ? null
                : JsonSerializer.Deserialize<HomepageContent>(restaurant.HomepageContentJson),
            restaurant.OpeningHours
                .OrderBy(h => h.DayOfWeek)
                .Select(h => new OpeningHourDto(h.DayOfWeek, h.OpenTime?.ToString("HH:mm"), h.CloseTime?.ToString("HH:mm"), h.IsClosed))
                .ToList(),
            exceptions
                .Select(e => new OpeningHourExceptionDto(e.Date, e.OpenTime?.ToString("HH:mm"), e.CloseTime?.ToString("HH:mm"), e.IsClosed, e.Note))
                .ToList());

        return Ok(ApiResponse<RestaurantPublicDto>.Ok(dto));
    }

    [HttpGet("delivery-zones")]
    public async Task<ActionResult<ApiResponse<List<DeliveryZoneDto>>>> GetDeliveryZones()
    {
        var zones = await db.DeliveryZones
            .Where(z => z.IsActive)
            .OrderBy(z => z.MaxMileage)
            .Select(z => new DeliveryZoneDto(z.Id, z.Name, z.MaxMileage, z.DeliveryFee, z.MinimumOrderAmount))
            .ToListAsync();

        return Ok(ApiResponse<List<DeliveryZoneDto>>.Ok(zones));
    }
}
