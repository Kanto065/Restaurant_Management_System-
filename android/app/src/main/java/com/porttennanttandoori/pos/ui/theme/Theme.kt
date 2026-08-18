package com.porttennanttandoori.pos.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// Same tokens as the admin dashboard's own light/dark theme (hsl(210 90% 56%) primary in light,
// hsl(24 88% 50%) in dark - see the POS Terminal design canvas) so the terminal reads as the same
// design system as the dashboard, whichever theme is picked in Settings > Appearance.
private val DarkColors = darkColorScheme(
    primary = Color(0xFFF0690F),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF2EC2B3),
    onSecondary = Color(0xFF031F21),
    background = Color(0xFF0C0A09),
    onBackground = Color(0xFFF2F2F2),
    surface = Color(0xFF1C1917),
    onSurface = Color(0xFFF2F2F2),
    surfaceVariant = Color(0xFF262626),
    onSurfaceVariant = Color(0xFFA8A29E),
    outline = Color(0xFF2E2B29),
    error = Color(0xFF7F1D1D),
    onError = Color(0xFFF87171),
)

private val LightColors = lightColorScheme(
    primary = Color(0xFF2990F4),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF2EC2B3),
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFF6F3EE),
    onBackground = Color(0xFF0C0A09),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0C0A09),
    surfaceVariant = Color(0xFFF6F3EE),
    onSurfaceVariant = Color(0xFF78716C),
    outline = Color(0xFFE7E5E4),
    error = Color(0xFFEF4444),
    onError = Color(0xFFB91C1C),
)

// Matches the design canvas's consistent radius:12px on cards/sheets/dialogs and radius:10px on
// inputs/buttons - Material3's own defaults (extraSmall=4dp, small=8dp) read visibly "stock
// Android" next to that, which is a big part of why the app didn't read as the same design system
// even with matching colors.
private val PosShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(18.dp),
)

/** [darkTheme] is persisted via SettingsStore (Settings > Appearance) - defaults to dark, since a
 * Sunmi terminal sits under kitchen/counter lighting most of the day. */
@Composable
fun PosAppTheme(darkTheme: Boolean = true, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, shapes = PosShapes, content = content)
}
