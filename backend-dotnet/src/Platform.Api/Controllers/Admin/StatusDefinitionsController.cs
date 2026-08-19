using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Domain.Entities;
using Platform.Infrastructure.Persistence;

namespace Platform.Api.Controllers.Admin;

public record OrderStatusDefinitionDto(Guid Id, string Name, int DisplayOrder, bool CountsAsPending, bool CountsAsCompleted, bool IsDefault);
public record UpsertOrderStatusDefinitionRequest(string Name, bool CountsAsPending, bool CountsAsCompleted, bool IsDefault);

public record PaymentStatusDefinitionDto(Guid Id, string Name, int DisplayOrder, bool IsDefault);
public record UpsertPaymentStatusDefinitionRequest(string Name, bool IsDefault);

public record ReorderStatusDefinitionsRequest(List<Guid> OrderedIds);

/// <summary>
/// Lets admins manage the Order/Payment status workflows themselves - what used to be a fixed
/// enum is now a per-restaurant configurable, orderable list. Renaming or reordering these does
/// not touch historical orders (Order.Status/PaymentStatus store the name as free text), but
/// deleting a status that's still in use on existing orders is blocked to avoid orphaning them.
/// </summary>
[ApiController]
[Route("api/admin")]
// No class-level policy: stacking [Authorize] at class and method level ANDs the policies
// together rather than letting the method override the class, so the two list endpoints
// below (which paired POS devices call directly) carry their own StaffOrDevice policy and
// every mutating endpoint carries StaffOnly explicitly instead.
public class StatusDefinitionsController(AppDbContext db) : ControllerBase
{
    [HttpGet("order-statuses")]
    [Authorize(Policy = "StaffOrDevice")]
    public async Task<ActionResult<ApiResponse<List<OrderStatusDefinitionDto>>>> ListOrderStatuses()
    {
        var items = await db.OrderStatusDefinitions.OrderBy(d => d.DisplayOrder)
            .Select(d => new OrderStatusDefinitionDto(d.Id, d.Name, d.DisplayOrder, d.CountsAsPending, d.CountsAsCompleted, d.IsDefault))
            .ToListAsync();
        return Ok(ApiResponse<List<OrderStatusDefinitionDto>>.Ok(items));
    }

    [HttpPost("order-statuses")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<OrderStatusDefinitionDto>>> CreateOrderStatus(UpsertOrderStatusDefinitionRequest request)
    {
        if (await db.OrderStatusDefinitions.AnyAsync(d => d.Name == request.Name))
            return BadRequest(ApiResponse<OrderStatusDefinitionDto>.Fail("A status with this name already exists.", 400));

        if (request.IsDefault)
            await db.OrderStatusDefinitions.Where(d => d.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsDefault, false));

        var nextOrder = await db.OrderStatusDefinitions.CountAsync();
        var entity = new OrderStatusDefinition
        {
            Name = request.Name, DisplayOrder = nextOrder,
            CountsAsPending = request.CountsAsPending, CountsAsCompleted = request.CountsAsCompleted, IsDefault = request.IsDefault,
        };
        db.OrderStatusDefinitions.Add(entity);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OrderStatusDefinitionDto>.Ok(
            new OrderStatusDefinitionDto(entity.Id, entity.Name, entity.DisplayOrder, entity.CountsAsPending, entity.CountsAsCompleted, entity.IsDefault),
            statusCode: 201));
    }

    [HttpPut("order-statuses/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<OrderStatusDefinitionDto>>> UpdateOrderStatus(Guid id, UpsertOrderStatusDefinitionRequest request)
    {
        var entity = await db.OrderStatusDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return NotFound(ApiResponse<OrderStatusDefinitionDto>.Fail("Status not found.", 404));

        if (await db.OrderStatusDefinitions.AnyAsync(d => d.Name == request.Name && d.Id != id))
            return BadRequest(ApiResponse<OrderStatusDefinitionDto>.Fail("A status with this name already exists.", 400));

        if (request.IsDefault && !entity.IsDefault)
            await db.OrderStatusDefinitions.Where(d => d.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsDefault, false));

        // Renaming updates every order/history row that currently uses the old name so
        // existing orders keep displaying correctly under the new label.
        if (entity.Name != request.Name)
        {
            await db.Orders.Where(o => o.Status == entity.Name).ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, request.Name));
            await db.OrderStatusHistories.Where(h => h.Status == entity.Name).ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, request.Name));
        }

        entity.Name = request.Name;
        entity.CountsAsPending = request.CountsAsPending;
        entity.CountsAsCompleted = request.CountsAsCompleted;
        entity.IsDefault = request.IsDefault;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<OrderStatusDefinitionDto>.Ok(
            new OrderStatusDefinitionDto(entity.Id, entity.Name, entity.DisplayOrder, entity.CountsAsPending, entity.CountsAsCompleted, entity.IsDefault)));
    }

    [HttpDelete("order-statuses/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteOrderStatus(Guid id)
    {
        var entity = await db.OrderStatusDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return NotFound(ApiResponse<object>.Fail("Status not found.", 404));

        if (await db.Orders.AnyAsync(o => o.Status == entity.Name))
            return BadRequest(ApiResponse<object>.Fail("This status is still used by existing orders and can't be deleted.", 400));

        db.OrderStatusDefinitions.Remove(entity);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    [HttpPut("order-statuses/reorder")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<List<OrderStatusDefinitionDto>>>> ReorderOrderStatuses(ReorderStatusDefinitionsRequest request)
    {
        var items = await db.OrderStatusDefinitions.ToListAsync();
        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            var item = items.FirstOrDefault(d => d.Id == request.OrderedIds[i]);
            if (item is not null) item.DisplayOrder = i;
        }
        await db.SaveChangesAsync();
        return await ListOrderStatuses();
    }

    [HttpGet("payment-statuses")]
    [Authorize(Policy = "StaffOrDevice")]
    public async Task<ActionResult<ApiResponse<List<PaymentStatusDefinitionDto>>>> ListPaymentStatuses()
    {
        var items = await db.PaymentStatusDefinitions.OrderBy(d => d.DisplayOrder)
            .Select(d => new PaymentStatusDefinitionDto(d.Id, d.Name, d.DisplayOrder, d.IsDefault))
            .ToListAsync();
        return Ok(ApiResponse<List<PaymentStatusDefinitionDto>>.Ok(items));
    }

    [HttpPost("payment-statuses")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<PaymentStatusDefinitionDto>>> CreatePaymentStatus(UpsertPaymentStatusDefinitionRequest request)
    {
        if (await db.PaymentStatusDefinitions.AnyAsync(d => d.Name == request.Name))
            return BadRequest(ApiResponse<PaymentStatusDefinitionDto>.Fail("A status with this name already exists.", 400));

        if (request.IsDefault)
            await db.PaymentStatusDefinitions.Where(d => d.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsDefault, false));

        var nextOrder = await db.PaymentStatusDefinitions.CountAsync();
        var entity = new PaymentStatusDefinition { Name = request.Name, DisplayOrder = nextOrder, IsDefault = request.IsDefault };
        db.PaymentStatusDefinitions.Add(entity);
        await db.SaveChangesAsync();

        return Ok(ApiResponse<PaymentStatusDefinitionDto>.Ok(
            new PaymentStatusDefinitionDto(entity.Id, entity.Name, entity.DisplayOrder, entity.IsDefault), statusCode: 201));
    }

    [HttpPut("payment-statuses/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<PaymentStatusDefinitionDto>>> UpdatePaymentStatus(Guid id, UpsertPaymentStatusDefinitionRequest request)
    {
        var entity = await db.PaymentStatusDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return NotFound(ApiResponse<PaymentStatusDefinitionDto>.Fail("Status not found.", 404));

        if (await db.PaymentStatusDefinitions.AnyAsync(d => d.Name == request.Name && d.Id != id))
            return BadRequest(ApiResponse<PaymentStatusDefinitionDto>.Fail("A status with this name already exists.", 400));

        if (request.IsDefault && !entity.IsDefault)
            await db.PaymentStatusDefinitions.Where(d => d.IsDefault).ExecuteUpdateAsync(s => s.SetProperty(d => d.IsDefault, false));

        if (entity.Name != request.Name)
            await db.Orders.Where(o => o.PaymentStatus == entity.Name).ExecuteUpdateAsync(s => s.SetProperty(o => o.PaymentStatus, request.Name));

        entity.Name = request.Name;
        entity.IsDefault = request.IsDefault;
        await db.SaveChangesAsync();

        return Ok(ApiResponse<PaymentStatusDefinitionDto>.Ok(new PaymentStatusDefinitionDto(entity.Id, entity.Name, entity.DisplayOrder, entity.IsDefault)));
    }

    [HttpDelete("payment-statuses/{id:guid}")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<object>>> DeletePaymentStatus(Guid id)
    {
        var entity = await db.PaymentStatusDefinitions.FirstOrDefaultAsync(d => d.Id == id);
        if (entity is null)
            return NotFound(ApiResponse<object>.Fail("Status not found.", 404));

        if (await db.Orders.AnyAsync(o => o.PaymentStatus == entity.Name))
            return BadRequest(ApiResponse<object>.Fail("This status is still used by existing orders and can't be deleted.", 400));

        db.PaymentStatusDefinitions.Remove(entity);
        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "Deleted."));
    }

    [HttpPut("payment-statuses/reorder")]
    [Authorize(Policy = "StaffOnly")]
    public async Task<ActionResult<ApiResponse<List<PaymentStatusDefinitionDto>>>> ReorderPaymentStatuses(ReorderStatusDefinitionsRequest request)
    {
        var items = await db.PaymentStatusDefinitions.ToListAsync();
        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            var item = items.FirstOrDefault(d => d.Id == request.OrderedIds[i]);
            if (item is not null) item.DisplayOrder = i;
        }
        await db.SaveChangesAsync();
        return await ListPaymentStatuses();
    }
}
