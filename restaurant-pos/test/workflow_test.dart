import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:my_pos/core/api.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/models.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/hub/lan_server.dart';
import 'package:my_pos/state/pos_state.dart';
import 'package:my_pos/tablet/tablet_state.dart';

import 'lan_server_test.dart' show waiterPinHash;
import 'pos_flow_test.dart' show snapshot;

/// Design section 8, steps 1-15, in one run: a real tablet client -> the till's LAN server ->
/// simulated kitchen/bar/receipt printers -> payment -> day report -> a fake cloud. Then an
/// offline soak: a busy evening with no internet, all of it synced once the line is back.
void main() {
  late PosState till;
  late LanServer server;
  late List<Map<String, dynamic>> cloudOrders;
  late bool cloudUp;
  late Map<String, List<String>> printed;

  setUp(() async {
    cloudOrders = [];
    cloudUp = true;
    printed = {};
    final db = LocalDb.memory();
    applyConfig(db, {
      ...snapshot(),
      'staff': [
        {'id': 's1', 'userId': 'u1', 'fullName': 'Maya Patel', 'role': 'Manager', 'pinHash': null},
        {'id': 's3', 'userId': 'u3', 'fullName': 'Sam Okafor', 'role': 'Waiter', 'pinHash': waiterPinHash},
      ],
      'printers': [
        {'name': 'Front', 'role': 'Receipt', 'connection': 'Network', 'address': '10.0.0.4'},
        {'name': 'Kitchen', 'role': 'Kitchen', 'connection': 'Network', 'address': '10.0.0.5'},
        {'name': 'Bar', 'role': 'Bar', 'connection': 'Network', 'address': '10.0.0.6'},
      ],
    }, full: true);
    till = PosState(db)..staff = db.loadCatalog().staff.first;
    till.printSender = (p, bytes) async => (printed[p.name] ??= []).add(latin1.decode(bytes, allowInvalid: true));
    till.sync = SyncService(db, CloudApi(
      baseUrl: 'https://cloud', deviceId: 'd', secret: 's',
      client: MockClient((req) async {
        if (!cloudUp) throw const SocketException('offline');
        if (req.url.path == '/api/auth/device/login') {
          return http.Response(jsonEncode({'success': true, 'data': {'accessToken': 't', 'expiresAt': '2099-01-01T00:00:00Z'}}), 200);
        }
        if (req.url.path == '/api/pos/changes') {
          return http.Response(jsonEncode({'success': true, 'data': {...snapshot(), 'serverTime': '2026-10-03T12:00:00+00:00', 'printers': null}}), 200);
        }
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        final orders = (body['orders'] as List).cast<Map<String, dynamic>>();
        expect(orders.length, lessThanOrEqualTo(200)); // the server's batch limit
        cloudOrders.addAll(orders);
        return http.Response(jsonEncode({'success': true, 'data': [
          for (final o in orders) {'kind': 'order', 'clientId': o['clientId'], 'ok': true, 'id': 'srv-${o['clientId']}'},
          for (final r in (body['refunds'] as List)) {'kind': 'refund', 'clientId': r['clientId'], 'ok': true},
        ]}), 200);
      }),
    ));
    server = LanServer(till, port: 0, registerTablet: (_) async => 'cloud-tablet');
    await server.start();
  });

  tearDown(() => server.stop());

  test('section 8: tablet to kitchen to payment to report to cloud', () async {
    final tablet = TabletState(LocalDb.memory());
    await tablet.pair(address: '127.0.0.1:${server.boundPort}', code: server.newPairCode(), name: 'Tablet 1');

    // 1. Waiter signs in with their PIN.
    await tablet.signIn('1357');
    // 2-3. Table map and menu.
    expect(tablet.tableStatus['t1'], 'free');
    final tikka = tablet.catalog.item('i1')!;
    // 4. Modifiers and a note.
    final basket = [
      OrderLine(menuItemId: tikka.id, name: tikka.name, unitPence: tikka.pricePence, qty: 2,
          modifiers: [LineModifier(id: 'o1', name: 'Pilau', deltaPence: 100)], notes: 'Mild please'),
      OrderLine(menuItemId: 'i2', name: 'Cobra', unitPence: 550),
    ];
    // 5. Confirm. A retry of the same basket (lost reply) changes nothing.
    final order = await tablet.placeOrder(tableId: 't1', guests: 2, basket: basket, requestId: 'req-1');
    await tablet.placeOrder(tableId: 't1', guests: 2, basket: basket, requestId: 'req-1');

    // 6. On the till, live.
    final onTill = till.orderForTable('t1')!;
    expect(onTill.clientId, order.clientId);
    expect(onTill.lines.length, 2);
    expect(onTill.staffName, 'Sam Okafor');
    // 7-8. Split by route: one kitchen ticket, one bar ticket.
    expect(printed['Kitchen']!.single, allOf(contains('TABLE 1'), contains('2 x Chicken Tikka'), contains('+ Pilau'), contains('** Mild please')));
    expect(printed['Bar']!.single, allOf(contains('1 x Cobra'), isNot(contains('Tikka'))));
    expect(onTill.lines.every((l) => l.status == 'Sent'), isTrue);

    // 9-10. The kitchen marks it ready; the waiter sees it.
    till.setItemStatus(onTill, onTill.lines.first.id, 'Ready');
    await _until(() => tablet.orders[order.clientId]?.lines.first.status == 'Ready');
    // 11. Served.
    await tablet.markServed(tablet.orders[order.clientId]!, tablet.orders[order.clientId]!.lines.first);
    expect(onTill.lines.first.status, 'Served');

    // 12. Payment at the till: discount, then cash with change.
    till.applyDiscount(onTill, 90, 'Regular');
    expect(onTill.totalPence, 2 * 1095 + 550 - 90);
    final problem = await till.takePayment(onTill, 'Cash', onTill.duePence, tenderedPence: 3000);
    expect(problem, isNull);
    // 13. Receipt, drawer opened for cash.
    final receipt = printed['Front']!;
    expect(receipt.first, contains('\x1Bp')); // ESC p: drawer kick
    expect(receipt.last, allOf(contains('TOTAL'), contains('26.50'), contains('Change'), contains('3.50')));
    // 14. Completed: table free on the tablet too.
    expect(till.orderForTable('t1'), isNull);
    await _until(() => tablet.tableStatus['t1'] == 'free');
    // 15. Day report straight away, the cloud once the outbox drains.
    expect(till.dayReport(DateTime.now()).salesPence, 2650);
    await till.sync!.syncNow();
    expect(cloudOrders.single['clientId'], order.clientId);
    expect(cloudOrders.single['totalAmount'], 26.5);
    expect(till.db.pendingCount, 0);

    tablet.dispose();
  });

  test('offline soak: 250 sales with no internet all reach the cloud once it is back, each once', () async {
    cloudUp = false;
    final cobra = till.catalog.itemsIn('c2').single;
    for (var i = 0; i < 250; i++) {
      final o = till.startOrder();
      till.addItem(o, cobra);
      await till.takePayment(o, i.isEven ? 'Cash' : 'Card', o.duePence);
    }
    await till.sync!.syncNow();
    expect(till.sync!.online, isFalse);
    expect(till.db.pendingCount, 250);
    expect(till.dayReport(DateTime.now()).orderCount, 250); // the till carries on regardless

    cloudUp = true;
    await till.sync!.syncNow();
    expect(till.db.pendingCount, 0);
    expect(cloudOrders.map((o) => o['clientId']).toSet().length, 250);
    expect(cloudOrders.length, 250);
  });
}

Future<void> _until(bool Function() ok) async {
  for (var i = 0; i < 50 && !ok(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 40));
  }
  expect(ok(), isTrue);
}
