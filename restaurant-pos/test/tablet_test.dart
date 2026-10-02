import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/models.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/hub/lan_server.dart';
import 'package:my_pos/state/pos_state.dart';
import 'package:my_pos/tablet/tablet_state.dart';

import 'lan_server_test.dart' show waiterPinHash;
import 'pos_flow_test.dart' show snapshot;

/// The tablet app's state against a real till (PosState + LanServer) in the same process.
void main() {
  test('tablet pairs, signs in, orders a table and sees the till change it live', () async {
    final hubDb = LocalDb.memory();
    applyConfig(hubDb, {
      ...snapshot(),
      'staff': [
        {'id': 's3', 'userId': 'u3', 'fullName': 'Sam Okafor', 'role': 'Waiter', 'pinHash': waiterPinHash},
      ],
    }, full: true);
    final till = PosState(hubDb);
    final server = LanServer(till, port: 0, registerTablet: (_) async => 'cloud-1');
    await server.start();
    final address = '127.0.0.1:${server.boundPort}';

    final tablet = TabletState(LocalDb.memory());
    await expectLater(tablet.pair(address: address, code: '123456', name: 'Tab'), throwsA(isA<TabletError>()));
    await tablet.pair(address: address, code: server.newPairCode(), name: 'Tab');
    expect(tablet.isPaired, isTrue);
    expect(tablet.restaurantName, 'Test Tandoori');
    expect(tablet.catalog.categories.map((c) => c.name), ['Mains', 'Drinks']);

    await tablet.signIn('1357');
    expect(tablet.staffName, 'Sam Okafor');

    final order = await tablet.placeOrder(tableId: 't1', guests: 4, basket: [
      OrderLine(menuItemId: 'i1', name: 'Chicken Tikka', unitPence: 1, qty: 2, modifiers: [LineModifier(id: 'o1', name: 'Pilau', deltaPence: 100)]),
      OrderLine(menuItemId: 'i2', name: 'Cobra', unitPence: 550),
    ]);
    expect(order.totalPence, 2 * 1095 + 550); // the till's prices, not the tablet's
    expect(till.orderForTable('t1')!.guestCount, 4);
    expect(tablet.tableStatus['t1'], 'occupied');

    // The kitchen marks the tikka Ready on the till; the tablet hears it.
    final onTill = till.orderForTable('t1')!;
    till.setItemStatus(onTill, onTill.lines.first.id, 'Ready');
    await _until(() => tablet.orders[order.clientId]!.lines.first.status == 'Ready');

    await tablet.markServed(tablet.orders[order.clientId]!, tablet.orders[order.clientId]!.lines.first);
    expect(till.orderForTable('t1')!.lines.first.status, 'Served');

    // Paid at the till: the table frees up on the tablet.
    await till.takePayment(onTill, 'Cash', onTill.duePence);
    await _until(() => tablet.orders.isEmpty);
    await _until(() => tablet.tableStatus['t1'] == 'free');

    // A tablet unpaired at the till is sent back to pairing on its next call.
    await server.unpairTablet(server.tablets.keys.single);
    await tablet.refresh();
    expect(tablet.isPaired, isFalse);
    await expectLater(tablet.placeOrder(tableId: 't2', basket: [OrderLine(menuItemId: 'i2', name: 'Cobra', unitPence: 550)]), throwsA(isA<TabletError>()));
    expect(tablet.isPaired, isFalse);

    tablet.dispose();
    till.stop();
    await server.stop();
  });
}

Future<void> _until(bool Function() ok) async {
  for (var i = 0; i < 50 && !ok(); i++) {
    await Future<void>.delayed(const Duration(milliseconds: 40));
  }
  expect(ok(), isTrue);
}
