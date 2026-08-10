using Microsoft.AspNetCore.Hosting;
using Platform.Application.Common;

namespace Platform.Infrastructure.Storage;

/// <summary>Dev-only backend: writes under wwwroot/uploads/{restaurantId}/{fileName},
/// served back by the API's own static file middleware.</summary>
public class LocalFileStorage(IWebHostEnvironment env) : IFileStorage
{
    public async Task<string> SaveAsync(Guid restaurantId, string fileName, byte[] content, string contentType, CancellationToken ct = default)
    {
        var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        var dir = Path.Combine(webRoot, "uploads", restaurantId.ToString());
        Directory.CreateDirectory(dir);

        var filePath = Path.Combine(dir, fileName);
        await File.WriteAllBytesAsync(filePath, content, ct);

        return $"/uploads/{restaurantId}/{fileName}";
    }
}
