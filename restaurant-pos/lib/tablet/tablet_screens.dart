import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../ui/order_screen.dart' show ItemChoice, ItemTile, ModifierDialog;
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'tablet_state.dart';

/// The waiter tablet app (design 3.3 and section 7): pair with the till, PIN, table map,
/// order with modifiers and notes, send, then follow each dish to Served.
class TabletApp extends StatelessWidget {
  const TabletApp({super.key, required this.onUseAsTill});
  final VoidCallback onUseAsTill;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TabletState>();
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Waiter',
      theme: posTheme(Brightness.light),
      darkTheme: posTheme(Brightness.dark),
      themeMode: state.themeMode,
      home: !state.isPaired
          ? TabletPairScreen(onUseAsTill: onUseAsTill)
          : state.staff == null
              ? const TabletLockScreen()
              : const TabletTablesScreen(),
    );
  }
}

/// Red strip while the tablet can't reach the till (it reconnects by itself).
class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TabletState>();
    if (state.connected || state.problem == null) return const SizedBox.shrink();
    return Material(
      color: PosColors.danger,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(children: [
          const Icon(Icons.wifi_off_rounded, color: Colors.white, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(state.problem!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
        ]),
      ),
    );
  }
}

class TabletPairScreen extends StatefulWidget {
  const TabletPairScreen({super.key, required this.onUseAsTill});
  final VoidCallback onUseAsTill;

  @override
  State<TabletPairScreen> createState() => _TabletPairScreenState();
}

class _TabletPairScreenState extends State<TabletPairScreen> {
  final _address = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController(text: 'Waiter tablet');
  bool _busy = false;
  String? _error;

  Future<void> _pair() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<TabletState>().pair(address: _address.text, code: _code.text, name: _name.text);
    } on TabletError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Icon(Icons.tablet_android_rounded, size: 44, color: scheme.primary),
              const SizedBox(height: 16),
              Text('Connect to the till', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('On the main till, open Settings → Waiter tablets → Pair a tablet. Type the address and code it shows. '
                  'This tablet must be on the shop Wi-Fi.', style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4)),
              const SizedBox(height: 28),
              TextField(controller: _address, decoration: const InputDecoration(labelText: 'Till address', hintText: '192.168.1.20'),
                  keyboardType: TextInputType.url),
              const SizedBox(height: 12),
              TextField(controller: _code, decoration: const InputDecoration(labelText: 'Code'), keyboardType: TextInputType.number, maxLength: 6),
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name for this tablet')),
              const SizedBox(height: 16),
              if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: TextStyle(color: scheme.error))),
              FilledButton(
                onPressed: _busy ? null : _pair,
                child: _busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Text('Connect'),
              ),
              const SizedBox(height: 8),
              TextButton(onPressed: widget.onUseAsTill, child: const Text('This is the main till, not a tablet')),
            ]),
          ),
        ),
      ),
    );
  }
}

class TabletLockScreen extends StatefulWidget {
  const TabletLockScreen({super.key});

  @override
  State<TabletLockScreen> createState() => _TabletLockScreenState();
}

class _TabletLockScreenState extends State<TabletLockScreen> {
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TabletState>();
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Column(children: [
        const _ConnectionBanner(),
        Expanded(
          child: Center(
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text(state.restaurantName, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text('Enter your PIN', style: TextStyle(fontSize: 18, color: scheme.onSurfaceVariant)),
                SizedBox(height: 36, child: _error == null ? null : Center(child: Text(_error!, style: TextStyle(color: scheme.error)))),
                PinPad(
                  busy: _busy,
                  onSubmit: (pin) async {
                    setState(() {
                      _busy = true;
                      _error = null;
                    });
                    try {
                      await state.signIn(pin);
                      return true;
                    } on TabletError catch (e) {
                      if (mounted) setState(() => _error = e.message);
                      return false;
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class TabletTablesScreen extends StatelessWidget {
  const TabletTablesScreen({super.key});

  Future<void> _settings(BuildContext context, TabletState state) => showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(
              leading: const Icon(Icons.brightness_6_outlined),
              title: const Text('Theme'),
              trailing: SegmentedButton<ThemeMode>(
                segments: const [
                  ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined)),
                  ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined)),
                  ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined)),
                ],
                selected: {state.themeMode},
                onSelectionChanged: (s) => state.setTheme(s.first),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.link_off),
              title: const Text('Disconnect from the till'),
              subtitle: const Text('Pair again with a new code from the till'),
              onTap: () {
                Navigator.pop(context);
                state.unpair();
              },
            ),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TabletState>();
    final scheme = Theme.of(context).colorScheme;
    final tables = state.catalog.tables;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: scheme.surfaceContainerLowest,
        title: Text('Tables · ${state.staffName}'),
        actions: [
          IconButton(tooltip: 'Refresh', icon: const Icon(Icons.refresh), onPressed: state.refresh),
          IconButton(tooltip: 'Settings', icon: const Icon(Icons.more_vert), onPressed: () => _settings(context, state)),
          IconButton(tooltip: 'Lock', icon: const Icon(Icons.lock_outline), onPressed: state.signOut),
        ],
      ),
      body: Column(children: [
        const _ConnectionBanner(),
        Expanded(
          child: tables.isEmpty
              ? Center(child: Text('No tables are set up. Add them in the admin under Tables.', style: TextStyle(color: scheme.onSurfaceVariant)))
              : GridView.extent(
                  padding: const EdgeInsets.all(16),
                  maxCrossAxisExtent: 170,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  children: [
                    for (final t in tables)
                      _TableCard(
                        table: t,
                        status: state.tableStatus[t.id] ?? (state.orderForTable(t.id) == null ? 'free' : 'occupied'),
                        order: state.orderForTable(t.id),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TabletOrderScreen(table: t))),
                      ),
                  ],
                ),
        ),
      ]),
    );
  }
}

class _TableCard extends StatelessWidget {
  const _TableCard({required this.table, required this.status, required this.order, required this.onTap});
  final TableInfo table;
  final String status;
  final PosOrder? order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (bg, fg) = switch (status) {
      'bill' => (PosColors.bill, Colors.black),
      'occupied' => (PosColors.occupied, Colors.white),
      _ => (scheme.surfaceContainerLow, scheme.onSurface),
    };
    final ready = order?.lines.where((l) => l.status == 'Ready').length ?? 0;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: status == 'free' ? Border.all(color: scheme.outlineVariant) : null),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(table.number, style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: fg)),
            const Spacer(),
            if (ready > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                child: Text('$ready ready', style: const TextStyle(color: PosColors.occupied, fontWeight: FontWeight.w800, fontSize: 12)),
              )
            else
              Text(
                switch (status) { 'bill' => 'Bill printed', 'occupied' => '${order?.itemCount ?? 0} items', _ => '${table.capacity} seats' },
                style: TextStyle(color: fg.withValues(alpha: 0.8), fontWeight: FontWeight.w600),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Menu on the left (or top), the table's order and the waiter's basket on the right (or in a
/// sheet on a narrow tablet). Nothing reaches the till until "Send".
class TabletOrderScreen extends StatefulWidget {
  const TabletOrderScreen({super.key, required this.table});
  final TableInfo table;

  @override
  State<TabletOrderScreen> createState() => _TabletOrderScreenState();
}

class _TabletOrderScreenState extends State<TabletOrderScreen> {
  final _basket = <OrderLine>[];
  String? _categoryId;
  int _guests = 2;
  bool _sending = false;

  Future<void> _pick(TabletState state, MenuItem item) async {
    if (!item.isAvailable) return showMessage(context, '${item.name} is not available.', error: true);
    final groups = state.catalog.groupsFor(item.id);
    var choice = ItemChoice(const [], null, 1);
    if (groups.isNotEmpty) {
      final picked = await showDialog<ItemChoice>(context: context, builder: (_) => ModifierDialog(item: item, groups: groups));
      if (picked == null) return;
      choice = picked;
    }
    final line = OrderLine(menuItemId: item.id, name: item.name, unitPence: item.pricePence, qty: choice.qty, notes: choice.notes, modifiers: choice.modifiers);
    setState(() {
      final same = _basket.where((l) => l.sameAs(line)).firstOrNull;
      if (same != null) {
        same.qty += line.qty;
      } else {
        _basket.add(line);
      }
    });
  }

  Future<void> _send(TabletState state) async {
    setState(() => _sending = true);
    final ok = await guard(context, () async {
      final isNew = state.orderForTable(widget.table.id) == null;
      await state.placeOrder(tableId: widget.table.id, guests: isNew ? _guests : null, basket: _basket);
      return true;
    });
    if (!mounted) return;
    setState(() {
      _sending = false;
      if (ok == true) _basket.clear();
    });
    if (ok == true) showMessage(context, 'Sent to the kitchen.');
  }

  Future<void> _lineActions(TabletState state, PosOrder order, OrderLine line) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text('${line.qty} × ${line.name}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(line.status)),
          if (line.status == 'Sent' || line.status == 'Ready')
            ListTile(leading: const Icon(Icons.room_service_outlined), title: const Text('Served'), onTap: () => Navigator.pop(context, 'served')),
          if (!line.isVoid) ListTile(leading: const Icon(Icons.block), title: const Text('Void'), onTap: () => Navigator.pop(context, 'void')),
        ]),
      ),
    );
    if (!mounted || action == null) return;
    if (action == 'served') {
      await guard(context, () => state.markServed(order, line));
      return;
    }
    final reason = await _askReason();
    if (reason == null || !mounted) return;
    final managers = state.staffRole == 'Owner' || state.staffRole == 'Manager';
    final pin = managers ? null : await _askManagerPin();
    if (!managers && pin == null) return;
    if (mounted) await guard(context, () => state.voidLine(order, line, reason, managerPin: pin));
  }

  Future<String?> _askReason() {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Why void it?'),
        content: TextField(controller: c, autofocus: true, decoration: const InputDecoration(hintText: 'Wrong dish, customer changed mind…')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => c.text.trim().isEmpty ? null : Navigator.pop(context, c.text.trim()), child: const Text('Next')),
        ],
      ),
    );
  }

  Future<String?> _askManagerPin() => showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Manager PIN'),
          content: PinPad(onSubmit: (pin) async {
            Navigator.pop(context, pin);
            return true;
          }),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<TabletState>();
    final scheme = Theme.of(context).colorScheme;
    final order = state.orderForTable(widget.table.id);
    final categories = state.catalog.categories;
    final categoryId = _categoryId ?? categories.firstOrNull?.id;
    final items = categoryId == null ? <MenuItem>[] : state.catalog.itemsIn(categoryId);

    final menu = Column(children: [
      SizedBox(
        height: 64,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          children: [
            for (final c in categories)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(c.name), selected: c.id == categoryId, onSelected: (_) => setState(() => _categoryId = c.id)),
              ),
          ],
        ),
      ),
      Expanded(
        child: GridView.extent(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          maxCrossAxisExtent: 180,
          childAspectRatio: 1.25,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          children: [for (final i in items) ItemTile(item: i, onTap: () => _pick(state, i))],
        ),
      ),
    ]);

    final ticket = _TabletTicket(
      order: order,
      basket: _basket,
      guests: order == null ? _guests : null,
      sending: _sending,
      onGuests: (g) => setState(() => _guests = g),
      onBasketQty: (l, d) => setState(() {
        l.qty += d;
        if (l.qty <= 0) _basket.remove(l);
      }),
      onLine: order == null ? null : (l) => _lineActions(state, order, l),
      onSend: _basket.isEmpty || _sending ? null : () => _send(state),
    );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: scheme.surfaceContainerLowest,
        title: Text('Table ${widget.table.number}${order?.guestCount == null ? '' : ' · ${order!.guestCount} guests'}'),
      ),
      body: Column(children: [
        const _ConnectionBanner(),
        Expanded(
          child: LayoutBuilder(
            builder: (context, box) => box.maxWidth >= 840
                ? Row(children: [Expanded(child: menu), const VerticalDivider(width: 1), SizedBox(width: 360, child: ticket)])
                : Column(children: [Expanded(child: menu), const Divider(height: 1), SizedBox(height: box.maxHeight * 0.45, child: ticket)]),
          ),
        ),
      ]),
    );
  }
}

class _TabletTicket extends StatelessWidget {
  const _TabletTicket({
    required this.order,
    required this.basket,
    required this.guests,
    required this.sending,
    required this.onGuests,
    required this.onBasketQty,
    required this.onLine,
    required this.onSend,
  });

  final PosOrder? order;
  final List<OrderLine> basket;
  final int? guests;
  final bool sending;
  final void Function(int) onGuests;
  final void Function(OrderLine, int) onBasketQty;
  final void Function(OrderLine)? onLine;
  final VoidCallback? onSend;

  static (String, Color) _status(String s, ColorScheme scheme) => switch (s) {
        'Ready' => ('Ready', PosColors.occupied),
        'Served' => ('Served', scheme.onSurfaceVariant),
        'Void' => ('Void', scheme.error),
        _ => ('Sent', scheme.primary),
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final sent = order?.lines ?? const <OrderLine>[];
    return Material(
      color: scheme.surfaceContainerLowest,
      child: Column(children: [
        if (guests != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
            child: Row(children: [
              const Text('Guests', style: TextStyle(fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton(onPressed: guests! > 1 ? () => onGuests(guests! - 1) : null, icon: const Icon(Icons.remove_circle_outline)),
              Text('$guests', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              IconButton(onPressed: () => onGuests(guests! + 1), icon: const Icon(Icons.add_circle_outline)),
            ]),
          ),
        Expanded(
          child: ListView(padding: const EdgeInsets.symmetric(vertical: 8), children: [
            for (final l in sent)
              ListTile(
                dense: true,
                onTap: onLine == null ? null : () => onLine!(l),
                title: Text('${l.qty} × ${l.name}',
                    style: TextStyle(fontWeight: FontWeight.w600, decoration: l.isVoid ? TextDecoration.lineThrough : null)),
                subtitle: _details(l, scheme),
                trailing: Builder(builder: (context) {
                  final (label, color) = _status(l.status, scheme);
                  return Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w800));
                }),
              ),
            if (sent.isNotEmpty && basket.isNotEmpty) const Divider(indent: 16, endIndent: 16),
            for (final l in basket)
              ListTile(
                dense: true,
                title: Text(l.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: _details(l, scheme),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(onPressed: () => onBasketQty(l, -1), icon: const Icon(Icons.remove)),
                  Text('${l.qty}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  IconButton(onPressed: () => onBasketQty(l, 1), icon: const Icon(Icons.add)),
                ]),
              ),
            if (sent.isEmpty && basket.isEmpty)
              Padding(padding: const EdgeInsets.all(24), child: Text('Tap dishes to add them.', textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant))),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: SizedBox(
            width: double.infinity,
            height: 56,
            child: FilledButton.icon(
              onPressed: onSend,
              icon: sending ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Icon(Icons.send_rounded),
              label: Text(basket.isEmpty ? 'Send' : 'Send ${basket.fold(0, (s, l) => s + l.qty)} to kitchen'),
            ),
          ),
        ),
      ]),
    );
  }

  Widget? _details(OrderLine l, ColorScheme scheme) {
    final parts = [...l.modifiers.map((m) => '+ ${m.name}'), if (l.notes != null) '“${l.notes}”'];
    return parts.isEmpty ? null : Text(parts.join('  '), style: TextStyle(color: scheme.onSurfaceVariant));
  }
}
