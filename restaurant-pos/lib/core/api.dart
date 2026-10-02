import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.statusCode, this.message, [this.errorCode]);
  final int statusCode;
  final String message;
  final String? errorCode;

  /// The cloud understood and refused the request; retrying the same body won't help.
  bool get isRejection => statusCode >= 400 && statusCode < 500 && statusCode != 401 && statusCode != 408 && statusCode != 429;

  @override
  String toString() => message;
}

/// Talks to the platform API as this till's paired device (POST /api/auth/device/login).
class CloudApi {
  CloudApi({required this.baseUrl, required this.deviceId, required this.secret, http.Client? client, this.appVersion = '2.0.0'})
      : _http = client ?? http.Client();

  final String baseUrl;
  final String deviceId;
  final String secret;
  final String appVersion;
  final http.Client _http;
  String? _token;
  DateTime _tokenExpires = DateTime(2000);
  String? restaurantName;

  Future<void> login() async {
    final res = await _http
        .post(Uri.parse('$baseUrl/api/auth/device/login'),
            headers: {'Content-Type': 'application/json'}, body: jsonEncode({'deviceId': deviceId, 'secret': secret}))
        .timeout(const Duration(seconds: 15));
    final data = _decode(res);
    _token = data['accessToken'];
    _tokenExpires = DateTime.parse(data['expiresAt']).subtract(const Duration(minutes: 2));
    restaurantName = data['restaurantName'];
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, Object body) => _send('POST', path, body);
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body, bool retried = false]) async {
    if (_token == null || DateTime.now().isAfter(_tokenExpires)) await login();
    final req = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll({'Authorization': 'Bearer $_token', 'Content-Type': 'application/json', 'X-App-Version': appVersion});
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 30)));
    if (res.statusCode == 401 && !retried) {
      _token = null; // signed out or expired: log in again once (a deactivated till fails here for good)
      return _send(method, path, body, true);
    }
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    Map<String, dynamic>? json;
    try {
      json = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {}
    if (res.statusCode >= 400 || json == null || json['success'] == false) {
      throw ApiException(res.statusCode, json?['message'] ?? 'The server answered ${res.statusCode}.', json?['errorCode']);
    }
    return json['data'];
  }
}
