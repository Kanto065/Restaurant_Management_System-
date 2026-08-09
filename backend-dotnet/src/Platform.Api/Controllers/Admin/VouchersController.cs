using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Domain.Enums;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record VoucherDto(
    Guid Id, string Code, VoucherDiscountType DiscountType, decimal DiscountValue, decimal MinimumOrderAmount,
    DateTimeOffset? ValidFrom, DateTimeOffset? ValidTo, int? MaxRedemptions, int TimesRedeemed, bool IsActive);

public record UpsertVoucherRequest(
    string Code, VoucherDiscountType DiscountType, decimal DiscountValue, decimal MinimumOrderAmount,
    DateTimeOffset? ValidFrom, DateTimeOffset? ValidTo, int? MaxRedemptions, bool IsActive);

[ApiController]
[Route("api/admin/vouchers")]
[Authorize(Policy = "StaffOnly")]
public class VouchersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<VoucherDto>>>> List()
    {
        var vouchers = await db.Vouchers
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new VoucherDto(v.Id, v.Code, v.DiscountType, v.DiscountValue, v.MinimumOrderAmount,
                v.ValidFrom, v.ValidTo, v.MaxRedemptions, v.TimesRedeemed, v.IsActive))
            .ToListAsync();

        return Ok(ApiResponse<List<VoucherDto>>.Ok(vouchers));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<VoucherDto>>> Create(UpsertVoucherRequest request)
    {
        var codeExists = await db.Vouchers.AnyAsync(v => v.Code == request.Code);
        if (codeExists)
            return Conflict(ApiResponse<VoucherDto>.Fail("A voucher with this code already exists.", 409));

        var voucher = new Voucher
        {
            Code = request.Code.ToUpperInvariant(),
            DiscountType = request.DiscountType,
            DiscountValue = request.DiscountValue,
            MinimumOrderAmount = request.MinimumOrderAmount,
            ValidFrom = request.ValidFrom,
            ValidTo = request.ValidTo,
            MaxRedemptions = request.MaxRedemptions,
            IsActive = request.IsActive,
        };
        db.Vouchers.Add(voucher);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<VoucherDto>.Ok(ToDto(voucher), statusCode: 201));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<VoucherDto>>> Update(Guid id, UpsertVoucherRequest request)
    {
        var voucher = await db.Vouchers.FirstOrDefaultAsync(v => v.Id == id);
        if (voucher is null)
            return NotFound(ApiResponse<VoucherDto>.Fail("Voucher not found.", 404));

        voucher.Code = request.Code.ToUpperInvariant();
        voucher.DiscountType = request.DiscountType;
        voucher.DiscountValue = request.DiscountValue;
        voucher.MinimumOrderAmount = request.MinimumOrderAmount;
        voucher.ValidFrom = request.ValidFrom;
        voucher.ValidTo = request.ValidTo;
        voucher.MaxRedemptions = request.MaxRedemptions;
        voucher.IsActive = request.IsActive;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<VoucherDto>.Ok(ToDto(voucher)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var voucher = await db.Vouchers.FirstOrDefaultAsync(v => v.Id == id);
        if (voucher is null)
            return NotFound(ApiResponse<object>.Fail("Voucher not found.", 404));

        db.Vouchers.Remove(voucher);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    private static VoucherDto ToDto(Voucher v) => new(
        v.Id, v.Code, v.DiscountType, v.DiscountValue, v.MinimumOrderAmount, v.ValidFrom, v.ValidTo,
        v.MaxRedemptions, v.TimesRedeemed, v.IsActive);
}
