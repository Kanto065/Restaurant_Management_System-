import 'package:flutter/material.dart';

import '../theme.dart';

/// One entry in the "jump to a value" bottom sheet / the chip control's
/// own value list.
class ChipOption {
  final String name;
  final int displayOrder;
  const ChipOption(this.name, this.displayOrder);
}

/// The shared status/payment chip control - the single most important shared
/// widget in the app (per FLUTTER_PROMPT.md), used identically for order
/// status and payment status:
///
/// [value] label | -> advance one step | tick jump straight to [terminalValue]
/// plus an optional trailing overflow button (status row only, for
/// "jump with note" / reprint).
class StatusChipControl extends StatelessWidget {
  const StatusChipControl({
    super.key,
    required this.value,
    required this.options,
    required this.terminalValue,
    required this.paletteFor,
    required this.onTapValue,
    required this.onAdvance,
    required this.onJumpToTerminal,
    this.onOverflow,
    this.busy = false,
    this.showAdvance = true,
  });

  final String value;
  final List<ChipOption> options;
  final String terminalValue;
  final ChipPalette Function(String name, int displayOrder, Brightness brightness) paletteFor;
  final VoidCallback onTapValue;
  final VoidCallback onAdvance;
  final VoidCallback onJumpToTerminal;
  final VoidCallback? onOverflow;
  final bool busy;
  /// False for payment-status usage, which per FLUTTER_PROMPT.md's chip spec
  /// never shows the "advance one step" arrow - only status chips do.
  final bool showAdvance;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final option = options.where((o) => o.name == value).toList();
    final displayOrder = option.isEmpty ? 0 : option.first.displayOrder;
    final palette = paletteFor(value, displayOrder, brightness);
    final atTerminal = value == terminalValue;

    // IntrinsicHeight: this Row uses CrossAxisAlignment.stretch, which needs
    // a bounded height to stretch its children to. Without it, when this
    // widget sits directly in a Column (no Expanded) inside a ListView item
    // slot, the incoming height constraint is unbounded and the stretch
    // fails silently at paint time instead of asserting - the whole card
    // renders as nothing, with no exception logged.
    return IntrinsicHeight(
      child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: palette.bg,
              border: Border.all(color: palette.border),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: busy ? null : onTapValue,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
                      child: Text(
                        value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: palette.fg),
                      ),
                    ),
                  ),
                ),
                if (showAdvance)
                  _MiniButton(
                    tooltip: 'Next status',
                    color: palette.fg,
                    onTap: busy ? null : onAdvance,
                    icon: Icons.arrow_forward_rounded,
                  ),
                _MiniButton(
                  tooltip: 'Jump to $terminalValue',
                  color: palette.fg,
                  onTap: busy || atTerminal ? null : onJumpToTerminal,
                  icon: Icons.check_rounded,
                  opacity: atTerminal ? 0.3 : 1,
                ),
              ],
            ),
          ),
        ),
        if (onOverflow != null) ...[
          const SizedBox(width: 6),
          SizedBox(
            width: 38,
            child: GestureDetector(
              onTap: busy ? null : onOverflow,
              behavior: HitTestBehavior.opaque,
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Theme.of(context).colorScheme.outline),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  '⋮',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Theme.of(context).extension<PosTokens>()!.mutedFg),
                ),
              ),
            ),
          ),
        ],
      ],
      ),
    );
  }
}

class _MiniButton extends StatelessWidget {
  const _MiniButton({required this.icon, required this.color, required this.onTap, required this.tooltip, this.opacity = 1});

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final String tooltip;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
        width: 42,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Container(
            color: Colors.black.withValues(alpha: 0.04),
            alignment: Alignment.center,
            child: Icon(icon, size: 15, color: color.withValues(alpha: opacity)),
          ),
        ),
    );
  }
}

/// Opens the "pick a value" bottom sheet shared by status and payment chips:
/// current value ticked, a colour swatch trailing each row.
Future<String?> showChipValueSheet(
  BuildContext context, {
  required String title,
  required List<ChipOption> options,
  required String current,
  required ChipPalette Function(String name, int displayOrder, Brightness brightness) paletteFor,
}) {
  final brightness = Theme.of(context).brightness;
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    builder: (context) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 6),
            Container(width: 38, height: 4, decoration: BoxDecoration(color: Theme.of(context).colorScheme.outline, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: options.map((option) {
                  final palette = paletteFor(option.name, option.displayOrder, brightness);
                  final selected = option.name == current;
                  return ListTile(
                    onTap: () => Navigator.of(context).pop(option.name),
                    leading: SizedBox(
                      width: 16,
                      child: selected
                          ? Icon(Icons.check, size: 14, color: Theme.of(context).colorScheme.primary)
                          : null,
                    ),
                    title: Text(
                      option.name,
                      style: TextStyle(fontWeight: selected ? FontWeight.w700 : FontWeight.w400, fontSize: 14),
                    ),
                    trailing: Container(width: 9, height: 9, decoration: BoxDecoration(color: palette.fg, borderRadius: BorderRadius.circular(3))),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
}
