import 'package:sunmi_printer_plus/column_maker.dart';
import 'package:sunmi_printer_plus/enums.dart';
import 'package:sunmi_printer_plus/sunmi_printer_plus.dart';
import 'package:sunmi_printer_plus/sunmi_style.dart';

import 'receipt_formatter.dart';

class PrinterException implements Exception {
  final String message;
  PrinterException(this.message);
  @override
  String toString() => message;
}

// 80mm paper at the default font fits ~32 characters per line - split between
// the item/label column and the right-aligned price column.
const _labelWidth = 22;
const _priceWidth = 10;

/// Drives the Sunmi terminal's built-in 80mm printer via the sunmi_printer_plus
/// package - swapped in after a hand-rolled binding straight to the same
/// woyou.aidlservice.jiuiv5 Sunmi Printer Service proved unreliable on this
/// exact hardware/firmware (silently printed a blank strip: the AIDL calls
/// all returned success with nothing rendered), while this package's own demo
/// app printed correctly every time on the same terminal. Every terminal this
/// app runs on is a Sunmi V2 with a built-in printer, so this is the only
/// transport supported - no USB/LAN printer picker.
class PrinterService {
  Future<bool> isSunmiAvailable() async {
    try {
      final bound = await SunmiPrinter.bindingPrinter();
      return bound ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Binds, prints, unbinds on every call - matches the reference app's own
  /// per-job bind/init/…/unbind sequence exactly (rather than staying bound
  /// long-term), since that's the pattern confirmed to actually print on this
  /// hardware.
  Future<void> printReceipt(Receipt receipt, {int copies = 1}) async {
    final n = copies.clamp(1, 3);
    try {
      for (var i = 0; i < n; i++) {
        await SunmiPrinter.bindingPrinter();
        await SunmiPrinter.initPrinter();

        await SunmiPrinter.setAlignment(SunmiPrintAlign.CENTER);
        for (var j = 0; j < receipt.header.length; j++) {
          await SunmiPrinter.printText(
            receipt.header[j],
            style: SunmiStyle(
              bold: j == 0,
              fontSize: j == 0 ? SunmiFontSize.MD : SunmiFontSize.SM,
              align: SunmiPrintAlign.CENTER,
            ),
          );
        }

        await SunmiPrinter.setAlignment(SunmiPrintAlign.LEFT);
        await SunmiPrinter.line();
        for (final line in receipt.meta) {
          await SunmiPrinter.printText(line);
        }

        if (receipt.customer.isNotEmpty) {
          await SunmiPrinter.line();
          for (final line in receipt.customer) {
            await SunmiPrinter.printText(line);
          }
        }

        if (receipt.items.isNotEmpty) {
          await SunmiPrinter.line();
          await _printRow('ITEMS', 'PRICE');
          await SunmiPrinter.lineWrap(1);
          for (final row in receipt.items) {
            await _printRow(row.left, row.right, bold: row.bold);
          }
        }

        if (receipt.totals.isNotEmpty) {
          await SunmiPrinter.line();
          for (final row in receipt.totals) {
            await _printRow(row.left, row.right, bold: row.bold);
          }
        }
        if (receipt.paymentLine.isNotEmpty) {
          await SunmiPrinter.printText(receipt.paymentLine);
        }

        await SunmiPrinter.lineWrap(1);
        await SunmiPrinter.setAlignment(SunmiPrintAlign.CENTER);
        for (final line in receipt.footer) {
          await SunmiPrinter.printText(line);
        }

        await SunmiPrinter.lineWrap(4);
        await SunmiPrinter.cut();
        await SunmiPrinter.unbindingPrinter();
      }
    } catch (e) {
      throw PrinterException('Sunmi printer failed: $e');
    }
  }

  Future<void> _printRow(String label, String value, {bool bold = false}) async {
    if (bold) await SunmiPrinter.bold();
    await SunmiPrinter.printRow(cols: [
      ColumnMaker(text: label, width: _labelWidth, align: SunmiPrintAlign.LEFT),
      ColumnMaker(text: value, width: _priceWidth, align: SunmiPrintAlign.RIGHT),
    ]);
    if (bold) await SunmiPrinter.resetBold();
  }
}
