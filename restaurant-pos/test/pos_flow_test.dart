import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:my_pos/core/api.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/models.dart';
import 'package:my_pos/core/printing.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/state/pos_state.dart';

import 'licence_fixtures.dart';

final _licences = jsonDecode(licenceFixtures) as Map<String, dynamic>;

Map<String, dynamic> snapshot({String licence = 'active', List<Map<String, dynamic>>? items}) => {
      'serverTime': '2026-10-02T12:00:00+00:00',
      'restaurant': {'id': 'r1', 'name': 'Test Tandoori', 'city': 'Swansea'},
      'categories': [
        {'id': 'c1', 'name': 'Mains', 'displayOrder': 1, 'isActive': true, 'printRoute': 'Kitchen'},
        {'id': 'c2', 'name': 'Drinks', 'displayOrder': 2, 'isActive': true, 'printRoute': 'Bar'},
      ],
      'items': items ??
          [
            {'id': 'i1', 'categoryId': 'c1', 'name': 'Chicken Tikka', 'basePrice': 9.95, 'isAvailable': true, 'printRouteOverride': null},
            {'id': 'i2', 'categoryId': 'c2', 'name': 'Cobra', 'basePrice': 5.5, 'isAvailable': true, 'printRouteOverride': null},
            {'id': 'i3', 'categoryId': 'c1', 'name': 'Dessert wine', 'basePrice': 6, 'isAvailable': true, 'printRouteOverride': 'Bar'},
          ],
      'itemModifierGroups': [
        {'id': 'l1', 'menuItemId': 'i1', 'modifierGroupId': 'g1', 'displayOrder': 0},
      ],
      'modifierGroups': [
        {'id': 'g1', 'name': 'Rice', 'minSelect': 1, 'maxSelect': 1, 'isRequired': true},
      ],
      'modifierOptions': [
        {'id': 'o1', 'modifierGroupId': 'g1', 'name': 'Pilau', 'priceDelta': 1.0, 'isAvailable': true},
      ],
      'tables': [
        {'id': 't1', 'tableNumber': '1', 'capacity': 4, 'isActive': true},
        {'id': 't2', 'tableNumber': '2', 'capacity': 2, 'isActive': true},
      ],
      'liveIds': null,
      'staff': [
        {'id': 's1', 'userId': 'u1', 'fullName': 'Maya Patel', 'role': 'Manager', 'pinHash': null},
        {'id': 's2', 'userId': 'u2', 'fullName': 'Tom Hughes', 'role': 'Cashier', 'pinHash': null},
      ],
      'printers': [],
      'orderStatuses': [
        {'name': 'Pending', 'countsAsCompleted': false},
        {'name': 'Completed', 'countsAsCompleted': true},
      ],
      'paymentStatuses': [
        {'name': 'Pending'},
        {'name': 'Paid'},
      ],
      'features': {},
      'licence': _licences[licence],
    };

PosState till({String licence = 'active'}) {
  final db = LocalDb.memory();
  applyConfig(db, snapshot(licence: licence), full: true);
  return PosState(db)..staff = db.loadCatalog().staff.first;
}

void main() {
  backupTests();
  test('catalog: categories in order, routes resolve (item override beats category)', () {
    final s = till();
    expect(s.catalog.categories.map((c) => c.name), ['Mains', 'Drinks']);
    final items = {for (final i in [...s.catalog.itemsIn('c1'), ...s.catalog.itemsIn('c2')]) i.id: i};
    expect(s.routeFor(items['i1']!), 'Kitchen');
    expect(s.routeFor(items['i2']!), 'Bar');
    expect(s.routeFor(items['i3']!), 'Bar');
    expect(s.catalog.groupsFor('i1').single.options.single.name, 'Pilau');
  });

  test('table order: add, merge, discount, split payment closes it into the outbox in the cloud shape', () async {
    final s = till();
    final table = s.catalog.tables.first;
    final order = s.startOrder(table: table, guests: 2);
    final tikka = s.catalog.itemsIn('c1').firstWhere((i) => i.id == 'i1');
    final pilau = [LineModifier(id: 'o1', name: 'Pilau', deltaPence: 100)];
    s.addItem(order, tikka, modifiers: pilau);
    s.addItem(order, tikka, modifiers: pilau); // merges into one line, qty 2
    s.addItem(order, s.catalog.itemsIn('c2').single);
    expect(order.lines.length, 2);
    expect(order.subtotalPence, 2 * 1095 + 550);

    s.applyDiscount(order, 240, 'Regular');
    expect(order.totalPence, 2500);
    expect(() => s.startOrder(table: table), throwsA(isA<PosError>()));

    await s.takePayment(order, 'Card', 1000);
    expect(order.isClosed, isFalse);
    await s.takePayment(order, 'Cash', 1500, tenderedPence: 2000);
    expect(order.isClosed, isTrue);
    expect(s.orderForTable(table.id), isNull);

    final sent = s.db.outbox().single;
    expect(sent.kind, 'order');
    final p = sent.payload;
    expect(p['totalAmount'], 25.0);
    expect(p['discountAmount'], 2.4);
    expect(p['status'], 'Completed');
    expect(p['paymentStatus'], 'Paid');
    expect(p['paymentMethod'], 'Cash');
    expect((p['payments'] as List).map((x) => x['amount']), [10.0, 15.0]);
    expect((p['items'] as List).first['modifiers'].single['priceDelta'], 1.0);
    // The server recomputes the total from the lines and must get the same figure.
    final items = (p['items'] as List).cast<Map>();
    final server = items.fold<double>(
            0, (t, i) => t + (i['unitPrice'] + (i['modifiers'] as List).fold<double>(0, (m, x) => m + x['priceDelta'])) * i['quantity']) -
        p['discountAmount'];
    expect(server, closeTo(25.0, 0.001));
    // And the order survives a restart of the till.
    expect(PosState(s.db).closedOrders().single.totalPence, 2500);
  });

  test('refunds never exceed what was paid and queue for the cloud', () async {
    final s = till();
    final order = s.startOrder();
    s.addItem(order, s.catalog.itemsIn('c2').single);
    await s.takePayment(order, 'Cash', 550);
    s.refund(order, 300, 'Cash', 'Spilt');
    expect(() => s.refund(order, 251, 'Cash', null), throwsA(isA<PosError>()));
    s.refund(order, 250, 'Card', null);
    expect(s.db.outbox().map((e) => e.kind), ['order', 'refund', 'refund']);
    expect(s.dayReport(DateTime.now()).netPence, 0);
  });

  test('an expired licence pauses new orders', () {
    final s = till(licence: 'expired');
    expect(() => s.startOrder(), throwsA(isA<PosError>()));
  });

  test('voided lines drop out of the total', () {
    final s = till();
    final order = s.startOrder();
    s.addItem(order, s.catalog.itemsIn('c2').single);
    s.send(order);
    s.voidLine(order, order.lines.single, 'Wrong drink');
    expect(order.totalPence, 0);
    expect(order.lines.single.status, 'Void');
  });

  test('send prints one ticket per station; a dead printer keeps its tickets until it is back', () async {
    final db = LocalDb.memory();
    applyConfig(db, {
      ...snapshot(),
      'printers': [
        {'name': 'Kitchen', 'role': 'Kitchen', 'connection': 'Network', 'address': '10.0.0.5'},
        {'name': 'Bar', 'role': 'Bar', 'connection': 'Network', 'address': '10.0.0.6'},
      ],
    }, full: true);
    final s = PosState(db)..staff = db.loadCatalog().staff.first;
    final printed = <String>[];
    var barUp = false;
    s.printSender = (p, bytes) async {
      if (p.role == 'Bar' && !barUp) throw const PrinterException('Bar (10.0.0.6) is not answering.');
      printed.add('${p.name}: ${latin1.decode(bytes, allowInvalid: true)}');
    };

    final o = s.startOrder(table: s.catalog.tables.first, guests: 2);
    final tikka = s.catalog.itemsIn('c1').firstWhere((i) => i.id == 'i1');
    s.addItem(o, tikka, modifiers: [LineModifier(id: 'o1', name: 'Pilau', deltaPence: 100)], notes: 'Medium');
    s.addItem(o, s.catalog.itemsIn('c2').single);
    s.addItem(o, s.catalog.itemsIn('c1').firstWhere((i) => i.id == 'i3')); // override: Bar
    await s.send(o);

    expect(printed.single, allOf(startsWith('Kitchen'), contains('TABLE 1'), contains('1 x Chicken Tikka'), contains('+ Pilau'),
        contains('** Medium'), isNot(contains('Cobra'))));
    expect(s.pendingPrints, 1);
    expect(s.printAlert, contains('not answering'));

    barUp = true;
    await s.drainPrints();
    expect(printed.last, allOf(startsWith('Bar'), contains('1 x Cobra'), contains('1 x Dessert wine'), isNot(contains('Tikka'))));
    expect(s.pendingPrints, 0);
    expect(s.printAlert, isNull);

    // Sending again prints nothing new; voiding a sent dish tells its station.
    await s.send(o);
    expect(printed.length, 2);
    await s.voidLine(o, o.lines.first, 'Customer changed mind');
    expect(printed.last, allOf(startsWith('Kitchen'), contains('VOID - KITCHEN'), contains('Chicken Tikka')));
  });

  test('sync: changes upsert rows, liveIds drop deleted ones, outbox parks rejections only', () async {
    final db = LocalDb.memory();
    applyConfig(db, snapshot(), full: true);
    applyConfig(db, {
      ...snapshot(items: [
        {'id': 'i2', 'categoryId': 'c2', 'name': 'Cobra 660ml', 'basePrice': 5.75, 'isAvailable': true},
      ]),
      'serverTime': '2026-10-02T12:01:00+00:00',
      'categories': [],
      'tables': [],
      'liveIds': {
        'categories': ['c1', 'c2'], 'items': ['i2', 'i3'], 'itemModifierGroups': [], 'modifierGroups': [], 'modifierOptions': [],
        'tables': ['t1'],
      },
    }, full: false);
    final cat = db.loadCatalog();
    expect(cat.collections['items']!.keys, unorderedEquals(['i2', 'i3']));
    expect(cat.collections['items']!['i2']!['name'], 'Cobra 660ml');
    expect(cat.tables.map((t) => t.id), ['t1']);
    expect(db.get('sync.since'), '2026-10-02T12:01:00+00:00');

    db.enqueue('order', 'a', {'clientId': 'a'});
    db.enqueue('order', 'b', {'clientId': 'b'});
    db.enqueue('refund', 'c', {'clientId': 'c'});
    var batches = 0;
    final api = CloudApi(
      baseUrl: 'https://test',
      deviceId: 'd',
      secret: 's',
      client: MockClient((req) async {
        if (req.url.path == '/api/auth/device/login') {
          return http.Response(jsonEncode({'success': true, 'data': {'accessToken': 't', 'expiresAt': '2099-01-01T00:00:00Z', 'restaurantName': 'R'}}), 200);
        }
        final body = jsonDecode(req.body);
        batches++;
        const answers = {
          'a': {'kind': 'order', 'clientId': 'a', 'ok': true, 'id': 'x'},
          'b': {'kind': 'order', 'clientId': 'b', 'ok': false, 'error': 'Total mismatch', 'errorCode': 'VALIDATION'},
          'c': {'kind': 'refund', 'clientId': 'c', 'ok': false, 'error': 'not synced', 'errorCode': 'ORDER_NOT_FOUND'},
        };
        final sent = [...(body['orders'] as List), ...(body['refunds'] as List)].map((r) => r['clientId']);
        return http.Response(jsonEncode({'success': true, 'data': [for (final id in sent) answers[id]]}), 200);
      }),
    );
    await SyncService(db, api).drainOutbox();
    expect(batches, 2); // the waiting refund is tried once more, then the drain stops (no progress)
    expect(db.outbox().map((e) => e.clientId), ['c']); // the refund waits for its order
    expect(db.outbox(parked: true).single.lastError, 'Total mismatch');
  });

  test('a licence that does not verify is ignored and the last good one kept', () {
    final db = LocalDb.memory();
    applyConfig(db, snapshot(), full: true);
    final forged = Map<String, dynamic>.from(_licences['active'])..['payload'] = _licences['expired']['payload'];
    final warning = applyConfig(db, {...snapshot(), 'licence': forged}, full: true);
    expect(warning, isNotNull);
    expect(db.getJson('licence')!['access'], 'Active');
  });
}

void backupTests() {
  test('nightly backup: one readable copy a day, oldest dropped', () async {
    final s = till();
    final o = s.startOrder();
    s.addItem(o, s.catalog.itemsIn('c2').single);
    await s.takePayment(o, 'Cash', o.duePence);

    final dir = Directory.systemTemp.createTempSync('pos-backup');
    addTearDown(() => dir.deleteSync(recursive: true));
    final first = s.db.backupDaily(dir.path, keep: 2, now: DateTime(2026, 10, 1))!;
    expect(s.db.backupDaily(dir.path, keep: 2, now: DateTime(2026, 10, 1, 23)), isNull); // once a day
    s.db.backupDaily(dir.path, keep: 2, now: DateTime(2026, 10, 2));
    s.db.backupDaily(dir.path, keep: 2, now: DateTime(2026, 10, 3));
    expect(dir.listSync().map((f) => f.uri.pathSegments.last).toList()..sort(), ['pos-2026-10-02.db', 'pos-2026-10-03.db']);
    expect(File(first).existsSync(), isFalse);

    final copy = LocalDb.open('${dir.path}/pos-2026-10-03.db');
    expect(copy.closedSince(DateTime(2000)).single.clientId, o.clientId);
    expect(copy.outbox().single.clientId, o.clientId);
    copy.close();
  });
}
