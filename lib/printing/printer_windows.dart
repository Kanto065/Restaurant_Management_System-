import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_pos_printer_platform/flutter_pos_printer_platform.dart';
// Fix: Correct import path for esc_pos_utils_plus 2.0.1+6
import 'package:esc_pos_utils_plus/esc_pos_utils.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'printer_interface.dart';
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

  // NOTE: esc_pos_utils_plus's Generator.row() has a column-splitting bug
  // (it miscalculates per-column character budgets), which caused garbled
  // output like words wrapping mid-character and totals printing as "0.00".
  // To avoid it, every line below is built as a single pre-padded string
  // and printed with generator.text() instead of generator.row().
  String _splitLine(String left, String right, int width) {
    String l = left;
    if (l.length + right.length + 1 > width) {
      final int maxLeftLen = width - right.length - 1;
      l = maxLeftLen > 0 ? l.substring(0, maxLeftLen) : '';
    }
    final int spaces = width - l.length - right.length;
    return l + ' ' * (spaces > 0 ? spaces : 1) + right;
  }

  String _centerLine(String text, int width) {
    if (text.length >= width) return text;
    final int totalPad = width - text.length;
    final int left = totalPad ~/ 2;
    return ' ' * left + text;
  }

  /// Builds the same content as the real ESC/POS receipt, as plain text,
  /// so it can be dumped to the debug console when no physical printer is
  /// attached (or just to preview a receipt without wasting paper).
  List<String> _buildConsolePreview(Map<String, dynamic> saleData) {
    const int lineWidth = 48;
    final List<String> lines = [];
    final String border = '=' * lineWidth;
    final String divider = '-' * lineWidth;

    final settings = ReceiptSettings();

    lines.add(border);
    lines.add(_centerLine(settings.shopName, lineWidth));
    for (final line in settings.addressLines) {
      lines.add(_centerLine(line, lineWidth));
    }
    lines.add('');

    final DateTime date = saleData['date'] is DateTime ? saleData['date'] : DateTime.tryParse(saleData['date'].toString()) ?? DateTime.now();
    lines.add(_splitLine('Date: ${DateFormat('dd-MM-yy').format(date)}', 'Time: ${DateFormat('hh:mm a').format(date)}', lineWidth));
    lines.add(_splitLine('Server: ${settings.serverName}', 'Type:Collection', lineWidth));
    lines.add(divider);

    lines.add(_centerLine('Dispatch Time: ASAP', lineWidth));
    lines.add(divider);

    lines.add(_centerLine('Collection', lineWidth));
    lines.add(_centerLine('Customer: ${settings.customerName}', lineWidth));
    lines.add(divider);

    final List items = saleData['items'] ?? [];
    int itemCount = 0;
    for (var item in items) {
      final product = item['product'];
      final String name = product['name'];
      final int qty = item['quantity'];
      itemCount += qty;
      final double price = (product['price'] as num).toDouble();
      lines.add(_splitLine('$qty x $name', '£${(price * qty).toStringAsFixed(2)}', lineWidth));
    }
    lines.add(divider);

    final double total = (saleData['total'] as num).toDouble();

    lines.add(_splitLine('Sub total: ($itemCount Item${itemCount == 1 ? '' : 's'})', '£${total.toStringAsFixed(2)}', lineWidth));
    lines.add(divider);

    lines.add(_splitLine('Total:', '£${total.toStringAsFixed(2)}', lineWidth));
    lines.add(divider);

    final int methodIndex = (saleData['method'] is int)
        ? saleData['method']
        : (saleData['method'] == 'PaymentMethod.cash' ? 0 : 1);

    lines.add(_splitLine('Paid: (${methodIndex == 0 ? 'Cash' : 'Card'})', '£${total.toStringAsFixed(2)}', lineWidth));

    if (methodIndex == 0) {
      final double received = (saleData['cashReceived'] as num?)?.toDouble() ?? 0.0;
      final double change = (saleData['change'] as num?)?.toDouble() ?? 0.0;
      lines.add(_splitLine('Received', '£${received.toStringAsFixed(2)}', lineWidth));
      lines.add(_splitLine('Change', '£${change.toStringAsFixed(2)}', lineWidth));
    }

    lines.add('');
    lines.add(_centerLine('Thank You, Please call again...', lineWidth));
    lines.add(border);

    return lines;
  }

  void _logConsolePreview(Map<String, dynamic> saleData) {
    debugPrint('');
    debugPrint('===== RECEIPT PREVIEW (console only — no physical printer) =====');
    for (final line in _buildConsolePreview(saleData)) {
      debugPrint(line);
    }
    debugPrint('==================================================================');
    debugPrint('');
  }

  @override
  Future<bool> printReceipt(Map<String, dynamic> saleData) async {
    _logConsolePreview(saleData);

    if (_selectedName == null) {
      _statusController.add("Printer not connected. (Preview printed to console.)");
      return false;
    }

    try {
      final profile = await CapabilityProfile.load();
      final generator = Generator(PaperSize.mm80, profile);
      const int lineWidth = 48;
      List<int> bytes = [];

      final settings = ReceiptSettings();

      bytes += generator.reset();

      bytes += generator.text(settings.shopName, styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2));
      for (final line in settings.addressLines) {
        bytes += generator.text(line, styles: const PosStyles(align: PosAlign.center));
      }
      bytes += generator.feed(1);

      final DateTime date = saleData['date'] is DateTime ? saleData['date'] : DateTime.tryParse(saleData['date'].toString()) ?? DateTime.now();
      bytes += generator.text(_splitLine('Date: ${DateFormat('dd-MM-yy').format(date)}', 'Time: ${DateFormat('hh:mm a').format(date)}', lineWidth));
      bytes += generator.text(_splitLine('Server: ${settings.serverName}', 'Type:Collection', lineWidth));
      bytes += generator.hr();

      // Short enough to stay well under the paper width even doubled, so
      // this one is safe to print bold+double-size (see NOTE above on why
      // row()/double-width two-column lines are avoided elsewhere).
      bytes += generator.text('Dispatch Time: ASAP', styles: const PosStyles(align: PosAlign.center, bold: true, height: PosTextSize.size2, width: PosTextSize.size2));
      bytes += generator.hr();

      bytes += generator.text('Collection', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.text('Customer: ${settings.customerName}', styles: const PosStyles(align: PosAlign.center));
      bytes += generator.hr();

      final List items = saleData['items'] ?? [];
      int itemCount = 0;
      for (var item in items) {
        final product = item['product'];
        final String name = product['name'];
        final int qty = item['quantity'];
        itemCount += qty;
        final double price = (product['price'] as num).toDouble();
        bytes += generator.text(_splitLine('$qty x $name', '£${(price * qty).toStringAsFixed(2)}', lineWidth));
      }
      bytes += generator.hr();

      final double total = (saleData['total'] as num).toDouble();

      bytes += generator.text(_splitLine('Sub total: ($itemCount Item${itemCount == 1 ? '' : 's'})', '£${total.toStringAsFixed(2)}', lineWidth));
      bytes += generator.hr();

      bytes += generator.text(_splitLine('Total:', '£${total.toStringAsFixed(2)}', lineWidth), styles: const PosStyles(bold: true));
      bytes += generator.hr();

      final int methodIndex = (saleData['method'] is int)
          ? saleData['method']
          : (saleData['method'] == 'PaymentMethod.cash' ? 0 : 1);

      bytes += generator.text(_splitLine('Paid: (${methodIndex == 0 ? 'Cash' : 'Card'})', '£${total.toStringAsFixed(2)}', lineWidth));

      if (methodIndex == 0) {
        final double received = (saleData['cashReceived'] as num?)?.toDouble() ?? 0.0;
        final double change = (saleData['change'] as num?)?.toDouble() ?? 0.0;
        bytes += generator.text(_splitLine('Received', '£${received.toStringAsFixed(2)}', lineWidth));
        bytes += generator.text(_splitLine('Change', '£${change.toStringAsFixed(2)}', lineWidth));
      }

      bytes += generator.feed(2);
      bytes += generator.text('Thank You, Please call again...', styles: const PosStyles(align: PosAlign.center));
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
