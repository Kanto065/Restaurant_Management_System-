import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/db.dart';
import 'package:my_pos/core/models.dart';
import 'package:my_pos/core/sync.dart';
import 'package:my_pos/main.dart';
import 'package:my_pos/state/pos_state.dart';
import 'package:my_pos/tablet/tablet_screens.dart';
import 'package:my_pos/tablet/tablet_state.dart';
import 'package:my_pos/ui/order_screen.dart';
import 'package:provider/provider.dart';

import 'pos_flow_test.dart' show snapshot;

/// Renders the main screens at a 1366x768 till resolution to build/screen_previews/*.png,
/// light and dark, and fails on any layout overflow. Run: flutter test test/screens_test.dart
String get _fonts => '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts';

PosState _state({bool signedIn = true, bool withOrders = true, String theme = 'light'}) {
  final db = LocalDb.memory();
  applyConfig(db, snapshot(), full: true);
  db.setJson('device', {'server': 'https://test', 'deviceId': 'd', 'secret': 's'});
  db.set('theme', theme);
  final s = PosState(db);
  s.stop();
  if (signedIn) s.staff = s.catalog.staff.first;
  if (withOrders) {
    final o = s.startOrder(table: s.catalog.tables.first, guests: 3);
    s.addItem(o, s.catalog.itemsIn('c1').first, modifiers: [LineModifier(id: 'o1', name: 'Pilau', deltaPence: 100)], notes: 'Medium spice');
    s.addItem(o, s.catalog.itemsIn('c2').single, qty: 2);
    s.send(o);
    s.addItem(o, s.catalog.itemsIn('c1').last);
  }
  return s;
}

Future<void> _shot(WidgetTester tester, String name) async {
  await tester.pumpAndSettle(const Duration(milliseconds: 300));
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey('shot')));
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    File('build/screen_previews/$name.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(png!.buffer.asUint8List());
  });
}

Widget _app(PosState s) => RepaintBoundary(
      key: const ValueKey('shot'),
      child: ChangeNotifierProvider.value(value: s, child: const PosApp()),
    );

void main() {
  tabletScreens();
  final fonts = Directory(_fonts).existsSync();

  Future<void> prepare(WidgetTester tester) async {
    await tester.runAsync(() async {
      final roboto = FontLoader('Roboto');
      for (final f in Directory(_fonts).listSync().whereType<File>().where((f) => f.path.contains('roboto-'))) {
        roboto.addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
      }
      await roboto.load();
      final icons = File('$_fonts/materialicons-regular.otf').readAsBytesSync();
      await (FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(icons)))).load();
    });
    tester.view.physicalSize = const Size(1366, 768);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  for (final theme in ['light', 'dark']) {
    testWidgets('screens render without overflow ($theme)', (tester) async {
      await prepare(tester);

      final unpaired = LocalDb.memory()..set('theme', theme);
      await tester.pumpWidget(_app(PosState(unpaired)));
      await _shot(tester, '${theme}_1_pairing');

      await tester.pumpWidget(_app(_state(signedIn: false, theme: theme)));
      await _shot(tester, '${theme}_2_pin');

      final s = _state(theme: theme);
      await tester.pumpWidget(_app(s));
      await _shot(tester, '${theme}_3_tables');

      await tester.tap(find.text('1').first);
      await _shot(tester, '${theme}_4_order');

      await tester.tap(find.textContaining('Pay £'));
      await _shot(tester, '${theme}_5_payment');
      expect(find.byType(PaymentDialog), findsOneWidget);

      final s2 = _state(theme: theme, withOrders: false);
      await tester.pumpWidget(const SizedBox()); // drop the open payment dialog
      await tester.pumpWidget(_app(s2));
      await tester.tap(find.text('Manage'));
      await _shot(tester, '${theme}_6_manage_menu');
      await tester.tap(find.text('Chicken Tikka'));
      await _shot(tester, '${theme}_7_manage_dish');
      expect(find.text('Rice'), findsOneWidget);
    }, skip: !fonts);
  }
}

/// A tablet signed in, with the till's demo order on table 1 (one dish already Ready).
TabletState _tablet(String theme) {
  final till = _state(theme: theme);
  final order = till.openOrders.single;
  till.setItemStatus(order, order.lines.first.id, 'Ready');
  final t = TabletState(LocalDb.memory()..set('theme', theme))
    ..client = HubClient('192.168.1.20', 'k')
    ..restaurantName = 'Test Tandoori'
    ..catalog = till.catalog
    ..staff = {'id': 's2', 'name': 'Tom Hughes', 'role': 'Waiter'}
    ..orders = {order.clientId: PosOrder.fromJson(order.toJson())}
    ..tableStatus = {'t1': 'occupied', 't2': 'free'}
    ..connected = true;
  return t;
}

void tabletScreens() {
  for (final (name, size) in [('landscape', const Size(1280, 800)), ('portrait', const Size(800, 1280))]) {
    testWidgets('tablet screens render without overflow ($name)', (tester) async {
      await tester.runAsync(() async {
        final roboto = FontLoader('Roboto');
        for (final f in Directory(_fonts).listSync().whereType<File>().where((f) => f.path.contains('roboto-'))) {
          roboto.addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
        }
        await roboto.load();
        final icons = File('$_fonts/materialicons-regular.otf').readAsBytesSync();
        await (FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(icons)))).load();
      });
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      Widget app(TabletState s) => RepaintBoundary(
          key: const ValueKey('shot'), child: ChangeNotifierProvider.value(value: s, child: TabletApp(onUseAsTill: () {})));

      await tester.pumpWidget(app(TabletState(LocalDb.memory())));
      await _shot(tester, 'tablet_${name}_1_pair');

      final s = _tablet('light');
      await tester.pumpWidget(app(s));
      await _shot(tester, 'tablet_${name}_2_tables');
      expect(find.text('1 ready'), findsOneWidget);

      await tester.tap(find.text('1').first);
      await _shot(tester, 'tablet_${name}_3_order');
      await tester.tap(find.text('Drinks'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cobra').last);
      await _shot(tester, 'tablet_${name}_4_basket');
      expect(find.text('Send 1 to kitchen'), findsOneWidget);
    }, skip: !Directory(_fonts).existsSync());
  }
}
