import 'ids.dart';

/// Money is held in pence on the till so totals are exact; the cloud gets 2-decimal amounts.
int toPence(num value) => (value * 100).round();
double fromPence(int pence) => pence / 100;
String money(int pence) => '${pence < 0 ? '-' : ''}£${(pence.abs() / 100).toStringAsFixed(2)}';

// ---------------------------------------------------------------------------
// Catalog mirrored from GET /api/pos/config-snapshot (JSON enums arrive as strings).
// ---------------------------------------------------------------------------

class MenuCategory {
  MenuCategory(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get name => json['name'];
  int get displayOrder => json['displayOrder'] ?? 0;
  bool get isActive => json['isActive'] ?? true;
  String get printRoute => json['printRoute'] ?? 'Kitchen';
}

class MenuItem {
  MenuItem(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get categoryId => json['categoryId'];
  String get name => json['name'];
  String? get description => json['description'];
  int get pricePence => toPence(json['basePrice'] ?? 0);
  bool get isAvailable => json['isAvailable'] ?? true;
  int get displayOrder => json['displayOrder'] ?? 0;
  String? get printRouteOverride => json['printRouteOverride'];
}

class ModifierOption {
  ModifierOption(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get groupId => json['modifierGroupId'];
  String get name => json['name'];
  int get deltaPence => toPence(json['priceDelta'] ?? 0);
  bool get isAvailable => json['isAvailable'] ?? true;
  bool get isDefault => json['isDefault'] ?? false;
  int get displayOrder => json['displayOrder'] ?? 0;
}

class ModifierGroup {
  ModifierGroup(this.json, this.options);
  final Map<String, dynamic> json;
  final List<ModifierOption> options;
  String get id => json['id'];
  String get name => json['name'];
  int get minSelect => json['minSelect'] ?? 0;
  int get maxSelect => json['maxSelect'] ?? 1;
  bool get isRequired => json['isRequired'] ?? false;

  /// Smallest number of options that must be picked.
  int get required => isRequired && minSelect < 1 ? 1 : minSelect;
}

class TableInfo {
  TableInfo(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get number => json['tableNumber'];
  int get capacity => json['capacity'] ?? 0;
  String? get location => json['location'];
  bool get isActive => json['isActive'] ?? true;
}

class StaffMember {
  StaffMember(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get userId => json['userId'];
  String get name => json['fullName'] ?? 'Staff';
  String get role => json['role'] ?? 'Staff';
  String? get pinHash => json['pinHash'];
}

class PrinterConfig {
  PrinterConfig(this.json);
  final Map<String, dynamic> json;
  String get name => json['name'] ?? '';
  String get role => json['role'] ?? 'Receipt';
  String get connection => json['connection'] ?? 'Network';
  String? get address => json['address'];
  int get port => json['port'] ?? 9100;
  int get columns => json['columns'] ?? 42;
  bool get isActive => json['isActive'] ?? true;
}

/// Everything the till needs to run offline, rebuilt from the stored collections.
class Catalog {
  Catalog(this.collections);

  /// collection name -> id -> row JSON
  final Map<String, Map<String, Map<String, dynamic>>> collections;

  Iterable<Map<String, dynamic>> _rows(String name) => collections[name]?.values ?? const [];
  Map<String, dynamic> get restaurant => collections['restaurant']?['restaurant'] ?? const {};

  List<MenuCategory> get categories =>
      _rows('categories').map(MenuCategory.new).where((c) => c.isActive).toList()..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// Every category, hidden ones too (for the Manage screen).
  List<MenuCategory> get allCategories =>
      _rows('categories').map(MenuCategory.new).toList()..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  List<MenuItem> itemsIn(String categoryId) =>
      _rows('items').map(MenuItem.new).where((i) => i.categoryId == categoryId).toList()
        ..sort((a, b) => a.displayOrder != b.displayOrder ? a.displayOrder.compareTo(b.displayOrder) : a.name.compareTo(b.name));

  MenuItem? item(String id) => switch (collections['items']?[id]) { final j? => MenuItem(j), _ => null };

  List<MenuItem> search(String q) {
    final s = q.toLowerCase();
    return _rows('items').map(MenuItem.new).where((i) => i.name.toLowerCase().contains(s)).toList();
  }

  /// Groups attached to an item, in the item's order, each with its available options.
  List<ModifierGroup> groupsFor(String menuItemId, {bool includeUnavailable = false}) {
    final links = _rows('itemModifierGroups').where((l) => l['menuItemId'] == menuItemId).toList()
      ..sort((a, b) => (a['displayOrder'] ?? 0).compareTo(b['displayOrder'] ?? 0));
    final options = _rows('modifierOptions').map(ModifierOption.new).where((o) => includeUnavailable || o.isAvailable).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return [
      for (final l in links)
        if (collections['modifierGroups']?[l['modifierGroupId']] case final g?)
          ModifierGroup(g, options.where((o) => o.groupId == g['id']).toList()),
    ];
  }

  List<TableInfo> get tables {
    int num(String s) => int.tryParse(RegExp(r'\d+').firstMatch(s)?.group(0) ?? '') ?? 1 << 20;
    return _rows('tables').map(TableInfo.new).where((t) => t.isActive).toList()
      ..sort((a, b) => num(a.number) != num(b.number) ? num(a.number).compareTo(num(b.number)) : a.number.compareTo(b.number));
  }

  List<StaffMember> get staff => _rows('staff').map(StaffMember.new).toList();
  /// Printer rows as stored, switched-off ones too (for the Manage screen).
  List<Map<String, dynamic>> get printerRows => _rows('printers').toList();
  List<PrinterConfig> get printers => _rows('printers').map(PrinterConfig.new).where((p) => p.isActive).toList();

  /// First status the restaurant counts as completed ("Completed" by default).
  String get completedStatus =>
      _rows('orderStatuses').where((s) => s['countsAsCompleted'] == true).map((s) => s['name'] as String).firstOrNull ?? 'Completed';

  String get paidStatus {
    final names = _rows('paymentStatuses').map((s) => s['name'] as String).toList();
    return names.contains('Paid') ? 'Paid' : (names.firstOrNull ?? 'Paid');
  }
}

// ---------------------------------------------------------------------------
// Orders (stored locally as JSON; closed orders go to the cloud via the outbox).
// ---------------------------------------------------------------------------

class LineModifier {
  LineModifier({required this.id, required this.name, required this.deltaPence});
  final String id;
  final String name;
  final int deltaPence;

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'deltaPence': deltaPence};
  factory LineModifier.fromJson(Map<String, dynamic> j) => LineModifier(id: j['id'], name: j['name'], deltaPence: j['deltaPence']);
}

class OrderLine {
  OrderLine({
    String? id,
    required this.menuItemId,
    required this.name,
    required this.unitPence,
    this.qty = 1,
    this.notes,
    this.modifiers = const [],
    this.status = 'Pending',
    this.sentAt,
    this.voidReason,
    this.printRoute = 'Kitchen',
  }) : id = id ?? newGuid();

  final String id;
  final String menuItemId;
  final String name;
  final int unitPence;
  int qty;
  String? notes;
  final List<LineModifier> modifiers;

  /// Pending | Sent | Ready | Served | Void (backend OrderItemStatus).
  String status;
  DateTime? sentAt;
  String? voidReason;
  String printRoute;

  bool get isVoid => status == 'Void';
  int get eachPence => unitPence + modifiers.fold(0, (s, m) => s + m.deltaPence);
  int get totalPence => isVoid ? 0 : eachPence * qty;

  /// Same dish, same choices, same note and not yet sent: tapping it again adds to the line.
  bool sameAs(OrderLine o) =>
      status == 'Pending' && o.status == 'Pending' && menuItemId == o.menuItemId && name == o.name && unitPence == o.unitPence &&
      (notes ?? '') == (o.notes ?? '') && modifiers.map((m) => m.id).join(',') == o.modifiers.map((m) => m.id).join(',');

  Map<String, dynamic> toJson() => {
        'id': id, 'menuItemId': menuItemId, 'name': name, 'unitPence': unitPence, 'qty': qty, 'notes': notes,
        'modifiers': modifiers.map((m) => m.toJson()).toList(), 'status': status, 'sentAt': sentAt?.toIso8601String(),
        'voidReason': voidReason, 'printRoute': printRoute,
      };

  factory OrderLine.fromJson(Map<String, dynamic> j) => OrderLine(
        id: j['id'], menuItemId: j['menuItemId'], name: j['name'], unitPence: j['unitPence'], qty: j['qty'], notes: j['notes'],
        modifiers: [for (final m in (j['modifiers'] as List? ?? [])) LineModifier.fromJson(m)],
        status: j['status'] ?? 'Pending', sentAt: j['sentAt'] == null ? null : DateTime.parse(j['sentAt']),
        voidReason: j['voidReason'], printRoute: j['printRoute'] ?? 'Kitchen',
      );
}

class OrderPayment {
  OrderPayment({required this.provider, required this.pence, this.tenderedPence});

  /// Cash | Card (backend PaymentProvider).
  final String provider;
  final int pence;
  final int? tenderedPence;
  int get changePence => (tenderedPence ?? pence) - pence;

  Map<String, dynamic> toJson() => {'provider': provider, 'pence': pence, 'tenderedPence': tenderedPence};
  factory OrderPayment.fromJson(Map<String, dynamic> j) => OrderPayment(provider: j['provider'], pence: j['pence'], tenderedPence: j['tenderedPence']);
}

class OrderRefund {
  OrderRefund({String? clientId, required this.pence, required this.method, this.reason, this.byUserId, this.approvedByUserId, DateTime? at})
      : clientId = clientId ?? newGuid(),
        at = at ?? DateTime.now();
  final String clientId;
  final int pence;
  final String method;
  final String? reason;
  final String? byUserId;
  final String? approvedByUserId;
  final DateTime at;

  Map<String, dynamic> toJson() => {
        'clientId': clientId, 'pence': pence, 'method': method, 'reason': reason, 'byUserId': byUserId,
        'approvedByUserId': approvedByUserId, 'at': at.toIso8601String(),
      };
  factory OrderRefund.fromJson(Map<String, dynamic> j) => OrderRefund(
        clientId: j['clientId'], pence: j['pence'], method: j['method'], reason: j['reason'], byUserId: j['byUserId'],
        approvedByUserId: j['approvedByUserId'], at: DateTime.parse(j['at']));
}

class PosOrder {
  PosOrder({
    String? clientId,
    String? orderNumber,
    required this.orderType,
    this.tableId,
    this.tableName,
    this.guestCount,
    this.staffUserId,
    this.staffName,
    this.customerName,
    DateTime? createdAt,
    List<OrderLine>? lines,
    List<OrderPayment>? payments,
    List<OrderRefund>? refunds,
  })  : clientId = clientId ?? newGuid(),
        orderNumber = orderNumber ?? newOrderNumber(),
        createdAt = createdAt ?? DateTime.now(),
        lines = lines ?? [],
        payments = payments ?? [],
        refunds = refunds ?? [];

  final String clientId;
  final String orderNumber;

  /// DineIn | Collection (backend OrderType).
  String orderType;
  String? tableId;
  String? tableName;
  int? guestCount;
  String? staffUserId;
  String? staffName;
  String? customerName;
  final DateTime createdAt;
  DateTime? closedAt;
  final List<OrderLine> lines;
  final List<OrderPayment> payments;
  final List<OrderRefund> refunds;

  int discountPence = 0;
  String? discountReason;
  String? discountApprovedBy;

  bool get isClosed => closedAt != null;
  int get subtotalPence => lines.fold(0, (s, l) => s + l.totalPence);
  int get totalPence => subtotalPence - discountPence;
  int get paidPence => payments.fold(0, (s, p) => s + p.pence);
  int get refundedPence => refunds.fold(0, (s, r) => s + r.pence);
  int get duePence => totalPence - paidPence;
  int get itemCount => lines.where((l) => !l.isVoid).fold(0, (s, l) => s + l.qty);
  bool get hasUnsent => lines.any((l) => l.status == 'Pending');

  /// Adds a line, merging into an identical unsent line.
  void add(OrderLine line) {
    final same = lines.where((l) => l.sameAs(line)).firstOrNull;
    if (same != null) {
      same.qty += line.qty;
    } else {
      lines.add(line);
    }
    if (discountPence > subtotalPence) discountPence = subtotalPence;
  }

  Map<String, dynamic> toJson() => {
        'clientId': clientId, 'orderNumber': orderNumber, 'orderType': orderType, 'tableId': tableId, 'tableName': tableName,
        'guestCount': guestCount, 'staffUserId': staffUserId, 'staffName': staffName, 'customerName': customerName,
        'createdAt': createdAt.toIso8601String(), 'closedAt': closedAt?.toIso8601String(),
        'lines': lines.map((l) => l.toJson()).toList(), 'payments': payments.map((p) => p.toJson()).toList(),
        'refunds': refunds.map((r) => r.toJson()).toList(), 'discountPence': discountPence, 'discountReason': discountReason,
        'discountApprovedBy': discountApprovedBy,
      };

  factory PosOrder.fromJson(Map<String, dynamic> j) => PosOrder(
        clientId: j['clientId'], orderNumber: j['orderNumber'], orderType: j['orderType'], tableId: j['tableId'],
        tableName: j['tableName'], guestCount: j['guestCount'], staffUserId: j['staffUserId'], staffName: j['staffName'],
        customerName: j['customerName'], createdAt: DateTime.parse(j['createdAt']),
        lines: [for (final l in j['lines'] as List) OrderLine.fromJson(l)],
        payments: [for (final p in j['payments'] as List) OrderPayment.fromJson(p)],
        refunds: [for (final r in (j['refunds'] as List? ?? [])) OrderRefund.fromJson(r)],
      )
        ..closedAt = j['closedAt'] == null ? null : DateTime.parse(j['closedAt'])
        ..discountPence = j['discountPence'] ?? 0
        ..discountReason = j['discountReason']
        ..discountApprovedBy = j['discountApprovedBy'];

  /// Body for one order in POST /api/pos/orders/sync (backend SyncOrder).
  Map<String, dynamic> toSync({required String completedStatus, required String paidStatus}) {
    final mainProvider = payments.isEmpty
        ? 'Cash'
        : payments.reduce((a, b) => a.pence >= b.pence ? a : b).provider;
    return {
      'clientId': clientId,
      'orderNumber': orderNumber,
      'orderType': orderType,
      'tableId': tableId,
      'guestCount': guestCount,
      'waiterUserId': staffUserId,
      'customerName': customerName,
      'customerPhone': null,
      'specialRequests': null,
      'items': [
        for (final l in lines)
          {
            'menuItemId': l.menuItemId,
            'name': l.name,
            'unitPrice': fromPence(l.unitPence),
            'quantity': l.qty,
            'notes': l.notes,
            'itemStatus': l.isVoid ? 'Void' : 'Served',
            'sentAt': l.sentAt?.toUtc().toIso8601String(),
            'voidReason': l.voidReason,
            'modifiers': [for (final m in l.modifiers) {'modifierOptionId': m.id, 'name': m.name, 'priceDelta': fromPence(m.deltaPence)}],
          },
      ],
      'discountAmount': fromPence(discountPence),
      'discountReason': discountReason,
      'discountApprovedByUserId': discountApprovedBy,
      'totalAmount': fromPence(totalPence),
      'paymentMethod': mainProvider,
      'payments': [for (final p in payments) {'provider': p.provider, 'amount': fromPence(p.pence)}],
      'status': completedStatus,
      'paymentStatus': paidStatus,
      'closedAt': closedAt!.toUtc().toIso8601String(),
    };
  }

  Map<String, dynamic> refundToSync(OrderRefund r) => {
        'clientId': r.clientId,
        'orderClientId': clientId,
        'amount': fromPence(r.pence),
        'method': r.method,
        'reason': r.reason,
        'itemsJson': null,
        'refundedByUserId': r.byUserId,
        'approvedByUserId': r.approvedByUserId,
      };
}
