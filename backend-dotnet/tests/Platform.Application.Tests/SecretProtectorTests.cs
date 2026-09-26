using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Platform.Infrastructure.Payments;
using Xunit;

namespace Platform.Application.Tests;

public class SecretProtectorTests
{
    private static AesGcmSecretProtector Create(string? key) =>
        new(Options.Create(new PaymentsOptions { EncryptionKey = key }));

    private static string NewKey() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    [Fact]
    public void RoundTrips_AndDoesNotStorePlaintext()
    {
        var protector = Create(NewKey());

        var protectedValue = protector.Protect("sk_test_abc123");

        Assert.DoesNotContain("sk_test", protectedValue);
        Assert.Equal("sk_test_abc123", protector.Unprotect(protectedValue));
    }

    [Fact]
    public void SamePlaintext_EncryptsDifferentlyEachTime()
    {
        var protector = Create(NewKey());

        Assert.NotEqual(protector.Protect("whsec_x"), protector.Protect("whsec_x"));
    }

    [Fact]
    public void DifferentKey_CannotDecrypt()
    {
        var protectedValue = Create(NewKey()).Protect("sk_live_secret");

        Assert.ThrowsAny<CryptographicException>(() => Create(NewKey()).Unprotect(protectedValue));
    }

    [Fact]
    public void NotConfigured_RefusesToProtect()
    {
        var protector = Create(null);

        Assert.False(protector.IsConfigured);
        Assert.Throws<SecretNotConfiguredException>(() => protector.Protect("sk_test_x"));
    }

    [Fact]
    public void WrongKeyLength_FailsAtStartup()
    {
        Assert.Throws<InvalidOperationException>(() => Create(Convert.ToBase64String(new byte[16])));
    }
}
