import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/printing/printer_windows.dart';
import 'package:my_pos/printing/receipt_builder.dart';
import 'package:my_pos/printing/receipt_settings.dart';

import 'escpos_printer_simulator.dart';

// Exercises the same layout printReceipt() sends to the Aures ODP 333,
// without needing a physical printer attached.
void main() {
  final sale = {
    'date': DateTime(2026, 9, 17, 23, 40),
    'items': [
      {'product': {'name': 'Small Cod', 'price': 7.5}, 'quantity': 1},
      {'product': {'name': 'Large Cod', 'price': 10.0}, 'quantity': 1},
      {'product': {'name': 'Haddock', 'price': 7.0}, 'quantity': 1},
      {'product': {'name': 'Bag', 'price': 0.3}, 'quantity': 1},
      {'product': {'name': 'Extra Large Battered Sausage With Curry Sauce', 'price': 4.25}, 'quantity': 2},
    ],
    'total': 33.3,
    'method': 0,
    'cashReceived': 50.0,
    'change': 16.7,
  };

  test('every line fits the 42-column ODP 333 paper width', () {
    final r = PrinterService.buildReceipt(sale, ReceiptSettings());
    for (final line in r.preview) {
      // ignore: avoid_print
      print('|${line.padRight(r.width)}|');
      expect(line.length, lessThanOrEqualTo(r.width), reason: line);
    }
    expect(r.preview, contains(' Date: 17-09-26             Time: 11:40 PM'));
    expect(r.preview, contains(' 1 x Small Cod                       £7.50'));
  });

  test('pound sign is encoded as CP437 0x9C, never Latin-1 0xA3', () {
    expect(ReceiptBuilder.encodeCp437('£5.50'), [0x9C, 0x35, 0x2E, 0x35, 0x30]);
    final bytes = PrinterService.buildReceipt(sale, ReceiptSettings()).bytes;
    expect(bytes.contains(0x9C), isTrue);
    expect(bytes.contains(0xA3), isFalse);
  });

  test('uses ESC a for alignment and never ESC \$ absolute positioning', () {
    final bytes = PrinterService.buildReceipt(sale, ReceiptSettings()).bytes;
    expect(bytes.sublist(0, 2), [0x1B, 0x40]);
    for (int i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] == 0x1B) expect(bytes[i + 1], isNot(0x24));
    }
  });

  group('simulated ODP 333 printout', () {
    final settings = ReceiptSettings();

    for (final entry in {
      'cash': sale,
      'card': {...sale, 'method': 1},
      'one item': {
        ...sale,
        'items': [
          {'product': {'name': 'Small Chips', 'price': 3.3}, 'quantity': 1},
        ],
        'total': 3.3,
      },
    }.entries) {
      test('${entry.key} receipt prints cleanly', () {
        final bytes = PrinterService.buildReceipt(entry.value, settings).bytes;
        final paper = SimulatedPrinter.run(bytes);
        expect(paper.errors, isEmpty);
        expect(paper.cut, isTrue);
        expect(paper.text.join('\n'), isNot(contains('\u{FFFD}')));
        expect(paper.text.join('\n'), isNot(contains('ú')));
      });
    }

    test('layout matches the reference receipt', () {
      final paper = SimulatedPrinter.run(PrinterService.buildReceipt(sale, settings).bytes);
      final text = paper.text;
      // ignore: avoid_print
      print(text.map((l) => '|${l.padRight(SimulatedPrinter.columns)}|').join('\n'));

      bool centred(String s) {
        final line = paper.lines.firstWhere((l) => l.chars.map((c) => c.ch).join() == s);
        final used = line.chars.fold(0, (n, c) => n + (c.dw ? 2 : 1)) * SimulatedPrinter.cellW;
        final right = SimulatedPrinter.printDots - used - line.offsetDots;
        return (line.offsetDots - right).abs() <= SimulatedPrinter.cellW;
      }

      expect(centred('CRISPY COD'), isTrue);
      expect(centred('NEATH'), isTrue);
      expect(centred('Dispatch Time: ASAP'), isTrue);
      expect(centred('Collection'), isTrue);
      expect(centred('Thank You, Please call again...'), isTrue);

      // Prices end exactly at the right edge.
      for (final price in ['£7.50', '£10.00', '£33.30', '£50.00', '£16.70']) {
        expect(text.any((l) => l.endsWith(price) && l.length == SimulatedPrinter.columns), isTrue, reason: price);
      }
      expect(text, contains(' Date: 17-09-26             Time: 11:40 PM'));

      final shop = paper.lines.firstWhere((l) => l.chars.map((c) => c.ch).join() == 'CRISPY COD');
      expect(shop.chars.first.dw && shop.chars.first.dh, isTrue);
      final total = paper.lines.firstWhere((l) => l.chars.isNotEmpty && l.chars.first.ch == 'T' && l.chars.first.dw);
      expect(total.chars.map((c) => c.ch).join(), 'Total:${' ' * 9}£33.30'); // 21 double-width chars = 42 columns
      expect(total.chars.first.bold, isTrue);

      final out = File('build/receipt_simulation.png')..createSync(recursive: true);
      out.writeAsBytesSync(paper.renderPng());
    });
  });
}
