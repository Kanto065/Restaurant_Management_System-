import 'package:flutter/material.dart';

/// Drop-in replacement for [Card] using a plain [Container] instead - no
/// [Material]/elevation. Same look (radius 12, 1px outline, cardTheme
/// colour), but no ink-splash surface, so use GestureDetector rather than
/// InkWell for taps inside a PosCard.
class PosCard extends StatelessWidget {
  const PosCard({super.key, required this.child, this.padding, this.margin});

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: margin,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outline),
      ),
      child: padding != null ? Padding(padding: padding!, child: child) : child,
    );
  }
}
