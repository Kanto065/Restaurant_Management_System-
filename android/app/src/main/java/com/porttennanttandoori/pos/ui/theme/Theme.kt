package com.porttennanttandoori.pos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Same palette as the storefront's --color-brand-* tokens (storefront/src/index.css), sampled
// from spice-village.uk/pontardawe - the terminal should read as the same brand as the customer
// site and the admin dashboard, not a stock Material app.
private val BrandBg = Color(0xFF031F21)
private val BrandBgLight = Color(0xFF0B3D2E)
private val BrandMint = Color(0xFF7CCEB7)
private val BrandGreen = Color(0xFF31826F)
private val BrandOrange = Color(0xFFF07402)
private val BrandCream = Color(0xFFF7F0E8)

// Always dark - a Sunmi terminal sits under kitchen/counter lighting most of the day, and
// matching the storefront's single dark theme means no separate light palette to keep in sync.
private val PosColors = darkColorScheme(
    primary = BrandOrange,
    onPrimary = BrandCream,
    secondary = BrandMint,
    onSecondary = BrandBg,
    tertiary = BrandGreen,
    onTertiary = BrandCream,
    background = BrandBg,
    onBackground = BrandCream,
    surface = BrandBgLight,
    onSurface = BrandCream,
    surfaceVariant = BrandBgLight,
    onSurfaceVariant = BrandCream,
    error = Color(0xFFCF6679),
)

@Composable
fun PosAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = PosColors, content = content)
}
