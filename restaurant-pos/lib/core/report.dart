import 'models.dart';

/// The till's own day report, straight from local orders (no internet needed).
/// Same rules as the cloud report: sales after discounts, refunds by the day they were given.
class DayReport {
  DayReport._(this.day, this.orderCount, this.grossPence, this.discountPence, this.salesPence, this.refundPence,
      this.byMethod, this.refundsByMethod, this.byItem);

  final DateTime day;
  final int orderCount;
  final int grossPence;
  final int discountPence;
  final int salesPence;
  final int refundPence;
  final Map<String, int> byMethod;
  final Map<String, int> refundsByMethod;
  final Map<String, (int qty, int pence)> byItem;

  int get netPence => salesPence - refundPence;

  /// [orders] = orders closed on [day]; [refunds] = refunds given on [day] (on any order).
  factory DayReport.build(DateTime day, List<PosOrder> orders, List<OrderRefund> refunds) {
    final byMethod = <String, int>{};
    final byItem = <String, (int, int)>{};
    for (final o in orders) {
      for (final p in o.payments) {
        byMethod[p.provider] = (byMethod[p.provider] ?? 0) + p.pence;
      }
      for (final l in o.lines.where((l) => !l.isVoid)) {
        final (q, s) = byItem[l.name] ?? (0, 0);
        byItem[l.name] = (q + l.qty, s + l.totalPence);
      }
    }
    final refundsByMethod = <String, int>{};
    for (final r in refunds) {
      refundsByMethod[r.method] = (refundsByMethod[r.method] ?? 0) + r.pence;
    }
    final sorted = Map.fromEntries(byItem.entries.toList()..sort((a, b) => b.value.$2.compareTo(a.value.$2)));
    return DayReport._(
      day, orders.length,
      orders.fold(0, (s, o) => s + o.subtotalPence),
      orders.fold(0, (s, o) => s + o.discountPence),
      orders.fold(0, (s, o) => s + o.totalPence),
      refunds.fold(0, (s, r) => s + r.pence),
      byMethod, refundsByMethod, sorted,
    );
  }
}
