import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../core/api.dart';
import '../core/db.dart';
import '../core/models.dart';

/// Talks to the main POS over the shop network (lib/hub/lan_server.dart).
class HubClient {
  HubClient(this.address, this.key, {http.Client? client}) : _http = client ?? http.Client();

  /// host or host:port; the till listens on 8787.
  final String address;
  final String key;
  final http.Client _http;
  String? session;

  static Uri uri(String address, String path, {String scheme = 'http'}) {
    final hasPort = RegExp(r':\d+$').hasMatch(address);
    return Uri.parse('$scheme://${hasPort ? address : '$address:8787'}/lan$path');
  }

  static Future<Map<String, dynamic>> pair(String address, String code, String name) async {
    final res = await http
        .post(uri(address, '/pair'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'code': code, 'name': name}))
        .timeout(const Duration(seconds: 8));
    return _decode(res) as Map<String, dynamic>;
  }

  Future<dynamic> send(String method, String path, [Object? body]) async {
    final req = http.Request(method, uri(address, path))
      ..headers.addAll({'Authorization': 'Bearer $key', 'Content-Type': 'application/json', 'X-Staff-Session': ?session});
    if (body != null) req.body = jsonEncode(body);
    return _decode(await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 10))));
  }

  Future<WebSocket> events() =>
      WebSocket.connect(uri(address, '/events', scheme: 'ws').toString(), headers: {'Authorization': 'Bearer $key'})
          .timeout(const Duration(seconds: 5));

  static dynamic _decode(http.Response res) {
    Map<String, dynamic>? json;
    try {
      json = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {}
    if (res.statusCode >= 400 || json == null || json['success'] == false) {
      throw ApiException(res.statusCode, json?['message'] ?? 'The till answered ${res.statusCode}.', json?['errorCode']);
    }
    return json['data'];
  }
}

/// The waiter tablet: no orders of its own, everything lives on the main POS. It keeps a copy
/// of the menu and the open orders, kept fresh by the till's live events.
class TabletState extends ChangeNotifier {
  TabletState(this.db) {
    themeMode = ThemeMode.values.byName(db.get('theme') ?? 'system');
    final hub = db.getJson('hub');
    if (hub != null) {
      client = HubClient(hub['address'], hub['key']);
      restaurantName = hub['restaurantName'] ?? 'Restaurant';
      refresh();
    }
  }

  final LocalDb db;
  HubClient? client;
  late ThemeMode themeMode;
  String restaurantName = 'Restaurant';
  Catalog catalog = Catalog({});
  Map<String, dynamic>? staff;
  Map<String, PosOrder> orders = {};
  Map<String, String> tableStatus = {};

  bool connected = false;
  String? problem;
  WebSocket? _socket;
  Timer? _retry;
  bool _disposed = false;

  bool get isPaired => client != null;
  String get staffName => staff?['name'] ?? '';
  String get staffRole => staff?['role'] ?? '';
  PosOrder? orderForTable(String tableId) => orders.values.where((o) => o.tableId == tableId).firstOrNull;

  Future<void> pair({required String address, required String code, required String name}) async {
    final a = address.trim();
    try {
      final r = await HubClient.pair(a, code.trim(), name.trim());
      db.setJson('hub', {'address': a, 'key': r['deviceKey'], 'restaurantName': r['restaurantName']});
      restaurantName = r['restaurantName'] ?? restaurantName;
      client = HubClient(a, r['deviceKey']);
    } on ApiException catch (e) {
      throw TabletError(e.message);
    } catch (_) {
      throw TabletError('Can’t reach the till at $a. Check the address and that this tablet is on the shop Wi-Fi.');
    }
    await refresh();
  }

  /// Pairs from the QR code the till shows: {"t":"pos-pair","a":["192.168.1.20:8787",...],"c":"123456"}.
  /// Tries each of the till's addresses (a PC can have Wi-Fi and cable) until one answers.
  Future<void> pairFromQr(String raw, {required String name}) async {
    final Map<String, dynamic> qr;
    try {
      qr = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      throw const TabletError('That is not a till pairing code. On the till, open Settings → Waiter tablets → Pair a tablet.');
    }
    if (qr['t'] != 'pos-pair' || qr['c'] is! String || qr['a'] is! List) {
      throw const TabletError('That is not a till pairing code. On the till, open Settings → Waiter tablets → Pair a tablet.');
    }
    TabletError? last;
    for (final address in (qr['a'] as List).cast<String>()) {
      try {
        return await pair(address: address, code: qr['c'], name: name);
      } on TabletError catch (e) {
        last = e;
        if (!e.message.startsWith('Can’t reach')) rethrow; // the till answered (e.g. code expired): stop
      }
    }
    throw last ?? const TabletError('Can’t reach the till. Check this tablet is on the shop Wi-Fi.');
  }

  void unpair() {
    _socket?.close();
    _retry?.cancel();
    client = null;
    staff = null;
    db.set('hub', null);
    notifyListeners();
  }

  Future<void> signIn(String pin) async {
    final r = await _call('POST', '/staff/pin-login', {'pin': pin}) as Map<String, dynamic>;
    client!.session = r['session'];
    staff = Map<String, dynamic>.from(r['staff']);
    await refresh();
  }

  void signOut() {
    client?.session = null;
    staff = null;
    notifyListeners();
  }

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    db.set('theme', mode.name);
    notifyListeners();
  }

  /// Pulls the menu (and, once signed in, tables and open orders) and opens the live feed.
  Future<void> refresh() async {
    if (client == null) return;
    try {
      final menu = await _call('GET', '/menu') as Map<String, dynamic>;
      catalog = Catalog({
        for (final e in menu.entries) e.key: {for (final r in (e.value as Map).entries) r.key as String: Map<String, dynamic>.from(r.value)},
      });
      if (staff != null) {
        final open = await _call('GET', '/orders') as List;
        orders = {for (final o in open) o['clientId'] as String: PosOrder.fromJson(Map<String, dynamic>.from(o))};
        await _loadTables();
      }
      connected = true;
      problem = null;
      _listen();
    } on TabletError catch (e) {
      _offline(e.message);
    }
    notifyListeners();
  }

  Future<void> _loadTables() async {
    final t = await _call('GET', '/tables') as List;
    tableStatus = {for (final r in t) r['id'] as String: r['status'] as String};
  }

  void _listen() {
    if (_socket != null || client == null) return;
    client!.events().then((s) {
      _socket = s;
      s.listen((m) {
        final e = jsonDecode(m as String) as Map<String, dynamic>;
        final o = PosOrder.fromJson(Map<String, dynamic>.from(e['order']));
        _track(o, closed: e['type'] == 'order.closed');
        if (staff != null) _loadTables().catchError((_) {}).whenComplete(() => _disposed ? null : notifyListeners());
        notifyListeners();
      }, onDone: _lostFeed, onError: (_) => _lostFeed());
    }).catchError((_) => _lostFeed());
  }

  void _lostFeed() {
    _socket = null;
    if (_disposed || client == null) return;
    _offline('Lost the connection to the till. Reconnecting…');
    notifyListeners();
  }

  void _offline(String message) {
    connected = false;
    problem = message;
    _retry?.cancel();
    _retry = Timer(const Duration(seconds: 3), refresh);
  }

  // ---- orders -------------------------------------------------------------------

  static Map<String, dynamic> _item(OrderLine l) =>
      {'menuItemId': l.menuItemId, 'qty': l.qty, 'modifierIds': [for (final m in l.modifiers) m.id], 'notes': l.notes};

  /// Sends the waiter's basket to the till (new order for the table, or onto its open one)
  /// and on to the kitchen and bar.
  /// [requestId] stays the same while the waiter retries the same basket, so a repeat after a
  /// lost reply doesn't send the dishes twice.
  Future<PosOrder> placeOrder({String? tableId, int? guests, required List<OrderLine> basket, String? requestId}) async {
    final r = await _call('POST', '/orders', {
      'tableId': tableId, 'guests': guests, 'send': true, 'items': basket.map(_item).toList(), 'requestId': ?requestId,
    });
    return _apply(r);
  }

  Future<void> markServed(PosOrder order, OrderLine line) async =>
      _apply(await _call('PUT', '/orders/${order.clientId}/items/${line.id}/status', {'status': 'Served'}));

  Future<void> voidLine(PosOrder order, OrderLine line, String reason, {String? managerPin}) async =>
      _apply(await _call('POST', '/orders/${order.clientId}/items/${line.id}/void', {'reason': reason, 'managerPin': ?managerPin}));

  /// Keeps the order list and its table's colour in step straight away (the till's own
  /// table list follows a moment later and also knows about printed bills).
  void _track(PosOrder o, {bool closed = false}) {
    if (closed) {
      orders.remove(o.clientId);
    } else {
      orders[o.clientId] = o;
    }
    if (o.tableId case final t?) tableStatus[t] = closed ? 'free' : (tableStatus[t] == 'bill' ? 'bill' : 'occupied');
  }

  PosOrder _apply(dynamic json) {
    final o = PosOrder.fromJson(Map<String, dynamic>.from(json));
    _track(o);
    notifyListeners();
    return o;
  }

  Future<dynamic> _call(String method, String path, [Object? body]) async {
    final c = client;
    if (c == null) throw const TabletError('This tablet is not connected to a till.', 'NOT_PAIRED');
    try {
      return await c.send(method, path, body);
    } on ApiException catch (e) {
      if (e.errorCode == 'NOT_PAIRED') {
        unpair();
      } else if (e.errorCode == 'SESSION') {
        signOut();
      }
      throw TabletError(e.message, e.errorCode);
    } on SocketException {
      throw const TabletError('Can’t reach the till. Check the shop Wi-Fi.');
    } on TimeoutException {
      throw const TabletError('The till is not answering.');
    } on http.ClientException {
      throw const TabletError('Can’t reach the till. Check the shop Wi-Fi.');
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _retry?.cancel();
    _socket?.close();
    super.dispose();
  }
}

class TabletError implements Exception {
  const TabletError(this.message, [this.code]);
  final String message;
  final String? code;
  @override
  String toString() => message;
}
