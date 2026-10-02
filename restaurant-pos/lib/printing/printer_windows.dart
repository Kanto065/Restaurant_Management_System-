import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_pos_printer_platform/flutter_pos_printer_platform.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'printer_interface.dart';
import 'receipt_builder.dart';
import 'receipt_settings.dart';

class PrinterService implements PrinterBase {
  static final PrinterService _instance = PrinterService._internal();
  factory PrinterService() => _instance;
  PrinterService._internal();

  final PrinterManager _printerManager = PrinterManager.instance;
  String? _selectedName;

  final _statusController = StreamController<String>.broadcast();
  @override
  Stream<String> get statusStream => _statusController.stream;

  @override
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _selectedName = prefs.getString('selected_printer_name');
  }

  @override
  Future<List<Map<String, dynamic>>> getAvailablePrinters() async {
    List<Map<String, dynamic>> devices = [];
    final completer = Completer<List<Map<String, dynamic>>>();

    StreamSubscription? subscription;
    subscription = _printerManager.discovery(type: PrinterType.usb).listen(
      (device) {
        if (!devices.any((d) => d['name'] == device.name)) {
          devices.add({
            'name': device.name,
            'address': device.address,
            'type': PrinterType.usb.index, // Fixed: PrinterDevice 1.4.2 does not have a 'type' property
          });
        }
      },
      onError: (e) {
        if (!completer.isCompleted) completer.complete(devices);
      },
      onDone: () {
        if (!completer.isCompleted) completer.complete(devices);
      },
    );

    Future.delayed(const Duration(seconds: 2), () {
      subscription?.cancel();
      if (!completer.isCompleted) completer.complete(devices);
    });

    return completer.future;
  }

  @override
  Future<void> selectPrinter(Map<String, dynamic> deviceMap) async {
    _selectedName = deviceMap['name'];
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('selected_printer_name', _selectedName!);
    _statusController.add("Printer selected: $_selectedName");
  }

  @override
  String? get selectedPrinterName => _selectedName;

  @override
  Future<bool> printTestReceipt() async {
    if (_selectedName == null) {
      _statusController.add("Printer not connected.");
      return false;
    }

    try {
      final r = ReceiptBuilder();
      r.reset();
      r.divider('=');
      r.text('TEST PRINT', align: ReceiptAlign.center, bold: true, doubleWidth: true, doubleHeight: true);
      r.text('AURES ODP333', align: ReceiptAlign.center, bold: true);
      r.text('PRINTER WORKING', align: ReceiptAlign.center, bold: true);
      r.leftRight('Left edge', 'Right edge');
      r.leftRight('Pound sign', '£1.23');
      r.divider('=');
      r.cut();

      return await _sendToPrinter(r.bytes);
    } catch (e) {
      _statusController.add("Test print failed: $e");
      return false;
    }
  }

  /// Lays out the receipt once; the same builder yields both the ESC/POS
  /// bytes sent to the printer and the text preview logged to the console.
  static ReceiptBuilder buildReceipt(Map<String, dynamic> saleData, ReceiptSettings settings) {
    final r = ReceiptBuilder();

    r.reset();
    r.text(settings.shopName, align: ReceiptAlign.center, doubleWidth: true, doubleHeight: true);
    for (final line in settings.addressLines) {
      if (line.trim().isEmpty) continue;
      r.text(line, align: ReceiptAlign.center);
    }
    r.blank();

    final DateTime date = saleData['date'] is DateTime ? saleData['date'] : DateTime.tryParse(saleData['date'].toString()) ?? DateTime.now();
    r.leftRight('Date: ${DateFormat('dd-MM-yy').format(date)}', 'Time: ${DateFormat('hh:mm a').format(date)}', indent: 1);
    r.leftRight('Server: ${settings.serverName}', 'Type:Collection', indent: 1);
    r.divider();

    r.text('Dispatch Time: ASAP', align: ReceiptAlign.center, bold: true, doubleHeight: true);
    r.divider();

    r.text('Collection', align: ReceiptAlign.center);
    r.text('Customer: ${settings.customerName}', align: ReceiptAlign.center);
    r.divider();

    final List items = saleData['items'] ?? [];
    int itemCount = 0;
    for (var item in items) {
      final product = item['product'];
      final String name = product['name'];
      final int qty = item['quantity'];
      itemCount += qty;
      final double price = (product['price'] as num).toDouble();
      r.leftRight('$qty x $name', '£${(price * qty).toStringAsFixed(2)}', indent: 1);
    }
    r.divider();

    final double total = (saleData['total'] as num).toDouble();

    r.leftRight('Sub total: ($itemCount Item${itemCount == 1 ? '' : 's'})', '£${total.toStringAsFixed(2)}');
    r.divider();

    r.leftRight('Total:', '£${total.toStringAsFixed(2)}', bold: true, doubleWidth: true);
    r.divider();
    r.blank();

    final int methodIndex = (saleData['method'] is int)
        ? saleData['method']
        : (saleData['method'] == 'PaymentMethod.cash' ? 0 : 1);

    r.leftRight('Paid: (${methodIndex == 0 ? 'Cash' : 'Card'})', '£${total.toStringAsFixed(2)}');

    if (methodIndex == 0) {
      final double received = (saleData['cashReceived'] as num?)?.toDouble() ?? 0.0;
      final double change = (saleData['change'] as num?)?.toDouble() ?? 0.0;
      r.leftRight('Received', '£${received.toStringAsFixed(2)}');
      r.leftRight('Change', '£${change.toStringAsFixed(2)}');
    }

    r.blank();
    r.text('Thank You, Please call again...', align: ReceiptAlign.center);
    r.cut();
    return r;
  }

  void _logConsolePreview(ReceiptBuilder receipt) {
    debugPrint('');
    debugPrint('===== RECEIPT PREVIEW (${receipt.width} columns) =====');
    for (final line in receipt.preview) {
      debugPrint('|${line.padRight(receipt.width)}|');
    }
    debugPrint('=' * (receipt.width + 2));
    debugPrint('');
  }

  @override
  Future<bool> printReceipt(Map<String, dynamic> saleData) async {
    final ReceiptBuilder receipt;
    try {
      receipt = buildReceipt(saleData, ReceiptSettings());
    } catch (e) {
      debugPrint("Printing error: $e");
      _statusController.add("Transaction saved, but receipt printing failed.");
      return false;
    }
    _logConsolePreview(receipt);

    if (_selectedName == null) {
      _statusController.add("Printer not connected. (Preview printed to console.)");
      return false;
    }

    final success = await _sendToPrinter(receipt.bytes);
    if (!success) {
      _statusController.add("Transaction saved, but receipt printing failed.");
    }
    return success;
  }

  Future<bool> _sendToPrinter(List<int> bytes) async {
    if (_selectedName == null) return false;

    try {
      bool isConnected = await _printerManager.connect(
        type: PrinterType.usb,
        model: UsbPrinterInput(name: _selectedName!)
      );

      if (isConnected) {
        bool sent = await _printerManager.send(type: PrinterType.usb, bytes: bytes);
        await Future.delayed(const Duration(milliseconds: 500));
        await _printerManager.disconnect(type: PrinterType.usb);
        return sent;
      } else {
        _statusController.add("Printer not connected.");
        return false;
      }
    } catch (e) {
      debugPrint("Native printing error: $e");
      _statusController.add("Printer not connected.");
      return false;
    }
  }
}
