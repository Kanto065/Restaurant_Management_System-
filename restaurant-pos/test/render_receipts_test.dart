import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/main.dart';
import 'package:my_pos/printing/printer_windows.dart';
import 'package:my_pos/printing/receipt_settings.dart';

import 'escpos_printer_simulator.dart';

/// Renders sample sales to build/receipt_previews/*.png so a receipt can be
/// inspected without the physical printer. The pipeline is the real one:
/// SaleRecord.toMap() -> PrinterService.buildReceipt() -> ESC/POS bytes ->
/// SimulatedPrinter -> drawn in a 12x24-dot monospace cell per character.
///
/// Run with: flutter test test/render_receipts_test.dart
const _regular = r'C:\Windows\Fonts\consola.ttf';
const _bold = r'C:\Windows\Fonts\consolab.ttf';

Product _p(String name, double price) =>
    Product(id: name, name: name, price: price, category: '');

SaleRecord _sale(
  DateTime date,
  List<(int, Product)> lines,
  PaymentMethod method, {
  double? received,
}) {
  final items = [
    for (final (qty, p) in lines) CartItem(product: p, quantity: qty),
  ];
  final total = items.fold(0.0, (s, i) => s + i.product.price * i.quantity);
  final cash = received ?? total;
  return SaleRecord(
    id: '#1',
    items: items,
    total: total,
    date: date,
    method: method,
    cashReceived: method == PaymentMethod.cash ? cash : 0,
    change: method == PaymentMethod.cash ? cash - total : 0,
  );
}

final Map<String, SaleRecord> _samples = {
  '1_reference_small_chips_sausage': _sale(DateTime(2026, 9, 15, 13, 35), [
    (1, _p('Small Chips', 3.30)),
    (1, _p('Large Sausage', 2.20)),
  ], PaymentMethod.cash),
  '2_family_order_cash_with_change': _sale(
    DateTime(2026, 9, 17, 23, 40),
    [
      (2, _p('Large Cod', 10.00)),
      (1, _p('Scampi (8)', 6.50)),
      (3, _p('Large Chips', 4.40)),
      (1, _p('Salt & Pepper Chips', 4.50)),
      (2, _p('Large Gravy or Curry', 2.50)),
      (4, _p('Cans', 1.70)),
    ],
    PaymentMethod.cash,
    received: 70.00,
  ),
  '3_card_payment': _sale(DateTime(2026, 9, 26, 18, 5), [
    (1, _p('Haddock', 7.00)),
    (1, _p('Small Chips', 3.30)),
    (1, _p('Fruity Curry', 2.00)),
  ], PaymentMethod.card),
  '4_long_item_name_wraps': _sale(
    DateTime(2026, 9, 26, 12, 0),
    [
      (
        1,
        _p(
          'Extra Large Battered Sausage With Curry Sauce And Bread Roll',
          5.95,
        ),
      ),
      (12, _p('Fish Bite', 2.00)),
    ],
    PaymentMethod.cash,
    received: 50.00,
  ),
};

Widget _paper(SimulatedPrinter printer) {
  const double margin =
      (SimulatedPrinter.paperDots - SimulatedPrinter.printDots) / 2;
  return Container(
    width: SimulatedPrinter.paperDots.toDouble(),
    color: Colors.white,
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final line in printer.lines)
          Padding(
            padding: EdgeInsets.only(left: margin + line.offsetDots),
            child: SizedBox(
              height: (line.dh ? 2 : 1) * SimulatedPrinter.cellH.toDouble(),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final ch in line.chars)
                    SizedBox(
                      width:
                          (ch.dw ? 2 : 1) * SimulatedPrinter.cellW.toDouble(),
                      height:
                          (ch.dh ? 2 : 1) * SimulatedPrinter.cellH.toDouble(),
                      child: FittedBox(
                        fit: BoxFit.fill,
                        child: Text(
                          ch.ch,
                          style: TextStyle(
                            fontFamily: ch.bold
                                ? 'ReceiptBold'
                                : 'ReceiptRegular',
                            fontSize: 24,
                            height: 1.0,
                            color: const Color(0xFF151515),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

void main() {
  final bool fontsAvailable =
      File(_regular).existsSync() && File(_bold).existsSync();

  testWidgets('render sample receipts to PNG', (tester) async {
    await tester.runAsync(() async {
      for (final (family, path) in [
        ('ReceiptRegular', _regular),
        ('ReceiptBold', _bold),
      ]) {
        final bytes = File(path).readAsBytesSync();
        await (FontLoader(
          family,
        )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
      }
    });
    tester.view.physicalSize = const Size(
      SimulatedPrinter.paperDots + 0.0,
      3000,
    );
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final outDir = Directory('build/receipt_previews')
      ..createSync(recursive: true);
    for (final entry in _samples.entries) {
      final printer = SimulatedPrinter.run(
        PrinterService.buildReceipt(
          entry.value.toMap(),
          ReceiptSettings(),
        ).bytes,
      );
      expect(printer.errors, isEmpty, reason: entry.key);

      final key = GlobalKey();
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Align(
            alignment: Alignment.topLeft,
            child: RepaintBoundary(key: key, child: _paper(printer)),
          ),
        ),
      );
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 2);
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        File('${outDir.path}/${entry.key}.png')
            .writeAsBytesSync(png!.buffer.asUint8List());
      });
    }
  }, skip: !fontsAvailable);
}
