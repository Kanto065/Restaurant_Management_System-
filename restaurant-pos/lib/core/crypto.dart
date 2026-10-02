import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

/// Checks a PIN against the cloud's hash, format "pbkdf2-sha256$iterations$saltB64$hashB64"
/// (backend Platform.Infrastructure.Pos.PinHasher).
bool verifyPin(String pin, String? stored) {
  final parts = stored?.split(r'$');
  if (parts == null || parts.length != 4 || parts[0] != 'pbkdf2-sha256') return false;
  final iterations = int.tryParse(parts[1]);
  if (iterations == null) return false;
  final salt = base64Decode(parts[2]);
  final expected = base64Decode(parts[3]);
  final kdf = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64))..init(Pbkdf2Parameters(salt, iterations, expected.length));
  final actual = kdf.process(Uint8List.fromList(utf8.encode(pin)));
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff == 0;
}

Uint8List _fromBase64Url(String s) => base64Url.decode(base64Url.normalize(s));

/// Verifies a cloud licence: ECDSA P-256 / SHA-256, signature in IEEE P1363 form (r || s),
/// public key as SubjectPublicKeyInfo whose last 65 bytes are the uncompressed point.
bool verifyLicenceSignature({required String payload, required String signature, required String publicKeySpki}) {
  try {
    final spki = base64Decode(publicKeySpki);
    if (spki.length < 65 || spki[spki.length - 65] != 0x04) return false;
    final domain = ECDomainParameters('secp256r1');
    final point = domain.curve.decodePoint(spki.sublist(spki.length - 65));
    final sig = _fromBase64Url(signature);
    if (sig.length != 64) return false;
    BigInt big(List<int> bytes) => BigInt.parse(bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join(), radix: 16);
    final signer = Signer('SHA-256/ECDSA')..init(false, PublicKeyParameter<ECPublicKey>(ECPublicKey(point, domain)));
    return signer.verifySignature(_fromBase64Url(payload), ECSignature(big(sig.sublist(0, 32)), big(sig.sublist(32))));
  } catch (_) {
    return false;
  }
}

Map<String, dynamic> decodeLicencePayload(String payload) =>
    jsonDecode(utf8.decode(_fromBase64Url(payload))) as Map<String, dynamic>;
