using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Application.Abstractions;
using Platform.Application.Orders;
using Platform.Domain.Enums;
using Platform.Infrastructure.Identity;

namespace Platform.Api.Controllers.Admin;

public record UpdateOrderStatusRequest(string Status, string? Note);
public record UpdateEstimatedTimeRequest(int EstimatedMinutesFromNow);
public record UpdatePaymentStatusRequest(string PaymentStatus);
public record UpdateOrderDetailsRequest(string? CustomerName, string? CustomerPhone, string? CustomerEmail, string? SpecialRequests);

[ApiController]
[Route("api/admin/orders")]
// StaffOrDevice, not StaffOnly - paired Sunmi POS terminals need to list, read, and update
// orders the same as the admin dashboard does. [HasPermission] adds the per-role check on top.
[Authorize(Policy = "StaffOrDevice")]
public class OrdersController(
    IQueryHandler<ListOrdersQuery, OrderListPageDto> list,
    IQueryHandler<GetOrderStatsQuery, OrderStatsDto> stats,
    IQueryHandler<GetOrderQuery, OrderDetailDto> get,
    ICommandHandler<UpdateOrderStatusCommand, OrderDetailDto> updateStatus,
    ICommandHandler<SetEstimatedTimeCommand, OrderDetailDto> setEstimate,
    ICommandHandler<UpdatePaymentStatusCommand, OrderDetailDto> updatePayment,
    ICommandHandler<UpdateOrderDetailsCommand, OrderDetailDto> updateDetails,
    ICommandHandler<DeleteOrderCommand, bool> delete) : ControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.OrdersView)]
    public async Task<ActionResult<ApiResponse<OrderListPageDto>>> List(
        [FromQuery] string? status, [FromQuery] string? paymentStatus, [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] string? search, [FromQuery] DateOnly? dateFrom, [FromQuery] DateOnly? dateTo,
        [FromQuery] bool? historyOnly,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        this.ToActionResult(await list.Handle(
            new ListOrdersQuery(status, paymentStatus, paymentMethod, search, dateFrom, dateTo, historyOnly, page, pageSize), ct));

    [HttpGet("stats")]
    [HasPermission(Permissions.OrdersView)]
    public async Task<ActionResult<ApiResponse<OrderStatsDto>>> Stats(CancellationToken ct) =>
        this.ToActionResult(await stats.Handle(new GetOrderStatsQuery(), ct));

    [HttpGet("{id:guid}")]
    [HasPermission(Permissions.OrdersView)]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> Get(Guid id, CancellationToken ct) =>
        this.ToActionResult(await get.Handle(new GetOrderQuery(id), ct));

    [HttpPut("{id:guid}/status")]
    [HasPermission(Permissions.OrdersUpdate)]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateStatus(Guid id, UpdateOrderStatusRequest request, CancellationToken ct) =>
        this.ToActionResult(await updateStatus.Handle(new UpdateOrderStatusCommand(id, request.Status, request.Note), ct));

    [HttpPut("{id:guid}/estimated-time")]
    [HasPermission(Permissions.OrdersUpdate)]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> SetEstimatedTime(Guid id, UpdateEstimatedTimeRequest request, CancellationToken ct) =>
        this.ToActionResult(await setEstimate.Handle(new SetEstimatedTimeCommand(id, request.EstimatedMinutesFromNow), ct));

    [HttpPut("{id:guid}/payment-status")]
    [HasPermission(Permissions.OrdersUpdate)]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdatePaymentStatus(Guid id, UpdatePaymentStatusRequest request, CancellationToken ct) =>
        this.ToActionResult(await updatePayment.Handle(new UpdatePaymentStatusCommand(id, request.PaymentStatus), ct));

    [HttpPut("{id:guid}")]
    [HasPermission(Permissions.OrdersUpdate)]
    public async Task<ActionResult<ApiResponse<OrderDetailDto>>> UpdateDetails(Guid id, UpdateOrderDetailsRequest request, CancellationToken ct) =>
        this.ToActionResult(await updateDetails.Handle(
            new UpdateOrderDetailsCommand(id, request.CustomerName, request.CustomerPhone, request.CustomerEmail, request.SpecialRequests), ct));

    [HttpDelete("{id:guid}")]
    [HasPermission(Permissions.OrdersDelete)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct)
    {
        var result = await delete.Handle(new DeleteOrderCommand(id), ct);
        return result.IsSuccess
            ? Ok(ApiResponse<object>.Ok(new { }, "Order deleted."))
            : NotFound(ApiResponse<object>.Fail(result.Error!.Description, 404));
    }
}
