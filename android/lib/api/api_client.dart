import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';
import 'token_store.dart';

/// Base URL for the .NET backend, matching BuildConfig.API_BASE_URL in the
/// archived Kotlin app (android/app/build.gradle.kts).
const apiBaseUrl = 'https://api.porttennanttandoori.co.uk';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

/// Thin REST client: attaches the cached bearer token to every request except
/// device-login itself, and on a single 401 re-logs in with the stored
/// device id/secret and retries once - mirrors AuthInterceptor +
/// DeviceAuthenticator from the Kotlin app, minus OkHttp's Authenticator
/// abstraction (http package has no equivalent, so this is done by hand).
class ApiClient {
  ApiClient({required TokenStore tokenStore, http.Client? httpClient})
      : _tokenStore = tokenStore,
        _http = httpClient ?? http.Client();

  final TokenStore _tokenStore;
  final http.Client _http;

  String? _cachedToken;

  /// Restores the in-memory token cache from disk on process start, so the
  /// very first request after a restart already carries a bearer token.
  Future<void> restoreCachedToken() async {
    _cachedToken = (await _tokenStore.currentSession())?.accessToken;
  }

  Future<DeviceTokenResponse> deviceLogin(String deviceId, String secret) async {
    final response = await _http.post(
      Uri.parse('$apiBaseUrl/api/auth/device/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'deviceId': deviceId, 'secret': secret}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_extractErrorMessage(response.body) ?? 'Invalid device ID or secret.',
          statusCode: response.statusCode);
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final parsed = ApiResponse<DeviceTokenResponse>.fromJson(
        json, (d) => DeviceTokenResponse.fromJson(d as Map<String, dynamic>));
    final token = parsed.data;
    if (token == null) throw ApiException('Empty response from server.');
    return token;
  }

  Future<T> _request<T>(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    required T Function(dynamic) parseData,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$apiBaseUrl$path').replace(
      queryParameters: query?.map((k, v) => MapEntry(k, v)) ?? const {},
    );
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_cachedToken != null) headers['Authorization'] = 'Bearer $_cachedToken';

    late http.Response response;
    switch (method) {
      case 'GET':
        response = await _http.get(uri, headers: headers);
        break;
      case 'PUT':
        response = await _http.put(uri, headers: headers, body: body == null ? null : jsonEncode(body));
        break;
      default:
        throw UnsupportedError(method);
    }

    if (response.statusCode == 401 && !isRetry) {
      final relogged = await _reLogin();
      if (relogged) {
        return _request(method, path, query: query, body: body, parseData: parseData, isRetry: true);
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_extractErrorMessage(response.body) ?? 'Request failed (${response.statusCode}).',
          statusCode: response.statusCode);
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final parsed = ApiResponse<T>.fromJson(json, parseData);
    if (parsed.data == null) throw ApiException('Empty response from server.');
    return parsed.data as T;
  }

  /// A device token is short-lived with no refresh token - when a request
  /// 401s, re-login with the stored device id/secret and retry once.
  Future<bool> _reLogin() async {
    final session = await _tokenStore.currentSession();
    if (session == null) return false;
    try {
      final token = await deviceLogin(session.deviceId, session.deviceSecret);
      await _tokenStore.saveAccessToken(token.accessToken, token.accessTokenExpiresAt, token.restaurantName);
      _cachedToken = token.accessToken;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// For long-lived connections that supply their own bearer token up front
  /// (the SSE stream - see OrderListener) rather than going through
  /// _request()'s reactive on-401 retry: proactively re-logs in if the
  /// stored access token is already expired (or about to be), so callers
  /// never open a connection with a token that's guaranteed to be rejected.
  /// Falls back to whatever token is on disk if re-login itself fails
  /// (e.g. transiently offline) so a retry loop can still keep trying.
  Future<String?> ensureFreshAccessToken() async {
    final session = await _tokenStore.currentSession();
    if (session == null) return null;
    if (!session.isAccessTokenExpired) return session.accessToken;
    final relogged = await _reLogin();
    return relogged ? _cachedToken : session.accessToken;
  }

  /// Unconditionally re-logs in, ignoring the stored token's expiry -
  /// for a caller that got a definitive 401 straight from the server (see
  /// SseUnauthorizedException) rather than inferring staleness from the
  /// client-side clock, since a token can be rejected for reasons the
  /// client can't predict (revoked device, backend restart, clock drift).
  Future<String?> forceReLogin() async {
    final relogged = await _reLogin();
    if (relogged) return _cachedToken;
    final session = await _tokenStore.currentSession();
    return session?.accessToken;
  }

  Future<OrderListPage> listOrders({int pageSize = 100}) => _request(
        'GET',
        '/api/admin/orders',
        query: {'pageSize': '$pageSize'},
        parseData: (d) => OrderListPage.fromJson(d as Map<String, dynamic>),
      );

  Future<OrderListPage> searchOrders({
    String? status,
    String? paymentStatus,
    String? search,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int pageSize = 25,
  }) =>
      _request(
        'GET',
        '/api/admin/orders',
        query: {
          if (status != null) 'status': status,
          if (paymentStatus != null) 'paymentStatus': paymentStatus,
          if (search != null && search.isNotEmpty) 'search': search,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
          'page': '$page',
          'pageSize': '$pageSize',
        },
        parseData: (d) => OrderListPage.fromJson(d as Map<String, dynamic>),
      );

  Future<OrderDetail> getOrder(String id) => _request(
        'GET',
        '/api/admin/orders/$id',
        parseData: (d) => OrderDetail.fromJson(d as Map<String, dynamic>),
      );

  Future<OrderDetail> updateOrderStatus(String id, String status, {String? note}) => _request(
        'PUT',
        '/api/admin/orders/$id/status',
        body: {'status': status, if (note != null) 'note': note},
        parseData: (d) => OrderDetail.fromJson(d as Map<String, dynamic>),
      );

  Future<OrderDetail> updatePaymentStatus(String id, String paymentStatus) => _request(
        'PUT',
        '/api/admin/orders/$id/payment-status',
        body: {'paymentStatus': paymentStatus},
        parseData: (d) => OrderDetail.fromJson(d as Map<String, dynamic>),
      );

  Future<List<OrderStatusDefinition>> listOrderStatusDefinitions() => _request(
        'GET',
        '/api/admin/order-statuses',
        parseData: (d) => (d as List).map((e) => OrderStatusDefinition.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<PaymentStatusDefinition>> listPaymentStatusDefinitions() => _request(
        'GET',
        '/api/admin/payment-statuses',
        parseData: (d) => (d as List).map((e) => PaymentStatusDefinition.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<String> getRestaurantCurrency() => _request(
        'GET',
        '/api/admin/restaurant',
        parseData: (d) => (d as Map<String, dynamic>)['currency'] as String? ?? 'GBP',
      );

  String? _extractErrorMessage(String body) {
    try {
      final json = jsonDecode(body) as Map<String, dynamic>;
      return json['message'] as String?;
    } catch (_) {
      return null;
    }
  }
}
