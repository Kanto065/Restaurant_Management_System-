using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Platform.Infrastructure.Payments;

public class PaymentsOptions
{
    public const string SectionName = "Payments";

    /// <summary>
    /// Base64 of 32 random bytes (e.g. `openssl rand -base64 32`), from env
    /// Payments__EncryptionKey. Encrypts restaurants' Stripe secrets at rest. Kept outside the
    /// database on purpose, so a database dump alone doesn't reveal any Stripe keys.
    /// Changing or losing it makes every stored restaurant key unreadable (they must be re-entered).
    /// </summary>
    public string? EncryptionKey { get; set; }
}

public interface ISecretProtector
{
    bool IsConfigured { get; }
    string Protect(string plaintext);
    string Unprotect(string protectedValue);
}

public class SecretNotConfiguredException()
    : Exception("Payments:EncryptionKey is not configured on the server, so restaurant Stripe keys can't be stored.");

/// <summary>AES-256-GCM. Output format: "v1:" + base64(nonce[12] | tag[16] | ciphertext).</summary>
public class AesGcmSecretProtector : ISecretProtector
{
    private const string Prefix = "v1:";
    private readonly byte[]? _key;

    public AesGcmSecretProtector(IOptions<PaymentsOptions> options)
    {
        var configured = options.Value.EncryptionKey;
        if (string.IsNullOrWhiteSpace(configured))
            return;

        var key = Convert.FromBase64String(configured.Trim());
        if (key.Length != 32)
            throw new InvalidOperationException("Payments:EncryptionKey must be base64 of exactly 32 bytes.");
        _key = key;
    }

    public bool IsConfigured => _key is not null;

    public string Protect(string plaintext)
    {
        var key = _key ?? throw new SecretNotConfiguredException();
        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plainBytes.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];

        using var aes = new AesGcm(key, tag.Length);
        aes.Encrypt(nonce, plainBytes, cipher, tag);

        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string Unprotect(string protectedValue)
    {
        var key = _key ?? throw new SecretNotConfiguredException();
        if (!protectedValue.StartsWith(Prefix))
            throw new CryptographicException("Unknown protected value format.");

        var bytes = Convert.FromBase64String(protectedValue[Prefix.Length..]);
        var nonceSize = AesGcm.NonceByteSizes.MaxSize;
        var tagSize = AesGcm.TagByteSizes.MaxSize;
        var nonce = bytes.AsSpan(0, nonceSize);
        var tag = bytes.AsSpan(nonceSize, tagSize);
        var cipher = bytes.AsSpan(nonceSize + tagSize);
        var plain = new byte[cipher.Length];

        using var aes = new AesGcm(key, tagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
