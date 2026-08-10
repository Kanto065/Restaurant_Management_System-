using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Platform.Application.Common;

namespace Platform.Infrastructure.Storage;

/// <summary>Production backend: any S3-compatible bucket (self-hosted MinIO, AWS S3, Cloudflare
/// R2, ...). The bucket is named "uploads" and given a public-read policy so its path-style
/// object URLs ("/uploads/{key}") line up exactly with the Caddy /uploads/* proxy route -
/// switching providers never changes the URLs the storefront/admin already reference.</summary>
public class S3FileStorage : IFileStorage
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private bool _bucketEnsured;
    private readonly SemaphoreSlim _ensureLock = new(1, 1);

    public S3FileStorage(IOptions<StorageOptions> options)
    {
        var s3Options = options.Value.S3;
        _bucket = s3Options.Bucket;

        _s3 = new AmazonS3Client(
            s3Options.AccessKey,
            s3Options.SecretKey,
            new AmazonS3Config
            {
                ServiceURL = s3Options.ServiceUrl,
                ForcePathStyle = true, // required for MinIO/self-hosted - {endpoint}/{bucket}/{key}, not {bucket}.{endpoint}/{key}
            });
    }

    public async Task<string> SaveAsync(Guid restaurantId, string fileName, byte[] content, string contentType, CancellationToken ct = default)
    {
        await EnsureBucketAsync(ct);

        var key = $"{restaurantId}/{fileName}";
        using var stream = new MemoryStream(content);
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
        }, ct);

        return $"/{_bucket}/{key}";
    }

    private async Task EnsureBucketAsync(CancellationToken ct)
    {
        if (_bucketEnsured) return;
        await _ensureLock.WaitAsync(ct);
        try
        {
            if (_bucketEnsured) return;

            var exists = await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_s3, _bucket);
            if (!exists)
            {
                await _s3.PutBucketAsync(new PutBucketRequest { BucketName = _bucket }, ct);
            }

            // Anonymous GET only - uploaded images are meant to be publicly viewable on the
            // storefront/admin, nothing else (no listing, no writes) is exposed.
            var policy = $$"""
                {
                  "Version": "2012-10-17",
                  "Statement": [{
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::{{_bucket}}/*"]
                  }]
                }
                """;
            await _s3.PutBucketPolicyAsync(_bucket, policy, ct);

            _bucketEnsured = true;
        }
        finally
        {
            _ensureLock.Release();
        }
    }
}
