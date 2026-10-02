import 'package:intl/intl.dart';

import '../core/models.dart';
import '../core/report.dart';
import 'receipt_builder.dart';

void _header(ReceiptBuilder r, Map<String, dynamic> restaurant) {
  r.reset();
  r.text((restaurant['name'] as String? ?? 'Receipt').toUpperCase(), align: ReceiptAlign.center, doubleWidth: true, doubleHeight: true);
  for (final key in ['addressLine1', 'addressLine2', 'city', 'postcode', 'phone']) {
    final v = restaurant[key] as String?;
    if (v != null && v.trim().isNotEmpty) r.text(v, align: ReceiptAlign.center);
  }
  r.blank();
}

void _orderLines(ReceiptBuilder r, PosOrder order) {
  for (final l in order.lines.where((l) => !l.isVoid)) {
    r.leftRight('${l.qty} x ${l.name}', money(l.unitPence * l.qty), indent: 1);
    for (final m in l.modifiers) {
      r.leftRight('   + ${m.name}', m.deltaPence == 0 ? '' : money(m.deltaPence * l.qty));
    }
    if (l.notes != null && l.notes!.trim().isNotEmpty) r.text('   * ${l.notes}');
  }
}

/// Customer receipt (or, with [bill], the bill brought to the table before paying).
ReceiptBuilder buildOrderReceipt(PosOrder order, Map<String, dynamic> restaurant, {int columns = 42, bool bill = false}) {
  final r = ReceiptBuilder(width: columns);
  _header(r, restaurant);
  final when = order.closedAt ?? DateTime.now();
  r.leftRight('Date: ${DateFormat('dd-MM-yy').format(when)}', 'Time: ${DateFormat('h:mm a').format(when)}', indent: 1);
  r.leftRight('Order: ${order.orderNumber}', order.orderType == 'DineIn' ? 'Table ${order.tableName ?? '-'}' : 'Takeaway', indent: 1);
  if (order.staffName != null) r.leftRight('Served by: ${order.staffName}', order.guestCount != null ? 'Guests: ${order.guestCount}' : '', indent: 1);
  r.divider();
  if (bill) {
    r.text('BILL', align: ReceiptAlign.center, bold: true, doubleHeight: true);
    r.divider();
  }
  _orderLines(r, order);
  r.divider();
  r.leftRight('Sub total (${order.itemCount} item${order.itemCount == 1 ? '' : 's'})', money(order.subtotalPence));
  if (order.discountPence > 0) {
    r.leftRight('Discount${order.discountReason == null ? '' : ' (${order.discountReason})'}', '-${money(order.discountPence)}');
  }
  r.divider();
  r.leftRight('TOTAL', money(order.totalPence), bold: true, doubleWidth: true);
  r.divider();
  if (!bill) {
    for (final p in order.payments) {
      r.leftRight('Paid (${p.provider})', money(p.pence));
      if (p.provider == 'Cash' && p.tenderedPence != null && p.tenderedPence! > p.pence) {
        r.leftRight('  Cash given', money(p.tenderedPence!));
        r.leftRight('  Change', money(p.changePence));
      }
    }
    for (final f in order.refunds) {
      r.leftRight('Refunded (${f.method})', '-${money(f.pence)}');
    }
  }
  r.blank();
  r.text(bill ? 'Please pay at the counter or ask for the card machine.' : 'Thank you, please call again', align: ReceiptAlign.center);
  r.cut();
  return r;
}

ReceiptBuilder buildDayReport(DayReport rep, Map<String, dynamic> restaurant, {int columns = 42, String? printedBy}) {
  final r = ReceiptBuilder(width: columns);
  _header(r, restaurant);
  r.text('DAY REPORT', align: ReceiptAlign.center, bold: true, doubleHeight: true);
  r.text(DateFormat('EEEE d MMMM yyyy').format(rep.day), align: ReceiptAlign.center);
  r.text('Printed ${DateFormat('h:mm a').format(DateTime.now())}${printedBy == null ? '' : ' by $printedBy'}', align: ReceiptAlign.center);
  r.divider();
  r.leftRight('Orders', '${rep.orderCount}');
  r.leftRight('Gross sales', money(rep.grossPence));
  r.leftRight('Discounts', '-${money(rep.discountPence)}');
  r.leftRight('Sales', money(rep.salesPence), bold: true);
  r.leftRight('Refunds', '-${money(rep.refundPence)}');
  r.divider();
  r.leftRight('NET', money(rep.netPence), bold: true, doubleWidth: true);
  r.divider();
  r.text('Takings', bold: true);
  for (final e in rep.byMethod.entries) {
    r.leftRight('  ${e.key}', money(e.value));
  }
  for (final e in rep.refundsByMethod.entries) {
    r.leftRight('  ${e.key} refunds', '-${money(e.value)}');
  }
  final cash = (rep.byMethod['Cash'] ?? 0) - (rep.refundsByMethod['Cash'] ?? 0);
  r.leftRight('Cash in drawer (excl. float)', money(cash), bold: true);
  r.divider();
  r.text('Items sold', bold: true);
  for (final e in rep.byItem.entries) {
    r.leftRight('  ${e.value.$1} x ${e.key}', money(e.value.$2));
  }
  r.cut();
  return r;
}

/// Just the drawer pulse, for cash payments and "No sale".
List<int> drawerKick() => (ReceiptBuilder()..openDrawer()).bytes;

List<int> testPage(String printerName) => (ReceiptBuilder()
      ..reset()
      ..divider('=')
      ..text('TEST PRINT', align: ReceiptAlign.center, bold: true, doubleWidth: true, doubleHeight: true)
      ..text(printerName, align: ReceiptAlign.center)
      ..leftRight('Left edge', 'Right edge')
      ..leftRight('Pound sign', '£1.23')
      ..divider('=')
      ..cut())
    .bytes;
