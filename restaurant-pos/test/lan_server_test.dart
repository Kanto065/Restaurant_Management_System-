import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/hub/lan_server.dart';
import 'package:my_pos/state/pos_state.dart';

import 'pos_flow_test.dart' show snapshot;

// Hashes made by the backend's PinHasher: Maya (Manager) 2468, Sam (Waiter) 1357.
const _maya = r'pbkdf2-sha256$10000$F8b9IFsGeQ5ua5W9SW+wvQ==$eFZbxua/wuwTjCDu9fwEngLCQM6tEt8QzKRd/E5rqII=';
const waiterPinHash = r'pbkdf2-sha256$10000$5wdCnydK6KxWn+3deznJdQ==$hH3oo8G38Ionba4SAutEn9ZRpx3BldEFBVHoqW9RgJE=';

void main() {
  late PosState state;
  late LanServer server;
  late String base;
  final printed = <String>[];
  final registered = <String>[];

  setUp(() async {
    final db = LocalDb.memory();
    applyConfig(db, {
      ...snapshot(),
      'staff': [
        {'id': 's1', 'userId': 'u1', 'fullName': 'Maya Patel', 'role': 'Manager', 'pinHash': _maya},
        {'id': 's3', 'userId': 'u3', 'fullName': 'Sam Okafor', 'role': 'Waiter', 'pinHash': waiterPinHash},
      ],
      'printers': [
        {'name': 'Kitchen', 'role': 'Kitchen', 'connection': 'Network', 'address': '10.0.0.5'},
      ],
    }, full: true);
    state = PosState(db)..printSender = (p, bytes) async => printed.add(latin1.decode(bytes, allowInvalid: true));
    server = LanServer(state, port: 0, registerTablet: (name) async {
      registered.add(name);
      return 'cloud-${registered.length}';
    });
    await server.start();
    base = 'http://127.0.0.1:${server.boundPort}/lan';
  });

  tearDown(() => server.stop());

  Future<(int, Map<String, dynamic>)> call(String method, String path, {Object? body, String? key, String? session}) async {
    final client = HttpClient();
    final req = await client.openUrl(method, Uri.parse('$base$path'));
    if (key != null) req.headers.set('Authorization', 'Bearer $key');
    if (session != null) req.headers.set('X-Staff-Session', session);
    if (body != null) req.write(jsonEncode(body));
    final res = await req.close();
    final json = jsonDecode(await utf8.decodeStream(res)) as Map<String, dynamic>;
    client.close();
    return (res.statusCode, json);
  }

  test('pairing needs the current code, once; unpaired tablets are refused', () async {
    expect((await call('POST', '/pair', body: {'code': '000000'})).$1, 403); // no code issued yet
    final code = server.newPairCode();
    expect((await call('POST', '/pair', body: {'code': 'nope'})).$2['errorCode'], 'PAIR_CODE');
    final (status, ok) = await call('POST', '/pair', body: {'code': code, 'name': 'Tablet A'});
    expect(status, 200);
    expect(registered, ['Tablet A']);
    expect(server.tablets.values.single['id'], 'cloud-1');
    expect((await call('POST', '/pair', body: {'code': code})).$1, 403); // used up

    expect((await call('GET', '/menu')).$1, 401);
    expect((await call('GET', '/menu', key: 'made-up')).$1, 401);
    final menu = (await call('GET', '/menu', key: ok['data']['deviceKey'])).$2['data'] as Map;
    expect(menu.keys, isNot(contains('staff'))); // PIN hashes never leave the till
    expect((menu['items'] as Map).length, 3);

    await server.unpairTablet(ok['data']['deviceKey']);
    expect((await call('GET', '/menu', key: ok['data']['deviceKey'])).$1, 401);
  });

  test('waiter flow: PIN, order a table, kitchen ticket, live events, served; void needs a manager', () async {
    final key = (await call('POST', '/pair', body: {'code': server.newPairCode()})).$2['data']['deviceKey'] as String;
    expect((await call('GET', '/tables', key: key)).$2['errorCode'], 'SESSION');
    expect((await call('POST', '/staff/pin-login', key: key, body: {'pin': '9999'})).$1, 401);
    final login = (await call('POST', '/staff/pin-login', key: key, body: {'pin': '1357'})).$2['data'];
    expect(login['staff']['role'], 'Waiter');
    final session = login['session'] as String;

    final socket = await WebSocket.connect('ws://127.0.0.1:${server.boundPort}/lan/events', headers: {'Authorization': 'Bearer $key'});
    final events = <Map>[];
    socket.listen((m) => events.add(jsonDecode(m)));

    // A missing required choice is refused and nothing is created.
    final bad = await call('POST', '/orders', key: key, session: session, body: {
      'tableId': 't1', 'items': [{'menuItemId': 'i1', 'qty': 1}],
    });
    expect(bad.$2['message'], contains('Pick Rice'));
    expect(state.openOrders, isEmpty);

    final (status, created) = await call('POST', '/orders', key: key, session: session, body: {
      'tableId': 't1', 'guests': 3, 'send': true,
      'items': [
        {'menuItemId': 'i1', 'qty': 2, 'modifierIds': ['o1'], 'notes': 'Mild', 'unitPrice': 0.01}, // a sent price is ignored
      ],
    });
    expect(status, 200);
    final order = created['data'] as Map;
    expect(order['staffName'], 'Sam Okafor');
    expect((order['lines'] as List).single['unitPence'], 995);
    expect((order['lines'] as List).single['status'], 'Sent');
    expect(printed.single, allOf(contains('TABLE 1'), contains('2 x Chicken Tikka'), contains('+ Pilau'), contains('** Mild')));
    expect(state.orderForTable('t1')!.clientId, order['clientId']); // it's the till's own order

    final tables = (await call('GET', '/tables', key: key, session: session)).$2['data'] as List;
    expect(tables.firstWhere((t) => t['id'] == 't1')['status'], 'occupied');

    // Second round on the same table goes onto the same order.
    final again = await call('POST', '/orders', key: key, session: session, body: {'tableId': 't1', 'items': [{'menuItemId': 'i2'}]});
    expect(again.$2['data']['clientId'], order['clientId']);

    final lineId = (order['lines'] as List).single['id'];
    final id = order['clientId'];
    expect((await call('PUT', '/orders/$id/items/$lineId/status', key: key, session: session, body: {'status': 'Ready'})).$1, 403);
    expect((await call('PUT', '/orders/$id/items/$lineId/status', key: key, session: session, body: {'status': 'Served'})).$1, 200);

    expect((await call('POST', '/orders/$id/items/$lineId/void', key: key, session: session, body: {'reason': 'Cold'})).$2['errorCode'], 'MANAGER_PIN');
    final voided = await call('POST', '/orders/$id/items/$lineId/void', key: key, session: session, body: {'reason': 'Cold', 'managerPin': '2468'});
    expect((voided.$2['data']['lines'] as List).first['status'], 'Void');
    expect(printed.last, contains('VOID - KITCHEN'));

    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(events.map((e) => e['type']).toSet(), {'order.updated'});
    expect(events.last['order']['clientId'], id);
    await socket.close();
  });

  test('wrong PINs lock the tablet out for a while', () async {
    final key = (await call('POST', '/pair', body: {'code': server.newPairCode()})).$2['data']['deviceKey'] as String;
    for (var i = 0; i < 5; i++) {
      await call('POST', '/staff/pin-login', key: key, body: {'pin': '0000'});
    }
    expect((await call('POST', '/staff/pin-login', key: key, body: {'pin': '1357'})).$1, 429);
  });
}
