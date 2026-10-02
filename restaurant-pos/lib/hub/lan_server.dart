import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import '../core/models.dart';
import '../core/permissions.dart';
import '../state/pos_state.dart';

class _Session {
  _Session(this.staffId, this.tabletKey) : expires = DateTime.now().add(const Duration(hours: 12));
  final String staffId;
  final String tabletKey;
  final DateTime expires;
}

class _NotFound implements Exception {
  const _NotFound();
}

class _Denied implements Exception {
  const _Denied(this.message, [this.status = 403, this.code]);
  final String message;
  final int status;
  final String? code;
}

/// The main POS's server for waiter tablets on the shop network (design section 5.5). Plain
/// HTTP on the LAN: every call carries the tablet's key (`Authorization: Bearer`), order calls
/// also a staff session from a PIN login (`X-Staff-Session`). Answers use the cloud's envelope.
/// Everything runs against [PosState], so tablet orders are the till's own orders.
class LanServer {
  LanServer(this.state, {this.port = 8787, Future<String> Function(String name)? registerTablet, Future<void> Function(String id)? removeTablet})
      : _register = registerTablet ?? ((name) => _cloudRegister(state, name)),
        _unregister = removeTablet ?? ((id) => _cloudRemove(state, id));

  final PosState state;
  final int port;
  final Future<String> Function(String name) _register;
  final Future<void> Function(String id) _unregister;

  HttpServer? _server;
  StreamSubscription? _events;
  final _sockets = <WebSocket>{};
  final _sessions = <String, _Session>{};
  final _pinFailures = <String, (int, DateTime)>{};
  final _random = Random.secure();

  /// Why the server isn't running (e.g. the port is taken), shown in Settings.
  String? error;
  bool get running => _server != null;
  int? get boundPort => _server?.port;

  String? _pairCode;
  DateTime? _pairExpires;
  int _pairTries = 0;

  Future<void> start() async {
    try {
      _server = await HttpServer.bind(InternetAddress.anyIPv4, port);
      error = null;
    } on SocketException catch (e) {
      error = 'Tablets can’t connect: port $port is in use (${e.osError?.message ?? e.message}).';
      return;
    }
    _server!.listen(_handle);
    _events = state.events.listen((e) {
      final text = jsonEncode(e);
      for (final s in _sockets.toList()) {
        s.add(text);
      }
    });
  }

  Future<void> stop() async {
    await _events?.cancel();
    for (final s in _sockets.toList()) {
      await s.close();
    }
    await _server?.close(force: true);
    _server = null;
  }

  // ---- tablets ----------------------------------------------------------------

  /// key -> {id (cloud device id), name, pairedAt}
  Map<String, dynamic> get tablets => state.db.getJson('lan.tablets') ?? {};

  /// A 6-digit code, good for 10 minutes and one tablet, shown on the till next to its address.
  String newPairCode() {
    _pairCode = (100000 + _random.nextInt(900000)).toString();
    _pairExpires = DateTime.now().add(const Duration(minutes: 10));
    _pairTries = 0;
    return _pairCode!;
  }

  String? get pairCode => _pairExpires != null && DateTime.now().isBefore(_pairExpires!) ? _pairCode : null;

  Future<void> unpairTablet(String key) async {
    final all = tablets;
    final t = all.remove(key);
    state.db.setJson('lan.tablets', all);
    _sessions.removeWhere((_, s) => s.tabletKey == key);
    if (t != null) {
      try {
        await _unregister(t['id']);
      } catch (_) {} // ponytail: offline unpair isn't retried; deactivate it in the admin if it stays listed
    }
  }

  /// The till's addresses on the shop network, to type into a tablet.
  static Future<List<String>> addresses() async => [
        for (final i in await NetworkInterface.list(type: InternetAddressType.IPv4))
          for (final a in i.addresses)
            if (!a.isLoopback) a.address,
      ];

  static Future<String> _cloudRegister(PosState state, String name) async {
    final api = state.sync?.api;
    if (api == null) throw const PosError('The till is not paired with the cloud yet.');
    try {
      final r = await api.post('/api/pos/devices/tablets', {'deviceName': name, 'appVersion': api.appVersion}) as Map;
      return r['id'] as String;
    } on SocketException {
      throw const PosError('The till needs the internet to pair a tablet. Try again once it is back.');
    } on TimeoutException {
      throw const PosError('The cloud is not answering. Try again in a minute.');
    } catch (e) {
      throw PosError('$e');
    }
  }

  static Future<void> _cloudRemove(PosState state, String id) async => state.sync?.api.delete('/api/pos/devices/tablets/$id');

  // ---- requests ---------------------------------------------------------------

  Future<void> _handle(HttpRequest req) async {
    try {
      final seg = req.uri.pathSegments;
      if (seg.isEmpty || seg.first != 'lan') throw const _NotFound();
      final route = seg.sublist(1);
      if (req.method == 'POST' && route.length == 1 && route.first == 'pair') {
        return await _reply(req, 200, await _pair(await _body(req)));
      }

      final key = _bearer(req);
      if (key == null || !tablets.containsKey(key)) throw const _Denied('This tablet is not paired with the till.', 401, 'NOT_PAIRED');

      if (route.length == 1 && route.first == 'events') {
        if (!WebSocketTransformer.isUpgradeRequest(req)) throw const _NotFound();
        final socket = await WebSocketTransformer.upgrade(req);
        socket.pingInterval = const Duration(seconds: 20);
        _sockets.add(socket);
        socket.listen((_) {}, onDone: () => _sockets.remove(socket), onError: (_) => _sockets.remove(socket));
        return;
      }

      final body = req.method == 'GET' ? const <String, dynamic>{} : await _body(req);
      if (req.method == 'POST' && route.length == 2 && route[0] == 'staff' && route[1] == 'pin-login') {
        return await _reply(req, 200, await _pinLogin(key, body));
      }
      if (req.method == 'GET' && route.length == 1 && route.first == 'menu') return await _reply(req, 200, _menu());

      final who = _sessionStaff(req, key);
      final data = switch ((req.method, route)) {
        ('GET', ['tables']) => _tables(),
        ('GET', ['orders']) => [for (final o in state.openOrders) o.toJson()],
        ('POST', ['orders']) => await _createOrder(who, body),
        ('POST', ['orders', final id, 'items']) => await _addItems(who, _order(id), body),
        ('POST', ['orders', final id, 'send']) => await _send(who, _order(id)),
        ('PUT', ['orders', final id, 'items', final itemId, 'status']) => _setStatus(who, _order(id), itemId, body),
        ('POST', ['orders', final id, 'items', final itemId, 'void']) => await _void(who, _order(id), itemId, body),
        _ => throw const _NotFound(),
      };
      return await _reply(req, 200, data);
    } on _NotFound {
      return _fail(req, 404, 'Not found.');
    } on _Denied catch (e) {
      return _fail(req, e.status, e.message, e.code);
    } on PosError catch (e) {
      return _fail(req, 400, e.message, 'VALIDATION');
    } on FormatException {
      return _fail(req, 400, 'The request could not be read.', 'VALIDATION');
    } catch (e) {
      return _fail(req, 500, 'The till hit a problem: $e', 'INTERNAL_ERROR');
    }
  }

  Future<Map<String, dynamic>> _pair(Map<String, dynamic> body) async {
    if (!state.hasFeature('pos.waiter')) throw const _Denied('Waiter tablets are not switched on for this restaurant.', 403, 'FEATURE_DISABLED');
    final code = pairCode;
    if (code == null) throw const _Denied('Ask for a new pairing code on the till (Settings → Tablets).', 403, 'PAIR_CODE');
    if (body['code']?.toString().trim() != code) {
      if (++_pairTries >= 5) _pairExpires = null; // too many guesses: the code dies
      throw const _Denied('That pairing code is wrong.', 403, 'PAIR_CODE');
    }
    _pairExpires = null; // one tablet per code
    final name = (body['name'] as String?)?.trim();
    final tabletName = name == null || name.isEmpty ? 'Waiter tablet' : name;
    final cloudId = await _register(tabletName);
    final deviceKey = base64Url.encode(List.generate(32, (_) => _random.nextInt(256))).replaceAll('=', '');
    state.db.setJson('lan.tablets', {...tablets, deviceKey: {'id': cloudId, 'name': tabletName, 'pairedAt': DateTime.now().toIso8601String()}});
    return {'deviceKey': deviceKey, 'restaurantName': state.restaurantName};
  }

  Future<Map<String, dynamic>> _pinLogin(String key, Map<String, dynamic> body) async {
    final (fails, until) = _pinFailures[key] ?? (0, DateTime(2000));
    if (DateTime.now().isBefore(until)) throw const _Denied('Too many wrong PINs. Wait 30 seconds.', 429, 'LOCKED');
    final who = await state.findByPin(body['pin']?.toString() ?? '');
    if (who == null) {
      _pinFailures[key] = fails + 1 >= 5 ? (0, DateTime.now().add(const Duration(seconds: 30))) : (fails + 1, DateTime(2000));
      throw const _Denied('That PIN is not recognised.', 401, 'BAD_PIN');
    }
    _pinFailures.remove(key);
    _sessions.removeWhere((_, s) => DateTime.now().isAfter(s.expires));
    final token = base64Url.encode(List.generate(24, (_) => _random.nextInt(256)));
    _sessions[token] = _Session(who.id, key);
    return {'session': token, 'staff': {'id': who.id, 'name': who.name, 'role': who.role}};
  }

  StaffMember _sessionStaff(HttpRequest req, String key) {
    final s = _sessions[req.headers.value('x-staff-session') ?? ''];
    final who = s == null || s.tabletKey != key || DateTime.now().isAfter(s.expires)
        ? null
        : state.catalog.staff.where((m) => m.id == s.staffId).firstOrNull;
    if (who == null) throw const _Denied('Sign in again with your PIN.', 401, 'SESSION');
    return who;
  }

  Map<String, dynamic> _menu() => {
        for (final name in ['restaurant', 'categories', 'items', 'itemModifierGroups', 'modifierGroups', 'modifierOptions', 'tables'])
          name: state.catalog.collections[name] ?? {},
      };

  List<Map<String, dynamic>> _tables() => [
        for (final t in state.catalog.tables)
          {
            ...t.json,
            'orderId': state.orderForTable(t.id)?.clientId,
            'status': state.orderForTable(t.id) == null ? 'free' : (state.billPrinted.contains(t.id) ? 'bill' : 'occupied'),
          },
      ];

  PosOrder _order(String id) =>
      state.openOrders.where((o) => o.clientId == id).firstOrNull ?? (throw const _Denied('That order is closed or not on the till.', 404, 'ORDER_NOT_FOUND'));

  void _mayOrder(StaffMember who) {
    if (can(who.role, Perm.takeOrders) == Access.denied) throw _Denied('${who.role} accounts can’t take orders.');
  }

  List<OrderLine> _lines(Map<String, dynamic> body) {
    final items = body['items'] as List? ?? const [];
    return [
      for (final i in items.cast<Map>())
        state.lineFor(i['menuItemId'] as String,
            modifierIds: [for (final m in (i['modifierIds'] as List? ?? const [])) m as String],
            notes: i['notes'] as String?, qty: (i['qty'] as num?)?.toInt() ?? 1),
    ];
  }

  /// New order for a table (or takeaway). If the table already has one, the items go onto it.
  Future<Map<String, dynamic>> _createOrder(StaffMember who, Map<String, dynamic> body) async {
    _mayOrder(who);
    final lines = _lines(body); // validates everything before anything changes
    final tableId = body['tableId'] as String?;
    final table = tableId == null ? null : state.catalog.tables.where((t) => t.id == tableId).firstOrNull;
    if (tableId != null && table == null) throw const PosError('That table is not set up on the till.');
    final order = (table == null ? null : state.orderForTable(table.id)) ??
        state.startOrder(table: table, guests: (body['guests'] as num?)?.toInt(), customerName: body['customerName'] as String?, by: who);
    state.addLines(order, lines);
    if (body['send'] == true) await state.send(order);
    return order.toJson();
  }

  Future<Map<String, dynamic>> _addItems(StaffMember who, PosOrder order, Map<String, dynamic> body) async {
    _mayOrder(who);
    state.addLines(order, _lines(body));
    if (body['send'] == true) await state.send(order);
    return order.toJson();
  }

  Future<Map<String, dynamic>> _send(StaffMember who, PosOrder order) async {
    _mayOrder(who);
    await state.send(order);
    return order.toJson();
  }

  Map<String, dynamic> _setStatus(StaffMember who, PosOrder order, String lineId, Map<String, dynamic> body) {
    final status = body['status'] as String?;
    final allowed = switch (status) {
      'Ready' => isManager(who.role) || who.role == 'KitchenDisplay',
      'Served' => can(who.role, Perm.takeOrders) != Access.denied,
      _ => throw const PosError('Status must be Ready or Served.'),
    };
    if (!allowed) throw _Denied('${who.role} accounts can’t mark dishes $status.');
    state.setItemStatus(order, lineId, status!);
    return order.toJson();
  }

  /// Voids a sent dish. Roles that need approval send a manager's PIN with the request.
  Future<Map<String, dynamic>> _void(StaffMember who, PosOrder order, String lineId, Map<String, dynamic> body) async {
    final line = order.lines.where((l) => l.id == lineId).firstOrNull ?? (throw const PosError('That item is not on the order.'));
    final reason = (body['reason'] as String?)?.trim() ?? '';
    if (reason.isEmpty) throw const PosError('Give a reason for the void.');
    StaffMember? approvedBy;
    switch (can(who.role, Perm.voidItem)) {
      case Access.denied:
        throw _Denied('${who.role} accounts can’t void dishes.');
      case Access.managerPin:
        final manager = await state.findByPin(body['managerPin']?.toString() ?? '');
        if (manager == null || !isManager(manager.role)) throw const _Denied('A manager’s PIN is needed to void.', 403, 'MANAGER_PIN');
        approvedBy = manager;
      case Access.allowed:
        break;
    }
    if (line.status == 'Pending') {
      state.changeQty(order, line, -line.qty); // never reached the kitchen: just remove it
    } else {
      await state.voidLine(order, line, reason, approvedBy: approvedBy);
    }
    return order.toJson();
  }

  // ---- plumbing ---------------------------------------------------------------

  static String? _bearer(HttpRequest req) {
    final h = req.headers.value(HttpHeaders.authorizationHeader);
    return h != null && h.startsWith('Bearer ') ? h.substring(7) : null;
  }

  static Future<Map<String, dynamic>> _body(HttpRequest req) async {
    final text = await utf8.decodeStream(req);
    if (text.trim().isEmpty) return {};
    final json = jsonDecode(text);
    if (json is! Map<String, dynamic>) throw const FormatException();
    return json;
  }

  static Future<void> _reply(HttpRequest req, int status, Object? data) =>
      _write(req, status, {'success': true, 'statusCode': status, 'message': 'OK', 'data': data});

  static Future<void> _fail(HttpRequest req, int status, String message, [String? code]) =>
      _write(req, status, {'success': false, 'statusCode': status, 'message': message, 'errorCode': ?code});

  static Future<void> _write(HttpRequest req, int status, Map<String, dynamic> body) async {
    req.response
      ..statusCode = status
      ..headers.contentType = ContentType.json
      ..write(jsonEncode(body));
    await req.response.close();
  }
}
