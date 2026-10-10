using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Application.Abstractions;
using Platform.Application.Orders;

namespace Platform.Api.Controllers.Public;

/// <summary>Anonymous (guest) or customer-authenticated order placement and tracking, host-resolved tenant.</summary>
[ApiController]
[Route("api/public/orders")]
public class PublicOrdersController(
    ICommandHandler<PlaceOrderCommand, CreatedOrderDto> place,
    IQueryHandler<TrackOrderQuery, TrackOrderDto> track) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CreatedOrderDto>>> Create(CreatePublicOrderRequest request, CancellationToken ct = default)
    {
        // Authenticated customers only; a missing/odd token is just a guest order, as before.
        Guid? userId = User.Identity?.IsAuthenticated == true && Guid.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id)
            ? id : null;

        var result = await place.Handle(new PlaceOrderCommand(request, userId), ct);
        // 200 on the wire with 201 in the envelope - what the storefront already receives.
        return result.IsSuccess
            ? Ok(ApiResponse<CreatedOrderDto>.Ok(result.Value!, statusCode: 201))
            : this.ToActionResult(result);
    }

    [HttpGet("{id:guid}/track")]
    public async Task<ActionResult<ApiResponse<TrackOrderDto>>> Track(Guid id, CancellationToken ct) =>
        this.ToActionResult(await track.Handle(new TrackOrderQuery(id), ct));
}
