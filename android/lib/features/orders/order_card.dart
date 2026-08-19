import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../api/models.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/pos_card.dart';
import '../../widgets/status_chip_control.dart';

final _timeFormat = DateFormat('HH:mm');

/// Minimal order row used by both the New Orders and History tabs: header
/// line (order #, type, method, total), meta line, then the shared status
/// and payment chip controls, expandable to a line-item detail panel.
class OrderCard extends ConsumerStatefulWidget {
  const OrderCard({super.key, required this.order, required this.currencySymbol});

  final OrderListItem order;
  final String currencySymbol;

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

  Future<void> _setStatus(String status) async {
    setState(() => _busy = true);
    try {
      await ref.read(ordersProvider.notifier).updateStatus(widget.order.id, status);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to update status: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
                      Text(' · ${_timeFormat.format(order.createdAt.toLocal())}', style: TextStyle(color: tokens.mutedFg, fontSize: 12.5)),
                    ],
                  ),
                ],
              ),
            ),
          ),
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
                  onAdvance: () {
                    final sorted = [...statusDefs]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
                    final index = sorted.indexWhere((d) => d.name == order.status);
                    final next = (index != -1 && index + 1 < sorted.length) ? sorted[index + 1].name : order.status;
                    _setStatus(next);
                  },
                  onJumpToTerminal: () => _setStatus(completedStatus),
                  onOverflow: () => _setStatus(order.status), // TODO: "jump with note" dialog + reprint menu
                ),
                const SizedBox(height: 7),
                Padding(
                  padding: const EdgeInsets.only(right: 44),
                  child: StatusChipControl(
                    value: order.paymentStatus,
                    options: paymentDefs.map((d) => ChipOption(d.name, d.displayOrder)).toList(),
                    terminalValue: paidStatus,
                    paletteFor: (name, displayOrder, brightness) => paymentChipColor(name, displayOrder, brightness),
                    busy: _busy,
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
                    onAdvance: () {
                      final sorted = [...paymentDefs]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
                      final index = sorted.indexWhere((d) => d.name == order.paymentStatus);
                      final next = (index != -1 && index + 1 < sorted.length) ? sorted[index + 1].name : order.paymentStatus;
                      _setPaymentStatus(next);
                    },
                    onJumpToTerminal: () => _setPaymentStatus(paidStatus),
                  ),
                ),
              ],
            ),
          ),
          if (_expanded)
            Container(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: scheme.outline)), color: scheme.surfaceContainer),
              padding: const EdgeInsets.all(14),
              child: _detail == null
                  ? const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Center(child: CircularProgressIndicator()))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final item in _detail!.items)
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
                                    ],
                                  ),
                                ),
                                Text('${widget.currencySymbol}${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              ],
                            ),
                          ),
                        const SizedBox(height: 10),
                        OutlinedButton(onPressed: () {}, child: const Text('Reprint receipt')),
                      ],
                    ),
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
