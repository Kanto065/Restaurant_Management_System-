import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:my_pos/core/report.dart';
import 'package:my_pos/printing/pos_receipts.dart';
import 'package:my_pos/printing/receipt_builder.dart';

import 'escpos_printer_simulator.dart';
import 'sample_orders.dart';

// Runs the real receipt bytes through the ODP 333 simulator: no physical printer needed.
void main() {
  test('pound sign is CP437 0x9C, never Latin-1 0xA3', () {
    expect(ReceiptBuilder.encodeCp437('£5.50'), [0x9C, 0x35, 0x2E, 0x35, 0x30]);
    final bytes = buildOrderReceipt(dineInCash(), restaurant).bytes;
    expect(bytes.contains(0x9C), isTrue);
    expect(bytes.contains(0xA3), isFalse);
  });

  test('uses ESC a for alignment and never ESC \$ absolute positioning', () {
    final bytes = buildOrderReceipt(dineInCash(), restaurant).bytes;
    expect(bytes.sublist(0, 2), [0x1B, 0x40]);
    for (var i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] == 0x1B) expect(bytes[i + 1], isNot(0x24));
    }
  });

  group('simulated ODP 333 printout', () {
    final docs = {
      'dine-in cash receipt': buildOrderReceipt(dineInCash(), restaurant).bytes,
      'takeaway card receipt': buildOrderReceipt(takeawayCard(), restaurant).bytes,
      'bill': buildOrderReceipt(dineInCash(), restaurant, bill: true).bytes,
      'day report': buildDayReport(DayReport.build(DateTime(2026, 10, 2), [dineInCash(), takeawayCard()], []), restaurant, printedBy: 'Amira').bytes,
      'test page': testPage('Kitchen'),
    };
    for (final e in docs.entries) {
      test('${e.key} prints cleanly within 42 columns', () {
        final paper = SimulatedPrinter.run(e.value);
        expect(paper.errors, isEmpty, reason: paper.errors.join('\n'));
        expect(paper.cut, isTrue);
        expect(paper.text.join('\n'), isNot(contains('\u{FFFD}')));
      });
    }

    test('receipt content: modifiers, notes, discount, change; void lines left off', () {
      final paper = SimulatedPrinter.run(buildOrderReceipt(dineInCash(), restaurant).bytes);
      final text = paper.text.join('\n');
      // ignore: avoid_print
      print(paper.text.map((l) => '|${l.padRight(SimulatedPrinter.columns)}|').join('\n'));
      expect(text, contains('2 x Chicken Tikka Masala'));
      expect(text, contains('+ Pilau rice'));
      expect(text, contains('* one mild'));
      expect(text, contains('Discount (Regular)'));
      expect(text, contains('Cash given'));
      expect(text, isNot(contains('Cobra')));
      // Subtotal 2x10.95 + 3x3.50 + 5.95 = 38.35; 10% off = 3.84 (rounded) -> 34.51; change 15.49.
      expect(paper.text.any((l) => l.endsWith('£38.35')), isTrue);
      expect(paper.text.any((l) => l.endsWith('-£3.84')), isTrue);
      expect(paper.text.any((l) => l.endsWith('£15.49')), isTrue);
      File('build/receipt_simulation.png')
        ..createSync(recursive: true)
        ..writeAsBytesSync(paper.renderPng());
    });

    test('drawer kick is ESC p and nothing else', () {
      final paper = SimulatedPrinter.run(drawerKick());
      expect(paper.drawerOpened, isTrue);
      expect(paper.errors, isEmpty);
    });
  });
}

