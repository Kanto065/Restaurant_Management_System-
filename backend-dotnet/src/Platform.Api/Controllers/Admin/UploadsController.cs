using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Contracts;
using Platform.Application.Common;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Platform.Api.Controllers.Admin;

public record UploadedImageDto(string Url);

/// <summary>Restaurant-scoped image uploads (hero slides, logo, etc), stored via IFileStorage.
///
/// Uploaded bytes are never written through as-is: they're decoded and re-encoded with
/// ImageSharp. This is the actual security boundary, not the Content-Type header (which is
/// just a client-supplied hint and easy to spoof) - only bytes that decode as a real raster
/// image survive, so a script/executable/zip renamed to "photo.jpg" is rejected outright
/// rather than stored and served back to browsers. Re-encoding also strips all metadata
/// (EXIF, embedded thumbnails, etc) and is where compression happens: images are capped to a
/// sane max dimension for a homepage banner and re-encoded at a high quality setting, so file
/// size drops substantially with no visible loss.</summary>
[ApiController]
[Route("api/admin/uploads")]
[Authorize(Policy = "StaffOnly")]
public class UploadsController(IFileStorage fileStorage, ICurrentTenant currentTenant) : ControllerBase
{
    private const int MaxDimension = 2000;
    private const int JpegQuality = 88;

    [HttpPost("image")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<ApiResponse<UploadedImageDto>>> UploadImage(IFormFile file, CancellationToken ct)
    {
        if (!currentTenant.RestaurantId.HasValue)
            return BadRequest(ApiResponse<UploadedImageDto>.Fail("Could not resolve the current restaurant.", 400));

        if (file is null || file.Length == 0)
            return BadRequest(ApiResponse<UploadedImageDto>.Fail("No file was uploaded.", 400));

        Image<Rgba32> image;
        try
        {
            await using var uploadStream = file.OpenReadStream();
            image = await Image.LoadAsync<Rgba32>(uploadStream, ct);
        }
        catch (UnknownImageFormatException)
        {
            return BadRequest(ApiResponse<UploadedImageDto>.Fail(
                "That file isn't a readable JPEG, PNG, or WebP image.", 400));
        }
        catch (InvalidImageContentException)
        {
            return BadRequest(ApiResponse<UploadedImageDto>.Fail(
                "That file isn't a readable JPEG, PNG, or WebP image.", 400));
        }

        using (image)
        {
            if (image.Width > MaxDimension || image.Height > MaxDimension)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Mode = ResizeMode.Max,
                    Size = new Size(MaxDimension, MaxDimension),
                }));
            }

            // Re-encoded fresh, so no source metadata (EXIF, ICC profiles, thumbnails) is carried
            // over - PNG only for images that actually need transparency, JPEG (smaller) otherwise.
            var hasTransparency = false;
            image.ProcessPixelRows(accessor =>
            {
                for (var y = 0; y < accessor.Height && !hasTransparency; y++)
                {
                    foreach (var pixel in accessor.GetRowSpan(y))
                    {
                        if (pixel.A < 255)
                        {
                            hasTransparency = true;
                            break;
                        }
                    }
                }
            });

            using var output = new MemoryStream();
            string contentType;
            string extension;
            if (hasTransparency)
            {
                await image.SaveAsync(output, new PngEncoder { CompressionLevel = PngCompressionLevel.BestCompression }, ct);
                contentType = "image/png";
                extension = ".png";
            }
            else
            {
                await image.SaveAsync(output, new JpegEncoder { Quality = JpegQuality }, ct);
                contentType = "image/jpeg";
                extension = ".jpg";
            }

            var fileName = $"{Guid.NewGuid()}{extension}";
            var url = await fileStorage.SaveAsync(
                currentTenant.RestaurantId.Value, fileName, output.ToArray(), contentType, ct);

            return Ok(ApiResponse<UploadedImageDto>.Ok(new UploadedImageDto(url)));
        }
    }
}
