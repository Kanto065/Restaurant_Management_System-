import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/models.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../printing/receipt_formatter.dart';
import 'incoming_queue.dart';

/// Full-screen takeover shown while one or more orders sit unconfirmed.
/// Nothing else is usable until Confirm or Cancel - queues multiple
/// simultaneous incoming orders and shows "1 of N".
class IncomingOrderOverlay extends ConsumerWidget {
  const IncomingOrderOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(incomingOrderIdsProvider);
    if (queue.isEmpty) return const SizedBox.shrink();
    return PopScope(
      canPop: false,
      child: _IncomingOrderScreen(orderId: queue.first, position: 1, total: queue.length),
    );
  }
}

class _IncomingOrderScreen extends ConsumerStatefulWidget {
  const _IncomingOrderScreen({required this.orderId, required this.position, required this.total});

  final String orderId;
  final int position;
  final int total;

  @override
  ConsumerState<_IncomingOrderScreen> createState() => _IncomingOrderScreenState();
}

class _IncomingOrderScreenState extends ConsumerState<_IncomingOrderScreen> {
  OrderDetail? _detail;
  bool _busy = false;
  bool _printing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _IncomingOrderScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.orderId != widget.orderId) {
      _detail = null;
      _load();
    }
  }

  Future<void> _load() async {
    final detail = await ref.read(ordersRepositoryProvider).getOrder(widget.orderId);
    if (mounted) setState(() => _detail = detail);
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: const Text('The customer is notified and the order moves to History as Cancelled. Nothing prints.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Keep')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    // Another actor (admin dashboard, a different terminal) could resolve
    // this same order while the confirmation dialog is open, which - like
    // updateStatus below - can dispose this State before the dialog's await
    // resumes if this was the last order in the queue.
    if (!mounted) return;
    setState(() => _busy = true);
    try {
      final definitions = ref.read(orderStatusDefinitionsProvider);
      final cancelled = definitions.where((d) => d.name.toLowerCase() == 'cancelled').firstOrNull?.name ?? 'Cancelled';
      await ref.read(ordersProvider.notifier).updateStatus(widget.orderId, cancelled);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmAndPrint() async {
    final detail = _detail;
    if (detail == null) return;
    setState(() => _busy = true);
    try {
      final definitions = ref.read(orderStatusDefinitionsProvider);
      final sorted = [...definitions]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      final index = sorted.indexWhere((d) => d.name == detail.status);
      final next = (index != -1 && index + 1 < sorted.length) ? sorted[index + 1].name : detail.status;

      // Everything below is read from `ref` now and kept as locals, not
      // re-read after the update - updateStatus's REST round-trip can
      // outlast this screen (confirming moves the order out of
      // ordersAwaitingConfirmation, which can pop the overlay entirely or
      // swap in the next queued order before this await resumes, disposing
      // this State), and unlike a bare setState, Riverpod's `ref.read`
      // throws immediately once that happens rather than just warning.
      // Printing should still happen either way; only UI feedback
      // (setState/context) needs a mounted check.
      final ordersNotifier = ref.read(ordersProvider.notifier);
      final settings = ref.read(settingsProvider).valueOrNull;
      final currency = ref.read(currencySymbolProvider).valueOrNull ?? '£';
      final restaurant = ref.read(restaurantInfoProvider).valueOrNull;
      final receipt = buildReceipt(detail, currencySymbol: currency, restaurant: restaurant);
      final printerService = ref.read(printerServiceProvider);

      await ordersNotifier.updateStatus(widget.orderId, next);

      if (mounted) setState(() => _printing = true);
      try {
        await printerService.printReceipt(receipt, copies: settings?.copiesPerOrder ?? 1);
        await Future.delayed(const Duration(milliseconds: 1100));
        if (mounted) {
          setState(() => _printing = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('#${detail.orderNumber} confirmed · receipt printed')),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _printing = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Order confirmed but printing failed: $e'),
              action: SnackBarAction(
                label: 'Reprint',
                onPressed: () async {
                  try {
                    await printerService.printReceipt(receipt, copies: settings?.copiesPerOrder ?? 1);
                  } catch (_) {}
                },
              ),
            ),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;
    final detail = _detail;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: Stack(
        children: [
          Column(
            children: [
              Container(
                color: scheme.primary,
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
                child: SafeArea(
                  bottom: false,
                  child: Row(
                    children: [
                      _PulsingDot(color: scheme.onPrimary),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('New order', style: TextStyle(color: scheme.onPrimary, fontWeight: FontWeight.w700, fontSize: 17)),
                            Text(
                              widget.total > 1 ? 'Just now · ${widget.position} of ${widget.total}' : 'Just now',
                              style: TextStyle(color: scheme.onPrimary.withValues(alpha: 0.9), fontWeight: FontWeight.w500, fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      if (detail != null)
                        Text('#${detail.orderNumber}', style: TextStyle(color: scheme.onPrimary, fontWeight: FontWeight.w700, fontSize: 21, fontFamily: 'monospace')),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: detail == null
                    ? const Center(child: CircularProgressIndicator())
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 7,
                              runSpacing: 7,
                              children: [
                                _Pill(label: detail.orderType, background: tokens.secondary, foreground: Colors.white),
                                _Pill(label: detail.paymentMethod, outlined: true),
                                _Pill(label: detail.paymentStatus, outlined: true),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Text(detail.customerName ?? 'Walk-in', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15.5)),
                            const SizedBox(height: 2),
                            Text(
                              [detail.customerPhone, ''].where((s) => s != null && s.isNotEmpty).join(' · '),
                              style: TextStyle(color: tokens.mutedFg, fontSize: 13.5, height: 1.6),
                            ),
                            Divider(height: 32, color: scheme.outline),
                            for (final item in detail.items)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 9),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('${item.quantity}× ${item.nameSnapshot}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                                          if (item.modifiers.isNotEmpty)
                                            Text(item.modifiers.map((m) => m.nameSnapshot).join(', '), style: TextStyle(color: tokens.mutedFg, fontSize: 12.5)),
                                          if ((item.specialInstructions ?? '').isNotEmpty)
                                            Text(item.specialInstructions!, style: TextStyle(color: tokens.warning, fontWeight: FontWeight.w600, fontSize: 12.5)),
                                        ],
                                      ),
                                    ),
                                    Text(item.lineTotal.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.all(13),
                              decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(12)),
                              child: Column(
                                children: [
                                  _totalsRow('Subtotal', detail.subtotal, tokens),
                                  if (detail.deliveryFee > 0) _totalsRow('Delivery fee', detail.deliveryFee, tokens),
                                  if (detail.processingFee > 0) _totalsRow('Processing fee', detail.processingFee, tokens),
                                  if (detail.discountAmount > 0) _totalsRow('Discount', -detail.discountAmount, tokens),
                                  Divider(height: 20, color: scheme.outline),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Total', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                                      Text(detail.totalAmount.toStringAsFixed(2), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 22, color: scheme.primary)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            if ((detail.specialRequests ?? '').isNotEmpty) ...[
                              const SizedBox(height: 14),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  border: Border.all(color: scheme.outline, style: BorderStyle.solid),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('SPECIAL REQUESTS', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 11.5, letterSpacing: 0.06)),
                                    const SizedBox(height: 5),
                                    Text(detail.specialRequests!, style: const TextStyle(fontSize: 13.5, height: 1.55)),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
              ),
              Container(
                decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outline))),
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                child: SafeArea(
                  top: false,
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy || detail == null ? null : _cancel,
                          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56), foregroundColor: tokens.destructiveText, side: BorderSide(color: scheme.error)),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          onPressed: _busy || detail == null ? null : _confirmAndPrint,
                          style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                          icon: const Icon(Icons.print_rounded, size: 17),
                          label: const Text('Confirm & print'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_printing) const _PrintingOverlay(),
        ],
      ),
    );
  }

  Widget _totalsRow(String label, double amount, PosTokens tokens) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: tokens.mutedFg, fontSize: 13.5)),
          Text(amount.toStringAsFixed(2), style: const TextStyle(fontSize: 13.5)),
        ],
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});
  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 34,
      height: 34,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final t = _controller.value;
              return Opacity(
                opacity: (0.55 * (1 - t)).clamp(0, 1),
                child: Transform.scale(
                  scale: 1 + t * 1.1,
                  child: Container(width: 34, height: 34, decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
                ),
              );
            },
          ),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), shape: BoxShape.circle),
            child: Center(child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle))),
          ),
        ],
      ),
    );
  }
}

class _PrintingOverlay extends StatelessWidget {
  const _PrintingOverlay();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.55),
      alignment: Alignment.center,
      child: Container(
        width: 250,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _FeedingReceipt(),
            const SizedBox(height: 14),
            const Text('Printing receipt…', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
            const SizedBox(height: 4),
            Text('Please wait', style: TextStyle(color: Theme.of(context).extension<PosTokens>()!.mutedFg, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}

class _FeedingReceipt extends StatefulWidget {
  const _FeedingReceipt();

  @override
  State<_FeedingReceipt> createState() => _FeedingReceiptState();
}

class _FeedingReceiptState extends State<_FeedingReceipt> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 88,
      height: 56,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(8), border: Border.all(color: scheme.outline)),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, -56 + _controller.value * 56),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(6, (i) => Container(height: 4, width: [1.0, 0.7, 0.85, 0.55, 1.0, 0.7][i] * 72, decoration: BoxDecoration(color: scheme.outline, borderRadius: BorderRadius.circular(2)))),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, this.background, this.foreground, this.outlined = false});
  final String label;
  final Color? background;
  final Color? foreground;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        border: outlined ? Border.all(color: scheme.outline) : null,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: foreground ?? scheme.onSurface)),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
