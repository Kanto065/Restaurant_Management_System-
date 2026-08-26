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

// 80mm paper fits ~32 characters per line at SunmiFontSize.MD (24pt) - which
// SunmiPrinter.line()'s internal resetFontSize() call actually resets *to*
// (its own doc comment: "reset the font size to the medium (default) size"),
// so every _printRow call already lands at MD even without an explicit
// setFontSize. LG (36pt) is used for items/totals to match the reference
// receipt's bigger item text; 24/36 of 32 is ~21 chars, though the real
// figure needs confirming on the actual printer - adjust _itemRowWidth below
// once tested.
const _rowWidth = 32;
const _itemRowWidth = 21;

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
        // Reverse video only paints the characters actually sent, not the
        // rest of the line - SunmiPrintAlign.CENTER on its own just centers
        // "DELIVERY" itself, leaving white margin either side instead of a
        // full-width block, so the label is manually space-padded to
        // _rowWidth and sent left-aligned instead, which puts the reverse
        // background under the whole line. Kept at MD (not LG) since MD is
        // the size _rowWidth is calibrated against elsewhere in this file.
        await SunmiPrinter.line();
        await SunmiPrinter.setFontSize(SunmiFontSize.MD);
        await SunmiPrinter.printRawData(Uint8List.fromList([29, 66, 1]));
        await SunmiPrinter.printText(
          _padCenter(receipt.orderTypeLabel, _rowWidth),
          style: SunmiStyle(bold: true, align: SunmiPrintAlign.LEFT),
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

        if (receipt.items.isNotEmpty) {
          await SunmiPrinter.line();
          await SunmiPrinter.setFontSize(SunmiFontSize.LG);
          // Title case, not ITEMS/PRICE - capital "I" prints corrupted at LG
          // size on this hardware/firmware (confirmed on a real receipt:
          // "ITEMS"/"PRICE" came out "TTEMS"/"PRTCE"), while lowercase "i" in
          // item names prints fine, so this sidesteps the glyph entirely.
          await _printRow('Items', 'Price', width: _itemRowWidth);
          for (final row in receipt.items) {
            await _printRow(row.left, row.right, bold: row.bold, width: _itemRowWidth);
          }
        }

        if (receipt.totals.isNotEmpty) {
          await SunmiPrinter.line();
          await SunmiPrinter.setFontSize(SunmiFontSize.LG);
          for (final row in receipt.totals) {
            await _printRow(row.left, row.right, bold: row.bold, width: _itemRowWidth);
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
  Future<void> _printRow(String label, String value, {bool bold = false, int width = _rowWidth}) async {
    final labelBytes = utf8.encode(label).length;
    final valueBytes = utf8.encode(value).length;
    final gap = width - labelBytes - valueBytes;
    if (bold) await SunmiPrinter.bold();
    if (value.isEmpty || gap >= 1) {
      await SunmiPrinter.printText(gap >= 1 ? '$label${' ' * gap}$value' : '$label $value');
    } else {
      // The label alone doesn't leave room for the price on this line -
      // print the label on its own line and right-align the price on the
      // next, rather than letting the firmware's own line-wrap handle the
      // overflow (it corrupts the tail instead of wrapping cleanly, per the
      // byte-width note above - this was printing the price on a line by
      // itself anyway, just without the right-alignment).
      await SunmiPrinter.printText(label);
      final valueGap = (width - valueBytes).clamp(0, width);
      await SunmiPrinter.printText('${' ' * valueGap}$value');
    }
    if (bold) await SunmiPrinter.resetBold();
  }

  String _padCenter(String text, int width) {
    final len = utf8.encode(text).length;
    if (len >= width) return text;
    final totalPad = width - len;
    final left = totalPad ~/ 2;
    final right = totalPad - left;
    return '${' ' * left}$text${' ' * right}';
  }
}
