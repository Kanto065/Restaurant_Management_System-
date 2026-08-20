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
        await SunmiPrinter.printText(
          receipt.title,
          style: SunmiStyle(bold: true, fontSize: SunmiFontSize.MD, align: SunmiPrintAlign.CENTER),
        );
        await SunmiPrinter.printText(receipt.subtitle, style: SunmiStyle(align: SunmiPrintAlign.LEFT));
        await SunmiPrinter.lineWrap(1);
        for (final line in receipt.lines) {
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
}
