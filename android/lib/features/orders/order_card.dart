import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../api/models.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/pos_card.dart';
import '../../widgets/status_chip_control.dart';
import '../printing/receipt_formatter.dart';

final _timeFormat = DateFormat('h:mm a');
final _invoiceDateFormat = DateFormat('d MMM yyyy');

String _orderTypeDescription(String orderType) {
  switch (orderType.toLowerCase()) {
    case 'collection':
      return 'Collection at counter';
    case 'dinein':
      return 'Dine-in';
    case 'delivery':
      return 'Delivery';
    default:
      return orderType;
  }
}

/// Minimal order row used by both the New Orders and History tabs: header
/// line (order #, type, method, total), meta line, then the shared status
/// and payment chip controls, expandable to a line-item detail panel.
///
/// The order status chip is always visible in New Orders
/// ([alwaysShowStatus]); in History every status/payment/reprint control -
/// and the invoice detail - stays hidden until the card is tapped, since a
/// history row is a closed record, not something staff act on at a glance.
class OrderCard extends ConsumerStatefulWidget {
  const OrderCard({super.key, required this.order, required this.currencySymbol, this.alwaysShowStatus = true});

  final OrderListItem order;
  final String currencySymbol;
  final bool alwaysShowStatus;

  @override
  ConsumerState<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<OrderCard> {
  bool _expanded = false;
  bool _busy = false;
  OrderDetail? _detail;

  Future<void> _toggleExpand() async {
    setState(() => _expanded = !_expanded);
    if (_expanded && _detail == null) {
      final detail = await ref.read(ordersRepositoryProvider).getOrder(widget.order.id);
      if (mounted) setState(() => _detail = detail);
    }
  }

  Future<void> _setStatus(String status, {String? note}) async {
    setState(() => _busy = true);
    try {
      await ref.read(ordersProvider.notifier).updateStatus(widget.order.id, status, note: note);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update status: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reprint() async {
    setState(() => _busy = true);
    try {
      var detail = _detail;
      if (detail == null) {
        detail = await ref.read(ordersRepositoryProvider).getOrder(widget.order.id);
        if (mounted) setState(() => _detail = detail);
      }

      final settings = ref.read(settingsProvider).valueOrNull;
      final currency = ref.read(currencySymbolProvider).valueOrNull ?? widget.currencySymbol;
      final restaurant = ref.read(restaurantInfoProvider).valueOrNull;
      final receipt = buildReceipt(detail, currencySymbol: currency, restaurant: restaurant);
      await ref.read(printerServiceProvider).printReceipt(receipt, copies: settings?.copiesPerOrder ?? 1);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Receipt reprinted')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Reprint failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _jumpWithNote(List<OrderStatusDefinition> statusDefs) async {
    final sorted = [...statusDefs]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final picked = await showChipValueSheet(
      context,
      title: 'Change status',
      options: sorted.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
      current: widget.order.status,
      paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
    );
    if (picked == null || !mounted) return;
    final note = await _promptForNote();
    if (note == null || !mounted) return;
    await _setStatus(picked, note: note.trim().isEmpty ? null : note.trim());
  }

  Future<String?> _promptForNote() async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add a note'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'Optional note for this change'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(controller.text), child: const Text('Confirm')),
        ],
      ),
    );
    controller.dispose();
    return note;
  }

  Future<void> _setPaymentStatus(String status) async {
    setState(() => _busy = true);
    try {
      await ref.read(ordersProvider.notifier).updatePaymentStatus(widget.order.id, status);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update payment status: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;
    final order = widget.order;
    final statusDefs = ref.watch(orderStatusDefinitionsProvider);
    final paymentDefs = ref.watch(paymentStatusDefinitionsProvider);
    final completedStatus = statusDefs.where((d) => d.countsAsCompleted).firstOrNull?.name ?? order.status;
    final paidStatus = paymentDefs.where((d) => d.name.toLowerCase() == 'paid').firstOrNull?.name ?? order.paymentStatus;

    return PosCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: _toggleExpand,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('#${order.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, fontFamily: 'monospace')),
                      const SizedBox(width: 8),
                      _pill(order.orderType, background: tokens.secondary, foreground: Colors.white),
                      const SizedBox(width: 6),
                      _pill(order.paymentMethod, outlined: true, borderColor: scheme.outline),
                      const Spacer(),
                      Text('${widget.currencySymbol}${order.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Flexible(child: Text(order.customerName ?? 'Walk-in', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5))),
                      Text(
                        ' · ${_timeFormat.format(order.createdAt.toLocal())} · ${order.itemCount} item${order.itemCount == 1 ? '' : 's'}',
                        style: TextStyle(color: tokens.mutedFg, fontSize: 12.5),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (widget.alwaysShowStatus || _expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 13),
              child: Column(
                children: [
                  StatusChipControl(
                    value: order.status,
                    options: statusDefs.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
                    terminalValue: completedStatus,
                    paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
                    busy: _busy,
                    onTapValue: () async {
                      final picked = await showChipValueSheet(
                        context,
                        title: 'Order status',
                        options: statusDefs.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
                        current: order.status,
                        paletteFor: (name, displayOrder, brightness) => statusChipColor(displayOrder, brightness),
                      );
                      if (picked != null) await _setStatus(picked);
                    },
                    onLongPressValue: () => _jumpWithNote(statusDefs),
                    onAdvance: () {
                      final sorted = [...statusDefs]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
                      final index = sorted.indexWhere((d) => d.name == order.status);
                      final next = (index != -1 && index + 1 < sorted.length) ? sorted[index + 1].name : order.status;
                      _setStatus(next);
                    },
                    onJumpToTerminal: () => _setStatus(completedStatus),
                  ),
                  if (_expanded) ...[
                    const SizedBox(height: 7),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: StatusChipControl(
                              value: order.paymentStatus,
                              options: paymentDefs.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
                              terminalValue: paidStatus,
                              paletteFor: (name, displayOrder, brightness) => paymentChipColor(name, displayOrder, brightness),
                              busy: _busy,
                              showAdvance: false,
                              onTapValue: () async {
                                final picked = await showChipValueSheet(
                                  context,
                                  title: 'Payment status',
                                  options: paymentDefs.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
                                  current: order.paymentStatus,
                                  paletteFor: (name, displayOrder, brightness) => paymentChipColor(name, displayOrder, brightness),
                                );
                                if (picked != null) await _setPaymentStatus(picked);
                              },
                              onAdvance: () {},
                              onJumpToTerminal: () => _setPaymentStatus(paidStatus),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 8)),
                              onPressed: _busy ? null : _reprint,
                              icon: const Icon(Icons.print_outlined, size: 16),
                              label: const Text('Reprint'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          if (_expanded)
            Container(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: scheme.outline)), color: scheme.surfaceContainer),
              padding: const EdgeInsets.all(14),
              child: _detail == null
                  ? const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Center(child: CircularProgressIndicator()))
                  : _invoiceDetail(context, tokens, scheme, _detail!),
            ),
        ],
      ),
    );
  }

  Widget _invoiceDetail(BuildContext context, PosTokens tokens, ColorScheme scheme, OrderDetail detail) {
    final labelStyle = TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w500, fontSize: 11.5, letterSpacing: 0.04);
    final divider = Divider(height: 18, color: scheme.outline);
    final contactLine = [
      if (detail.customerPhone != null && detail.customerPhone!.trim().isNotEmpty) detail.customerPhone!,
      _orderTypeDescription(detail.orderType),
    ].join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text('INVOICE #${detail.orderNumber}', style: labelStyle)),
            Text(
              '${_invoiceDateFormat.format(detail.createdAt.toLocal())} · ${_timeFormat.format(detail.createdAt.toLocal())}',
              style: labelStyle,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(detail.customerName ?? 'Walk-in', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 2),
        Text(contactLine, style: TextStyle(color: tokens.mutedFg, fontSize: 12.5)),
        divider,
        for (final item in detail.items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${item.quantity}× ${item.nameSnapshot}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                      if (item.modifiers.isNotEmpty)
                        Text(item.modifiers.map((m) => m.nameSnapshot).join(', '), style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
                      if ((item.specialInstructions ?? '').isNotEmpty)
                        Text(item.specialInstructions!, style: TextStyle(color: tokens.warning, fontWeight: FontWeight.w600, fontSize: 12)),
                    ],
                  ),
                ),
                Text('${widget.currencySymbol}${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              ],
            ),
          ),
        if ((detail.specialRequests ?? '').isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: tokens.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SPECIAL REQUESTS', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 10.5, letterSpacing: 0.06)),
                const SizedBox(height: 4),
                Text(detail.specialRequests!, style: const TextStyle(fontSize: 12.5, height: 1.5)),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
        divider,
        _totalRow(tokens, 'Subtotal', detail.subtotal),
        if (detail.deliveryFee > 0) _totalRow(tokens, 'Delivery fee', detail.deliveryFee),
        if (detail.processingFee > 0) _totalRow(tokens, 'Processing fee', detail.processingFee),
        if (detail.discountAmount > 0) _totalRow(tokens, 'Discount', -detail.discountAmount),
        const SizedBox(height: 4),
        _totalRow(tokens, 'Total', detail.totalAmount, emphasize: true),
      ],
    );
  }

  Widget _totalRow(PosTokens tokens, String label, double amount, {bool emphasize = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: emphasize ? null : tokens.mutedFg, fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500, fontSize: emphasize ? 14.5 : 13)),
          Text(
            '${amount < 0 ? '-' : ''}${widget.currencySymbol}${amount.abs().toStringAsFixed(2)}',
            style: TextStyle(fontWeight: emphasize ? FontWeight.w700 : FontWeight.w600, fontSize: emphasize ? 14.5 : 13),
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, {Color? background, Color? foreground, bool outlined = false, Color? borderColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: background,
        border: outlined ? Border.all(color: borderColor ?? Colors.transparent) : null,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 11, color: foreground)),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
