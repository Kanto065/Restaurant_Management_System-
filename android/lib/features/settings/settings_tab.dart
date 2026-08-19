import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/settings_store.dart';
import '../../providers.dart';
import '../../theme.dart';
import '../../widgets/pos_card.dart';
import '../orders/new_order_alarm.dart';
import '../printing/printer_service.dart';

const _alarmModeLabels = {
  AlarmMode.untilConfirmed: 'Until answered',
  AlarmMode.tenSeconds: '10 seconds',
  AlarmMode.thirtySeconds: '30 seconds',
  AlarmMode.off: 'No sound',
};

class SettingsTab extends ConsumerStatefulWidget {
  const SettingsTab({super.key});

  @override
  ConsumerState<SettingsTab> createState() => SettingsTabState();
}

class SettingsTabState extends ConsumerState<SettingsTab> {
  bool _checkingUpdate = false;
  bool _testPrinting = false;

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
    await Future.delayed(const Duration(milliseconds: 700));
    if (mounted) {
      setState(() => _testPrinting = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Test print sent')));
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

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<PosTokens>()!;
    final settingsAsync = ref.watch(settingsProvider);
    final session = ref.watch(sessionProvider).valueOrNull;
    final settings = settingsAsync.valueOrNull ?? const TerminalSettings();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 26),
      children: [
        PosCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('PAIRED RESTAURANT', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w500, fontSize: 11.5, letterSpacing: 0.06)),
                const SizedBox(height: 6),
                Text(session?.restaurantName ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 19)),
                const SizedBox(height: 4),
                // No device ID or version string here, per FLUTTER_PROMPT.md - "Check for
                // updates" lower on this tab is where the version number belongs.
                Text('Paired', style: TextStyle(color: tokens.mutedFg, fontSize: 13)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        PosCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Appearance', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                const SizedBox(height: 12),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Light')),
                    ButtonSegment(value: true, label: Text('Dark')),
                  ],
                  selected: {settings.darkTheme},
                  onSelectionChanged: (v) => ref.read(settingsProvider.notifier).setDarkTheme(v.first),
                ),
                const SizedBox(height: 9),
                Text('Follows the same tokens as the admin dashboard\'s theme switch.', style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        PosCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thermal printer', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                const SizedBox(height: 12),
                for (final printer in defaultPrinters)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: RadioListTile<String>(
                      value: printer.id,
                      groupValue: settings.printerId,
                      onChanged: (v) => ref.read(settingsProvider.notifier).setPrinterId(v!),
                      contentPadding: EdgeInsets.zero,
                      title: Text(printer.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                      subtitle: Text(printer.detail, style: TextStyle(color: tokens.mutedFg, fontSize: 12)),
                    ),
                  ),
                Divider(height: 1, color: Theme.of(context).colorScheme.outline),
                const SizedBox(height: 12),
                Row(
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
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _testPrinting ? null : _testPrint,
                  child: Text(_testPrinting ? 'Printing test…' : 'Test print'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        PosCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('New-order alarm', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                const SizedBox(height: 4),
                InkWell(
                  onTap: _openToneSheet,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
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
                ),
                Divider(height: 1, color: Theme.of(context).colorScheme.outline),
                InkWell(
                  onTap: _openAlarmModeSheet,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('How long it sounds', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w500, fontSize: 13.5)),
                        Row(
                          children: [
                            Text(_alarmModeLabels[settings.alarmMode]!, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                            Icon(Icons.chevron_right_rounded, color: tokens.mutedFg, size: 18),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Divider(height: 1, color: Theme.of(context).colorScheme.outline),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Volume', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5)),
                    Text('${settings.alarmVolume}%', style: TextStyle(color: tokens.mutedFg, fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'monospace')),
                  ],
                ),
                Slider(
                  value: settings.alarmVolume.toDouble(),
                  min: 0,
                  max: 100,
                  onChanged: (v) => ref.read(settingsProvider.notifier).setAlarmVolume(v.round()),
                ),
                Divider(height: 1, color: Theme.of(context).colorScheme.outline),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _previewAlarm,
                  icon: const Icon(Icons.volume_up_rounded, size: 18),
                  label: const Text('Preview alarm'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: _checkingUpdate ? null : _checkUpdates,
          icon: const Icon(Icons.system_update_alt_rounded),
          label: Text(_checkingUpdate ? 'Checking…' : 'Check for updates'),
        ),
        const SizedBox(height: 10),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
          onPressed: _signOut,
          child: const Text('Sign out this terminal'),
        ),
      ],
    );
  }
}
