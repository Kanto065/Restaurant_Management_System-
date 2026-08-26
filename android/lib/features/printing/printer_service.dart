import 'dart:convert';
import 'dart:typed_data';

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
const _rowWidth = 32;

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

        // Reverse video (GS B 1 / GS B 0) - same raw-ESC/POS mechanism bold()/
        // resetBold() already use on this hardware - to render the order type
        // as a dark banner with white text, matching the reference receipt.
        await SunmiPrinter.line();
        await SunmiPrinter.printRawData(Uint8List.fromList([29, 66, 1]));
        await SunmiPrinter.printText(
          receipt.orderTypeLabel,
          style: SunmiStyle(bold: true, fontSize: SunmiFontSize.LG, align: SunmiPrintAlign.CENTER),
        );
        await SunmiPrinter.printRawData(Uint8List.fromList([29, 66, 0]));

        // SunmiPrinter.line() resets font size internally, so MD has to be
        // re-applied after every line() call, not just once up front.
        await SunmiPrinter.setAlignment(SunmiPrintAlign.LEFT);
        await SunmiPrinter.line();
        await SunmiPrinter.setFontSize(SunmiFontSize.MD);
        for (final line in receipt.meta) {
          await SunmiPrinter.printText(line);
        }

        if (receipt.customer.isNotEmpty) {
          await SunmiPrinter.line();
          await SunmiPrinter.setFontSize(SunmiFontSize.MD);
          for (final line in receipt.customer) {
            await SunmiPrinter.printText(line);
          }
        }

        // Items/totals keep the default (unset) font size deliberately - they're
        // rendered through _printRow's fixed 32-char width padding (tuned for
        // that size to work around a firmware wrapping bug, see below); bumping
        // the font here would shrink the real chars-per-line and reintroduce
        // that same wrapping bug, so only the free-flowing single-column
        // sections (meta/customer above) get the larger MD size.
        if (receipt.items.isNotEmpty) {
          await SunmiPrinter.line();
          await _printRow('ITEMS', 'PRICE');
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
        await SunmiPrinter.resetFontSize();

        await SunmiPrinter.lineWrap(1);
        await SunmiPrinter.setAlignment(SunmiPrintAlign.CENTER);
        for (final line in receipt.footer) {
          await SunmiPrinter.printText(line, style: SunmiStyle(align: SunmiPrintAlign.CENTER));
        }

        await SunmiPrinter.lineWrap(4);
        await SunmiPrinter.cut();
        await SunmiPrinter.unbindingPrinter();
      }
    } catch (e) {
      throw PrinterException('Sunmi printer failed: $e');
    }
  }

  // printRow's ColumnMaker occasionally corrupts a row's tail into a wrapped
  // fragment on this hardware/firmware (e.g. "PRICE" splitting into "PRIC" +
  // a stray "E" on the next line) - manually padding to a fixed width and
  // sending it through printText (the same call meta/customer lines already
  // use without issue) is deterministic and avoids that plugin-internal quirk.
  //
  // The printer's line-wrap counts UTF-8 *bytes*, not Dart String.length
  // (UTF-16 code units) - "£" is 1 code unit but 2 bytes, so any row with a
  // price was silently 1 byte over the real limit and wrapped its last
  // character (e.g. "£1.30" printing "£1.3" then a stray "0" below). Padding
  // must be sized off the UTF-8 byte length, not the character count.
  Future<void> _printRow(String label, String value, {bool bold = false}) async {
    final gap = _rowWidth - utf8.encode(label).length - utf8.encode(value).length;
    final line = gap > 0 ? '$label${' ' * gap}$value' : '$label $value';
    if (bold) await SunmiPrinter.bold();
    await SunmiPrinter.printText(line);
    if (bold) await SunmiPrinter.resetBold();
  }
}
