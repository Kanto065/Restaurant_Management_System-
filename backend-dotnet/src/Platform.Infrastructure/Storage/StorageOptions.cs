namespace Platform.Infrastructure.Storage;

public class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>"Local" (default, wwwroot/uploads on disk) or "S3" (any S3-compatible bucket -
    /// AWS S3, Cloudflare R2, or a self-hosted MinIO instance).</summary>
    public string Provider { get; set; } = "Local";

    public S3StorageOptions S3 { get; set; } = new();
}

public class S3StorageOptions
{
    /// <summary>e.g. http://minio:9000 for the in-cluster MinIO service, or a real AWS/R2 endpoint.</summary>
    public string ServiceUrl { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
    /// <summary>Bucket name - deliberately "uploads" in production so its S3 path-style URL
    /// (/uploads/{key}) lines up exactly with the existing /uploads/* Caddy route, with zero
    /// URL-rewriting needed when switching providers.</summary>
    public string Bucket { get; set; } = "uploads";
}
