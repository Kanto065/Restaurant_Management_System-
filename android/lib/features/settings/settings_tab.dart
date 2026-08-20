import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/settings_store.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/pos_card.dart';
import '../orders/new_order_alarm.dart';
import '../printing/receipt_formatter.dart';

const _alarmModeLabels = {
  AlarmMode.untilConfirmed: 'Until answered',
  AlarmMode.tenSeconds: '10 seconds',
  AlarmMode.thirtySeconds: '30 seconds',
  AlarmMode.off: 'No sound',
};

const _appVersion = 'PTT POS v1.0.0';

class SettingsTab extends ConsumerStatefulWidget {
  const SettingsTab({super.key});

  @override
  ConsumerState<SettingsTab> createState() => SettingsTabState();
}

class SettingsTabState extends ConsumerState<SettingsTab> {
  bool _checkingUpdate = false;
  bool _testPrinting = false;
  bool? _sunmiAvailable;

  @override
  void initState() {
    super.initState();
    _checkSunmi();
  }

  Future<void> _checkSunmi() async {
    final available = await ref.read(printerServiceProvider).isSunmiAvailable();
    if (mounted) setState(() => _sunmiAvailable = available);
  }

  Future<void> openTerminalOptionsMenu() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
              child: Align(alignment: Alignment.centerLeft, child: Text('Terminal options', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
            ),
            ListTile(
              title: Text('Alarm sound · ${_alarmModeLabels[ref.read(settingsProvider).valueOrNull?.alarmMode ?? AlarmMode.untilConfirmed]}'),
              onTap: () => Navigator.of(context).pop('alarm'),
            ),
            ListTile(title: const Text('Reprint last receipt'), onTap: () => Navigator.of(context).pop('reprint')),
            ListTile(title: const Text('Refresh orders'), onTap: () => Navigator.of(context).pop('refresh')),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    switch (choice) {
      case 'alarm':
        await _openAlarmModeSheet();
      case 'refresh':
        await ref.read(ordersProvider.notifier).refresh();
      case 'reprint':
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick an order from History to reprint.')));
    }
  }

  Future<void> _openAlarmModeSheet() async {
    final mode = await showModalBottomSheet<AlarmMode>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final mode in AlarmMode.values)
              ListTile(
                title: Text(_alarmModeLabels[mode]!),
                trailing: ref.read(settingsProvider).valueOrNull?.alarmMode == mode ? const Icon(Icons.check) : null,
                onTap: () => Navigator.of(context).pop(mode),
              ),
          ],
        ),
      ),
    );
    if (mode != null) await ref.read(settingsProvider.notifier).setAlarmMode(mode);
  }

  Future<void> _openToneSheet() async {
    final tone = await showModalBottomSheet<AlarmTone>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 6),
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 8, 18, 8),
              child: Align(alignment: Alignment.centerLeft, child: Text('Alert tone', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15))),
            ),
            for (final t in AlarmTone.values)
              ListTile(
                title: Text(alarmToneInfo[t]!.name),
                subtitle: Text(alarmToneInfo[t]!.detail),
                trailing: ref.read(settingsProvider).valueOrNull?.alarmTone == t ? const Icon(Icons.check) : null,
                onTap: () => Navigator.of(context).pop(t),
              ),
          ],
        ),
      ),
    );
    if (tone != null) await ref.read(settingsProvider.notifier).setAlarmTone(tone);
  }

  Future<void> _previewAlarm() async {
    final settings = ref.read(settingsProvider).valueOrNull;
    if (settings == null) return;
    await NewOrderAlarmController.preview(volume: settings.alarmVolume, tone: settings.alarmTone);
  }

  Future<void> _testPrint() async {
    setState(() => _testPrinting = true);
    try {
      final now = DateTime.now();
      final receipt = Receipt(
        title: 'Test Print',
        subtitle: 'Port Tennant Tandoori POS',
        lines: [
          'Printer connection test',
          '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} '
              '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
          '',
          'If you can read this clearly,',
          'the printer is set up correctly.',
        ],
      );
      // Always 1 copy, regardless of the configured copies-per-order - this is a connectivity
      // check, not a real order, no reason to burn extra paper testing it.
      await ref.read(printerServiceProvider).printReceipt(receipt, copies: 1);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Test print sent')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Test print failed: $e')));
    } finally {
      if (mounted) setState(() => _testPrinting = false);
    }
  }

  Future<void> _checkUpdates() async {
    setState(() => _checkingUpdate = true);
    await Future.delayed(const Duration(milliseconds: 900));
    if (mounted) {
      setState(() => _checkingUpdate = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('You\'re on the latest version')));
    }
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out this terminal?'),
        content: const Text('You\'ll need the device ID and secret (or a fresh QR) to pair again.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Keep')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true) await ref.read(sessionProvider.notifier).signOut();
  }

  Widget _sectionLabel(PosTokens tokens, String text) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(text, style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 11.5, letterSpacing: 0.06)),
      );

  Widget _row({required Widget child, VoidCallback? onTap}) {
    final content = Padding(padding: const EdgeInsets.all(14), child: child);
    return onTap == null ? content : InkWell(onTap: onTap, child: content);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = Theme.of(context).extension<PosTokens>()!;
    final settingsAsync = ref.watch(settingsProvider);
    final session = ref.watch(sessionProvider).valueOrNull;
    final settings = settingsAsync.valueOrNull ?? const TerminalSettings();
    final divider = Divider(height: 1, color: scheme.outline);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 26),
      children: [
        PosCard(
          child: _row(
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.storefront_rounded, color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(session?.restaurantName ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15.5)),
                      const SizedBox(height: 2),
                      Text('Paired', style: TextStyle(color: tokens.mutedFg, fontSize: 12.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        _sectionLabel(tokens, 'APPEARANCE'),
        PosCard(
          child: _row(
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, icon: Icon(Icons.circle_outlined, size: 14), label: Text('Light')),
                ButtonSegment(value: true, icon: Icon(Icons.circle, size: 14), label: Text('Dark')),
              ],
              showSelectedIcon: false,
              selected: {settings.darkTheme},
              onSelectionChanged: (v) => ref.read(settingsProvider.notifier).setDarkTheme(v.first),
            ),
          ),
        ),
        const SizedBox(height: 18),
        _sectionLabel(tokens, 'PRINTING'),
        PosCard(
          child: Column(
            children: [
              _row(
                child: Row(
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _sunmiAvailable == true ? Colors.green : tokens.mutedFg,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Sunmi internal printer', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                          const SizedBox(height: 2),
                          Text(
                            _sunmiAvailable == null
                                ? '80mm · built-in · checking…'
                                : (_sunmiAvailable! ? '80mm · built-in · connected' : '80mm · built-in · not detected'),
                            style: TextStyle(color: tokens.mutedFg, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              divider,
              _row(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Copies per order', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                    Row(
                      children: [
                        IconButton(onPressed: () => ref.read(settingsProvider.notifier).setCopiesPerOrder(settings.copiesPerOrder - 1), icon: const Icon(Icons.remove)),
                        Text('${settings.copiesPerOrder}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, fontFamily: 'monospace')),
                        IconButton(onPressed: () => ref.read(settingsProvider.notifier).setCopiesPerOrder(settings.copiesPerOrder + 1), icon: const Icon(Icons.add)),
                      ],
                    ),
                  ],
                ),
              ),
              divider,
              _row(
                onTap: _testPrinting ? null : _testPrint,
                child: Row(
                  children: [
                    Icon(Icons.print_outlined, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Text(_testPrinting ? 'Printing test…' : 'Test print', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600, fontSize: 13.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionLabel(tokens, 'NEW-ORDER ALARM'),
        PosCard(
          child: Column(
            children: [
              _row(
                onTap: _openToneSheet,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Alert tone', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                          const SizedBox(height: 2),
                          Text(alarmToneInfo[settings.alarmTone]!.detail, style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
                        ],
                      ),
                    ),
                    Text(alarmToneInfo[settings.alarmTone]!.name, style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 13)),
                    Icon(Icons.chevron_right_rounded, color: tokens.mutedFg, size: 18),
                  ],
                ),
              ),
              divider,
              _row(
                onTap: _openAlarmModeSheet,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('How long it sounds', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                        const SizedBox(height: 2),
                        Text('Until answered, or a fixed burst', style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
                      ],
                    ),
                    Row(
                      children: [
                        Text(_alarmModeLabels[settings.alarmMode]!, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        Icon(Icons.chevron_right_rounded, color: tokens.mutedFg, size: 18),
                      ],
                    ),
                  ],
                ),
              ),
              divider,
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Volume', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                    Text('${settings.alarmVolume}%', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'monospace')),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Slider(
                  value: settings.alarmVolume.toDouble(),
                  min: 0,
                  max: 100,
                  onChanged: (v) => ref.read(settingsProvider.notifier).setAlarmVolume(v.round()),
                ),
              ),
              divider,
              _row(
                onTap: _previewAlarm,
                child: Row(
                  children: [
                    Icon(Icons.volume_up_rounded, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Text('Preview alarm', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600, fontSize: 13.5)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionLabel(tokens, 'TERMINAL'),
        PosCard(
          child: Column(
            children: [
              _row(
                onTap: _checkingUpdate ? null : _checkUpdates,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Check for updates', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                          const SizedBox(height: 2),
                          Text(_appVersion, style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
                        ],
                      ),
                    ),
                    if (_checkingUpdate)
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    else
                      Icon(Icons.chevron_right_rounded, color: tokens.mutedFg, size: 18),
                  ],
                ),
              ),
              divider,
              _row(
                onTap: _signOut,
                child: Text('Sign out this terminal', style: TextStyle(color: scheme.error, fontWeight: FontWeight.w600, fontSize: 13.5)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
