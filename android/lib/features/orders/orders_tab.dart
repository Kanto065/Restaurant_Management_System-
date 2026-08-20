import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/filter_sheet.dart';
import 'order_card.dart';

/// New Orders tab: minimal rows, live-updated via SSE, with search/filter.
class OrdersTab extends ConsumerStatefulWidget {
  const OrdersTab({super.key});

  @override
  ConsumerState<OrdersTab> createState() => OrdersTabState();
}

class OrdersTabState extends ConsumerState<OrdersTab> {
  bool _searchOpen = false;
  String _search = '';
  OrderFilter _filter = const OrderFilter();

  bool get hasActiveFilters => _filter.isActive;

  Future<void> openFilter() async {
    final statuses = ref.read(orderStatusDefinitionsProvider);
    final paymentStatuses = ref.read(paymentStatusDefinitionsProvider);
    final result = await showOrderFilterSheet(context, current: _filter, statuses: statuses, paymentStatuses: paymentStatuses);
    if (result != null) setState(() => _filter = result);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;
    final ordersAsync = ref.watch(ordersProvider);
    final currency = ref.watch(currencySymbolProvider).valueOrNull ?? '£';

    return Column(
      children: [
        Container(
          height: 58,
          padding: const EdgeInsets.fromLTRB(16, 0, 6, 0),
          decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outline))),
          child: Row(
            children: [
              Expanded(
                child: _searchOpen
                    ? TextField(
                        autofocus: true,
                        decoration: const InputDecoration(isDense: true, hintText: 'Search order # or name'),
                        onChanged: (v) => setState(() => _search = v),
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          const Text('New Orders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 19)),
                          const SizedBox(width: 9),
                          Text('${ordersAsync.valueOrNull?.length ?? 0} orders', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w500, fontSize: 12.5)),
                        ],
                      ),
              ),
              IconButton(
                icon: Icon(_searchOpen ? Icons.close : Icons.search),
                onPressed: () => setState(() => _searchOpen = !_searchOpen),
              ),
              IconButton(
                icon: Icon(Icons.filter_list, color: hasActiveFilters ? scheme.primary : scheme.onSurface),
                onPressed: openFilter,
              ),
            ],
          ),
        ),
        if (hasActiveFilters)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(color: scheme.surface, border: Border(bottom: BorderSide(color: scheme.outline))),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final label in _filter.chipLabels)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Chip(label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12))),
                    ),
                  TextButton(onPressed: () => setState(() => _filter = const OrderFilter()), child: const Text('Clear')),
                ],
              ),
            ),
          ),
        Expanded(
          child: ordersAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Failed to load orders: $e')),
            data: (orders) {
              final filtered = orders.where((o) {
                if (_search.isNotEmpty) {
                  final query = _search.toLowerCase();
                  final matches = o.orderNumber.toLowerCase().contains(query) || (o.customerName ?? '').toLowerCase().contains(query);
                  if (!matches) return false;
                }
                if (_filter.status != null && o.status != _filter.status) return false;
                if (_filter.paymentStatus != null && o.paymentStatus != _filter.paymentStatus) return false;
                return true;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 60, height: 60, decoration: BoxDecoration(color: scheme.surfaceContainer, shape: BoxShape.circle)),
                      const SizedBox(height: 14),
                      const Text('No active orders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15.5)),
                      const SizedBox(height: 5),
                      Text('Confirmed orders appear here.', style: TextStyle(color: tokens.mutedFg, fontSize: 13)),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(14),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => OrderCard(order: filtered[i], currencySymbol: currency),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
