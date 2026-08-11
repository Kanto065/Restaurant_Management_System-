package com.porttennanttandoori.pos.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// A Sunmi terminal sits under kitchen/counter lighting most of the day - a plain, high-contrast
// palette reads better there than anything decorative.
private val PosOrange = Color(0xFFD9642C)

private val LightColors = lightColorScheme(
    primary = PosOrange,
    secondary = Color(0xFF5C5C5C),
)

private val DarkColors = darkColorScheme(
    primary = PosOrange,
    secondary = Color(0xFFB0B0B0),
)

@Composable
fun PosAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
