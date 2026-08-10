using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Application.Common;

namespace Platform.Api.Controllers.Admin;

public record UploadedImageDto(string Url);

/// <summary>Restaurant-scoped image uploads (hero slides, logo, etc). Files are stored
/// under wwwroot/uploads/{restaurantId}/ and served back via static file middleware.</summary>
[ApiController]
[Route("api/admin/uploads")]
[Authorize(Policy = "StaffOnly")]
public class UploadsController(IWebHostEnvironment env, ICurrentTenant currentTenant) : ControllerBase
{
    private static readonly Dictionary<string, string> AllowedContentTypes = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    [HttpPost("image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<ApiResponse<UploadedImageDto>>> UploadImage(IFormFile file)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<UploadedImageDto>.Fail("Could not resolve the current restaurant.", 400));

        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<UploadedImageDto>.Fail("No file was uploaded.", 400));

        if (!AllowedContentTypes.TryGetValue(file.ContentType, out var extension))
            return BadRequest(ApiResponse<UploadedImageDto>.Fail("Only JPEG, PNG, and WebP images are allowed.", 400));

        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        var uploadDir = Path.Combine(webRoot, "uploads", currentTenant.RestaurantId.Value.ToString());
        Directory.CreateDirectory(uploadDir);

        var fileName = $"{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadDir, fileName);

        await using (var stream = System.IO.File.Create(filePath))
        {
            await file.CopyToAsync(stream);
        }

        var url = $"/uploads/{currentTenant.RestaurantId.Value}/{fileName}";
        return Ok(ApiResponse<UploadedImageDto>.Ok(new UploadedImageDto(url)));
    }
}
