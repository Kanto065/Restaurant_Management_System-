import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../api/models.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/filter_sheet.dart';
import '../orders/order_card.dart';

const _pageSize = 25;
final _apiDateFormat = DateFormat('yyyy-MM-dd');

/// Order History tab - paginated server-side search/filter, matching
/// admin-frontend/src/pages/Orders.tsx's query shape and 350ms debounce.
class HistoryTab extends ConsumerStatefulWidget {
  const HistoryTab({super.key});

  @override
  ConsumerState<HistoryTab> createState() => HistoryTabState();
}

class HistoryTabState extends ConsumerState<HistoryTab> {
  bool searchOpen = false;
  String _search = '';
  OrderFilter _filter = const OrderFilter();
  int _page = 1;
  Timer? _debounce;

  List<OrderListItem> _items = [];
  int _totalCount = 0;
  bool _loading = true;
  String? _error;

  bool get hasActiveFilters => _filter.isActive;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _debouncedReload() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _page = 1;
      _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(ordersRepositoryProvider).searchOrders(
            status: _filter.status,
            paymentStatus: _filter.paymentStatus,
            search: _search.isEmpty ? null : _search,
            dateFrom: _filter.dateFrom == null ? null : _apiDateFormat.format(_filter.dateFrom!),
            dateTo: _filter.dateTo == null ? null : _apiDateFormat.format(_filter.dateTo!),
            page: _page,
            pageSize: _pageSize,
          );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _totalCount = page.totalCount;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> openFilter() async {
    final statuses = ref.read(orderStatusDefinitionsProvider);
    final paymentStatuses = ref.read(paymentStatusDefinitionsProvider);
    final result = await showOrderFilterSheet(context, current: _filter, statuses: statuses, paymentStatuses: paymentStatuses);
    if (result != null) {
      setState(() => _filter = result);
      _page = 1;
      _load();
    }
  }

  int get _pageCount => (_totalCount / _pageSize).ceil().clamp(1, 1 << 30);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;
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
                child: searchOpen
                    ? TextField(
                        autofocus: true,
                        decoration: const InputDecoration(isDense: true, hintText: 'Search order # or name'),
                        onChanged: (v) {
                          _search = v;
                          _debouncedReload();
                        },
                      )
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          const Text('History', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 19)),
                          const SizedBox(width: 9),
                          Text('$_totalCount orders', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w500, fontSize: 12.5)),
                        ],
                      ),
              ),
              IconButton(
                icon: Icon(searchOpen ? Icons.close : Icons.search),
                onPressed: () => setState(() => searchOpen = !searchOpen),
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
                    Padding(padding: const EdgeInsets.only(right: 8), child: Chip(label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)))),
                  TextButton(
                    onPressed: () {
                      setState(() => _filter = const OrderFilter());
                      _page = 1;
                      _load();
                    },
                    child: const Text('Clear'),
                  ),
                ],
              ),
            ),
          ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text('Failed to load history: $_error'))
                  : _items.isEmpty
                      ? Center(child: Text('No orders match these filters.', style: TextStyle(color: tokens.mutedFg)))
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, i) => OrderCard(order: _items[i], currencySymbol: currency),
                        ),
        ),
        if (_pageCount > 1)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _page > 1
                      ? () {
                          setState(() => _page--);
                          _load();
                        }
                      : null,
                  icon: const Icon(Icons.chevron_left),
                ),
                Text('Page $_page of $_pageCount', style: TextStyle(color: tokens.mutedFg, fontSize: 13)),
                IconButton(
                  onPressed: _page < _pageCount
                      ? () {
                          setState(() => _page++);
                          _load();
                        }
                      : null,
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
