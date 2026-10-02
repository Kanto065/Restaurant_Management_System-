import 'dart:async';

abstract class PrinterBase {
  Future<void> init();
  Future<List<Map<String, dynamic>>> getAvailablePrinters();
  Future<void> selectPrinter(Map<String, dynamic> device);
  String? get selectedPrinterName;
  Future<bool> printTestReceipt();
  Future<bool> printReceipt(Map<String, dynamic> saleData);
  Stream<String> get statusStream;
}
