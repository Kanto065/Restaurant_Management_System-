import 'package:flutter/foundation.dart';
import 'package:flutter_pos_printer_platform/flutter_pos_printer_platform.dart';

import '../core/db.dart';

/// USB / Windows printers by name (e.g. the Aures ODP 333 receipt printer).
/// LAN printers don't come through here - see PrinterRouter.
class PrinterService {
  static final PrinterService _instance = PrinterService._internal();
  factory PrinterService() => _instance;
  PrinterService._internal();

  final PrinterManager _printerManager = PrinterManager.instance;
  LocalDb? _db;

  /// The printer picked on this till, used when the admin has no receipt printer configured.
  String? get selectedPrinterName => _db?.get('printer.selected');

  void init(LocalDb db) => _db = db;

  Future<List<String>> availablePrinters() async {
    final names = <String>{};
    try {
      await for (final device in _printerManager.discovery(type: PrinterType.usb).timeout(const Duration(seconds: 2), onTimeout: (s) => s.close())) {
        names.add(device.name);
      }
    } catch (e) {
      debugPrint('Printer discovery failed: $e');
    }
    return names.toList()..sort();
  }

  void selectPrinter(String name) => _db?.set('printer.selected', name);

  /// Sends raw ESC/POS bytes to [printerName] (or the selected printer). False if it can't.
  Future<bool> sendBytes(List<int> bytes, {String? printerName}) async {
    final name = printerName ?? selectedPrinterName;
    if (name == null || name.isEmpty) return false;
    try {
      final connected = await _printerManager.connect(type: PrinterType.usb, model: UsbPrinterInput(name: name));
      if (!connected) return false;
      final sent = await _printerManager.send(type: PrinterType.usb, bytes: bytes);
      await Future.delayed(const Duration(milliseconds: 500));
      await _printerManager.disconnect(type: PrinterType.usb);
      return sent;
    } catch (e) {
      debugPrint('Native printing error: $e');
      return false;
    }
  }
}
