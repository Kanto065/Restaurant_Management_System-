import 'package:flutter/material.dart';

/// Delivery defaults to 60 minutes, Collection to 20 - mirrors the admin
/// dashboard's EstimatedTimeButton (Orders.tsx) so both sides agree.
const _defaultEstimatedMinutes = <String, int>{
  'delivery': 60,
  'collection': 20,
};

/// Opens a dialog to set/edit an order's estimated ready time, prefilled with
/// the order-type default - lets staff set this directly on the POS (new
/// order screen, order card) instead of only from the admin dashboard.
class EstimatedTimeButton extends StatelessWidget {
  const EstimatedTimeButton({
    super.key,
    required this.orderType,
    required this.hasEstimatedTime,
    required this.onSet,
    this.busy = false,
  });

  final String orderType;
  final bool hasEstimatedTime;
  final Future<void> Function(int minutesFromNow) onSet;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: busy ? null : () => _openDialog(context),
      icon: const Icon(Icons.timer_outlined, size: 16),
      label: Text(hasEstimatedTime ? 'Edit time' : 'Set time'),
      style: OutlinedButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
    );
  }

  Future<void> _openDialog(BuildContext context) async {
    final defaultMinutes = _defaultEstimatedMinutes[orderType.toLowerCase()];
    final controller = TextEditingController(text: defaultMinutes?.toString() ?? '');
    final minutes = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Estimated ready time'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Minutes from now', hintText: 'e.g. 20'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(int.tryParse(controller.text)),
            child: const Text('Set'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (minutes != null) await onSet(minutes);
  }
}
