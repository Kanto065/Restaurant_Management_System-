import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/report.dart';
import 'package:my_pos/printing/pos_receipts.dart';

import 'escpos_printer_simulator.dart';
import 'sample_orders.dart';

/// Renders sample sales to build/receipt_previews/*.png so a receipt can be
/// inspected without the physical printer. The pipeline is the real one:
/// PosOrder -> buildOrderReceipt() / buildDayReport() -> ESC/POS bytes ->
/// SimulatedPrinter -> drawn in a 12x24-dot monospace cell per character.
///
/// Run with: flutter test test/render_receipts_test.dart
const _regular = r'C:\Windows\Fonts\consola.ttf';
const _bold = r'C:\Windows\Fonts\consolab.ttf';

final Map<String, List<int>> _samples = {
  '1_dine_in_cash_with_change': buildOrderReceipt(dineInCash(), restaurant).bytes,
  '2_takeaway_card': buildOrderReceipt(takeawayCard(), restaurant).bytes,
  '3_bill_before_paying': buildOrderReceipt(dineInCash(), restaurant, bill: true).bytes,
  '4_day_report': buildDayReport(DayReport.build(DateTime(2026, 10, 2), [dineInCash(), takeawayCard()], []), restaurant).bytes,
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
      final printer = SimulatedPrinter.run(entry.value);
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
