using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Platform.Api.Contracts;
using Platform.Api.Filters;
using Platform.Infrastructure.Persistence;
using Platform.Infrastructure.Pos;

namespace Platform.Api.Controllers.PlatformAdmin;

/// <summary>Every feature key as a map. The older PUT /api/platform/tenants/{id}/features
/// ({posEnabled}) stays as it is; both write the same Restaurant.PosEnabled for "pos".</summary>
[AllowUnresolvedTenant]
[ApiController]
[Route("api/platform/tenants/{id:guid}/feature-map")]
[Authorize(Policy = "PlatformSuperAdmin")]
public class PlatformFeaturesController(FeatureService features, AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Dictionary<string, bool>>>> Get(Guid id)
    {
        if (!await ExistsAsync(id))
            return NotFound(ApiResponse<Dictionary<string, bool>>.Fail("Restaurant not found.", 404));
        return Ok(ApiResponse<Dictionary<string, bool>>.Ok(await features.GetMapAsync(id, HttpContext.RequestAborted)));
    }

    /// <summary>Partial update: only the keys sent are changed.</summary>
    [HttpPut]
    public async Task<ActionResult<ApiResponse<Dictionary<string, bool>>>> Put(Guid id, Dictionary<string, bool> changes)
    {
        if (!await ExistsAsync(id))
            return NotFound(ApiResponse<Dictionary<string, bool>>.Fail("Restaurant not found.", 404));
        try
        {
            await features.SetAsync(id, changes, HttpContext.RequestAborted);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<Dictionary<string, bool>>.Fail(ex.Message, 400));
        }
        return Ok(ApiResponse<Dictionary<string, bool>>.Ok(await features.GetMapAsync(id, HttpContext.RequestAborted)));
    }

    private Task<bool> ExistsAsync(Guid id) =>
        db.Restaurants.IgnoreQueryFilters().AnyAsync(r => r.Id == id && !r.IsDeleted);
}
