import 'package:flutter/services.dart';

import 'receipt_formatter.dart';

class PrinterException implements Exception {
  final String message;
  PrinterException(this.message);
  @override
  String toString() => message;
}

/// Drives the Sunmi terminal's built-in 80mm printer through a platform
/// channel to the Sunmi Printer Service AIDL binder (see
/// android/android/app/src/main/kotlin/.../SunmiPrinterPlugin.kt, ported from
/// the archived native Kotlin app's PrinterManager). Every terminal this app
/// runs on is a Sunmi V2 with a built-in printer, so this is the only
/// transport supported - no USB/LAN printer picker.
class PrinterService {
  static const _channel = MethodChannel('com.porttennanttandoori.pos/sunmi_printer');

  Future<bool> isSunmiAvailable() async {
    try {
      final result = await _channel.invokeMethod<bool>('isAvailable');
      return result ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  Future<void> printReceipt(Receipt receipt, {int copies = 1}) async {
    final n = copies.clamp(1, 3);
    try {
      await _channel.invokeMethod('printReceipt', {
        'title': receipt.title,
        'subtitle': receipt.subtitle,
        'lines': receipt.lines,
        'copies': n,
      });
    } on MissingPluginException {
      throw PrinterException('Sunmi printer service is not available on this device.');
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'Sunmi printer failed.');
    }
  }
}
