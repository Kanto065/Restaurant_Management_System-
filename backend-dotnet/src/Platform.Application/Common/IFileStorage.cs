namespace Platform.Application.Common;

/// <summary>Object storage for admin-uploaded files (hero slides, logo, etc), keyed the same
/// way an S3 bucket keys objects - a flat "{restaurantId}/{fileName}" path per file. Swappable
/// between a local-disk implementation (dev) and an S3-compatible one (production) behind this
/// interface so callers never know which backend is in use.</summary>
public interface IFileStorage
{
    /// <summary>Stores the bytes under "{restaurantId}/{fileName}" and returns the public URL
    /// to serve them back at (always a root-relative path like "/uploads/{restaurantId}/{fileName}",
    /// so it resolves against whichever domain the caller's request came in on).</summary>
    Task<string> SaveAsync(Guid restaurantId, string fileName, byte[] content, string contentType, CancellationToken ct = default);
}
