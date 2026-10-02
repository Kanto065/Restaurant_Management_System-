import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../state/pos_state.dart';
import 'widgets.dart';

/// First run: connect this till to the restaurant using the ID and secret from
/// admin > POS settings > Register till.
class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, this.onUseAsTablet});
  final VoidCallback? onUseAsTablet;

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final _server = TextEditingController(text: prodServer);
  final _deviceId = TextEditingController();
  final _secret = TextEditingController();
  bool _busy = false;
  String? _error;

  /// The admin's QR code holds {"deviceId": ..., "secret": ...}; a scanner or a paste fills both.
  Future<void> _paste() async {
    final text = (await Clipboard.getData('text/plain'))?.text ?? '';
    try {
      final j = jsonDecode(text) as Map<String, dynamic>;
      setState(() {
        _deviceId.text = j['deviceId'] ?? '';
        _secret.text = j['secret'] ?? '';
      });
    } catch (_) {
      setState(() => _error = 'The clipboard does not hold a pairing code. Type the ID and secret instead.');
    }
  }

  Future<void> _pair() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<PosState>().pair(server: _server.text, deviceId: _deviceId.text, secret: _secret.text);
    } on PosError catch (e) {
      setState(() => _error = e.message);
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
            constraints: const BoxConstraints(maxWidth: 460),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Icon(Icons.point_of_sale_rounded, size: 44, color: scheme.primary),
              const SizedBox(height: 16),
              Text('Set up this till', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('In the restaurant admin, open POS settings and press “Register till”. Enter the ID and secret it shows.',
                  style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4)),
              const SizedBox(height: 28),
              TextField(controller: _deviceId, decoration: const InputDecoration(labelText: 'Device ID')),
              const SizedBox(height: 12),
              TextField(controller: _secret, decoration: const InputDecoration(labelText: 'Secret'), obscureText: true),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(onPressed: _paste, icon: const Icon(Icons.content_paste), label: const Text('Paste pairing code')),
              ),
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text('Server', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14)),
                children: [
                  TextField(controller: _server, decoration: const InputDecoration(labelText: 'Server address')),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, children: [
                    ActionChip(label: const Text('Live'), onPressed: () => _server.text = prodServer),
                    ActionChip(label: const Text('Test (UAT)'), onPressed: () => _server.text = 'https://apiuat.porttennanttandoori.co.uk'),
                  ]),
                  const SizedBox(height: 12),
                ],
              ),
              if (_error != null)
                Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: TextStyle(color: scheme.error))),
              FilledButton(
                onPressed: _busy ? null : _pair,
                child: _busy ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : const Text('Connect till'),
              ),
              if (widget.onUseAsTablet != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: TextButton(onPressed: widget.onUseAsTablet, child: const Text('Use this device as a waiter tablet')),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Shown whenever nobody is signed in: staff type their own PIN.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  bool _busy = false;
  String? _error;
  late final Timer _clock;

  @override
  void initState() {
    super.initState();
    _clock = Timer.periodic(const Duration(seconds: 20), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _clock.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    final scheme = Theme.of(context).colorScheme;
    final now = DateTime.now();
    return Scaffold(
      body: Row(children: [
        Expanded(
          child: Container(
            color: scheme.surfaceContainerLowest,
            padding: const EdgeInsets.all(48),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(state.restaurantName, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(DateFormat('h:mm').format(now),
                  style: const TextStyle(fontSize: 88, fontWeight: FontWeight.w300, height: 1, fontFeatures: [FontFeature.tabularFigures()])),
              Text(DateFormat('EEEE d MMMM').format(now), style: TextStyle(fontSize: 22, color: scheme.onSurfaceVariant)),
              const SizedBox(height: 24),
              SyncChip(state: state),
            ]),
          ),
        ),
        Expanded(
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('Enter your PIN', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
              SizedBox(
                height: 36,
                child: _error == null ? null : Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: TextStyle(color: scheme.error))),
              ),
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
                  } on PosError catch (e) {
                    if (mounted) setState(() => _error = e.message);
                    return false;
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
              ),
              if (state.catalog.staff.every((s) => s.pinHash == null))
                Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: Text('No one has a PIN yet. Set PINs in the admin under Staff.', style: TextStyle(color: scheme.onSurfaceVariant)),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Online / offline / waiting-to-send indicator.
class SyncChip extends StatelessWidget {
  const SyncChip({super.key, required this.state});
  final PosState state;

  @override
  Widget build(BuildContext context) {
    final sync = state.sync;
    final pending = state.db.pendingCount;
    final (color, label) = switch (sync) {
      null => (Colors.grey, 'Not connected'),
      _ when sync.signedOut => (Colors.red, 'Signed out'),
      _ when !sync.online => (Colors.orange, pending > 0 ? 'Offline · $pending to send' : 'Offline'),
      _ when pending > 0 => (Colors.orange, 'Sending $pending…'),
      _ => (Colors.green, 'Online'),
    };
    return Tooltip(
      message: sync?.lastError ?? (sync?.lastSync == null ? '' : 'Last sync ${DateFormat('h:mm a').format(sync!.lastSync!)}'),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13)),
      ]),
    );
  }
}
