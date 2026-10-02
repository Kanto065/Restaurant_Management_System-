import 'dart:async';
import 'dart:isolate';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/crypto.dart';
import '../core/db.dart';
import '../core/models.dart';
import '../core/permissions.dart';
import '../core/printing.dart';
import '../core/report.dart';
import '../core/sync.dart';
import '../printing/pos_receipts.dart';
import '../printing/printer_windows.dart';

const prodServer = 'https://api.porttennanttandoori.co.uk';

/// Thrown for things the person at the till must sort out (shown as a message, never a crash).
class PosError implements Exception {
  const PosError(this.message);
  final String message;
  @override
  String toString() => message;
}

/// All of the till's state. Every change is written to SQLite before listeners are told.
class PosState extends ChangeNotifier {
  PosState(this.db) {
    catalog = db.loadCatalog();
    _loadLicence();
    _orders = {for (final o in db.openOrders()) o.clientId: o};
    themeMode = ThemeMode.values.byName(db.get('theme') ?? 'system');
    final creds = db.getJson('device');
    if (creds != null) _connect(creds['server'], creds['deviceId'], creds['secret']);
  }

  final LocalDb db;
  late Catalog catalog;
  Licence? licence;
  SyncService? sync;
  late ThemeMode themeMode;
  StaffMember? staff;
  Map<String, PosOrder> _orders = {};

  /// Tables whose bill has been printed and are waiting to pay (shown amber on the map).
  final Set<String> billPrinted = {};

  bool get isPaired => db.getJson('device') != null && db.get('sync.since') != null;
  String get restaurantName => catalog.restaurant['name'] ?? 'POS';
  List<PosOrder> get openOrders => _orders.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  PosOrder? orderForTable(String tableId) => _orders.values.where((o) => o.tableId == tableId).firstOrNull;
  PrinterRouter get printers => PrinterRouter(catalog.printers);

  LicenceState get licenceState => licence?.stateAt(DateTime.now()) ?? LicenceState.active;
  bool hasFeature(String key) => licence?.has(key) ?? false;

  // ---- pairing & sync -------------------------------------------------------

  void _connect(String server, String deviceId, String secret) {
    final api = CloudApi(baseUrl: server, deviceId: deviceId, secret: secret);
    sync = SyncService(db, api, onChanged: _reloadConfig)..start();
    _printTimer?.cancel();
    _printTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (db.printJobs().isNotEmpty) drainPrints();
    });
  }

  Timer? _printTimer;

  /// Stops the background sync and print retries (unpairing, tests).
  void stop() {
    sync?.stop();
    _printTimer?.cancel();
  }

  void _reloadConfig() {
    catalog = db.loadCatalog();
    _loadLicence();
    notifyListeners();
  }

  void _loadLicence() {
    final payload = db.getJson('licence');
    licence = payload == null ? null : Licence(payload);
  }

  /// First run: sign in as the main POS device registered in the admin, then pull everything.
  Future<void> pair({required String server, required String deviceId, required String secret}) async {
    final base = server.trim().replaceAll(RegExp(r'/+$'), '');
    final api = CloudApi(baseUrl: base, deviceId: deviceId.trim(), secret: secret.trim());
    try {
      await api.login();
      final s = SyncService(db, api, onChanged: _reloadConfig);
      await s.pullSnapshot();
    } on ApiException catch (e) {
      throw PosError(e.statusCode == 403
          ? 'This device is not registered as a main POS. Register it under POS settings in the admin.'
          : e.message);
    } catch (e) {
      throw PosError('Could not reach $base. Check the address and the internet connection.');
    }
    db.setJson('device', {'server': base, 'deviceId': deviceId.trim(), 'secret': secret.trim()});
    _connect(base, deviceId.trim(), secret.trim());
    _reloadConfig();
  }

  /// Forget the pairing (e.g. moving the till to another restaurant). Orders not yet sent stay
  /// in the outbox and go up after pairing again with the same restaurant.
  void unpair() {
    stop();
    sync = null;
    staff = null;
    db.set('device', null);
    db.set('sync.since', null);
    db.set('licence.publicKey', null);
    notifyListeners();
  }

  // ---- staff ----------------------------------------------------------------

  /// Finds whose PIN this is (PINs are unique per restaurant). Runs off the UI thread:
  /// each check is 10,000 rounds of PBKDF2.
  Future<StaffMember?> findByPin(String pin) async {
    final candidates = [for (final s in catalog.staff) if (s.pinHash != null) (s.id, s.pinHash!)];
    final id = await Isolate.run(() => candidates.where((c) => verifyPin(pin, c.$2)).map((c) => c.$1).firstOrNull);
    return catalog.staff.where((s) => s.id == id).firstOrNull;
  }

  Future<void> signIn(String pin) async {
    final who = await findByPin(pin);
    if (who == null) throw const PosError('That PIN is not recognised.');
    if (!canSignInAtTill(who.role)) throw const PosError('Kitchen accounts cannot sign in at the till.');
    staff = who;
    notifyListeners();
  }

  void signOut() {
    staff = null;
    notifyListeners();
  }

  Access access(Perm perm) => staff == null ? Access.denied : can(staff!.role, perm);

  // ---- orders ---------------------------------------------------------------

  void _save(PosOrder order) {
    db.saveOrder(order);
    if (order.isClosed) {
      _orders.remove(order.clientId);
    } else {
      _orders[order.clientId] = order;
    }
    notifyListeners();
  }

  void _requireCanSell() {
    if (licenceState == LicenceState.expired) {
      throw const PosError('The subscription has ended, so new orders are paused. Open orders can still be paid.');
    }
  }

  PosOrder startOrder({TableInfo? table, int? guests, String? customerName}) {
    _requireCanSell();
    if (table != null && orderForTable(table.id) != null) throw PosError('Table ${table.number} already has an order.');
    final order = PosOrder(
      orderType: table == null ? 'Collection' : 'DineIn',
      tableId: table?.id,
      tableName: table?.number,
      guestCount: guests,
      staffUserId: staff?.userId,
      staffName: staff?.name,
      customerName: customerName,
    );
    _save(order);
    return order;
  }

  /// Where a dish prints: the item's override, else its category's route (design section 8).
  String routeFor(MenuItem item) =>
      item.printRouteOverride ?? catalog.categories.where((c) => c.id == item.categoryId).firstOrNull?.printRoute ?? 'Kitchen';

  void addItem(PosOrder order, MenuItem item, {List<LineModifier> modifiers = const [], String? notes, int qty = 1}) {
    _requireCanSell();
    order.add(OrderLine(
      menuItemId: item.id, name: item.name, unitPence: item.pricePence, qty: qty, notes: notes, modifiers: modifiers,
      printRoute: routeFor(item),
    ));
    _save(order);
  }

  /// An open-price item typed at the till (not on the menu).
  void addOpenItem(PosOrder order, String name, int pence) {
    _requireCanSell();
    order.add(OrderLine(menuItemId: '00000000-0000-0000-0000-000000000000', name: name, unitPence: pence, printRoute: 'None'));
    _save(order);
  }

  void changeQty(PosOrder order, OrderLine line, int delta) {
    line.qty += delta;
    if (line.qty <= 0) order.lines.remove(line);
    if (order.discountPence > order.subtotalPence) order.discountPence = order.subtotalPence;
    _save(order);
  }

  void setNote(PosOrder order, OrderLine line, String? note) {
    line.notes = (note?.trim().isEmpty ?? true) ? null : note!.trim();
    _save(order);
  }

  /// Sent lines can't just disappear: they're voided with a reason (and a manager's say-so).
  Future<void> voidLine(PosOrder order, OrderLine line, String reason, {StaffMember? approvedBy}) async {
    final wasSent = line.status != 'Pending' && line.status != 'Void';
    line.status = 'Void';
    line.voidReason = approvedBy == null ? reason : '$reason (OK ${approvedBy.name})';
    if (order.discountPence > order.subtotalPence) order.discountPence = order.subtotalPence;
    if (wasSent) _queueTickets(order, [line], voided: true); // the kitchen must hear it's off
    _save(order);
    if (wasSent) await drainPrints();
  }

  /// Marks unsent lines as sent and queues one ticket per station (kitchen, bar) for them.
  Future<void> send(PosOrder order) {
    final now = DateTime.now();
    final pending = order.lines.where((l) => l.status == 'Pending').toList();
    for (final l in pending) {
      l.status = 'Sent';
      l.sentAt = now;
    }
    db.transaction(() {
      db.saveOrder(order);
      _queueTickets(order, pending);
    });
    _save(order);
    return drainPrints();
  }

  static const _stations = {'Kitchen': 'pos.kitchenPrint', 'Bar': 'pos.barPrint'};

  /// Problem with kitchen/bar printing, shown as a banner until the queue is empty.
  String? printAlert;
  int get pendingPrints => db.printJobs().length;

  /// How tickets reach a printer; swapped out in tests.
  Future<void> Function(PrinterConfig, List<int>) printSender = PrinterRouter.send;
  bool _printing = false;

  void _queueTickets(PosOrder order, List<OrderLine> lines, {bool voided = false}) {
    for (final MapEntry(key: station, value: feature) in _stations.entries) {
      final forStation = lines.where((l) => l.printRoute == station).toList();
      if (forStation.isEmpty || !hasFeature(feature)) continue;
      final printer = catalog.printers.where((p) => p.role == station).firstOrNull;
      if (printer == null) {
        printAlert = 'No ${station.toLowerCase()} printer is set up. Add one under Printers in the admin.';
        continue;
      }
      db.addPrintJob(printer.name, '${voided ? 'Void' : station} - ${order.tableName == null ? order.orderNumber : 'Table ${order.tableName}'}',
          buildStationTicket(order, forStation, station, columns: printer.columns, voided: voided));
    }
  }

  /// Prints queued tickets in order. A printer that fails keeps its tickets for the next try
  /// (every 15 seconds on the hub, or "Retry"); other printers carry on.
  Future<void> drainPrints() async {
    if (_printing) return;
    _printing = true;
    String? problem;
    try {
      final failed = <String>{};
      for (final job in db.printJobs()) {
        if (failed.contains(job.printer)) continue;
        final printer = catalog.printers.where((p) => p.name == job.printer).firstOrNull;
        try {
          if (printer == null) throw PrinterException('${job.printer} is no longer set up in the admin.');
          await printSender(printer, job.bytes);
          db.printJobDone(job.id);
        } catch (e) {
          failed.add(job.printer);
          db.printJobFailed(job.id, e.toString());
          problem = '${job.title} has not printed: $e';
        }
      }
    } finally {
      _printing = false;
    }
    printAlert = problem ?? (printAlert?.startsWith('No ') == true ? printAlert : null);
    notifyListeners();
  }

  void dismissPrintAlert() {
    printAlert = null;
    notifyListeners();
  }

  void applyDiscount(PosOrder order, int pence, String? reason, {StaffMember? approvedBy}) {
    if (!hasFeature('pos.discounts')) throw const PosError('Discounts are not switched on for this restaurant.');
    if (pence < 0 || pence > order.subtotalPence) throw const PosError('The discount must be between zero and the bill.');
    order.discountPence = pence;
    order.discountReason = pence == 0 ? null : reason;
    order.discountApprovedBy = pence == 0 ? null : (approvedBy ?? staff)?.userId;
    _save(order);
  }

  /// Deletes an order that has nothing on it (opened by mistake).
  void discardEmpty(PosOrder order) {
    if (order.lines.isNotEmpty) throw const PosError('Remove or void the items first.');
    db.deleteOrder(order.clientId);
    _orders.remove(order.clientId);
    notifyListeners();
  }

  /// Takes a payment. When the bill is covered the order closes, goes into the outbox, the
  /// receipt prints and (for cash) the drawer opens. Returns a printer problem, if any,
  /// without undoing the sale - the money has been taken either way.
  Future<String?> takePayment(PosOrder order, String provider, int pence, {int? tenderedPence}) async {
    if (pence <= 0 || pence > order.duePence) throw const PosError('That amount is more than what is owed.');
    order.payments.add(OrderPayment(provider: provider, pence: pence, tenderedPence: tenderedPence));
    String? printProblem;
    if (order.duePence == 0) {
      order.closedAt = DateTime.now();
      for (final l in order.lines.where((l) => l.status == 'Pending')) {
        l.sentAt ??= order.closedAt;
      }
      db.transaction(() {
        db.saveOrder(order);
        db.enqueue('order', order.clientId,
            order.toSync(completedStatus: catalog.completedStatus, paidStatus: catalog.paidStatus));
      });
      _orders.remove(order.clientId);
      if (order.tableId != null) billPrinted.remove(order.tableId);
      notifyListeners();
      printProblem = await _print(() async {
        if (order.payments.any((p) => p.provider == 'Cash')) await printers.printReceipt(drawerKick());
        await printers.printReceipt(buildOrderReceipt(order, catalog.restaurant, columns: printers.receiptColumns).bytes);
      });
      sync?.syncNow();
    } else {
      _save(order);
    }
    return printProblem;
  }

  Future<String?> printBill(PosOrder order) async {
    if (order.tableId != null) billPrinted.add(order.tableId!);
    notifyListeners();
    return _print(() => printers.printReceipt(buildOrderReceipt(order, catalog.restaurant, columns: printers.receiptColumns, bill: true).bytes));
  }

  Future<String?> reprint(PosOrder order) =>
      _print(() => printers.printReceipt(buildOrderReceipt(order, catalog.restaurant, columns: printers.receiptColumns).bytes));

  Future<String?> openDrawer() => _print(() => printers.printReceipt(drawerKick()));

  Future<String?> testPrint() =>
      _print(() => printers.printReceipt(testPage(printers.receiptPrinter?.name ?? PrinterService().selectedPrinterName ?? 'Receipt printer')));

  Future<String?> _print(Future<void> Function() job) async {
    try {
      await job();
      return null;
    } on PrinterException catch (e) {
      return e.message;
    } catch (e) {
      return 'Printing failed: $e';
    }
  }

  /// Refunds part or all of a closed order. Never more than was paid less earlier refunds.
  void refund(PosOrder order, int pence, String method, String? reason, {StaffMember? approvedBy}) {
    if (!hasFeature('pos.refunds')) throw const PosError('Refunds are not switched on for this restaurant.');
    if (pence <= 0 || pence > order.paidPence - order.refundedPence) {
      throw PosError('You can refund up to ${money(order.paidPence - order.refundedPence)}.');
    }
    final r = OrderRefund(pence: pence, method: method, reason: reason, byUserId: staff?.userId,
        approvedByUserId: (approvedBy ?? staff)?.userId);
    order.refunds.add(r);
    db.transaction(() {
      db.saveOrder(order);
      db.enqueue('refund', r.clientId, order.refundToSync(r));
    });
    notifyListeners();
    sync?.syncNow();
  }

  List<PosOrder> closedOrders({Duration within = const Duration(days: 7)}) => db.closedSince(DateTime.now().subtract(within));

  DayReport dayReport(DateTime day) {
    final start = DateTime(day.year, day.month, day.day);
    final end = start.add(const Duration(days: 1));
    bool inDay(DateTime t) => !t.isBefore(start) && t.isBefore(end);
    final recent = db.closedSince(start.subtract(const Duration(days: 60)));
    return DayReport.build(
      day,
      recent.where((o) => inDay(o.closedAt!.toLocal())).toList(),
      [for (final o in recent) ...o.refunds.where((r) => inDay(r.at.toLocal()))],
    );
  }

  Future<String?> printDayReport(DateTime day) =>
      _print(() => printers.printReceipt(buildDayReport(dayReport(day), catalog.restaurant, columns: printers.receiptColumns, printedBy: staff?.name).bytes));

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    db.set('theme', mode.name);
    notifyListeners();
  }
}
