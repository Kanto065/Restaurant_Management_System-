import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/crypto.dart';

// Fixtures produced by the backend's own PinHasher and LicenceSigner (Platform.Infrastructure.Pos),
// so these prove the till verifies exactly what the cloud issues.
const pinHash = r'pbkdf2-sha256$10000$F8b9IFsGeQ5ua5W9SW+wvQ==$eFZbxua/wuwTjCDu9fwEngLCQM6tEt8QzKRd/E5rqII=';
const payload =
    'eyJyZXN0YXVyYW50SWQiOiIxMTExMTExMS0yMjIyLTMzMzMtNDQ0NC01NTU1NTU1NTU1NTUiLCJmZWF0dXJlcyI6eyJwb3MiOnRydWUsInBvcy5yZWZ1bmRzIjp0cnVlfSwic3Vic2NyaXB0aW9uRW5kIjoiMjAyNi0xMS0wMVQwMDowMDowMCswMDowMCIsImdyYWNlRGF5cyI6NywiYWNjZXNzIjoiQWN0aXZlIiwiaXNzdWVkQXQiOiIyMDI2LTEwLTAyVDEyOjAwOjAwKzAwOjAwIn0';
const signature = 'p14gxVrFVqGkrINL1aXkYmW7k7QzXPnxTP9cEB4vsQ4-2DDS0T9ACB4ysyhHa8bB-MzVr49O1VbthICMd0_cYA';
const publicKey =
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzueLMOH38Ytt6AavKbaVhYs1QftwTa8GoFk2ZwMH/tBQ4vlqXLKPlIhUoW2qKqWm+M/mTODr93DO7oa/K9tp7w==';

void main() {
  test('PIN hashes from the cloud verify only for the right PIN', () {
    expect(verifyPin('2468', pinHash), isTrue);
    expect(verifyPin('2469', pinHash), isFalse);
    expect(verifyPin('2468', null), isFalse);
    expect(verifyPin('2468', 'garbage'), isFalse);
  });

  test('cloud licence signature verifies, and a tampered payload does not', () {
    expect(verifyLicenceSignature(payload: payload, signature: signature, publicKeySpki: publicKey), isTrue);
    final tampered = payload.replaceFirst('QWN0aXZl', 'RXhwaXJl'); // "Active" -> "Expire"
    expect(verifyLicenceSignature(payload: tampered, signature: signature, publicKeySpki: publicKey), isFalse);
    expect(decodeLicencePayload(payload)['graceDays'], 7);
  });
}
