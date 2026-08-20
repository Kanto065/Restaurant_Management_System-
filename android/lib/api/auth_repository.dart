import 'api_client.dart';
import 'token_store.dart';

class AuthRepository {
  AuthRepository({required this.apiClient, required this.tokenStore});

  final ApiClient apiClient;
  final TokenStore tokenStore;

  Future<DeviceSession?> restoreSession() async {
    await apiClient.restoreCachedToken();
    return tokenStore.currentSession();
  }

  /// Pairs this terminal using the id + secret an admin generated in the
  /// dashboard, then immediately logs in to get a working access token.
  Future<DeviceSession> pairAndLogin(String deviceId, String secret) async {
    final token = await apiClient.deviceLogin(deviceId, secret);
    await tokenStore.savePairing(deviceId, secret);
    await tokenStore.saveAccessToken(token.accessToken, token.accessTokenExpiresAt, token.restaurantName);
    await apiClient.restoreCachedToken();
    return DeviceSession(
      deviceId: deviceId,
      deviceSecret: secret,
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      restaurantName: token.restaurantName,
    );
  }

  Future<void> signOut() async {
    await tokenStore.clear();
    await apiClient.restoreCachedToken();
  }
}
