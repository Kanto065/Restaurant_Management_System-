import 'dart:async';
import 'printer_interface.dart';

class PrinterService implements PrinterBase {
  static final PrinterService _instance = PrinterService._internal();
  factory PrinterService() => _instance;
  PrinterService._internal();

  final _statusController = StreamController<String>.broadcast();

  @override
  Future<void> init() async {
    // Web initialization: Browser storage could be used but silent printing is blocked
  }

  @override
  Future<List<Map<String, dynamic>>> getAvailablePrinters() async {
    // Web browsers cannot list system printers without user interaction/dialogs
    return [];
  }

  @override
  Future<void> selectPrinter(Map<String, dynamic> device) async {
    // No-op for web
  }

  @override
  String? get selectedPrinterName => null;

  @override
  Future<bool> printTestReceipt() async {
    _statusController.add("Silent printing is not supported in the web browser.");
    return false;
  }

  @override
  Future<bool> printReceipt(Map<String, dynamic> saleData) async {
    _statusController.add("Web version: Automatic printing is disabled to protect application stability.");
    return false;
  }

  @override
  Stream<String> get statusStream => _statusController.stream;
}
