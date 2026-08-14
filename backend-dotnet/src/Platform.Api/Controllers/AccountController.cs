using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers;

public record AccountOrderSummaryDto(Guid Id, string OrderNumber, OrderType OrderType, string Status, PaymentMethod PaymentMethod, decimal TotalAmount, DateTimeOffset CreatedAt);
public record FavoriteMenuItemDto(Guid MenuItemId, string Name, decimal BasePrice, string? ImageUrl);
public record AddFavoriteRequest(Guid MenuItemId);
public record LoyaltyDto(int PointsBalance, List<LoyaltyTransactionDto> RecentTransactions);
public record LoyaltyTransactionDto(int PointsDelta, string Reason, DateTimeOffset CreatedAt);

public record CustomerAddressDto(Guid Id, string? Label, string Line1, string? Line2, string City, string? County, string Postcode, bool IsDefault);
public record UpsertCustomerAddressRequest(string? Label, string Line1, string? Line2, string City, string? County, string Postcode, bool IsDefault);

public record ProfileDto(
    string? Title, string FullName, string Email, string? Phone, string? LandlinePhone, DateOnly? DateOfBirth,
    bool MarketingEmailOptIn, bool MarketingSmsOptIn, int LoyaltyPointsBalance, int OrderCount, decimal OrderTotal,
    List<CustomerAddressDto> Addresses, Guid? DefaultAddressId);

public record UpdateProfileRequest(
    string? Title, string FullName, string? Phone, string? LandlinePhone, DateOnly? DateOfBirth,
    bool MarketingEmailOptIn, bool MarketingSmsOptIn, string? NewPassword);

/// <summary>Customer-authenticated account features: order history/reorder, favourites, loyalty, profile, addresses.</summary>
[ApiController]
[Route("api/account")]
[Authorize(Policy = "CustomerOnly")]
public class AccountController(AppDbContext db, UserManager<AppUser> userManager) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> GetProfile()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<ProfileDto>.Fail("Customer account not found.", 404));

        var customer = await db.Customers.Include(c => c.Addresses).FirstAsync(c => c.Id == customerId);
        var orderStats = await db.Orders.Where(o => o.CustomerId == customerId)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Total = g.Sum(o => o.TotalAmount) })
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<ProfileDto>.Ok(ToProfileDto(customer, orderStats?.Count ?? 0, orderStats?.Total ?? 0)));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<ProfileDto>>> UpdateProfile(UpdateProfileRequest request)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<ProfileDto>.Fail("Customer account not found.", 404));

        var customer = await db.Customers.Include(c => c.Addresses).FirstAsync(c => c.Id == customerId);
        customer.Title = request.Title;
        customer.FullName = request.FullName;
        customer.Phone = request.Phone;
        customer.LandlinePhone = request.LandlinePhone;
        customer.DateOfBirth = request.DateOfBirth;
        customer.MarketingEmailOptIn = request.MarketingEmailOptIn;
        customer.MarketingSmsOptIn = request.MarketingSmsOptIn;
        await db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(request.NewPassword) && customer.IdentityUserId.HasValue)
        {
            var user = await userManager.FindByIdAsync(customer.IdentityUserId.Value.ToString());
            if (user is not null)
            {
                // Already authenticated via JWT, so a full password reset (no current-password
                // check) is safe here - matches the reference site's single "new password" field.
                var removeResult = await userManager.RemovePasswordAsync(user);
                if (!removeResult.Succeeded)
                    return BadRequest(ApiResponse<ProfileDto>.Fail("Could not update password.", 400));
                var addResult = await userManager.AddPasswordAsync(user, request.NewPassword);
                if (!addResult.Succeeded)
                    return BadRequest(ApiResponse<ProfileDto>.Fail(string.Join("; ", addResult.Errors.Select(e => e.Description)), 400));
            }
        }

        var orderStats = await db.Orders.Where(o => o.CustomerId == customerId)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Total = g.Sum(o => o.TotalAmount) })
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<ProfileDto>.Ok(ToProfileDto(customer, orderStats?.Count ?? 0, orderStats?.Total ?? 0)));
    }

    [HttpDelete("profile")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAccount()
    {
        var userIdClaim = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return NotFound(ApiResponse<object>.Fail("Customer account not found.", 404));

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.IdentityUserId == userId);
        if (customer is null)
            return NotFound(ApiResponse<object>.Fail("Customer account not found.", 404));

        // Keep the Customer row and order history for financial/legal record-keeping (matches
        // the reference site's stated policy) - only the login identity is removed, and the
        // customer is detached from it so it can't be found by CurrentCustomerIdAsync again.
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is not null)
            await userManager.DeleteAsync(user);

        customer.IdentityUserId = null;
        customer.MarketingEmailOptIn = false;
        customer.MarketingSmsOptIn = false;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { }, "Account deleted."));
    }

    [HttpGet("addresses")]
    public async Task<ActionResult<ApiResponse<List<CustomerAddressDto>>>> Addresses()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<List<CustomerAddressDto>>.Fail("Customer account not found.", 404));

        var addresses = await db.CustomerAddresses.Where(a => a.CustomerId == customerId)
            .OrderByDescending(a => a.IsDefault)
            .Select(a => new CustomerAddressDto(a.Id, a.Label, a.Line1, a.Line2, a.City, a.County, a.Postcode, a.IsDefault))
            .ToListAsync();

        return Ok(ApiResponse<List<CustomerAddressDto>>.Ok(addresses));
    }

    [HttpPost("addresses")]
    public async Task<ActionResult<ApiResponse<CustomerAddressDto>>> CreateAddress(UpsertCustomerAddressRequest request)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<CustomerAddressDto>.Fail("Customer account not found.", 404));

        var isFirst = !await db.CustomerAddresses.AnyAsync(a => a.CustomerId == customerId);
        var makeDefault = request.IsDefault || isFirst;

        if (makeDefault)
            await db.CustomerAddresses.Where(a => a.CustomerId == customerId && a.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false));

        var address = new CustomerAddress
        {
            CustomerId = customerId.Value, Label = request.Label, Line1 = request.Line1, Line2 = request.Line2,
            City = request.City, County = request.County, Postcode = request.Postcode, IsDefault = makeDefault,
        };
        db.CustomerAddresses.Add(address);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<CustomerAddressDto>.Ok(
            new CustomerAddressDto(address.Id, address.Label, address.Line1, address.Line2, address.City, address.County, address.Postcode, address.IsDefault),
            statusCode: 201));
    }

    [HttpPut("addresses/{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerAddressDto>>> UpdateAddress(Guid id, UpsertCustomerAddressRequest request)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<CustomerAddressDto>.Fail("Customer account not found.", 404));

        var address = await db.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == id && a.CustomerId == customerId);
        if (address is null)
            return NotFound(ApiResponse<CustomerAddressDto>.Fail("Address not found.", 404));

        if (request.IsDefault && !address.IsDefault)
            await db.CustomerAddresses.Where(a => a.CustomerId == customerId && a.IsDefault)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false));

        address.Label = request.Label;
        address.Line1 = request.Line1;
        address.Line2 = request.Line2;
        address.City = request.City;
        address.County = request.County;
        address.Postcode = request.Postcode;
        address.IsDefault = request.IsDefault;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<CustomerAddressDto>.Ok(
            new CustomerAddressDto(address.Id, address.Label, address.Line1, address.Line2, address.City, address.County, address.Postcode, address.IsDefault)));
    }

    [HttpDelete("addresses/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteAddress(Guid id)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<object>.Fail("Customer account not found.", 404));

        var address = await db.CustomerAddresses.FirstOrDefaultAsync(a => a.Id == id && a.CustomerId == customerId);
        if (address is null)
            return NotFound(ApiResponse<object>.Fail("Address not found.", 404));

        var wasDefault = address.IsDefault;
        db.CustomerAddresses.Remove(address);
        await db.SaveChangesAsync();

        if (wasDefault)
        {
            var next = await db.CustomerAddresses.Where(a => a.CustomerId == customerId).FirstOrDefaultAsync();
            if (next is not null)
            {
                next.IsDefault = true;
                await db.SaveChangesAsync();
            }
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Address removed."));
    }

    private static ProfileDto ToProfileDto(Customer customer, int orderCount, decimal orderTotal) => new(
        customer.Title, customer.FullName, customer.Email, customer.Phone, customer.LandlinePhone, customer.DateOfBirth,
        customer.MarketingEmailOptIn, customer.MarketingSmsOptIn, customer.LoyaltyPointsBalance, orderCount, orderTotal,
        customer.Addresses.OrderByDescending(a => a.IsDefault)
            .Select(a => new CustomerAddressDto(a.Id, a.Label, a.Line1, a.Line2, a.City, a.County, a.Postcode, a.IsDefault)).ToList(),
        customer.Addresses.FirstOrDefault(a => a.IsDefault)?.Id);

    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<List<AccountOrderSummaryDto>>>> Orders()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<List<AccountOrderSummaryDto>>.Fail("Customer account not found.", 404));

        var orders = await db.Orders
            .Where(o => o.CustomerId == customerId && !o.IsDeleted)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new AccountOrderSummaryDto(o.Id, o.OrderNumber, o.OrderType, o.Status, o.PaymentMethod, o.TotalAmount, o.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<List<AccountOrderSummaryDto>>.Ok(orders));
    }

    /// <summary>The reference site's "My Last Order" quick-reorder — returns full item detail, not just the summary.</summary>
    [HttpGet("orders/last")]
    public async Task<ActionResult<ApiResponse<Admin.OrderDetailDto>>> LastOrder()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<Admin.OrderDetailDto>.Fail("Customer account not found.", 404));

        var order = await db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.StatusHistory)
            .Where(o => o.CustomerId == customerId && !o.IsDeleted)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (order is null)
            return NotFound(ApiResponse<Admin.OrderDetailDto>.Fail("No previous orders.", 404));

        var dto = new Admin.OrderDetailDto(
            order.Id, order.OrderNumber, order.OrderType, order.Status, order.PaymentStatus, order.PaymentMethod,
            order.Subtotal, order.DeliveryFee, order.ProcessingFee, order.DiscountAmount, order.TotalAmount,
            order.CustomerName, order.CustomerPhone, order.CustomerEmail, order.SpecialRequests,
            order.EstimatedReadyAt, order.CreatedAt,
            order.Items.Select(i => new Admin.OrderItemDto(
                i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.SpecialInstructions, i.LineTotal,
                i.Modifiers.Select(m => new Admin.OrderItemModifierDto(m.Id, m.NameSnapshot, m.PriceDeltaSnapshot)).ToList())).ToList(),
            order.StatusHistory.OrderBy(h => h.Timestamp).Select(h => new Admin.OrderStatusHistoryDto(h.Status, h.Note, h.Timestamp)).ToList());

        return Ok(ApiResponse<Admin.OrderDetailDto>.Ok(dto));
    }

    [HttpGet("favourites")]
    public async Task<ActionResult<ApiResponse<List<FavoriteMenuItemDto>>>> Favourites()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<List<FavoriteMenuItemDto>>.Fail("Customer account not found.", 404));

        var favourites = await db.CustomerFavoriteMenuItems
            .Where(f => f.CustomerId == customerId)
            .Include(f => f.MenuItem)
            .Where(f => f.MenuItem != null && f.MenuItem.IsAvailable)
            .Select(f => new FavoriteMenuItemDto(f.MenuItemId, f.MenuItem!.Name, f.MenuItem.BasePrice, f.MenuItem.ImageUrl))
            .ToListAsync();

        return Ok(ApiResponse<List<FavoriteMenuItemDto>>.Ok(favourites));
    }

    [HttpPost("favourites")]
    public async Task<ActionResult<ApiResponse<object>>> AddFavourite(AddFavoriteRequest request)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<object>.Fail("Customer account not found.", 404));

        var alreadyExists = await db.CustomerFavoriteMenuItems
            .AnyAsync(f => f.CustomerId == customerId && f.MenuItemId == request.MenuItemId);

        if (!alreadyExists)
        {
            db.CustomerFavoriteMenuItems.Add(new CustomerFavoriteMenuItem
            {
                CustomerId = customerId.Value,
                MenuItemId = request.MenuItemId,
            });
            await db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Added to favourites.", 201));
    }

    [HttpDelete("favourites/{menuItemId:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveFavourite(Guid menuItemId)
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<object>.Fail("Customer account not found.", 404));

        var favourite = await db.CustomerFavoriteMenuItems
            .FirstOrDefaultAsync(f => f.CustomerId == customerId && f.MenuItemId == menuItemId);

        if (favourite is not null)
        {
            db.CustomerFavoriteMenuItems.Remove(favourite);
            await db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { }, "Removed from favourites."));
    }

    [HttpGet("loyalty")]
    public async Task<ActionResult<ApiResponse<LoyaltyDto>>> Loyalty()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<LoyaltyDto>.Fail("Customer account not found.", 404));

        var customer = await db.Customers.FirstAsync(c => c.Id == customerId);
        var transactions = await db.LoyaltyTransactions
            .Where(t => t.CustomerId == customerId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(20)
            .Select(t => new LoyaltyTransactionDto(t.PointsDelta, t.Reason.ToString(), t.CreatedAt))
            .ToListAsync();

        return Ok(ApiResponse<LoyaltyDto>.Ok(new LoyaltyDto(customer.LoyaltyPointsBalance, transactions)));
    }

    private async Task<Guid?> CurrentCustomerIdAsync()
    {
        var userIdClaim = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return null;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.IdentityUserId == userId);
        return customer?.Id;
    }
}
