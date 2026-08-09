using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers;

public record AccountOrderSummaryDto(Guid Id, long OrderNumber, OrderStatus Status, decimal TotalAmount, DateTimeOffset CreatedAt);
public record FavoriteMenuItemDto(Guid MenuItemId, string Name, decimal BasePrice, string? ImageUrl);
public record AddFavoriteRequest(Guid MenuItemId);
public record LoyaltyDto(int PointsBalance, List<LoyaltyTransactionDto> RecentTransactions);
public record LoyaltyTransactionDto(int PointsDelta, string Reason, DateTimeOffset CreatedAt);

/// <summary>Customer-authenticated account features: order history/reorder, favourites, loyalty.</summary>
[ApiController]
[Route("api/account")]
[Authorize(Policy = "CustomerOnly")]
public class AccountController(AppDbContext db) : ControllerBase
{
    [HttpGet("orders")]
    public async Task<ActionResult<ApiResponse<List<AccountOrderSummaryDto>>>> Orders()
    {
        var customerId = await CurrentCustomerIdAsync();
        if (customerId is null)
            return NotFound(ApiResponse<List<AccountOrderSummaryDto>>.Fail("Customer account not found.", 404));

        var orders = await db.Orders
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new AccountOrderSummaryDto(o.Id, o.OrderNumber, o.Status, o.TotalAmount, o.CreatedAt))
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
            .Include(o => o.Items)
            .Include(o => o.StatusHistory)
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (order is null)
            return NotFound(ApiResponse<Admin.OrderDetailDto>.Fail("No previous orders.", 404));

        var dto = new Admin.OrderDetailDto(
            order.Id, order.OrderNumber, order.OrderType, order.Status, order.PaymentStatus, order.PaymentMethod,
            order.Subtotal, order.DeliveryFee, order.ProcessingFee, order.DiscountAmount, order.TotalAmount,
            order.CustomerName, order.CustomerPhone, order.CustomerEmail, order.SpecialRequests,
            order.EstimatedReadyAt, order.CreatedAt,
            order.Items.Select(i => new Admin.OrderItemDto(i.Id, i.NameSnapshot, i.UnitPriceSnapshot, i.Quantity, i.LineTotal)).ToList(),
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
