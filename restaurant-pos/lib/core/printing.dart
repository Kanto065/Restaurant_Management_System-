import 'dart:io';

import '../printing/printer_windows.dart';
import 'models.dart';

/// Sends finished ESC/POS bytes to a configured printer: LAN printers over raw TCP (port 9100),
/// USB/Windows printers by name through the existing PrinterService. With no receipt printer
/// configured in the admin, the receipt goes to the printer picked on this till.
class PrinterRouter {
  PrinterRouter(this.printers, {this.sender = PrinterRouter.send});
  final List<PrinterConfig> printers;
  final Future<void> Function(PrinterConfig, List<int>) sender;

  PrinterConfig? get receiptPrinter => printers.where((p) => p.role == 'Receipt').firstOrNull;
  int get receiptColumns => receiptPrinter?.columns ?? 42;

  /// Throws with a readable message when the printer can't be reached.
  Future<void> printReceipt(List<int> bytes) async {
    final p = receiptPrinter;
    if (p == null) {
      if (!await PrinterService().sendBytes(bytes)) throw const PrinterException('No receipt printer is set up or it is not answering.');
      return;
    }
    await sender(p, bytes);
  }

  static Future<void> send(PrinterConfig p, List<int> bytes) async {
    if (p.connection == 'Network') {
      final address = p.address;
      if (address == null || address.isEmpty) throw PrinterException('${p.name} has no IP address.');
      try {
        final socket = await Socket.connect(address, p.port, timeout: const Duration(seconds: 4));
        socket.add(bytes);
        await socket.flush();
        await socket.close();
      } on SocketException {
        throw PrinterException('${p.name} ($address) is not answering.');
      }
    } else if (!await PrinterService().sendBytes(bytes, printerName: p.address)) {
      throw PrinterException('${p.name} is not answering.');
    }
  }
}

class PrinterException implements Exception {
  const PrinterException(this.message);
  final String message;
  @override
  String toString() => message;
}
