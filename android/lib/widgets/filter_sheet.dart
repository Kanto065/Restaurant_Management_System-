import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../theme.dart';

class OrderFilter {
  final String? status;
  final String? paymentStatus;
  final DateTime? dateFrom;
  final DateTime? dateTo;

  const OrderFilter({this.status, this.paymentStatus, this.dateFrom, this.dateTo});

  bool get isActive => status != null || paymentStatus != null || dateFrom != null || dateTo != null;

  OrderFilter copyWith({
    String? status,
    bool clearStatus = false,
    String? paymentStatus,
    bool clearPaymentStatus = false,
    DateTime? dateFrom,
    bool clearDateFrom = false,
    DateTime? dateTo,
    bool clearDateTo = false,
  }) {
    return OrderFilter(
      status: clearStatus ? null : (status ?? this.status),
      paymentStatus: clearPaymentStatus ? null : (paymentStatus ?? this.paymentStatus),
      dateFrom: clearDateFrom ? null : (dateFrom ?? this.dateFrom),
      dateTo: clearDateTo ? null : (dateTo ?? this.dateTo),
    );
  }

  List<String> get chipLabels => [
        if (status != null) status!,
        if (paymentStatus != null) paymentStatus!,
        if (dateFrom != null || dateTo != null) 'Date range',
      ];
}

final _dateFormat = DateFormat('dd/MM/yyyy');

/// Modal bottom sheet for filtering orders by status, payment status and
/// date range - shared by the New Orders and History tabs.
Future<OrderFilter?> showOrderFilterSheet(
  BuildContext context, {
  required OrderFilter current,
  required List<OrderStatusDefinition> statuses,
  required List<PaymentStatusDefinition> paymentStatuses,
}) {
  return showModalBottomSheet<OrderFilter>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _FilterSheetBody(current: current, statuses: statuses, paymentStatuses: paymentStatuses),
  );
}

class _FilterSheetBody extends StatefulWidget {
  const _FilterSheetBody({required this.current, required this.statuses, required this.paymentStatuses});

  final OrderFilter current;
  final List<OrderStatusDefinition> statuses;
  final List<PaymentStatusDefinition> paymentStatuses;

  @override
  State<_FilterSheetBody> createState() => _FilterSheetBodyState();
}

class _FilterSheetBodyState extends State<_FilterSheetBody> {
  late OrderFilter _draft = widget.current;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;

    Widget sectionLabel(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
          child: Text(text, style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 11.5, letterSpacing: 0.06)),
        );

    Widget pill(String label, bool selected, VoidCallback onTap) => OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 40),
            padding: const EdgeInsets.symmetric(horizontal: 13),
            backgroundColor: selected ? scheme.primary.withValues(alpha: 0.1) : null,
            foregroundColor: selected ? scheme.primary : scheme.onSurface,
            side: BorderSide(color: selected ? scheme.primary : scheme.outline),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          ),
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        );

    Future<void> pickDate({required bool isFrom}) async {
      final picked = await showDatePicker(
        context: context,
        initialDate: (isFrom ? _draft.dateFrom : _draft.dateTo) ?? DateTime.now(),
        firstDate: DateTime(2020),
        lastDate: DateTime(2100),
      );
      if (picked == null) return;
      setState(() {
        _draft = isFrom ? _draft.copyWith(dateFrom: picked) : _draft.copyWith(dateTo: picked);
      });
    }

    return SafeArea(
      child: DraggableScrollableSheet(
        initialChildSize: 0.86,
        maxChildSize: 0.86,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) {
          return ListView(
            controller: scrollController,
            children: [
              const SizedBox(height: 6),
              Center(child: Container(width: 38, height: 4, decoration: BoxDecoration(color: scheme.outline, borderRadius: BorderRadius.circular(2)))),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
                child: Row(
                  children: const [
                    Text('Filter orders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  ],
                ),
              ),
              sectionLabel('Order status'),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    pill('All statuses', _draft.status == null, () => setState(() => _draft = _draft.copyWith(clearStatus: true))),
                    for (final s in widget.statuses) pill(s.name, _draft.status == s.name, () => setState(() => _draft = _draft.copyWith(status: s.name))),
                  ],
                ),
              ),
              sectionLabel('Payment status'),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    pill('All payments', _draft.paymentStatus == null, () => setState(() => _draft = _draft.copyWith(clearPaymentStatus: true))),
                    for (final p in widget.paymentStatuses)
                      pill(p.name, _draft.paymentStatus == p.name, () => setState(() => _draft = _draft.copyWith(paymentStatus: p.name))),
                  ],
                ),
              ),
              sectionLabel('Date range'),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => pickDate(isFrom: true),
                        child: Text(_draft.dateFrom == null ? 'From' : _dateFormat.format(_draft.dateFrom!)),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('–')),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => pickDate(isFrom: false),
                        child: Text(_draft.dateTo == null ? 'To' : _dateFormat.format(_draft.dateTo!)),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
                child: Text('DD/MM/YYYY · en-GB', style: TextStyle(color: tokens.mutedFg, fontSize: 11.5)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
                child: Wrap(
                  spacing: 8,
                  children: [
                    pill('Today', false, () => setState(() {
                          final now = DateTime.now();
                          _draft = _draft.copyWith(dateFrom: DateTime(now.year, now.month, now.day), dateTo: now);
                        })),
                    pill('Last 7 days', false, () => setState(() {
                          final now = DateTime.now();
                          _draft = _draft.copyWith(dateFrom: now.subtract(const Duration(days: 7)), dateTo: now);
                        })),
                    pill('Any date', false, () => setState(() => _draft = _draft.copyWith(clearDateFrom: true, clearDateTo: true))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 4),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: scheme.outline))),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(const OrderFilter()),
                        child: const Text('Clear all'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(context).pop(_draft),
                        child: const Text('Apply filters'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          );
        },
      ),
    );
  }
}
