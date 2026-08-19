import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

import 'receipt_formatter.dart';

enum PrinterTransport { sunmiInternal, starUsb, epsonLan }

class PrinterDescriptor {
  final String id;
  final String name;
  final String detail;
  final PrinterTransport transport;
  final String? lanAddress; // host:port, epson only

  const PrinterDescriptor({
    required this.id,
    required this.name,
    required this.detail,
    required this.transport,
    this.lanAddress,
  });
}

const defaultPrinters = [
  PrinterDescriptor(
    id: 'sunmi',
    name: 'Sunmi internal',
    detail: '80mm built-in printer',
    transport: PrinterTransport.sunmiInternal,
  ),
  PrinterDescriptor(
    id: 'star',
    name: 'Star TSP143',
    detail: 'USB',
    transport: PrinterTransport.starUsb,
  ),
  PrinterDescriptor(
    id: 'epson',
    name: 'Epson TM-T20III',
    detail: 'LAN · 192.168.1.50',
    transport: PrinterTransport.epsonLan,
    lanAddress: '192.168.1.50:9100',
  ),
];

class PrinterException implements Exception {
  final String message;
  PrinterException(this.message);
  @override
  String toString() => message;
}

/// Printer abstraction, decoupled from the specific transport - mirrors
/// PrinterManager.kt's Receipt shape. The Sunmi built-in printer is driven
/// through a platform channel to the Sunmi Printer Service AIDL binder (see
/// android/android/app/src/main/kotlin/.../SunmiPrinterPlugin.kt, ported from
/// the archived native Kotlin app's PrinterManager - not yet verified against
/// a physical Sunmi terminal). External printers use raw ESC/POS bytes: LAN
/// over a TCP socket to port 9100 (works today, no hardware needed to
/// compile), USB stubbed - Android USB host access needs a native plugin this
/// pass didn't have hardware to build/verify against.
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

  Future<void> printReceipt(PrinterDescriptor printer, Receipt receipt, {int copies = 1}) async {
    final n = copies.clamp(1, 3);
    switch (printer.transport) {
      case PrinterTransport.sunmiInternal:
        await _printSunmi(receipt, n);
      case PrinterTransport.epsonLan:
        await _printEscPosLan(printer, receipt, n);
      case PrinterTransport.starUsb:
        // TODO: Android USB host (UsbManager) ESC/POS transport - needs a
        // native plugin + real USB hardware to implement/verify. Not stubbed
        // as "success" so callers surface a real failure instead of lying
        // about a print that didn't happen.
        throw PrinterException('USB printing isn\'t wired up yet - needs the Star driver on real hardware.');
    }
  }

  Future<void> _printSunmi(Receipt receipt, int copies) async {
    try {
      await _channel.invokeMethod('printReceipt', {
        'title': receipt.title,
        'subtitle': receipt.subtitle,
        'lines': receipt.lines,
        'copies': copies,
      });
    } on MissingPluginException {
      throw PrinterException('Sunmi printer service is not available on this device.');
    } on PlatformException catch (e) {
      throw PrinterException(e.message ?? 'Sunmi printer failed.');
    }
  }

  Future<void> _printEscPosLan(PrinterDescriptor printer, Receipt receipt, int copies) async {
    final address = printer.lanAddress;
    if (address == null) throw PrinterException('No LAN address configured for ${printer.name}.');
    final parts = address.split(':');
    final host = parts[0];
    final port = int.tryParse(parts.length > 1 ? parts[1] : '9100') ?? 9100;

    Socket? socket;
    try {
      socket = await Socket.connect(host, port, timeout: const Duration(seconds: 5));
      final bytes = _escPosBytes(receipt, copies);
      socket.add(bytes);
      await socket.flush();
    } on SocketException catch (e) {
      throw PrinterException('Could not reach ${printer.name} at $address: ${e.message}');
    } finally {
      await socket?.close();
    }
  }

  /// Builds raw ESC/POS commands: init, bold+centered title, left-aligned
  /// body lines, feed, cut - repeated per copy. Kept dependency-free (no
  /// esc_pos_* package) since the byte sequences involved are small.
  List<int> _escPosBytes(Receipt receipt, int copies) {
    final out = <int>[];
    const esc = 0x1B;
    const gs = 0x1D;
    void raw(List<int> bytes) => out.addAll(bytes);
    void text(String s) => out.addAll(utf8.encode(s));

    for (var i = 0; i < copies; i++) {
      raw([esc, 0x40]); // init
      raw([esc, 0x61, 0x01]); // center
      raw([esc, 0x45, 0x01]); // bold on
      text('${receipt.title}\n');
      raw([esc, 0x45, 0x00]); // bold off
      raw([esc, 0x61, 0x00]); // left
      text('${receipt.subtitle}\n\n');
      for (final line in receipt.lines) {
        text('$line\n');
      }
      raw([0x0A, 0x0A, 0x0A, 0x0A]); // feed
      raw([gs, 0x56, 0x00]); // full cut
    }
    return out;
  }
}
