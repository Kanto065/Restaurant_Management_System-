import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../core/permissions.dart';
import '../state/pos_state.dart';
import 'widgets.dart';

void openOrder(BuildContext context, PosOrder order) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderScreen(orderId: order.clientId)));

class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.orderId});
  final String orderId;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  String? _categoryId;
  String _search = '';

  Future<void> _addItem(PosState state, PosOrder order, MenuItem item) async {
    if (!item.isAvailable) return showMessage(context, '${item.name} is not available.', error: true);
    final groups = state.catalog.groupsFor(item.id);
    if (groups.isEmpty) {
      await guard(context, () async => state.addItem(order, item));
      return;
    }
    final choice = await showDialog<_Choice>(context: context, builder: (_) => _ModifierDialog(item: item, groups: groups));
    if (choice != null && mounted) {
      await guard(context, () async => state.addItem(order, item, modifiers: choice.modifiers, notes: choice.notes, qty: choice.qty));
    }
  }

  Future<void> _lineActions(PosState state, PosOrder order, OrderLine line) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(line.name, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(line.status == 'Pending' ? 'Not sent yet' : 'Sent')),
          if (line.status == 'Pending') ...[
            ListTile(leading: const Icon(Icons.add), title: const Text('One more'), onTap: () => Navigator.pop(context, 'plus')),
            ListTile(leading: const Icon(Icons.remove), title: const Text('One less'), onTap: () => Navigator.pop(context, 'minus')),
            ListTile(leading: const Icon(Icons.edit_note), title: const Text('Note for the kitchen'), onTap: () => Navigator.pop(context, 'note')),
            ListTile(leading: const Icon(Icons.delete_outline), title: const Text('Remove'), onTap: () => Navigator.pop(context, 'remove')),
          ] else if (!line.isVoid)
            ListTile(leading: const Icon(Icons.block), title: const Text('Void (needs a reason)'), onTap: () => Navigator.pop(context, 'void')),
        ]),
      ),
    );
    if (!mounted || action == null) return;
    switch (action) {
      case 'plus':
        state.changeQty(order, line, 1);
      case 'minus':
        state.changeQty(order, line, -1);
      case 'remove':
        state.changeQty(order, line, -line.qty);
      case 'note':
        final note = await _askText(context, 'Note for ${line.name}', initial: line.notes, hint: 'No onions, extra spicy…');
        if (note != null) state.setNote(order, line, note);
      case 'void':
        final reason = await _askText(context, 'Why void ${line.name}?', hint: 'Wrong dish, customer changed mind…');
        if (reason == null || reason.trim().isEmpty || !mounted) return;
        final by = await authorize(context, Perm.voidItem, 'Void ${line.qty} x ${line.name}');
        if (by != null) state.voidLine(order, line, reason.trim(), approvedBy: by == state.staff ? null : by);
    }
  }

  Future<void> _discount(PosState state, PosOrder order) async {
    if (!state.hasFeature('pos.discounts')) return showMessage(context, 'Discounts are not switched on for this restaurant.', error: true);
    final result = await showDialog<(int, String?)>(context: context, builder: (_) => _DiscountDialog(order: order));
    if (result == null || !mounted) return;
    final by = await authorize(context, Perm.discount, 'Discount of ${money(result.$1)}');
    if (by != null && mounted) await guard(context, () async => state.applyDiscount(order, result.$1, result.$2, approvedBy: by));
  }

  Future<void> _pay(PosState state, PosOrder order) async {
    if (state.access(Perm.takePayment) == Access.denied) return showMessage(context, 'Your role can’t take payments.', error: true);
    if (order.lines.every((l) => l.isVoid)) return showMessage(context, 'There is nothing to pay for.', error: true);
    final closed = await showDialog<bool>(context: context, barrierDismissible: false, builder: (_) => PaymentDialog(order: order));
    if (closed == true && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final order = state.openOrders.where((o) => o.clientId == widget.orderId).firstOrNull;
    if (order == null) return const Scaffold(body: Center(child: Text('This order is closed.')));
    final scheme = Theme.of(context).colorScheme;
    final categories = state.catalog.categories;
    final categoryId = _categoryId ?? categories.firstOrNull?.id;
    final items = _search.isNotEmpty ? state.catalog.search(_search) : (categoryId == null ? <MenuItem>[] : state.catalog.itemsIn(categoryId));

    return Scaffold(
      appBar: AppBar(
        backgroundColor: scheme.surfaceContainerLowest,
        title: Text(order.tableId != null
            ? 'Table ${order.tableName}${order.guestCount == null ? '' : ' · ${order.guestCount} guests'}'
            : (order.customerName ?? 'Takeaway ${order.orderNumber}')),
        actions: [
          if (order.lines.isEmpty)
            TextButton.icon(
              onPressed: () {
                state.discardEmpty(order);
                Navigator.pop(context);
              },
              icon: const Icon(Icons.close),
              label: const Text('Cancel order'),
            ),
          const SizedBox(width: 12),
        ],
      ),
      body: Row(children: [
        Expanded(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search the menu', isDense: true),
                    onChanged: (v) => setState(() => _search = v.trim()),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Open item'),
                  onPressed: () async {
                    final r = await showDialog<(String, int)>(context: context, builder: (_) => const _OpenItemDialog());
                    if (r != null && context.mounted) await guard(context, () async => state.addOpenItem(order, r.$1, r.$2));
                  },
                ),
              ]),
            ),
            if (_search.isEmpty)
              SizedBox(
                height: 58,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                  children: [
                    for (final c in categories)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(c.name, style: const TextStyle(fontSize: 15)),
                          selected: c.id == categoryId,
                          showCheckmark: false,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          onSelected: (_) => setState(() => _categoryId = c.id),
                        ),
                      ),
                  ],
                ),
              ),
            Expanded(
              child: items.isEmpty
                  ? Center(child: Text(_search.isEmpty ? 'No dishes in this category.' : 'Nothing matches “$_search”.', style: TextStyle(color: scheme.onSurfaceVariant)))
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 190, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.35),
                      itemCount: items.length,
                      itemBuilder: (context, i) => _ItemTile(item: items[i], onTap: () => _addItem(state, order, items[i])),
                    ),
            ),
          ]),
        ),
        const VerticalDivider(width: 1),
        SizedBox(
          width: 420,
          child: _Ticket(
            order: order,
            onLine: (l) => _lineActions(state, order, l),
            onSend: order.hasUnsent ? () => state.send(order) : null,
            onBill: order.lines.isEmpty ? null : () async {
              final problem = await state.printBill(order);
              if (problem != null && context.mounted) showMessage(context, problem, error: true);
            },
            onDiscount: order.lines.isEmpty ? null : () => _discount(state, order),
            onPay: order.lines.isEmpty ? null : () => _pay(state, order),
          ),
        ),
      ]),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({required this.item, required this.onTap});
  final MenuItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final off = !item.isAvailable;
    return Opacity(
      opacity: off ? 0.45 : 1,
      child: Material(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: scheme.outlineVariant)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(item.name, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.2))),
              Row(children: [
                Text(off ? 'Unavailable' : money(item.pricePence),
                    style: TextStyle(color: off ? scheme.onSurfaceVariant : scheme.primary, fontWeight: FontWeight.w700, fontSize: 15)),
                const Spacer(),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Ticket extends StatelessWidget {
  const _Ticket({required this.order, required this.onLine, this.onSend, this.onBill, this.onDiscount, this.onPay});
  final PosOrder order;
  final void Function(OrderLine) onLine;
  final VoidCallback? onSend, onBill, onDiscount, onPay;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const tabular = [FontFeature.tabularFigures()];
    return Container(
      color: scheme.surfaceContainerLowest,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Row(children: [
            Text('Order ${order.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const Spacer(),
            Text(order.staffName ?? '', style: TextStyle(color: scheme.onSurfaceVariant)),
          ]),
        ),
        const Divider(),
        Expanded(
          child: order.lines.isEmpty
              ? Center(child: Text('Tap dishes to add them.', style: TextStyle(color: scheme.onSurfaceVariant)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: order.lines.length,
                  separatorBuilder: (_, _) => const Divider(indent: 20, endIndent: 20),
                  itemBuilder: (context, i) {
                    final l = order.lines[i];
                    final muted = l.isVoid ? scheme.onSurfaceVariant : null;
                    return InkWell(
                      onTap: () => onLine(l),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SizedBox(width: 30, child: Text('${l.qty}×', style: TextStyle(fontWeight: FontWeight.w700, color: muted))),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(l.name,
                                  style: TextStyle(fontWeight: FontWeight.w600, color: muted, decoration: l.isVoid ? TextDecoration.lineThrough : null)),
                              for (final m in l.modifiers)
                                Text('+ ${m.name}${m.deltaPence == 0 ? '' : '  ${money(m.deltaPence)}'}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                              if (l.notes != null) Text('“${l.notes}”', style: TextStyle(color: scheme.primary, fontSize: 13, fontStyle: FontStyle.italic)),
                              if (l.isVoid) Text('Void: ${l.voidReason ?? ''}', style: TextStyle(color: scheme.error, fontSize: 12)),
                            ]),
                          ),
                          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                            Text(money(l.totalPence), style: TextStyle(fontWeight: FontWeight.w600, color: muted, fontFeatures: tabular)),
                            if (l.status == 'Pending') Text('new', style: TextStyle(color: scheme.primary, fontSize: 11, fontWeight: FontWeight.w700)),
                          ]),
                        ]),
                      ),
                    );
                  },
                ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(children: [
            _row('Subtotal', money(order.subtotalPence), scheme),
            if (order.discountPence > 0) _row('Discount${order.discountReason == null ? '' : ' · ${order.discountReason}'}', '-${money(order.discountPence)}', scheme),
            if (order.paidPence > 0) _row('Paid so far', '-${money(order.paidPence)}', scheme),
            const SizedBox(height: 6),
            Row(children: [
              const Text('To pay', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const Spacer(),
              Text(money(order.duePence), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, fontFeatures: tabular)),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: onSend, child: const Text('Send'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: onBill, child: const Text('Bill'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: onDiscount, child: const Text('Discount'))),
            ]),
            const SizedBox(height: 8),
            SizedBox(width: double.infinity, height: 60, child: FilledButton(onPressed: onPay, child: Text('Pay ${money(order.duePence)}', style: const TextStyle(fontSize: 19)))),
          ]),
        ),
      ]),
    );
  }

  Widget _row(String label, String value, ColorScheme s) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(color: s.onSurfaceVariant), overflow: TextOverflow.ellipsis)),
          Text(value, style: TextStyle(color: s.onSurfaceVariant, fontFeatures: const [FontFeature.tabularFigures()])),
        ]),
      );
}

class _Choice {
  _Choice(this.modifiers, this.notes, this.qty);
  final List<LineModifier> modifiers;
  final String? notes;
  final int qty;
}

/// Pick options for a dish: one-of groups as choice chips, many-of groups up to their maximum.
class _ModifierDialog extends StatefulWidget {
  const _ModifierDialog({required this.item, required this.groups});
  final MenuItem item;
  final List<ModifierGroup> groups;

  @override
  State<_ModifierDialog> createState() => _ModifierDialogState();
}

class _ModifierDialogState extends State<_ModifierDialog> {
  late final Map<String, List<ModifierOption>> _picked = {
    for (final g in widget.groups) g.id: g.options.where((o) => o.isDefault).take(g.maxSelect).toList(),
  };
  final _notes = TextEditingController();
  int _qty = 1;

  int get _each => widget.item.pricePence + _picked.values.expand((l) => l).fold(0, (s, o) => s + o.deltaPence);
  ModifierGroup? get _missing => widget.groups.where((g) => (_picked[g.id]?.length ?? 0) < g.required).firstOrNull;

  void _toggle(ModifierGroup g, ModifierOption o) => setState(() {
        final list = _picked[g.id]!;
        if (list.contains(o)) {
          list.remove(o);
        } else if (g.maxSelect <= 1) {
          list
            ..clear()
            ..add(o);
        } else if (list.length < g.maxSelect) {
          list.add(o);
        }
      });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: Text(widget.item.name),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final g in widget.groups) ...[
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 8),
                child: Text(
                  '${g.name}${g.required > 0 ? '  ·  required' : ''}${g.maxSelect > 1 ? '  ·  up to ${g.maxSelect}' : ''}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: g == _missing ? scheme.error : null),
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final o in g.options)
                  FilterChip(
                    label: Text(o.deltaPence == 0 ? o.name : '${o.name}  ${o.deltaPence > 0 ? '+' : ''}${money(o.deltaPence)}'),
                    selected: _picked[g.id]!.contains(o),
                    showCheckmark: g.maxSelect > 1,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    onSelected: (_) => _toggle(g, o),
                  ),
              ]),
            ],
            const SizedBox(height: 16),
            TextField(controller: _notes, decoration: const InputDecoration(labelText: 'Note for the kitchen (optional)')),
          ]),
        ),
      ),
      actions: [
        IconButton.outlined(onPressed: _qty > 1 ? () => setState(() => _qty--) : null, icon: const Icon(Icons.remove)),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: Text('$_qty', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
        IconButton.outlined(onPressed: () => setState(() => _qty++), icon: const Icon(Icons.add)),
        const SizedBox(width: 16),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _missing != null
              ? null
              : () => Navigator.pop(
                    context,
                    _Choice([
                      for (final g in widget.groups)
                        for (final o in _picked[g.id]!) LineModifier(id: o.id, name: o.name, deltaPence: o.deltaPence),
                    ], _notes.text.trim().isEmpty ? null : _notes.text.trim(), _qty),
                  ),
          child: Text('Add ${money(_each * _qty)}'),
        ),
      ],
    );
  }
}

class _OpenItemDialog extends StatefulWidget {
  const _OpenItemDialog();

  @override
  State<_OpenItemDialog> createState() => _OpenItemDialogState();
}

class _OpenItemDialogState extends State<_OpenItemDialog> {
  final _name = TextEditingController();
  int _pence = 0;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Open item'),
        content: SizedBox(
          width: 340,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'What is it?'), autofocus: true),
            const SizedBox(height: 12),
            MoneyField(pence: _pence, label: 'Price'),
            const SizedBox(height: 12),
            Keypad(extra: 'del', leftKey: '00', onKey: (k) => setState(() => _pence = applyMoneyKey(_pence, k))),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: _pence <= 0 ? null : () => Navigator.pop(context, (_name.text.trim().isEmpty ? 'Item' : _name.text.trim(), _pence)),
            child: const Text('Add'),
          ),
        ],
      );
}

class _DiscountDialog extends StatefulWidget {
  const _DiscountDialog({required this.order});
  final PosOrder order;

  @override
  State<_DiscountDialog> createState() => _DiscountDialogState();
}

class _DiscountDialogState extends State<_DiscountDialog> {
  late int _pence = widget.order.discountPence;
  late final _reason = TextEditingController(text: widget.order.discountReason);

  @override
  Widget build(BuildContext context) {
    final sub = widget.order.subtotalPence;
    return AlertDialog(
      title: const Text('Discount'),
      content: SizedBox(
        width: 360,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            for (final pct in [10, 15, 20, 50])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: OutlinedButton(onPressed: () => setState(() => _pence = (sub * pct / 100).round()), child: Text('$pct%')),
                ),
              ),
          ]),
          const SizedBox(height: 12),
          MoneyField(pence: _pence, label: 'Off the bill of ${money(sub)}'),
          const SizedBox(height: 12),
          Keypad(leftKey: '00', onKey: (k) => setState(() => _pence = applyMoneyKey(_pence, k).clamp(0, sub))),
          const SizedBox(height: 12),
          TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason', hintText: 'Regular, staff, complaint…')),
        ]),
      ),
      actions: [
        if (widget.order.discountPence > 0) TextButton(onPressed: () => Navigator.pop(context, (0, null)), child: const Text('Remove discount')),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _pence <= 0 ? null : () => Navigator.pop(context, (_pence, _reason.text.trim().isEmpty ? null : _reason.text.trim())),
          child: const Text('Apply'),
        ),
      ],
    );
  }
}

/// Cash (with change) or card (amount typed into the card machine by hand). Paying less than
/// the total leaves the rest to pay - that's how a bill is split between cash and card.
class PaymentDialog extends StatefulWidget {
  const PaymentDialog({super.key, required this.order});
  final PosOrder order;

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  String _method = 'Cash';
  late int _amount = widget.order.duePence;
  bool _typed = false;
  bool _busy = false;
  int? _changeShown;

  int get _due => widget.order.duePence;

  void _key(String k) => setState(() {
        _amount = applyMoneyKey(_typed ? _amount : 0, k);
        _typed = true;
      });

  Future<void> _confirm() async {
    final state = context.read<PosState>();
    final applied = _amount > _due ? _due : _amount;
    if (_method == 'Card' && _amount > _due) return showMessage(context, 'A card payment can’t be more than what is owed.', error: true);
    setState(() => _busy = true);
    final change = _method == 'Cash' ? _amount - applied : 0;
    final closing = applied == _due;
    final problem = await guard(context, () => state.takePayment(widget.order, _method, applied, tenderedPence: _method == 'Cash' ? _amount : null));
    if (!mounted) return;
    setState(() => _busy = false);
    if (problem != null) showMessage(context, problem, error: true);
    if (closing) {
      if (change > 0) {
        setState(() => _changeShown = change);
      } else {
        Navigator.pop(context, true);
      }
    } else {
      setState(() {
        _amount = widget.order.duePence;
        _typed = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (_changeShown != null) {
      return AlertDialog(
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Change', style: TextStyle(fontSize: 20, color: scheme.onSurfaceVariant)),
          Text(money(_changeShown!), style: const TextStyle(fontSize: 64, fontWeight: FontWeight.w800)),
        ]),
        actions: [FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Done'))],
      );
    }
    final quick = <int>{_due, ((_due + 499) ~/ 500) * 500, 1000, 2000, 5000}.where((v) => v >= _due).toList()..sort();
    final change = _method == 'Cash' && _amount > _due ? _amount - _due : 0;
    return AlertDialog(
      title: Row(children: [
        const Text('Payment'),
        const Spacer(),
        Text('Due ${money(_due)}', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700)),
      ]),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'Cash', label: Text('Cash'), icon: Icon(Icons.payments_outlined)),
              ButtonSegment(value: 'Card', label: Text('Card'), icon: Icon(Icons.credit_card)),
            ],
            selected: {_method},
            onSelectionChanged: (s) => setState(() {
              _method = s.first;
              _amount = _due;
              _typed = false;
            }),
          ),
          const SizedBox(height: 14),
          MoneyField(pence: _amount, label: _method == 'Cash' ? 'Cash given' : 'Charge on card machine'),
          if (_method == 'Cash') ...[
            const SizedBox(height: 10),
            Wrap(spacing: 8, children: [
              for (final q in quick)
                ActionChip(label: Text(q == _due ? 'Exact' : money(q)), onPressed: () => setState(() {
                      _amount = q;
                      _typed = false;
                    })),
            ]),
          ],
          const SizedBox(height: 10),
          Keypad(leftKey: '00', onKey: _key, keyAspect: 2.3),
          const SizedBox(height: 12),
          if (change > 0) Text('Change ${money(change)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          if (_amount < _due && _amount > 0) Text('Part payment: ${money(_due - _amount)} will still be owed.', style: TextStyle(color: scheme.onSurfaceVariant)),
        ])),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy || _amount <= 0 ? null : _confirm,
          child: _busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.5)) : Text('Take ${money(_amount > _due ? _due : _amount)}'),
        ),
      ],
    );
  }
}

Future<String?> _askText(BuildContext context, String title, {String? initial, String? hint}) {
  final ctrl = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: SizedBox(width: 380, child: TextField(controller: ctrl, autofocus: true, decoration: InputDecoration(hintText: hint))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(context, ctrl.text), child: const Text('OK')),
      ],
    ),
  );
}
