import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/models.dart';
import '../core/permissions.dart';
import '../state/pos_state.dart';

void showMessage(BuildContext context, String text, {bool error = false}) {
  final scheme = Theme.of(context).colorScheme;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? scheme.error : null));
}

/// Runs [body]; a PosError (or anything else) becomes a message instead of a crash.
Future<T?> guard<T>(BuildContext context, Future<T> Function() body) async {
  try {
    return await body();
  } on PosError catch (e) {
    if (context.mounted) showMessage(context, e.message, error: true);
  } catch (e) {
    if (context.mounted) showMessage(context, 'Something went wrong: $e', error: true);
  }
  return null;
}

/// A 3x4 keypad. [onKey] gets '0'-'9', '00' / '.', or 'del'.
class Keypad extends StatelessWidget {
  const Keypad({super.key, required this.onKey, this.extra = 'del', this.leftKey, this.keyAspect = 1.6});
  final void Function(String key) onKey;
  final String extra;
  final String? leftKey;
  final double keyAspect;

  @override
  Widget build(BuildContext context) {
    final keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', leftKey ?? '', '0', extra];
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: keyAspect,
      children: [
        for (final k in keys)
          k.isEmpty
              ? const SizedBox()
              : FilledButton.tonal(
                  onPressed: () => onKey(k),
                  style: FilledButton.styleFrom(padding: EdgeInsets.zero),
                  child: k == 'del' ? const Icon(Icons.backspace_outlined) : Text(k, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
                ),
      ],
    );
  }
}

/// PIN entry with dots; submits automatically at [length] digits (or on OK for 4-6).
class PinPad extends StatefulWidget {
  const PinPad({super.key, required this.onSubmit, this.busy = false});
  final Future<bool> Function(String pin) onSubmit;
  final bool busy;

  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _pin = '';
  bool _shake = false;

  Future<void> _submit() async {
    if (_pin.length < 4) return;
    final ok = await widget.onSubmit(_pin);
    if (!mounted) return;
    setState(() {
      _pin = '';
      _shake = !ok;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 320,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TweenAnimationBuilder<double>(
            key: ValueKey(_shake ? DateTime.now() : 0),
            tween: Tween(begin: _shake ? 1 : 0, end: 0),
            duration: const Duration(milliseconds: 400),
            builder: (context, t, child) => Transform.translate(offset: Offset(math.sin(t * math.pi * 6) * 10 * t, 0), child: child),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < 6; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.symmetric(horizontal: 7),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _pin.length ? scheme.primary : Colors.transparent,
                      border: Border.all(color: i < _pin.length ? scheme.primary : scheme.outlineVariant, width: 2),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          if (widget.busy)
            const SizedBox(height: 300, child: Center(child: CircularProgressIndicator()))
          else
            Keypad(
              leftKey: 'OK',
              onKey: (k) {
                setState(() {
                  if (k == 'del') {
                    if (_pin.isNotEmpty) _pin = _pin.substring(0, _pin.length - 1);
                  } else if (k != 'OK' && _pin.length < 6) {
                    _pin += k;
                  }
                });
                if (k == 'OK' || _pin.length == 6) _submit();
              },
            ),
        ],
      ),
    );
  }
}

/// Asks for a manager's PIN. Returns the manager, or null if cancelled.
Future<StaffMember?> askManagerPin(BuildContext context, String reason) {
  final state = context.read<PosState>();
  return showDialog<StaffMember>(
    context: context,
    builder: (context) {
      var busy = false;
      String? error;
      return StatefulBuilder(builder: (context, setState) {
        return AlertDialog(
          title: const Text('Manager approval'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(reason, textAlign: TextAlign.center),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 20),
            PinPad(
              busy: busy,
              onSubmit: (pin) async {
                setState(() => busy = true);
                final who = await state.findByPin(pin);
                if (!context.mounted) return false;
                if (who != null && isManager(who.role)) {
                  Navigator.pop(context, who);
                  return true;
                }
                setState(() {
                  busy = false;
                  error = who == null ? 'PIN not recognised.' : '${who.name} is not a manager.';
                });
                return false;
              },
            ),
          ]),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))],
        );
      });
    },
  );
}

/// Checks [perm] for whoever is signed in. Returns the approving staff member (the person
/// themselves, or a manager who typed their PIN), or null when it isn't allowed.
Future<StaffMember?> authorize(BuildContext context, Perm perm, String reason) async {
  final state = context.read<PosState>();
  switch (state.access(perm)) {
    case Access.allowed:
      return state.staff;
    case Access.managerPin:
      return askManagerPin(context, reason);
    case Access.denied:
      showMessage(context, 'Your role can’t do this.', error: true);
      return null;
  }
}

/// Amount entry in pounds: digits fill from the right (typing 1 2 5 0 gives £12.50).
class MoneyField extends StatelessWidget {
  const MoneyField({super.key, required this.pence, this.label});
  final int pence;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(color: scheme.surfaceContainerLowest, borderRadius: BorderRadius.circular(12), border: Border.all(color: scheme.outlineVariant)),
      child: Row(children: [
        if (label != null) Text(label!, style: TextStyle(color: scheme.onSurfaceVariant)),
        const Spacer(),
        Text(money(pence), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
      ]),
    );
  }
}

int applyMoneyKey(int pence, String key) {
  if (key == 'del') return pence ~/ 10;
  if (key == '00') return pence * 100 > 99999999 ? pence : pence * 100;
  final d = int.tryParse(key);
  if (d == null || pence > 9999999) return pence;
  return pence * 10 + d;
}
