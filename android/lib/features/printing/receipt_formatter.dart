import 'package:intl/intl.dart';

import '../../api/models.dart';

class Receipt {
  final String title;
  final String subtitle;
  final List<String> lines;
  const Receipt({required this.title, required this.subtitle, required this.lines});
}

final _timeFormat = DateFormat('HH:mm');

/// Formats an OrderDetail into a plain-text receipt, matching
/// ReceiptFormatter.kt line-for-line so printed output doesn't change
/// between the old Kotlin app and this one.
Receipt buildReceipt(OrderDetail order, {required String currencySymbol}) {
  String money(double amount) => '$currencySymbol${amount.toStringAsFixed(2)}';

  final lines = <String>[
    'Order #${order.orderNumber} · ${order.orderType}',
    order.customerName ?? 'Walk-in',
    _timeFormat.format(order.createdAt.toLocal()),
    '',
  ];

  for (final item in order.items) {
    lines.add('${item.quantity}x ${item.nameSnapshot}  ${money(item.lineTotal)}');
    for (final modifier in item.modifiers) {
      lines.add('  + ${modifier.nameSnapshot}');
    }
    final instructions = item.specialInstructions;
    if (instructions != null && instructions.trim().isNotEmpty) {
      lines.add('  Note: $instructions');
    }
  }

  lines.add('');
  lines.add('Subtotal        ${money(order.subtotal)}');
  if (order.deliveryFee > 0) lines.add('Delivery fee    ${money(order.deliveryFee)}');
  if (order.processingFee > 0) lines.add('Processing fee  ${money(order.processingFee)}');
  if (order.discountAmount > 0) lines.add('Discount       -${money(order.discountAmount)}');
  lines.add('Total           ${money(order.totalAmount)}');

  final requests = order.specialRequests;
  if (requests != null && requests.trim().isNotEmpty) {
    lines.add('');
    lines.add('Note: $requests');
  }

  return Receipt(
    title: 'Port Tennant Tandoori',
    subtitle: '${order.paymentMethod} · ${order.paymentStatus}',
    lines: lines,
  );
}
