import 'package:my_pos/core/models.dart';

const restaurant = {
  'name': 'Crispy Cod', 'addressLine1': 'Unit D Llwyn Helyg Retail Park', 'city': 'Neath', 'postcode': 'SA10 7BZ', 'phone': '01639 635981',
};

OrderLine line(String name, int pence, {int qty = 1, List<LineModifier> mods = const [], String? notes, String status = 'Served'}) =>
    OrderLine(menuItemId: '0f0f0f0f-0000-4000-8000-000000000001', name: name, unitPence: pence, qty: qty, modifiers: mods, notes: notes, status: status);

/// Table 4, three guests: tikka with pilau (+£1), naans, a voided drink, 10% off, cash £50.
PosOrder dineInCash() {
  final o = PosOrder(orderNumber: 'P1A2B3', orderType: 'DineIn', tableId: 't4', tableName: '4', guestCount: 3, staffName: 'Amira', createdAt: DateTime(2026, 10, 2, 19, 5))
    ..lines.addAll([
      line('Chicken Tikka Masala', 995, qty: 2, mods: [LineModifier(id: 'm1', name: 'Pilau rice', deltaPence: 100)], notes: 'one mild'),
      line('Garlic Naan', 350, qty: 3),
      line('Cobra 660ml', 550, status: 'Void')..voidReason = 'Wrong drink',
      line('Extra Large Battered Sausage With Curry Sauce And Bread Roll', 595),
    ]);
  o.discountPence = (o.subtotalPence * 0.1).round();
  o.discountReason = 'Regular';
  o.payments.add(OrderPayment(provider: 'Cash', pence: o.totalPence, tenderedPence: 5000));
  o.closedAt = DateTime(2026, 10, 2, 20, 41);
  return o;
}

PosOrder takeawayCard() {
  final o = PosOrder(orderNumber: 'P1A2B4', orderType: 'Collection', staffName: 'Tom', createdAt: DateTime(2026, 10, 2, 18, 0))
    ..lines.addAll([line('Small Chips', 330), line('Large Cod', 1000)]);
  o.payments.add(OrderPayment(provider: 'Card', pence: o.totalPence));
  o.closedAt = DateTime(2026, 10, 2, 18, 4);
  return o;
}
