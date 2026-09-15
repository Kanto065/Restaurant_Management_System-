import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_pos_printer_platform/flutter_pos_printer_platform.dart';
// Fix: Correct import path for esc_pos_utils_plus 2.0.1+6
import 'package:esc_pos_utils_plus/esc_pos_utils.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'printer_interface.dart';

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
      final profile = await CapabilityProfile.load();
      final generator = Generator(PaperSize.mm80, profile);
      List<int> bytes = [];

      bytes += generator.reset();
      bytes += generator.text('================================', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.text('TEST PRINT', styles: const PosStyles(align: PosAlign.center, bold: true));
      bytes += generator.text('AURES ODP333', styles: const PosStyles(align: PosAlign.center, bold: true));
      bytes += generator.text('PRINTER WORKING', styles: const PosStyles(align: PosAlign.center, bold: true));
      bytes += generator.text('================================', styles: const PosStyles(align: PosAlign.center));
      
      bytes += generator.feed(3);
      bytes += generator.cut();

      return await _sendToPrinter(bytes);
    } catch (e) {
      _statusController.add("Test print failed: $e");
      return false;
    }
  }

  @override
  Future<bool> printReceipt(Map<String, dynamic> saleData) async {
    if (_selectedName == null) {
      _statusController.add("Printer not connected.");
      return false;
    }

    try {
      final profile = await CapabilityProfile.load();
      final generator = Generator(PaperSize.mm80, profile);
      List<int> bytes = [];

      bytes += generator.reset();
      
      bytes += generator.text('RECEIPT', styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2));
      bytes += generator.text('AURES ODP333 POS', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.text('VAT No: 123456789', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.hr();

      final DateTime date = saleData['date'] is DateTime ? saleData['date'] : DateTime.tryParse(saleData['date'].toString()) ?? DateTime.now();
      final String formattedDate = DateFormat('dd MMM yyyy HH:mm').format(date);
      
      bytes += generator.row([
        PosColumn(text: formattedDate, width: 8),
        PosColumn(text: 'Takeaway', width: 4, styles: const PosStyles(align: PosAlign.right)),
      ]);
      bytes += generator.text('Order ID: ${saleData['id']}');
      bytes += generator.hr();

      final List items = saleData['items'] ?? [];
      for (var item in items) {
        final product = item['product'];
        final String name = product['name'];
        final int qty = item['quantity'];
        final double price = (product['price'] as num).toDouble();
        bytes += generator.row([
          PosColumn(text: '$qty x $name', width: 8),
          PosColumn(text: (price * qty).toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
        ]);
      }
      bytes += generator.hr();

      final double total = (saleData['total'] as num).toDouble();
      final double vat = total * 0.2 / 1.2; 
      
      bytes += generator.row([
        PosColumn(text: 'Subtotal', width: 8), 
        PosColumn(text: (total - vat).toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right))
      ]);
      bytes += generator.row([
        PosColumn(text: 'VAT (20%)', width: 8), 
        PosColumn(text: vat.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right))
      ]);
      
      bytes += generator.feed(1);
      bytes += generator.row([
        PosColumn(text: 'TOTAL', width: 7, styles: const PosStyles(bold: true, height: PosTextSize.size2)),
        PosColumn(text: total.toStringAsFixed(2), width: 5, styles: const PosStyles(align: PosAlign.right, bold: true, height: PosTextSize.size2)),
      ]);
      bytes += generator.hr();

      final int methodIndex = (saleData['method'] is int) 
          ? saleData['method'] 
          : (saleData['method'] == 'PaymentMethod.cash' ? 0 : 1);
          
      bytes += generator.row([
        PosColumn(text: 'Paid by', width: 8),
        PosColumn(text: (methodIndex == 0) ? 'Cash' : 'Card', width: 4, styles: const PosStyles(align: PosAlign.right)),
      ]);

      if (methodIndex == 0) {
        bytes += generator.text('Received: ${(saleData['cashReceived'] as num?)?.toDouble().toStringAsFixed(2) ?? '0.00'}');
        bytes += generator.text('Change:   ${(saleData['change'] as num?)?.toDouble().toStringAsFixed(2) ?? '0.00'}');
      }

      bytes += generator.feed(2);
      bytes += generator.text('Thank you!', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.feed(4);
      bytes += generator.cut();

      final success = await _sendToPrinter(bytes);
      if (!success) {
        _statusController.add("Transaction saved, but receipt printing failed.");
      }
      return success;
    } catch (e) {
      debugPrint("Printing error: $e");
      _statusController.add("Transaction saved, but receipt printing failed.");
      return false;
    }
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
