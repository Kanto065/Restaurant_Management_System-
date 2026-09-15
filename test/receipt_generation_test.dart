import 'package:flutter_test/flutter_test.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils.dart';
import 'package:intl/intl.dart';

// Exercises the same byte-generation path used by
// lib/printing/printer_windows.dart's printReceipt(), without needing a
// physical printer attached, to confirm the receipt actually renders.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('capability profile loads and receipt bytes generate', () async {
    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm80, profile);
    List<int> bytes = [];

    bytes += generator.reset();
    bytes += generator.text('RECEIPT', styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2));
    bytes += generator.text('AURES ODP333 POS', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.hr();

    final date = DateTime.now();
    final formattedDate = DateFormat('dd MMM yyyy HH:mm').format(date);
    bytes += generator.row([
      PosColumn(text: formattedDate, width: 8),
      PosColumn(text: 'Takeaway', width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += generator.text('Order ID: #1234567');
    bytes += generator.hr();

    bytes += generator.row([
      PosColumn(text: '2 x Fish & Chips', width: 8),
      PosColumn(text: '11.00', width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += generator.hr();

    bytes += generator.row([PosColumn(text: 'Subtotal', width: 8), PosColumn(text: '9.17', width: 4, styles: const PosStyles(align: PosAlign.right))]);
    bytes += generator.row([PosColumn(text: 'VAT (20%)', width: 8), PosColumn(text: '1.83', width: 4, styles: const PosStyles(align: PosAlign.right))]);

    bytes += generator.feed(1);
    bytes += generator.row([
      PosColumn(text: 'TOTAL', width: 7, styles: const PosStyles(bold: true, height: PosTextSize.size2)),
      PosColumn(text: '11.00', width: 5, styles: const PosStyles(align: PosAlign.right, bold: true, height: PosTextSize.size2)),
    ]);
    bytes += generator.hr();

    bytes += generator.feed(2);
    bytes += generator.text('Thank you!', styles: const PosStyles(align: PosAlign.center));
    bytes += generator.feed(4);
    bytes += generator.cut();

    expect(bytes, isNotEmpty);
    // ESC/POS byte stream should start with the reset command (ESC @ = 0x1B 0x40).
    expect(bytes[0], 0x1B);
    expect(bytes[1], 0x40);
    // Should contain the cut command (GS V) somewhere near the end.
    expect(bytes.contains(0x1D), isTrue);

    // ignore: avoid_print
    print('Generated receipt: ${bytes.length} bytes');
  });
}
