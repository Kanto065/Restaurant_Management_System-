using System.Security.Cryptography;
using System.Text;

namespace Platform.Infrastructure.Pos;

/// <summary>
/// POS PIN hashes, format "pbkdf2-sha256${iterations}${saltB64}${hashB64}". Kept simple and
/// documented because the hub (Dart) verifies the same strings offline.
/// ponytail: a 4-6 digit PIN is brute-forceable by whoever holds the hash whatever the KDF;
/// the hub DB is the trust boundary, the iterations only slow casual attempts.
/// </summary>
public static class PinHasher
{
    private const int Iterations = 10_000;

    public static bool IsValidPin(string? pin) => pin is { Length: >= 4 and <= 6 } && pin.All(char.IsAsciiDigit);

    public static string Hash(string pin)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(pin), salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string pin, string? stored)
    {
        var parts = stored?.Split('$');
        if (parts is not { Length: 4 } || parts[0] != "pbkdf2-sha256" || !int.TryParse(parts[1], out var iterations))
            return false;
        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(pin), Convert.FromBase64String(parts[2]),
            iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
