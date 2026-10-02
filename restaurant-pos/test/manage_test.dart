import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:my_pos/core/api.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/state/manage.dart';
import 'package:my_pos/state/pos_state.dart';

import 'pos_flow_test.dart' show snapshot;

/// Managing the restaurant from the till goes through the admin endpoints (fake cloud here).
void main() {
  late PosState state;
  late List<http.Request> calls;
  late bool online;

  http.Response ok(Object? data) => http.Response(jsonEncode({'success': true, 'data': data}), 200);

  setUp(() {
    calls = [];
    online = true;
    final db = LocalDb.memory();
    applyConfig(db, snapshot(), full: true);
    state = PosState(db)..staff = db.loadCatalog().staff.first; // Maya, Manager
    final api = CloudApi(
      baseUrl: 'https://cloud',
      deviceId: 'd',
      secret: 's',
      client: MockClient((req) async {
        if (!online) throw const SocketException('down');
        if (req.url.path == '/api/auth/device/login') {
          return ok({'accessToken': 't', 'expiresAt': '2099-01-01T00:00:00Z', 'restaurantName': 'R'});
        }
        calls.add(req);
        return switch ((req.method, req.url.path)) {
          ('GET', '/api/admin/menu-items') => ok([
              {'id': 'i1', 'categoryId': 'c1', 'name': 'Chicken Tikka', 'basePrice': 9.95, 'imageUrl': 'https://img/tikka.jpg',
                'containsAllergens': true, 'allergenInfo': 'Milk', 'isAvailable': true, 'spiceLevel': 'Medium'},
            ]),
          ('PUT', '/api/admin/menu-items/i1') => ok({'id': 'i1'}),
          ('POST', '/api/admin/staff') => ok({'id': 'new-staff'}),
          ('GET', '/api/pos/changes') => ok({...snapshot(), 'serverTime': '2026-10-03T09:00:00+00:00'}),
          _ => ok({'id': 'x'}),
        };
      }),
    );
    state.sync = SyncService(db, api);
  });

  test('editing a dish keeps what the till does not show, sets its ticket, then pulls the change', () async {
    await state.saveItem(id: 'i1', categoryId: 'c1', name: 'Chicken Tikka Masala', pricePence: 1095, isAvailable: true, printRouteOverride: 'Bar');

    final put = calls.firstWhere((c) => c.method == 'PUT' && c.url.path == '/api/admin/menu-items/i1');
    final body = jsonDecode(put.body) as Map;
    expect(body['name'], 'Chicken Tikka Masala');
    expect(body['basePrice'], 10.95);
    expect(body['imageUrl'], 'https://img/tikka.jpg'); // the website's photo survives
    expect(body['allergenInfo'], 'Milk');
    expect(body['spiceLevel'], 'Medium');
    final route = calls.firstWhere((c) => c.url.path == '/api/admin/menu-items/i1/print-route');
    expect(jsonDecode(route.body), {'printRouteOverride': 'Bar'});
    expect(calls.last.url.path, '/api/pos/changes'); // pulled straight back into the till
  });

  test('staff changes name the manager signed in at the till', () async {
    await state.addStaff(name: 'Ana Costa', role: 'Waiter', pin: '5678');
    final create = calls.firstWhere((c) => c.url.path == '/api/admin/staff');
    expect(create.headers['X-Pos-Staff-Id'], 's1');
    expect(jsonDecode(create.body)['email'], isNull);
    final pin = calls.firstWhere((c) => c.url.path == '/api/admin/staff/new-staff/pin');
    expect(jsonDecode(pin.body), {'pin': '5678'});
    expect(pin.headers['X-Pos-Staff-Id'], 's1');

    // Menu calls don't carry it.
    await state.deleteTable('t2');
    expect(calls.firstWhere((c) => c.url.path == '/api/admin/tables/t2').headers.containsKey('X-Pos-Staff-Id'), isFalse);
  });

  test('offline: a clear message, nothing half-done', () async {
    online = false;
    await expectLater(state.saveCategory(name: 'Specials', isActive: true, printRoute: 'Kitchen'),
        throwsA(isA<PosError>().having((e) => e.message, 'message', contains('need the internet'))));
  });

  test('a table with an open order cannot be deleted', () {
    state.startOrder(table: state.catalog.tables.first);
    expect(() => state.deleteTable('t1'), throwsA(isA<PosError>()));
  });
}
