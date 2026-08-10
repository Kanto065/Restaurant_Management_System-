using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Application.Homepage;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record RestaurantSettingsDto(
    Guid Id, string Name, string Slug, string? Description, string? LogoUrl, string? HeroImageUrl,
    string ThemeColorPrimary, string ThemeColorSecondary, string? Phone, string? Email,
    string AddressLine1, string? AddressLine2, string City, string Postcode, string Country,
    string TimeZone, bool IsActive, bool SupportsDelivery, bool SupportsCollection, bool SupportsDineIn,
    decimal ProcessingFeeFlat, decimal ProcessingFeePercentage, decimal LoyaltyPointsPerCurrencyUnit,
    string Currency, HomepageContent? HomepageContent);

public record UpdateRestaurantSettingsRequest(
    string Name, string? Description, string? LogoUrl, string? HeroImageUrl,
    string ThemeColorPrimary, string ThemeColorSecondary, string? Phone, string? Email,
    string AddressLine1, string? AddressLine2, string City, string Postcode, string Country,
    string TimeZone, bool SupportsDelivery, bool SupportsCollection, bool SupportsDineIn,
    decimal ProcessingFeeFlat, decimal ProcessingFeePercentage, decimal LoyaltyPointsPerCurrencyUnit,
    string Currency, HomepageContent? HomepageContent);

[ApiController]
[Route("api/admin/restaurant")]
[Authorize(Policy = "StaffOnly")]
public class RestaurantsController(AppDbContext db, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<RestaurantSettingsDto>>> Get()
    {
        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId);
        if (restaurant is null)
            return NotFound(ApiResponse<RestaurantSettingsDto>.Fail("Restaurant not found.", 404));

        var dto = new RestaurantSettingsDto(
            restaurant.Id, restaurant.Name, restaurant.Slug, restaurant.Description, restaurant.LogoUrl,
            restaurant.HeroImageUrl, restaurant.ThemeColorPrimary, restaurant.ThemeColorSecondary,
            restaurant.Phone, restaurant.Email, restaurant.AddressLine1, restaurant.AddressLine2,
            restaurant.City, restaurant.Postcode, restaurant.Country, restaurant.TimeZone, restaurant.IsActive,
            restaurant.SupportsDelivery, restaurant.SupportsCollection, restaurant.SupportsDineIn,
            restaurant.ProcessingFeeFlat, restaurant.ProcessingFeePercentage, restaurant.LoyaltyPointsPerCurrencyUnit,
            restaurant.Currency,
            restaurant.HomepageContentJson is null
                ? null
                : JsonSerializer.Deserialize<HomepageContent>(restaurant.HomepageContentJson));

        return Ok(ApiResponse<RestaurantSettingsDto>.Ok(dto));
    }

    [HttpPut]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<RestaurantSettingsDto>>> Update(UpdateRestaurantSettingsRequest request)
    {
        var restaurant = await db.Restaurants.FirstOrDefaultAsync(r => r.Id == currentTenant.RestaurantId);
        if (restaurant is null)
            return NotFound(ApiResponse<RestaurantSettingsDto>.Fail("Restaurant not found.", 404));

        restaurant.Name = request.Name;
        restaurant.Description = request.Description;
        restaurant.LogoUrl = request.LogoUrl;
        restaurant.HeroImageUrl = request.HeroImageUrl;
        restaurant.ThemeColorPrimary = request.ThemeColorPrimary;
        restaurant.ThemeColorSecondary = request.ThemeColorSecondary;
        restaurant.Phone = request.Phone;
        restaurant.Email = request.Email;
        restaurant.AddressLine1 = request.AddressLine1;
        restaurant.AddressLine2 = request.AddressLine2;
        restaurant.City = request.City;
        restaurant.Postcode = request.Postcode;
        restaurant.Country = request.Country;
        restaurant.TimeZone = request.TimeZone;
        restaurant.SupportsDelivery = request.SupportsDelivery;
        restaurant.SupportsCollection = request.SupportsCollection;
        restaurant.SupportsDineIn = request.SupportsDineIn;
        restaurant.ProcessingFeeFlat = request.ProcessingFeeFlat;
        restaurant.ProcessingFeePercentage = request.ProcessingFeePercentage;
        restaurant.LoyaltyPointsPerCurrencyUnit = request.LoyaltyPointsPerCurrencyUnit;
        restaurant.Currency = request.Currency;
        restaurant.HomepageContentJson = request.HomepageContent is null
            ? null
            : JsonSerializer.Serialize(request.HomepageContent);

        await db.SaveChangesAsync();

        return await Get();
    }
}
