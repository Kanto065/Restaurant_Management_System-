using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Application.Common;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.Admin;

/// <summary>Read-only: the restaurant can see its features, only the platform owner changes them.</summary>
[ApiController]
[Route("api/admin/features")]
[Authorize(Policy = "StaffOnly")]
public class FeaturesController(FeatureService features, ICurrentTenant currentTenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Dictionary<string, bool>>>> Get() =>
        Ok(ApiResponse<Dictionary<string, bool>>.Ok(
            await features.GetMapAsync(currentTenant.RestaurantId!.Value, HttpContext.RequestAborted)));
}
