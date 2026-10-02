import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../core/permissions.dart';
import '../hub/lan_server.dart';
import '../printing/printer_windows.dart';
import '../state/pos_state.dart';
import 'home.dart';
import 'widgets.dart';

const _tabular = [FontFeature.tabularFigures()];

/// Closed orders from the last week: reprint a receipt or give a refund.
class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  String _search = '';
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final q = _search.toLowerCase();
    final orders = state.closedOrders().where((o) =>
        q.isEmpty || o.orderNumber.toLowerCase().contains(q) || (o.tableName?.toLowerCase() == q) || (o.customerName?.toLowerCase().contains(q) ?? false)).toList();
    final selected = orders.where((o) => o.clientId == _selected).firstOrNull ?? orders.firstOrNull;

    return PageFrame(
      title: 'Orders',
      actions: [
        SizedBox(
          width: 280,
          child: TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Order number or table', isDense: true),
            onChanged: (v) => setState(() => _search = v.trim()),
          ),
        ),
      ],
      child: orders.isEmpty
          ? Center(child: Text('No closed orders in the last 7 days.', style: TextStyle(color: scheme.onSurfaceVariant)))
          : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                flex: 3,
                child: Card(
                  child: ListView.separated(
                    itemCount: orders.length,
                    separatorBuilder: (_, _) => const Divider(),
                    itemBuilder: (context, i) {
                      final o = orders[i];
                      return ListTile(
                        selected: o.clientId == selected?.clientId,
                        selectedTileColor: scheme.primary.withValues(alpha: 0.08),
                        title: Text('${o.orderNumber} · ${o.tableId != null ? 'Table ${o.tableName}' : 'Takeaway'}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${DateFormat('EEE d MMM, h:mm a').format(o.closedAt!.toLocal())} · ${o.payments.map((p) => p.provider).toSet().join(' + ')}'
                            '${o.refunds.isEmpty ? '' : ' · refunded ${money(o.refundedPence)}'}'),
                        trailing: Text(money(o.totalPence), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, fontFeatures: _tabular)),
                        onTap: () => setState(() => _selected = o.clientId),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(width: 20),
              if (selected != null) SizedBox(width: 380, child: _OrderDetail(order: selected)),
            ]),
    );
  }
}

class _OrderDetail extends StatelessWidget {
  const _OrderDetail({required this.order});
  final PosOrder order;

  Future<void> _refund(BuildContext context) async {
    final state = context.read<PosState>();
    if (!state.hasFeature('pos.refunds')) return showMessage(context, 'Refunds are not switched on for this restaurant.', error: true);
    final max = order.paidPence - order.refundedPence;
    if (max <= 0) return showMessage(context, 'This order has been fully refunded.', error: true);
    final r = await showDialog<(int, String, String?)>(context: context, builder: (_) => _RefundDialog(max: max, defaultMethod: order.payments.first.provider));
    if (r == null || !context.mounted) return;
    final by = await authorize(context, Perm.refund, 'Refund ${money(r.$1)} on ${order.orderNumber}');
    if (by == null || !context.mounted) return;
    await guard(context, () async => state.refund(order, r.$1, r.$2, r.$3, approvedBy: by));
    if (context.mounted) showMessage(context, 'Refunded ${money(r.$1)} (${r.$2}). Give it back to the customer now.');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Order ${order.orderNumber}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          Text('${order.staffName ?? ''} · ${DateFormat('d MMM yyyy, h:mm a').format(order.closedAt!.toLocal())}', style: TextStyle(color: scheme.onSurfaceVariant)),
          const SizedBox(height: 14),
          for (final l in order.lines.where((l) => !l.isVoid))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [Expanded(child: Text('${l.qty} × ${l.name}')), Text(money(l.totalPence), style: const TextStyle(fontFeatures: _tabular))]),
            ),
          const Divider(height: 24),
          if (order.discountPence > 0) Row(children: [const Expanded(child: Text('Discount')), Text('-${money(order.discountPence)}')]),
          Row(children: [
            const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w700))),
            Text(money(order.totalPence), style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: _tabular)),
          ]),
          for (final p in order.payments) Row(children: [Expanded(child: Text('Paid · ${p.provider}')), Text(money(p.pence))]),
          for (final r in order.refunds)
            Row(children: [Expanded(child: Text('Refund · ${r.method}${r.reason == null ? '' : ' · ${r.reason}'}', style: TextStyle(color: scheme.error))), Text('-${money(r.pence)}', style: TextStyle(color: scheme.error))]),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            icon: const Icon(Icons.print_outlined),
            label: const Text('Reprint receipt'),
            onPressed: () async {
              final problem = await context.read<PosState>().reprint(order);
              if (context.mounted) showMessage(context, problem ?? 'Receipt sent to the printer.', error: problem != null);
            },
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(icon: const Icon(Icons.undo), label: const Text('Refund'), onPressed: () => _refund(context)),
        ]),
      ),
    );
  }
}

class _RefundDialog extends StatefulWidget {
  const _RefundDialog({required this.max, required this.defaultMethod});
  final int max;
  final String defaultMethod;

  @override
  State<_RefundDialog> createState() => _RefundDialogState();
}

class _RefundDialogState extends State<_RefundDialog> {
  late int _pence = widget.max;
  late String _method = widget.defaultMethod;
  final _reason = TextEditingController();

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Refund'),
        content: SizedBox(
          width: 360,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'Cash', label: Text('Cash')), ButtonSegment(value: 'Card', label: Text('Card'))],
              selected: {_method},
              onSelectionChanged: (s) => setState(() => _method = s.first),
            ),
            const SizedBox(height: 12),
            MoneyField(pence: _pence, label: 'Up to ${money(widget.max)}'),
            const SizedBox(height: 12),
            Keypad(leftKey: '00', onKey: (k) => setState(() => _pence = applyMoneyKey(_pence, k).clamp(0, widget.max))),
            const SizedBox(height: 12),
            TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: _pence <= 0 ? null : () => Navigator.pop(context, (_pence, _method, _reason.text.trim().isEmpty ? null : _reason.text.trim())),
            child: Text('Refund ${money(_pence)}'),
          ),
        ],
      );
}

/// Today's (or any day's) takings from this till, available offline. Prints a Z report.
class ReportPage extends StatefulWidget {
  const ReportPage({super.key});

  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  DateTime _day = DateTime.now();
  bool _unlocked = false;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    if (!state.hasFeature('pos.reports')) {
      return PageFrame(title: 'Day report', child: Center(child: Text('Sales reports are not switched on for this restaurant.', style: TextStyle(color: scheme.onSurfaceVariant))));
    }
    if (!_unlocked && state.access(Perm.dayReport) != Access.allowed) {
      return PageFrame(
        title: 'Day report',
        child: Center(
          child: FilledButton.icon(
            icon: const Icon(Icons.lock_open),
            label: const Text('Manager PIN to view'),
            onPressed: () async {
              if (await authorize(context, Perm.dayReport, 'View the day report') != null) setState(() => _unlocked = true);
            },
          ),
        ),
      );
    }
    final rep = state.dayReport(_day);
    Widget stat(String label, String value, {Color? color}) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(color: scheme.onSurfaceVariant)),
                const SizedBox(height: 4),
                Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: color, fontFeatures: _tabular)),
              ]),
            ),
          ),
        );
    return PageFrame(
      title: 'Day report',
      actions: [
        OutlinedButton.icon(
          icon: const Icon(Icons.calendar_today_outlined),
          label: Text(DateFormat('EEE d MMM').format(_day)),
          onPressed: () async {
            final d = await showDatePicker(context: context, initialDate: _day, firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now());
            if (d != null) setState(() => _day = d);
          },
        ),
        const SizedBox(width: 10),
        FilledButton.icon(
          icon: const Icon(Icons.print_outlined),
          label: const Text('Print Z report'),
          onPressed: () async {
            final problem = await state.printDayReport(_day);
            if (context.mounted) showMessage(context, problem ?? 'Day report sent to the printer.', error: problem != null);
          },
        ),
      ],
      child: ListView(children: [
        Row(children: [
          stat('Net sales', money(rep.netPence), color: scheme.primary),
          const SizedBox(width: 12),
          stat('Orders', '${rep.orderCount}'),
          const SizedBox(width: 12),
          stat('Discounts', money(rep.discountPence)),
          const SizedBox(width: 12),
          stat('Refunds', money(rep.refundPence)),
        ]),
        const SizedBox(height: 16),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Takings', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  for (final e in rep.byMethod.entries) _line(e.key, money(e.value)),
                  for (final e in rep.refundsByMethod.entries) _line('${e.key} refunds', '-${money(e.value)}'),
                  const Divider(height: 20),
                  _line('Cash in drawer (excl. float)', money((rep.byMethod['Cash'] ?? 0) - (rep.refundsByMethod['Cash'] ?? 0)), bold: true),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Items sold', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 8),
                  if (rep.byItem.isEmpty) Text('Nothing sold yet.', style: TextStyle(color: scheme.onSurfaceVariant)),
                  for (final e in rep.byItem.entries) _line('${e.value.$1} × ${e.key}', money(e.value.$2)),
                ]),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Text('From orders taken on this till. The admin’s Reports page has every till and online order once they have synced.',
            style: TextStyle(color: scheme.onSurfaceVariant)),
      ]),
    );
  }

  Widget _line(String a, String b, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(a, style: TextStyle(fontWeight: bold ? FontWeight.w700 : null))),
          Text(b, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.w500, fontFeatures: _tabular)),
        ]),
      );
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  List<String>? _usbPrinters;

  Future<void> _scan() async {
    final list = await PrinterService().availablePrinters();
    if (mounted) setState(() => _usbPrinters = list);
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final sync = state.sync;
    final parked = state.db.outbox(parked: true);
    final manager = state.access(Perm.settings) == Access.allowed;

    Widget section(String title, List<Widget> children) => Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              ...children,
            ]),
          ),
        );

    return PageFrame(
      title: 'Settings',
      child: ListView(children: [
        section('Appearance', [
          SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode_outlined)),
              ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode_outlined)),
              ButtonSegment(value: ThemeMode.system, label: Text('Follow Windows'), icon: Icon(Icons.brightness_auto_outlined)),
            ],
            selected: {state.themeMode},
            onSelectionChanged: (s) => state.setTheme(s.first),
          ),
        ]),
        const SizedBox(height: 12),
        section('Connection to the cloud', [
          Text(sync == null
              ? 'Not connected.'
              : '${sync.online ? 'Online' : 'Offline'}${sync.lastSync == null ? '' : ' · last sync ${DateFormat('h:mm a').format(sync.lastSync!)}'}'
                  ' · ${state.db.pendingCount} waiting to send'),
          if (sync?.lastError != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(sync!.lastError!, style: TextStyle(color: scheme.error))),
          const SizedBox(height: 10),
          Wrap(spacing: 10, children: [
            OutlinedButton.icon(icon: const Icon(Icons.sync), label: const Text('Sync now'), onPressed: sync == null ? null : () => sync.syncNow()),
          ]),
          if (parked.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Not accepted by the cloud (${parked.length})', style: TextStyle(fontWeight: FontWeight.w600, color: scheme.error)),
            for (final p in parked)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${p.kind == 'order' ? 'Order' : 'Refund'} ${p.payload['orderNumber'] ?? p.clientId.substring(0, 8)}'),
                subtitle: Text(p.lastError ?? ''),
                trailing: TextButton(onPressed: () => setState(() => state.db.retryParked(p.id)), child: const Text('Try again')),
              ),
          ],
        ]),
        const SizedBox(height: 12),
        if (state.lan case final lan?) ...[
          section('Waiter tablets', [_TabletsPanel(lan: lan, manager: manager, enabled: state.hasFeature('pos.waiter'))]),
          const SizedBox(height: 12),
        ],
        section('Printers', [
          if (state.catalog.printers.isEmpty)
            Text('No printers set up in the admin yet, so receipts go to the printer picked below.', style: TextStyle(color: scheme.onSurfaceVariant))
          else
            for (final p in state.catalog.printers)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.print_outlined),
                title: Text('${p.name} · ${p.role}'),
                subtitle: Text('${p.connection}${p.address == null ? '' : ' · ${p.address}'}${p.connection == 'Network' ? ':${p.port}' : ''}'),
              ),
          const Divider(height: 24),
          Row(children: [
            Expanded(child: Text('This till’s USB printer: ${PrinterService().selectedPrinterName ?? 'none'}')),
            OutlinedButton(onPressed: _scan, child: const Text('Find printers')),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () async {
                final problem = await state.testPrint();
                if (context.mounted) showMessage(context, problem ?? 'Test page sent.', error: problem != null);
              },
              child: const Text('Test print'),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () async {
                final problem = await state.openDrawer();
                if (context.mounted) showMessage(context, problem ?? 'Drawer opened.', error: problem != null);
              },
              child: const Text('Open drawer'),
            ),
          ]),
          if (_usbPrinters != null)
            for (final name in _usbPrinters!)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(name),
                trailing: PrinterService().selectedPrinterName == name
                    ? const Icon(Icons.check_circle, color: Colors.green)
                    : TextButton(onPressed: () => setState(() => PrinterService().selectPrinter(name)), child: const Text('Use this')),
              ),
        ]),
        const SizedBox(height: 12),
        section('This till', [
          Text('${state.restaurantName} · server ${state.db.getJson('device')?['server'] ?? '-'}'),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            icon: const Icon(Icons.link_off),
            label: const Text('Disconnect this till'),
            onPressed: !manager
                ? null
                : () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Disconnect this till?'),
                        content: Text('${state.db.pendingCount} order(s) not yet sent stay on this till and go up after it is paired again.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Disconnect')),
                        ],
                      ),
                    );
                    if (ok == true) state.unpair();
                  },
          ),
          if (!manager) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Only an owner or manager can disconnect the till.', style: TextStyle(color: scheme.onSurfaceVariant))),
        ]),
      ]),
    );
  }
}

/// Pair a tablet: the till shows its address and a 6-digit code to type on the tablet.
class _TabletsPanel extends StatefulWidget {
  const _TabletsPanel({required this.lan, required this.manager, required this.enabled});
  final LanServer lan;
  final bool manager;
  final bool enabled;

  @override
  State<_TabletsPanel> createState() => _TabletsPanelState();
}

class _TabletsPanelState extends State<_TabletsPanel> {
  List<String> _addresses = const [];

  @override
  void initState() {
    super.initState();
    LanServer.addresses().then((a) {
      if (mounted) setState(() => _addresses = a);
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final lan = widget.lan;
    final code = lan.pairCode;
    final tablets = lan.tablets;
    if (!widget.enabled) {
      return Text('Waiter tablets are not part of this restaurant’s plan.', style: TextStyle(color: scheme.onSurfaceVariant));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (lan.error != null) Text(lan.error!, style: TextStyle(color: scheme.error)),
      if (code != null)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('On the tablet, choose “Waiter tablet” and enter:'),
            const SizedBox(height: 8),
            Text('Till address  ${_addresses.isEmpty ? '…' : _addresses.join('  or  ')}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            Text('Code  $code', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 4, color: scheme.primary)),
            Text('The code works once, for 10 minutes. Give the till a fixed IP on the router so tablets keep finding it.',
                style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
          ]),
        ),
      for (final MapEntry(:key, :value) in tablets.entries)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.tablet_android_outlined),
          title: Text(value['name'] ?? 'Tablet'),
          subtitle: Text('Paired ${DateFormat('d MMM').format(DateTime.parse(value['pairedAt']))}'),
          trailing: widget.manager
              ? TextButton(
                  onPressed: () async {
                    await lan.unpairTablet(key);
                    if (mounted) setState(() {});
                  },
                  child: const Text('Unpair'))
              : null,
        ),
      if (tablets.isEmpty && code == null) Text('No tablets paired yet.', style: TextStyle(color: scheme.onSurfaceVariant)),
      const SizedBox(height: 10),
      OutlinedButton.icon(
        icon: const Icon(Icons.add_link),
        label: Text(code == null ? 'Pair a tablet' : 'New code'),
        onPressed: widget.manager && lan.running ? () => setState(lan.newPairCode) : null,
      ),
    ]);
  }
}
