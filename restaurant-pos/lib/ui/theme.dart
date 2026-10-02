import 'package:flutter/material.dart';

/// One accent (saffron) on cool ink neutrals; light and dark share the same structure.
/// Big touch targets throughout - this runs on a touchscreen till.
const _accent = Color(0xFFD9701F);

ThemeData posTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: _accent, brightness: brightness).copyWith(
    primary: dark ? const Color(0xFFEE8A3A) : const Color(0xFFC0611A),
    onPrimary: dark ? const Color(0xFF1A1206) : Colors.white,
    surface: dark ? const Color(0xFF12141B) : const Color(0xFFF7F8FA),
    onSurface: dark ? const Color(0xFFE6E8EE) : const Color(0xFF161A24),
    surfaceContainerLowest: dark ? const Color(0xFF0C0E13) : Colors.white,
    surfaceContainerLow: dark ? const Color(0xFF181B23) : Colors.white,
    surfaceContainer: dark ? const Color(0xFF1D2029) : const Color(0xFFEFF1F5),
    surfaceContainerHigh: dark ? const Color(0xFF252935) : const Color(0xFFE6E9EF),
    outlineVariant: dark ? const Color(0xFF2B2F3B) : const Color(0xFFDDE1E8),
    onSurfaceVariant: dark ? const Color(0xFF9AA1B2) : const Color(0xFF5D6577),
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness, visualDensity: VisualDensity.standard);
  final radius = BorderRadius.circular(12);
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    textTheme: base.textTheme.apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface),
    cardTheme: CardThemeData(
      color: scheme.surfaceContainerLow,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: radius, side: BorderSide(color: scheme.outlineVariant)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(64, 52), shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: base.textTheme.labelLarge?.copyWith(fontSize: 16, fontWeight: FontWeight.w600)),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size(64, 52), shape: RoundedRectangleBorder(borderRadius: radius),
          side: BorderSide(color: scheme.outlineVariant), textStyle: base.textTheme.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w600)),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: const Size(48, 48))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerLowest,
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.outlineVariant)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.outlineVariant)),
    ),
    dialogTheme: DialogThemeData(backgroundColor: scheme.surfaceContainerLow, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: scheme.surfaceContainerLowest,
      indicatorColor: scheme.primary.withValues(alpha: 0.14),
      selectedIconTheme: IconThemeData(color: scheme.primary),
      selectedLabelTextStyle: base.textTheme.labelMedium?.copyWith(color: scheme.primary, fontWeight: FontWeight.w600),
      unselectedLabelTextStyle: base.textTheme.labelMedium?.copyWith(color: scheme.onSurfaceVariant),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

/// Status colours used on the table map and badges.
class PosColors {
  static Color free(ColorScheme s) => s.surfaceContainerLow;
  static const occupied = Color(0xFF2F7D5B);
  static const bill = Color(0xFFD9A21F);
  static const danger = Color(0xFFC8423B);
}
