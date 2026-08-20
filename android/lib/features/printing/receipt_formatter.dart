import 'package:intl/intl.dart';

import '../../api/models.dart';

/// One printed row with a label on the left and a value on the right (item
/// name/price, or a totals line) - mirrors SunmiPrinter.printRow's two-column
/// shape directly, so the printer_service layer doesn't need to know
/// anything about receipt content, just how to lay out a row.
class ReceiptRow {
  final String left;
  final String right;
  final bool bold;
  const ReceiptRow(this.left, this.right, {this.bold = false});
}

class Receipt {
  final List<String> header; // centered: restaurant name, address, phone
  final List<String> meta; // left: Order #, Type, Date
  final List<String> customer; // left: Customer, Phone, Delivery address
  final List<ReceiptRow> items; // two-column: item/modifier name -> price
  final List<ReceiptRow> totals; // two-column: Subtotal/fees/discount/Total
  final String paymentLine;
  final List<String> footer; // centered: thank-you message

  const Receipt({
    required this.header,
    required this.meta,
    required this.customer,
    required this.items,
    required this.totals,
    required this.paymentLine,
    required this.footer,
  });
}

final _dateFormat = DateFormat('d MMM yyyy hh:mm a');

/// Formats an OrderDetail (plus the restaurant's own name/address/phone) into
/// a structured receipt, laid out to match the reference invoice format:
/// restaurant header, order # / type / date, customer + delivery address,
/// an ITEMS/PRICE table, totals, payment method, then a thank-you footer.
Receipt buildReceipt(OrderDetail order, {required String currencySymbol, RestaurantInfo? restaurant}) {
  String money(double amount) => '$currencySymbol${amount.toStringAsFixed(2)}';

  final header = <String>[restaurant?.name ?? 'Receipt'];
  if (restaurant != null) {
    final addressParts = [
      restaurant.addressLine1,
      if (restaurant.addressLine2 != null && restaurant.addressLine2!.trim().isNotEmpty) restaurant.addressLine2!,
      restaurant.city,
      restaurant.postcode,
    ];
    header.add(addressParts.join(', '));
    if (restaurant.phone != null && restaurant.phone!.trim().isNotEmpty) {
      header.add('Tel: ${restaurant.phone}');
    }
  }

  final meta = <String>[
    'Order: #${order.orderNumber}',
    'Type: ${order.orderType.toUpperCase()}',
    'Date: ${_dateFormat.format(order.createdAt.toLocal())}',
  ];

  final customer = <String>['Customer: ${order.customerName ?? 'Walk-in'}'];
  if (order.customerPhone != null && order.customerPhone!.trim().isNotEmpty) {
    customer.add('Phone: ${order.customerPhone}');
  }
  final delivery = order.deliveryAddress;
  if (delivery != null) {
    final line2 = delivery.line2 != null && delivery.line2!.trim().isNotEmpty ? ', ${delivery.line2}' : '';
    customer.add('Delivery: ${delivery.line1}$line2, ${delivery.city} ${delivery.postcode}');
  }

  final items = <ReceiptRow>[];
  for (final item in order.items) {
    items.add(ReceiptRow('${item.quantity}x ${item.nameSnapshot}', money(item.unitPriceSnapshot * item.quantity)));
    for (final modifier in item.modifiers) {
      items.add(ReceiptRow('  + ${modifier.nameSnapshot}', money(modifier.priceDeltaSnapshot * item.quantity)));
    }
    final instructions = item.specialInstructions;
    if (instructions != null && instructions.trim().isNotEmpty) {
      items.add(ReceiptRow('  Note: $instructions', ''));
    }
  }

  final totals = <ReceiptRow>[ReceiptRow('Subtotal', money(order.subtotal))];
  if (order.deliveryFee > 0) totals.add(ReceiptRow('Delivery fee', money(order.deliveryFee)));
  if (order.processingFee > 0) totals.add(ReceiptRow('Processing fee', money(order.processingFee)));
  if (order.discountAmount > 0) totals.add(ReceiptRow('Discount', '-${money(order.discountAmount)}'));
  totals.add(ReceiptRow('TOTAL', money(order.totalAmount), bold: true));

  final footer = <String>['Thank You!', 'Visit us again.'];
  final requests = order.specialRequests;
  if (requests != null && requests.trim().isNotEmpty) {
    footer.insertAll(0, ['Note: $requests', '']);
  }

  return Receipt(
    header: header,
    meta: meta,
    customer: customer,
    items: items,
    totals: totals,
    paymentLine: 'Payment: ${order.paymentMethod.toUpperCase()}',
    footer: footer,
  );
}
