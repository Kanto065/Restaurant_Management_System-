import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../core/permissions.dart';
import '../core/sync.dart';
import '../state/pos_state.dart';
import 'back_office.dart';
import 'order_screen.dart';
import 'start_screens.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final pages = <(IconData, String, Widget)>[
      (Icons.table_restaurant_outlined, 'Tables', const TablesPage()),
      (Icons.takeout_dining_outlined, 'Takeaway', const TakeawayPage()),
      (Icons.receipt_long_outlined, 'Orders', const OrdersPage()),
      (Icons.bar_chart_rounded, 'Day report', const ReportPage()),
      (Icons.settings_outlined, 'Settings', const SettingsPage()),
    ];
    return Scaffold(
      body: Row(children: [
        NavigationRail(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          labelType: NavigationRailLabelType.all,
          minWidth: 88,
          leading: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Icon(Icons.point_of_sale_rounded, color: scheme.primary, size: 30),
          ),
          trailing: Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: scheme.primary.withValues(alpha: 0.15),
                    child: Text(_initials(state.staff?.name ?? '?'), style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 6),
                  Text(state.staff?.name.split(' ').first ?? '', style: const TextStyle(fontSize: 12)),
                  IconButton(tooltip: 'Lock till', icon: const Icon(Icons.lock_outline), onPressed: state.signOut),
                ]),
              ),
            ),
          ),
          destinations: [for (final p in pages) NavigationRailDestination(icon: Icon(p.$1), label: Text(p.$2))],
        ),
        const VerticalDivider(width: 1),
        Expanded(
          child: Column(children: [
            const LicenceBanner(),
            const PrintBanner(),
            Expanded(child: pages[_tab].$3),
          ]),
        ),
      ]),
    );
  }

  static String _initials(String name) => name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();
}

class LicenceBanner extends StatelessWidget {
  const LicenceBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final end = state.licence?.subscriptionEnd;
    final (show, color, text) = switch (state.licenceState) {
      LicenceState.active => (false, Colors.transparent, ''),
      LicenceState.grace => (true, PosColors.bill,
          'The subscription ended on ${end == null ? '' : DateFormat('d MMM').format(end.toLocal())}. New orders stop '
              '${end == null ? 'soon' : 'on ${DateFormat('d MMM').format(end.add(Duration(days: state.licence!.graceDays)).toLocal())}'} unless it is renewed.'),
      LicenceState.expired => (true, PosColors.danger, 'The subscription has ended. New orders are paused; open orders can still be paid.'),
    };
    if (!show) return const SizedBox.shrink();
    return Material(
      color: color,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Row(children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
        ]),
      ),
    );
  }
}

/// A kitchen or bar ticket that hasn't printed. Stays until the queue empties or it's dismissed.
class PrintBanner extends StatelessWidget {
  const PrintBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final alert = state.printAlert;
    if (alert == null) return const SizedBox.shrink();
    return Material(
      color: PosColors.danger,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 8, 6),
        child: Row(children: [
          const Icon(Icons.print_disabled_outlined, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(child: Text(alert, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
          TextButton(onPressed: state.drainPrints, style: TextButton.styleFrom(foregroundColor: Colors.white), child: const Text('Retry')),
          IconButton(tooltip: 'Dismiss', color: Colors.white, icon: const Icon(Icons.close), onPressed: state.dismissPrintAlert),
        ]),
      ),
    );
  }
}

/// Page frame: title on the left, actions on the right, sync status, then content.
class PageFrame extends StatelessWidget {
  const PageFrame({super.key, required this.title, required this.child, this.actions = const []});
  final String title;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 22, 28, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(width: 20),
          SyncChip(state: state),
          const Spacer(),
          ...actions,
        ]),
        const SizedBox(height: 20),
        Expanded(child: child),
      ]),
    );
  }
}

class TablesPage extends StatefulWidget {
  const TablesPage({super.key});

  @override
  State<TablesPage> createState() => _TablesPageState();
}

class _TablesPageState extends State<TablesPage> {
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  Future<void> _open(TableInfo table) async {
    final state = context.read<PosState>();
    final existing = state.orderForTable(table.id);
    if (existing != null) {
      openOrder(context, existing);
      return;
    }
    if (state.access(Perm.takeOrders) == Access.denied) return showMessage(context, 'Your role can’t take orders.', error: true);
    final guests = await showDialog<int>(context: context, builder: (_) => _GuestsDialog(table: table));
    if (guests == null || !mounted) return;
    final order = await guard(context, () async => state.startOrder(table: table, guests: guests));
    if (order != null && mounted) openOrder(context, order);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final tables = state.catalog.tables;
    final occupied = tables.where((t) => state.orderForTable(t.id) != null).length;
    return PageFrame(
      title: 'Tables',
      actions: [
        _Legend(color: scheme.outlineVariant, label: 'Free ${tables.length - occupied}'),
        _Legend(color: PosColors.occupied, label: 'Seated $occupied'),
        _Legend(color: PosColors.bill, label: 'Bill printed'),
      ],
      child: tables.isEmpty
          ? Center(child: Text('No tables yet. Add tables in the admin under Tables.', style: TextStyle(color: scheme.onSurfaceVariant)))
          : GridView.builder(
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 210, mainAxisSpacing: 14, crossAxisSpacing: 14, childAspectRatio: 1.15),
              itemCount: tables.length,
              itemBuilder: (context, i) => _TableTile(table: tables[i], order: state.orderForTable(tables[i].id), billPrinted: state.billPrinted.contains(tables[i].id), onTap: () => _open(tables[i])),
            ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 18),
        child: Row(children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ]),
      );
}

class _TableTile extends StatelessWidget {
  const _TableTile({required this.table, required this.order, required this.billPrinted, required this.onTap});
  final TableInfo table;
  final PosOrder? order;
  final bool billPrinted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final o = order;
    final color = o == null ? scheme.surfaceContainerLow : (billPrinted ? PosColors.bill : PosColors.occupied);
    final fg = o == null ? scheme.onSurface : Colors.white;
    final minutes = o == null ? 0 : DateTime.now().difference(o.createdAt).inMinutes;
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: o == null ? Border.all(color: scheme.outlineVariant) : null),
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(table.number, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: fg)),
              const Spacer(),
              Icon(Icons.people_outline, size: 18, color: fg.withValues(alpha: 0.7)),
              const SizedBox(width: 4),
              Text(o?.guestCount?.toString() ?? '${table.capacity}', style: TextStyle(color: fg.withValues(alpha: 0.8))),
            ]),
            const Spacer(),
            if (o == null)
              Text(table.location ?? 'Free', style: TextStyle(color: scheme.onSurfaceVariant))
            else ...[
              Text(money(o.totalPence), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: fg, fontFeatures: const [FontFeature.tabularFigures()])),
              Text('${o.itemCount} items · ${minutes < 60 ? '$minutes min' : '${minutes ~/ 60} h ${minutes % 60} min'}', style: TextStyle(color: fg.withValues(alpha: 0.85))),
            ],
          ]),
        ),
      ),
    );
  }
}

class _GuestsDialog extends StatelessWidget {
  const _GuestsDialog({required this.table});
  final TableInfo table;

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text('Table ${table.number}: how many guests?'),
        content: SizedBox(
          width: 360,
          child: GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: [
              for (var n = 1; n <= 12; n++)
                FilledButton.tonal(onPressed: () => Navigator.pop(context, n), child: Text('$n', style: const TextStyle(fontSize: 22))),
            ],
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
      );
}

class TakeawayPage extends StatelessWidget {
  const TakeawayPage({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final orders = state.openOrders.where((o) => o.tableId == null).toList();
    return PageFrame(
      title: 'Takeaway',
      actions: [
        FilledButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('New takeaway'),
          onPressed: () async {
            final order = await guard(context, () async => state.startOrder());
            if (order != null && context.mounted) openOrder(context, order);
          },
        ),
      ],
      child: orders.isEmpty
          ? Center(child: Text('No open takeaway orders.', style: TextStyle(color: scheme.onSurfaceVariant)))
          : ListView.separated(
              itemCount: orders.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final o = orders[i];
                return Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    title: Text(o.customerName ?? 'Takeaway ${o.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${o.itemCount} items · started ${DateFormat('h:mm a').format(o.createdAt)} by ${o.staffName ?? '-'}'),
                    trailing: Text(money(o.totalPence), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                    onTap: () => openOrder(context, o),
                  ),
                );
              },
            ),
    );
  }
}
