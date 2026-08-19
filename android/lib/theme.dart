import 'package:flutter/material.dart';

/// Design tokens for the POS terminal, mirrored 1:1 from FLUTTER_PROMPT.md /
/// the "POS Terminal.dc.html" design canvas and shared with the admin
/// dashboard's own token set. This is the only file that may define colours -
/// every screen pulls from [Theme.of(context).extension<PosTokens>()!] or the
/// plain [ColorScheme] fields below instead of hardcoding hex values.
class PosTokens extends ThemeExtension<PosTokens> {
  const PosTokens({
    required this.shell,
    required this.mutedFg,
    required this.secondary,
    required this.destructiveSoft,
    required this.destructiveText,
    required this.warning,
  });

  final Color shell;
  final Color mutedFg;
  final Color secondary;
  final Color destructiveSoft;
  final Color destructiveText;
  final Color warning;

  static const light = PosTokens(
    shell: Color(0xFFF6F3EE),
    mutedFg: Color(0xFF78716C),
    secondary: Color(0xFF2EC2B3),
    destructiveSoft: Color(0x14EF4444),
    destructiveText: Color(0xFFB91C1C),
    warning: Color(0xFFB45309),
  );

  static const dark = PosTokens(
    shell: Color(0xFF0C0A09),
    mutedFg: Color(0xFFA8A29E),
    secondary: Color(0xFF2EC2B3),
    destructiveSoft: Color(0x1AF87171),
    destructiveText: Color(0xFFF87171),
    warning: Color(0xFFFBBF24),
  );

  @override
  PosTokens copyWith({
    Color? shell,
    Color? mutedFg,
    Color? secondary,
    Color? destructiveSoft,
    Color? destructiveText,
    Color? warning,
  }) {
    return PosTokens(
      shell: shell ?? this.shell,
      mutedFg: mutedFg ?? this.mutedFg,
      secondary: secondary ?? this.secondary,
      destructiveSoft: destructiveSoft ?? this.destructiveSoft,
      destructiveText: destructiveText ?? this.destructiveText,
      warning: warning ?? this.warning,
    );
  }

  @override
  PosTokens lerp(ThemeExtension<PosTokens>? other, double t) {
    if (other is! PosTokens) return this;
    return PosTokens(
      shell: Color.lerp(shell, other.shell, t)!,
      mutedFg: Color.lerp(mutedFg, other.mutedFg, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      destructiveSoft: Color.lerp(destructiveSoft, other.destructiveSoft, t)!,
      destructiveText: Color.lerp(destructiveText, other.destructiveText, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
    );
  }
}

const _radius = 12.0;
const _controlRadius = 10.0;

ThemeData buildPosTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = isDark
      ? const ColorScheme.dark(
          surface: Color(0xFF0C0A09),
          onSurface: Color(0xFFF2F2F2),
          primary: Color(0xFFF0690F),
          onPrimary: Colors.white,
          secondary: Color(0xFF2EC2B3),
          onSecondary: Colors.white,
          error: Color(0xFF7F1D1D),
          onError: Colors.white,
          outline: Color(0xFF2E2B29),
          surfaceContainerHighest: Color(0xFF1C1917), // card
          surfaceContainer: Color(0xFF262626), // muted fill
        )
      : const ColorScheme.light(
          surface: Colors.white,
          onSurface: Color(0xFF0C0A09),
          primary: Color(0xFF2990F4),
          onPrimary: Colors.white,
          secondary: Color(0xFF2EC2B3),
          onSecondary: Colors.white,
          error: Color(0xFFEF4444),
          onError: Colors.white,
          outline: Color(0xFFE7E5E4),
          surfaceContainerHighest: Colors.white, // card
          surfaceContainer: Color(0xFFF6F3EE), // muted fill
        );

  final tokens = isDark ? PosTokens.dark : PosTokens.light;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: tokens.shell,
    fontFamily: 'Roboto',
    extensions: [tokens],
    cardTheme: CardThemeData(
      color: scheme.surfaceContainerHighest,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(_radius),
        side: BorderSide(color: scheme.outline),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: scheme.surfaceContainerHighest,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surfaceContainerHighest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_controlRadius),
        borderSide: BorderSide(color: scheme.outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_controlRadius),
        borderSide: BorderSide(color: scheme.outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(_controlRadius),
        borderSide: BorderSide(color: scheme.primary),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_controlRadius)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        foregroundColor: scheme.onSurface,
        side: BorderSide(color: scheme.outline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_controlRadius)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 62,
      backgroundColor: scheme.surface,
      indicatorColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 11,
          color: selected ? scheme.primary : tokens.mutedFg,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? scheme.primary : tokens.mutedFg);
      }),
    ),
  );
}

/// The palette used for order-status chips (BADGE_PALETTE in
/// admin-frontend/src/pages/Configurations.tsx), indexed by
/// `displayOrder % length`. Payment-status chips reuse the same palette but
/// are keyed by name instead (see [paymentStatusPaletteIndex]).
class ChipPalette {
  final Color bg;
  final Color fg;
  final Color border;
  const ChipPalette(this.bg, this.fg, this.border);
}

const _lightPalette = [
  ChipPalette(Color(0x1AEAB308), Color(0xFFA16207), Color(0xFFFDE047)),
  ChipPalette(Color(0x1A3B82F6), Color(0xFF1D4ED8), Color(0xFF93C5FD)),
  ChipPalette(Color(0x1AF97316), Color(0xFFC2410C), Color(0xFFFDBA74)),
  ChipPalette(Color(0x1A22C55E), Color(0xFF15803D), Color(0xFF86EFAC)),
  ChipPalette(Color(0x1AA855F7), Color(0xFF7E22CE), Color(0xFFD8B4FE)),
  ChipPalette(Color(0x1A6B7280), Color(0xFF374151), Color(0xFFD1D5DB)),
  ChipPalette(Color(0x1AEF4444), Color(0xFFB91C1C), Color(0xFFFCA5A5)),
];

// Dark mode: same background tint, brighter foreground text (matches the
// Kotlin STATUS_COLOR_PALETTE / the design canvas PAL_DARK values).
const _darkPalette = [
  ChipPalette(Color(0x1AEAB308), Color(0xFFFACC15), Color(0xFFFDE047)),
  ChipPalette(Color(0x1A3B82F6), Color(0xFF60A5FA), Color(0xFF93C5FD)),
  ChipPalette(Color(0x1AF97316), Color(0xFFFB923C), Color(0xFFFDBA74)),
  ChipPalette(Color(0x1A22C55E), Color(0xFF4ADE80), Color(0xFF86EFAC)),
  ChipPalette(Color(0x1AA855F7), Color(0xFFC084FC), Color(0xFFD8B4FE)),
  ChipPalette(Color(0x1A6B7280), Color(0xFF9CA3AF), Color(0xFFD1D5DB)),
  ChipPalette(Color(0x1AEF4444), Color(0xFFF87171), Color(0xFFFCA5A5)),
];

List<ChipPalette> chipPaletteFor(Brightness brightness) =>
    brightness == Brightness.dark ? _darkPalette : _lightPalette;

ChipPalette statusChipColor(int displayOrder, Brightness brightness) {
  final palette = chipPaletteFor(brightness);
  return palette[displayOrder % palette.length];
}

/// Mirrors PAYMENT_STATUS_COLORS in admin-frontend/src/pages/Configurations.tsx
/// and paymentPaletteIndex in the archived StatusColors.kt: payment statuses
/// are colour-keyed by name, not position, so "Paid" is always green.
const _paymentIndexByName = {
  'paid': 3,
  'failed': 6,
  'pending': 0,
  'authorized': 1,
  'refunded': 5,
  'partiallyrefunded': 2,
};

ChipPalette paymentChipColor(String name, int displayOrder, Brightness brightness) {
  final key = name.toLowerCase().replaceAll(' ', '');
  final index = _paymentIndexByName[key] ?? (displayOrder % chipPaletteFor(brightness).length);
  return chipPaletteFor(brightness)[index];
}
