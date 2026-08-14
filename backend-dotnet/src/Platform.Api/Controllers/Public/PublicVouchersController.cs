using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Public;

public record ValidateVoucherRequest(string Code, decimal Subtotal);
public record ValidateVoucherResponse(bool Valid, decimal DiscountAmount, string? Message);

/// <summary>Anonymous, host-resolved storefront endpoint for previewing a voucher's discount at
/// checkout before the order is actually placed. This is a preview only - the real, authoritative
/// check happens again server-side against the server-computed subtotal in
/// PublicOrdersController.Create, so a client passing a fabricated Subtotal here can't get a
/// discount it isn't entitled to on the actual order.</summary>
[ApiController]
[Route("api/public/vouchers")]
public class PublicVouchersController(AppDbContext db) : ControllerBase
{
    [HttpPost("validate")]
    public async Task<ActionResult<ApiResponse<ValidateVoucherResponse>>> Validate(ValidateVoucherRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0, "Enter a voucher code.")));

        var voucher = await db.Vouchers.FirstOrDefaultAsync(v => v.Code == request.Code && v.IsActive);
        var now = DateTimeOffset.UtcNow;

        if (voucher is null)
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0, "This voucher code isn't recognised.")));
        if (voucher.ValidFrom is not null && voucher.ValidFrom > now)
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0, "This voucher isn't active yet.")));
        if (voucher.ValidTo is not null && voucher.ValidTo < now)
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0, "This voucher has expired.")));
        if (voucher.MaxRedemptions is not null && voucher.TimesRedeemed >= voucher.MaxRedemptions)
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0, "This voucher has already been fully redeemed.")));
        if (request.Subtotal < voucher.MinimumOrderAmount)
            return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(false, 0,
                $"This voucher needs a minimum order of {voucher.MinimumOrderAmount:0.00}.")));

        var discount = voucher.DiscountType == VoucherDiscountType.Percentage
            ? Math.Round(request.Subtotal * voucher.DiscountValue / 100m, 2)
            : voucher.DiscountValue;

        return Ok(ApiResponse<ValidateVoucherResponse>.Ok(new ValidateVoucherResponse(true, discount, null)));
    }
}
