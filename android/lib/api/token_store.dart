import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// What the app needs to authenticate a paired device: its id/secret (for
/// re-login when the access token expires) plus the current access token and
/// when it stops being valid. Mirrors TokenStore.kt / DeviceSession.kt.
class DeviceSession {
  final String deviceId;
  final String deviceSecret;
  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String restaurantName;

  DeviceSession({
    required this.deviceId,
    required this.deviceSecret,
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.restaurantName,
  });

  bool get isAccessTokenExpired =>
      DateTime.now().isAfter(accessTokenExpiresAt.subtract(const Duration(seconds: 30)));
}

/// Persists device pairing + the current access token across restarts using
/// the platform keystore/keychain (flutter_secure_storage) - the secret never
/// leaves the device after pairing except over HTTPS to /api/auth/device/login.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _kDeviceId = 'device_id';
  static const _kDeviceSecret = 'device_secret';
  static const _kAccessToken = 'access_token';
  static const _kAccessTokenExpiresAt = 'access_token_expires_at';
  static const _kRestaurantName = 'restaurant_name';

  Future<DeviceSession?> currentSession() async {
    final all = await _storage.readAll();
    final deviceId = all[_kDeviceId];
    final deviceSecret = all[_kDeviceSecret];
    final accessToken = all[_kAccessToken];
    final expiresAtRaw = all[_kAccessTokenExpiresAt];
    final restaurantName = all[_kRestaurantName];
    if (deviceId == null || deviceSecret == null || accessToken == null || expiresAtRaw == null || restaurantName == null) {
      return null;
    }
    return DeviceSession(
      deviceId: deviceId,
      deviceSecret: deviceSecret,
      accessToken: accessToken,
      accessTokenExpiresAt: DateTime.parse(expiresAtRaw),
      restaurantName: restaurantName,
    );
  }

  Future<void> savePairing(String deviceId, String deviceSecret) async {
    await _storage.write(key: _kDeviceId, value: deviceId);
    await _storage.write(key: _kDeviceSecret, value: deviceSecret);
  }

  Future<void> saveAccessToken(String accessToken, DateTime expiresAt, String restaurantName) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kAccessTokenExpiresAt, value: expiresAt.toIso8601String());
    await _storage.write(key: _kRestaurantName, value: restaurantName);
  }

  /// Forgets everything, including the paired device secret - used when
  /// signing the terminal out.
  Future<void> clear() => _storage.deleteAll();
}
