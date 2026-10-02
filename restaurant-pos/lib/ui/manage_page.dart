import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../state/manage.dart';
import '../state/pos_state.dart';
import 'home.dart';
import 'widgets.dart';

// ---------------------------------------------------------------------------
// One small form dialog for every editor on this page.
// ---------------------------------------------------------------------------

enum _Kind { text, password, money, number, toggle, choice }

class _Field {
  const _Field(this.key, this.label, this.kind, {this.initial, this.choices = const {}, this.hint, this.visibleWhen});
  final String key;
  final String label;
  final _Kind kind;
  final Object? initial;

  /// value -> label, for [_Kind.choice].
  final Map<String, String> choices;
  final String? hint;

  /// Shows the field only when this returns true for the current values (e.g. email for logins).
  final bool Function(Map<String, Object?> values)? visibleWhen;
}

/// Returns the values by key (money in pence, numbers as int), or null if cancelled.
Future<Map<String, Object?>?> _form(BuildContext context, String title, List<_Field> fields, {String save = 'Save'}) =>
    showDialog<Map<String, Object?>>(context: context, builder: (_) => _FormDialog(title: title, fields: fields, save: save));

class _FormDialog extends StatefulWidget {
  const _FormDialog({required this.title, required this.fields, required this.save});
  final String title;
  final List<_Field> fields;
  final String save;

  @override
  State<_FormDialog> createState() => _FormDialogState();
}

class _FormDialogState extends State<_FormDialog> {
  late final Map<String, Object?> _values = {for (final f in widget.fields) f.key: f.initial};
  late final Map<String, TextEditingController> _text = {
    for (final f in widget.fields)
      if (f.kind case _Kind.text || _Kind.password || _Kind.money || _Kind.number)
        f.key: TextEditingController(
            text: switch (f.initial) { null => '', final int p when f.kind == _Kind.money => (p / 100).toStringAsFixed(2), final v => '$v' }),
  };
  String? _error;

  void _submit() {
    final out = <String, Object?>{};
    for (final f in widget.fields) {
      if (f.visibleWhen != null && !f.visibleWhen!(_values)) continue;
      switch (f.kind) {
        case _Kind.money:
          final v = double.tryParse(_text[f.key]!.text.replaceAll('£', '').trim());
          if (v == null) return setState(() => _error = '${f.label}: enter an amount like 9.95');
          out[f.key] = toPence(v);
        case _Kind.number:
          final v = int.tryParse(_text[f.key]!.text.trim());
          if (v == null) return setState(() => _error = '${f.label}: enter a whole number');
          out[f.key] = v;
        case _Kind.text || _Kind.password:
          out[f.key] = _text[f.key]!.text;
        case _Kind.toggle || _Kind.choice:
          out[f.key] = _values[f.key];
      }
    }
    Navigator.pop(context, out);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final f in widget.fields)
              if (f.visibleWhen == null || f.visibleWhen!(_values))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: switch (f.kind) {
                    _Kind.toggle => SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(f.label),
                        value: _values[f.key] == true,
                        onChanged: (v) => setState(() => _values[f.key] = v),
                      ),
                    _Kind.choice => DropdownButtonFormField<String>(
                        initialValue: _values[f.key] as String?,
                        decoration: InputDecoration(labelText: f.label),
                        items: [for (final e in f.choices.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                        onChanged: (v) => setState(() => _values[f.key] = v),
                      ),
                    _ => TextField(
                        controller: _text[f.key],
                        obscureText: f.kind == _Kind.password,
                        keyboardType: f.kind == _Kind.money
                            ? const TextInputType.numberWithOptions(decimal: true)
                            : (f.kind == _Kind.number ? TextInputType.number : null),
                        decoration: InputDecoration(labelText: f.label, hintText: f.hint, prefixText: f.kind == _Kind.money ? '£ ' : null),
                      ),
                  },
                ),
            if (_error != null) Text(_error!, style: TextStyle(color: scheme.error)),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _submit, child: Text(widget.save)),
      ],
    );
  }
}

Future<bool> _confirm(BuildContext context, String text) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(text),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    ) ==
    true;

const _routes = {'Kitchen': 'Kitchen ticket', 'Bar': 'Bar ticket', 'None': 'No ticket'};

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/// Set up the restaurant from the till (managers only): menu, tables, staff and printers.
/// Same data as the admin site; whichever is used, both stay in step.
class ManagePage extends StatelessWidget {
  const ManagePage({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    return DefaultTabController(
      length: 4,
      child: PageFrame(
        title: 'Manage',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (state.sync?.online == false)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text('Offline: changes here need the internet. Selling carries on as normal.', style: TextStyle(color: scheme.error)),
            ),
          const TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [
            Tab(text: 'Menu'),
            Tab(text: 'Tables'),
            Tab(text: 'Staff'),
            Tab(text: 'Printers'),
          ]),
          const SizedBox(height: 16),
          const Expanded(child: TabBarView(children: [_MenuTab(), _TablesTab(), _StaffTab(), _PrintersTab()])),
        ]),
      ),
    );
  }
}

// ---- menu --------------------------------------------------------------------------

class _MenuTab extends StatefulWidget {
  const _MenuTab();

  @override
  State<_MenuTab> createState() => _MenuTabState();
}

class _MenuTabState extends State<_MenuTab> {
  String? _categoryId;

  Future<void> _editCategory(PosState state, [MenuCategory? c]) async {
    final v = await _form(context, c == null ? 'New category' : 'Edit category', [
      _Field('name', 'Name', _Kind.text, initial: c?.name),
      _Field('route', 'Dishes print on', _Kind.choice, initial: c?.printRoute ?? 'Kitchen', choices: _routes),
      _Field('active', 'Show on the menu', _Kind.toggle, initial: c?.isActive ?? true),
    ]);
    if (v == null || !mounted) return;
    await guard(context, () => state.saveCategory(id: c?.id, name: v['name'] as String, isActive: v['active'] as bool, printRoute: v['route'] as String));
  }

  Future<void> _deleteCategory(PosState state, MenuCategory c) async {
    final count = state.catalog.itemsIn(c.id).length;
    if (count > 0) return showMessage(context, 'Move or delete the $count dishes in ${c.name} first.', error: true);
    if (await _confirm(context, 'Delete the category ${c.name}?') && mounted) {
      await guard(context, () => state.deleteCategory(c.id));
      setState(() => _categoryId = null);
    }
  }

  Future<void> _editItem(PosState state, String categoryId, [MenuItem? item]) async {
    final categories = state.catalog.allCategories;
    final v = await _form(context, item == null ? 'New dish' : 'Edit dish', [
      _Field('name', 'Name', _Kind.text, initial: item?.name),
      _Field('price', 'Price', _Kind.money, initial: item?.pricePence),
      _Field('description', 'Description (optional)', _Kind.text, initial: item?.description),
      _Field('category', 'Category', _Kind.choice, initial: item?.categoryId ?? categoryId, choices: {for (final c in categories) c.id: c.name}),
      _Field('route', 'Prints on', _Kind.choice, initial: item?.printRouteOverride ?? '', choices: {'': 'Same as its category', ..._routes}),
      _Field('available', 'Available to order', _Kind.toggle, initial: item?.isAvailable ?? true),
    ]);
    if (v == null || !mounted) return;
    await guard(context, () => state.saveItem(
          id: item?.id,
          categoryId: v['category'] as String,
          name: v['name'] as String,
          pricePence: v['price'] as int,
          description: v['description'] as String?,
          isAvailable: v['available'] as bool,
          printRouteOverride: (v['route'] as String).isEmpty ? null : v['route'] as String,
        ));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final categories = state.catalog.allCategories;
    final selected = categories.where((c) => c.id == _categoryId).firstOrNull ?? categories.firstOrNull;
    final items = selected == null ? <MenuItem>[] : state.catalog.itemsIn(selected.id);

    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        width: 300,
        child: Card(
          child: Column(children: [
            ListTile(
              title: const Text('Categories', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: const Text('Drag to change the order'),
              trailing: IconButton.filledTonal(tooltip: 'New category', icon: const Icon(Icons.add), onPressed: () => _editCategory(state)),
            ),
            const Divider(),
            Expanded(
              child: ReorderableListView(
                buildDefaultDragHandles: false,
                onReorderItem: (from, to) {
                  final ids = categories.map((c) => c.id).toList();
                  ids.insert(to, ids.removeAt(from));
                  guard(context, () => state.reorderCategories(ids));
                },
                children: [
                  for (final (i, c) in categories.indexed)
                    ListTile(
                      key: ValueKey(c.id),
                      selected: c.id == selected?.id,
                      selectedTileColor: scheme.primary.withValues(alpha: 0.08),
                      leading: ReorderableDragStartListener(index: i, child: const Icon(Icons.drag_indicator)),
                      title: Text(c.name, style: TextStyle(color: c.isActive ? null : scheme.onSurfaceVariant)),
                      subtitle: Text(switch (state.catalog.itemsIn(c.id).length) { 1 => '1 dish', final n => '$n dishes' } +
                          (c.isActive ? '' : ' · hidden')),
                      onTap: () => setState(() => _categoryId = c.id),
                      trailing: PopupMenuButton<String>(
                        onSelected: (a) => a == 'edit' ? _editCategory(state, c) : _deleteCategory(state, c),
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: 'edit', child: Text('Edit')),
                          PopupMenuItem(value: 'delete', child: Text('Delete')),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ]),
        ),
      ),
      const SizedBox(width: 16),
      Expanded(
        child: Card(
          child: selected == null
              ? Center(child: Text('Add a category to start the menu.', style: TextStyle(color: scheme.onSurfaceVariant)))
              : Column(children: [
                  ListTile(
                    title: Text(selected.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
                    subtitle: Text('Prints on: ${_routes[selected.printRoute] ?? selected.printRoute}'),
                    trailing: FilledButton.icon(icon: const Icon(Icons.add), label: const Text('Dish'), onPressed: () => _editItem(state, selected.id)),
                  ),
                  const Divider(),
                  Expanded(
                    child: items.isEmpty
                        ? Center(child: Text('No dishes in ${selected.name} yet.', style: TextStyle(color: scheme.onSurfaceVariant)))
                        : ListView.separated(
                            itemCount: items.length,
                            separatorBuilder: (_, _) => const Divider(indent: 16, endIndent: 16),
                            itemBuilder: (context, i) {
                              final item = items[i];
                              final groups = state.catalog.groupsFor(item.id, includeUnavailable: true);
                              return ListTile(
                                title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                subtitle: Text([
                                  money(item.pricePence),
                                  if (item.printRouteOverride != null) _routes[item.printRouteOverride] ?? '',
                                  if (groups.isNotEmpty) groups.map((g) => g.name).join(', '),
                                ].join('  ·  ')),
                                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => _ItemPage(itemId: item.id))),
                                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Text(item.isAvailable ? 'On' : 'Sold out', style: TextStyle(color: item.isAvailable ? null : scheme.error)),
                                  Switch(value: item.isAvailable, onChanged: (v) => guard(context, () => state.setAvailable(item, v))),
                                  IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined), onPressed: () => _editItem(state, selected.id, item)),
                                ]),
                              );
                            },
                          ),
                  ),
                ]),
        ),
      ),
    ]);
  }
}

/// One dish: its option groups (e.g. "Rice", "Spice level") and their choices.
class _ItemPage extends StatelessWidget {
  const _ItemPage({required this.itemId});
  final String itemId;

  Future<void> _editGroup(BuildContext context, PosState state, MenuItem item, [ModifierGroup? g]) async {
    final result = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => _GroupDialog(group: g));
    if (result == null || !context.mounted) return;
    await guard(context, () => state.saveModifierGroup(
          itemId: item.id,
          groupId: g?.id,
          name: result['name'],
          minSelect: result['min'],
          maxSelect: result['max'],
          isRequired: result['min'] > 0,
          options: result['options'],
        ));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final item = state.catalog.item(itemId);
    if (item == null) return const Scaffold(body: Center(child: Text('This dish was deleted.')));
    final groups = state.catalog.groupsFor(item.id, includeUnavailable: true);
    return Scaffold(
      appBar: AppBar(
        title: Text('${item.name} · ${money(item.pricePence)}'),
        actions: [
          TextButton.icon(
            icon: Icon(Icons.delete_outline, color: scheme.error),
            label: Text('Delete dish', style: TextStyle(color: scheme.error)),
            onPressed: () async {
              if (await _confirm(context, 'Delete ${item.name} from the menu?') && context.mounted) {
                final ok = await guard(context, () async {
                  await state.deleteItem(item.id);
                  return true;
                });
                if (ok == true && context.mounted) Navigator.pop(context);
              }
            },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Row(children: [
          Text('Options', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
          const Spacer(),
          FilledButton.icon(icon: const Icon(Icons.add), label: const Text('Option group'), onPressed: () => _editGroup(context, state, item)),
        ]),
        const SizedBox(height: 4),
        Text('For choices like rice, spice level or extras. Required groups must be picked before the dish is added.',
            style: TextStyle(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 16),
        if (groups.isEmpty) Text('No options: the dish is added straight away.', style: TextStyle(color: scheme.onSurfaceVariant)),
        for (final g in groups)
          Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              contentPadding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
              title: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text([
                g.required > 0 ? 'Pick ${g.required == g.maxSelect ? '${g.required}' : '${g.required} to ${g.maxSelect}'}' : 'Optional, up to ${g.maxSelect}',
                g.options.map((o) => '${o.name}${o.deltaPence == 0 ? '' : ' +${money(o.deltaPence)}'}${o.isAvailable ? '' : ' (off)'}').join(', '),
              ].join('\n')),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined), onPressed: () => _editGroup(context, state, item, g)),
                IconButton(
                  tooltip: 'Delete',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    if (await _confirm(context, 'Delete the ${g.name} options?') && context.mounted) {
                      await guard(context, () => state.deleteModifierGroup(g.id));
                    }
                  },
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

class _GroupDialog extends StatefulWidget {
  const _GroupDialog({this.group});
  final ModifierGroup? group;

  @override
  State<_GroupDialog> createState() => _GroupDialogState();
}

class _OptionRow {
  _OptionRow({this.id, String name = '', int pence = 0, this.isDefault = false, this.isAvailable = true})
      : name = TextEditingController(text: name),
        price = TextEditingController(text: pence == 0 ? '' : (pence / 100).toStringAsFixed(2));
  final String? id;
  final TextEditingController name;
  final TextEditingController price;
  bool isDefault;
  bool isAvailable;
}

class _GroupDialogState extends State<_GroupDialog> {
  late final _name = TextEditingController(text: widget.group?.name ?? '');
  late int _min = widget.group?.required ?? 1;
  late int _max = widget.group?.maxSelect ?? 1;
  late final List<_OptionRow> _rows = widget.group == null
      ? [_OptionRow(), _OptionRow()]
      : [
          for (final o in widget.group!.options)
            _OptionRow(id: o.id, name: o.name, pence: o.deltaPence, isDefault: o.isDefault, isAvailable: o.isAvailable),
        ];
  String? _error;

  void _save() {
    final rows = _rows.where((r) => r.name.text.trim().isNotEmpty).toList();
    final options = <Map<String, dynamic>>[];
    for (final r in rows) {
      final price = r.price.text.trim().isEmpty ? 0.0 : double.tryParse(r.price.text.replaceAll('£', '').trim());
      if (price == null) return setState(() => _error = 'Check the extra price for ${r.name.text.trim()}.');
      options.add({'id': r.id, 'name': r.name.text.trim(), 'priceDelta': price, 'isDefault': r.isDefault, 'isAvailable': r.isAvailable});
    }
    if (_name.text.trim().isEmpty) return setState(() => _error = 'Give the group a name, like “Rice”.');
    if (options.isEmpty) return setState(() => _error = 'Add at least one choice.');
    Navigator.pop(context, {'name': _name.text.trim(), 'min': _min, 'max': _max, 'options': options});
  }

  Widget _stepper(String label, int value, int min, void Function(int) set) => Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label),
        IconButton(onPressed: value > min ? () => setState(() => set(value - 1)) : null, icon: const Icon(Icons.remove_circle_outline)),
        Text('$value', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        IconButton(onPressed: () => setState(() => set(value + 1)), icon: const Icon(Icons.add_circle_outline)),
      ]);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: Text(widget.group == null ? 'New option group' : 'Edit ${widget.group!.name}'),
      content: SizedBox(
        width: 620,
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Group name', hintText: 'Rice, Spice level, Extras…')),
            const SizedBox(height: 8),
            Wrap(spacing: 24, children: [
              _stepper('Must pick at least', _min, 0, (v) => _min = v > _max ? _max : v),
              _stepper('Can pick up to', _max, 1, (v) => _max = v < _min ? _min : v),
            ]),
            const SizedBox(height: 8),
            for (final r in _rows)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(flex: 3, child: TextField(controller: r.name, decoration: const InputDecoration(labelText: 'Choice'))),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: r.price,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Extra', prefixText: '£ ', hintText: '0.00'),
                    ),
                  ),
                  Tooltip(message: 'Picked by default', child: Checkbox(value: r.isDefault, onChanged: (v) => setState(() => r.isDefault = v!))),
                  Tooltip(message: 'Available', child: Switch(value: r.isAvailable, onChanged: (v) => setState(() => r.isAvailable = v))),
                  IconButton(tooltip: 'Remove', icon: const Icon(Icons.close), onPressed: () => setState(() => _rows.remove(r))),
                ]),
              ),
            TextButton.icon(onPressed: () => setState(() => _rows.add(_OptionRow())), icon: const Icon(Icons.add), label: const Text('Add choice')),
            if (_error != null) Text(_error!, style: TextStyle(color: scheme.error)),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(onPressed: _save, child: const Text('Save')),
      ],
    );
  }
}

// ---- tables ------------------------------------------------------------------------

class _TablesTab extends StatelessWidget {
  const _TablesTab();

  Future<void> _edit(BuildContext context, PosState state, [Map<String, dynamic>? t]) async {
    final v = await _form(context, t == null ? 'New table' : 'Edit table ${t['tableNumber']}', [
      _Field('number', 'Table number or name', _Kind.text, initial: t?['tableNumber']),
      _Field('capacity', 'Seats', _Kind.number, initial: t?['capacity'] ?? 4),
      _Field('location', 'Area (optional)', _Kind.text, initial: t?['location'], hint: 'Window, Upstairs…'),
      _Field('active', 'In use', _Kind.toggle, initial: t?['isActive'] ?? true),
    ]);
    if (v == null || !context.mounted) return;
    await guard(context, () => state.saveTable(
        id: t?['id'], number: v['number'] as String, capacity: v['capacity'] as int, location: v['location'] as String?, isActive: v['active'] as bool));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final tables = (state.catalog.collections['tables']?.values.toList() ?? [])
      ..sort((a, b) => (a['tableNumber'] as String).compareTo(b['tableNumber'] as String));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FilledButton.icon(icon: const Icon(Icons.add), label: const Text('Table'), onPressed: () => _edit(context, state)),
      const SizedBox(height: 16),
      Expanded(
        child: tables.isEmpty
            ? Center(child: Text('No tables yet. Takeaway works without them.', style: TextStyle(color: scheme.onSurfaceVariant)))
            : GridView.extent(
                maxCrossAxisExtent: 220,
                childAspectRatio: 2.2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                children: [
                  for (final t in tables)
                    Card(
                      child: ListTile(
                        title: Text('Table ${t['tableNumber']}', style: TextStyle(fontWeight: FontWeight.w700, color: t['isActive'] == false ? scheme.onSurfaceVariant : null)),
                        subtitle: Text('${t['capacity']} seats${t['location'] == null ? '' : ' · ${t['location']}'}${t['isActive'] == false ? ' · not in use' : ''}'),
                        onTap: () => _edit(context, state, t),
                        trailing: IconButton(
                          tooltip: 'Delete',
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () async {
                            if (await _confirm(context, 'Delete table ${t['tableNumber']}?') && context.mounted) {
                              await guard(context, () => state.deleteTable(t['id']));
                            }
                          },
                        ),
                      ),
                    ),
                ],
              ),
      ),
    ]);
  }
}

// ---- staff -------------------------------------------------------------------------

class _StaffTab extends StatefulWidget {
  const _StaffTab();

  @override
  State<_StaffTab> createState() => _StaffTabState();
}

class _StaffTabState extends State<_StaffTab> {
  late Future<List<Map<String, dynamic>>> _staff = context.read<PosState>().loadStaff();

  void _reload() => setState(() => _staff = context.read<PosState>().loadStaff());

  /// Roles this manager may give: an Owner any, a Manager everything but Owner.
  Map<String, String> _roles(PosState state) => {
        if (state.staff?.role == 'Owner') 'Owner': 'Owner',
        'Manager': 'Manager',
        'Cashier': 'Cashier (till only)',
        'Waiter': 'Waiter (tablet only)',
        'Staff': 'Staff (admin site too)',
        'KitchenDisplay': 'Kitchen',
      };

  static bool _needsLogin(Map<String, Object?> v) => !{'Waiter', 'Cashier'}.contains(v['role']);

  Future<void> _add(PosState state) async {
    final v = await _form(context, 'New staff member', [
      const _Field('name', 'Name', _Kind.text),
      _Field('role', 'Role', _Kind.choice, initial: 'Cashier', choices: _roles(state)),
      const _Field('pin', 'PIN for the till (4-6 digits)', _Kind.password),
      const _Field('email', 'Email (to sign in to the admin site)', _Kind.text, visibleWhen: _needsLogin),
      const _Field('password', 'Password', _Kind.password, visibleWhen: _needsLogin),
    ], save: 'Add');
    if (v == null || !mounted) return;
    await guard(context, () => state.addStaff(
        name: v['name'] as String, role: v['role'] as String, email: v['email'] as String?, password: v['password'] as String?, pin: v['pin'] as String?));
    _reload();
  }

  Future<void> _edit(PosState state, Map<String, dynamic> s) async {
    final v = await _form(context, 'Edit ${s['fullName']}', [
      _Field('name', 'Name', _Kind.text, initial: s['fullName']),
      _Field('role', 'Role', _Kind.choice, initial: s['role'], choices: {..._roles(state), s['role'] as String: s['role'] as String}),
      _Field('active', 'Active', _Kind.toggle, initial: s['isActive']),
    ]);
    if (v == null || !mounted) return;
    await guard(context, () => state.updateStaff(s['id'], name: v['name'] as String, role: v['role'] as String, isActive: v['active'] as bool));
    _reload();
  }

  Future<void> _pin(PosState state, Map<String, dynamic> s) async {
    final v = await _form(context, 'PIN for ${s['fullName']}', [const _Field('pin', 'New PIN (4-6 digits)', _Kind.password)]);
    if (v == null || !mounted) return;
    final ok = await guard(context, () async {
      await state.setStaffPin(s['id'], v['pin'] as String);
      return true;
    });
    if (ok == true && mounted) showMessage(context, 'PIN set for ${s['fullName']}.');
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _staff,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snap.hasError) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${snap.error}', style: TextStyle(color: scheme.error)),
              TextButton(onPressed: _reload, child: const Text('Try again')),
            ]),
          );
        }
        final rows = snap.data!;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          FilledButton.icon(icon: const Icon(Icons.person_add_alt), label: const Text('Staff member'), onPressed: () => _add(state)),
          const SizedBox(height: 16),
          Expanded(
            child: Card(
              child: ListView.separated(
                itemCount: rows.length,
                separatorBuilder: (_, _) => const Divider(indent: 16, endIndent: 16),
                itemBuilder: (context, i) {
                  final s = rows[i];
                  return ListTile(
                    title: Text(s['fullName'] ?? '', style: TextStyle(fontWeight: FontWeight.w600, color: s['isActive'] == true ? null : scheme.onSurfaceVariant)),
                    subtitle: Text([s['role'], if (s['email'] != null) s['email'], s['hasPin'] == true ? 'PIN set' : 'no PIN', if (s['isActive'] != true) 'inactive'].join(' · ')),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      TextButton(onPressed: () => _pin(state, s), child: Text(s['hasPin'] == true ? 'Change PIN' : 'Set PIN')),
                      IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined), onPressed: () => _edit(state, s)),
                      if (s['id'] != state.staff?.id)
                        IconButton(
                          tooltip: 'Remove',
                          icon: const Icon(Icons.person_remove_outlined),
                          onPressed: () async {
                            if (await _confirm(context, 'Remove ${s['fullName']} from the staff?') && context.mounted) {
                              await guard(context, () => state.removeStaff(s['id']));
                              _reload();
                            }
                          },
                        ),
                    ]),
                  );
                },
              ),
            ),
          ),
        ]);
      },
    );
  }
}

// ---- printers ----------------------------------------------------------------------

class _PrintersTab extends StatelessWidget {
  const _PrintersTab();

  static const _roleNames = {'Receipt': 'Receipts', 'Kitchen': 'Kitchen tickets', 'Bar': 'Bar tickets'};
  static const _connections = {'Network': 'Network (IP address)', 'Usb': 'USB', 'Windows': 'Windows printer name'};

  Future<void> _edit(BuildContext context, PosState state, [Map<String, dynamic>? p]) async {
    final v = await _form(context, p == null ? 'New printer' : 'Edit ${p['name']}', [
      _Field('name', 'Name', _Kind.text, initial: p?['name'], hint: 'Kitchen, Bar, Front counter…'),
      _Field('role', 'Prints', _Kind.choice, initial: p?['role'] ?? 'Kitchen', choices: _roleNames),
      _Field('connection', 'Connected by', _Kind.choice, initial: p?['connection'] ?? 'Network', choices: _connections),
      _Field('address', 'IP address or printer name', _Kind.text, initial: p?['address'], hint: '192.168.1.50'),
      _Field('port', 'Port', _Kind.number, initial: p?['port'] ?? 9100, visibleWhen: (v) => v['connection'] == 'Network'),
      _Field('columns', 'Characters per line', _Kind.number, initial: p?['columns'] ?? 42),
      _Field('active', 'In use', _Kind.toggle, initial: p?['isActive'] ?? true),
    ]);
    if (v == null || !context.mounted) return;
    final row = {
      ...?p, 'name': (v['name'] as String).trim(), 'role': v['role'], 'connection': v['connection'], 'address': v['address'],
      'port': v['port'] ?? 9100, 'columns': v['columns'], 'isActive': v['active'],
    };
    final rest = state.catalog.printerRows.where((r) => p == null || r['id'] != p['id']);
    await guard(context, () => state.savePrinters([...rest, row]));
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final rows = state.catalog.printerRows;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      FilledButton.icon(icon: const Icon(Icons.add), label: const Text('Printer'), onPressed: () => _edit(context, state)),
      const SizedBox(height: 8),
      Text('Kitchen and bar tickets go to the printer with that job. With no receipt printer here, receipts use the USB printer picked in Settings.',
          style: TextStyle(color: scheme.onSurfaceVariant)),
      const SizedBox(height: 16),
      Expanded(
        child: Card(
          child: rows.isEmpty
              ? Center(child: Text('No printers yet.', style: TextStyle(color: scheme.onSurfaceVariant)))
              : ListView(children: [
                  for (final p in rows)
                    ListTile(
                      leading: const Icon(Icons.print_outlined),
                      title: Text('${p['name']} · ${_roleNames[p['role']] ?? p['role']}'),
                      subtitle: Text('${_connections[p['connection']] ?? p['connection']} ${p['address'] ?? ''}${p['isActive'] == false ? ' · not in use' : ''}'),
                      onTap: () => _edit(context, state, p),
                      trailing: IconButton(
                        tooltip: 'Delete',
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          if (await _confirm(context, 'Delete the printer ${p['name']}?') && context.mounted) {
                            await guard(context, () => state.savePrinters(rows.where((r) => r['id'] != p['id']).toList()));
                          }
                        },
                      ),
                    ),
                ]),
        ),
      ),
    ]);
  }
}
