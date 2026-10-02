using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Platform.Infrastructure.Persistence;

namespace Platform.Infrastructure.Pos;

public record LicencePayload(
    Guid RestaurantId, Dictionary<string, bool> Features, DateTimeOffset? SubscriptionEnd, int GraceDays,
    string Access, DateTimeOffset IssuedAt);

/// <summary>Payload is base64url JSON; Signature is ECDSA P-256 / SHA-256 over the payload
/// bytes. The hub pins PublicKey (SPKI, base64) at pairing and checks offline.</summary>
public record SignedLicence(string Payload, string Signature, string PublicKey);

public class LicenceSigner
{
    private readonly ECDsa _key;

    /// <summary>Uses PosLicence:PrivateKeyPem when set; otherwise derives a stable key from the
    /// JWT signing key so no new secret is needed to deploy.
    /// ponytail: derived key rotates with Jwt:SigningKey (hubs then re-pair); set the PEM to decouple.</summary>
    public LicenceSigner(IConfiguration configuration)
    {
        _key = ECDsa.Create();
        var pem = configuration["PosLicence:PrivateKeyPem"];
        if (!string.IsNullOrWhiteSpace(pem))
            _key.ImportFromPem(pem);
        else
            _key.ImportParameters(new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256,
                D = SHA256.HashData(Encoding.UTF8.GetBytes("pos-licence:" + configuration["Jwt:SigningKey"])),
            });
    }

    public string PublicKey => Convert.ToBase64String(_key.ExportSubjectPublicKeyInfo());

    public SignedLicence Sign(LicencePayload payload)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonSerializerOptions.Web);
        return new SignedLicence(Base64Url(bytes), Base64Url(_key.SignData(bytes, HashAlgorithmName.SHA256)), PublicKey);
    }

    public static bool Verify(SignedLicence licence)
    {
        using var key = ECDsa.Create();
        key.ImportSubjectPublicKeyInfo(Convert.FromBase64String(licence.PublicKey), out _);
        return key.VerifyData(FromBase64Url(licence.Payload), FromBase64Url(licence.Signature), HashAlgorithmName.SHA256);
    }

    public async Task<SignedLicence> IssueAsync(AppDbContext db, FeatureService features, Guid restaurantId, CancellationToken ct = default)
    {
        var orgId = await db.Restaurants.IgnoreQueryFilters().Where(r => r.Id == restaurantId)
            .Select(r => r.OrganizationId).FirstAsync(ct);
        var sub = await SubscriptionRules.CurrentAsync(db, orgId, ct);
        var now = DateTimeOffset.UtcNow;
        return Sign(new LicencePayload(
            restaurantId, await features.GetMapAsync(restaurantId, ct),
            sub?.CurrentPeriodEnd ?? sub?.TrialEndsAt, sub?.GraceDays ?? 0,
            SubscriptionRules.Evaluate(sub, now).ToString(), now));
    }

    private static string Base64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
