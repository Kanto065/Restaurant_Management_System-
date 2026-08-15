package com.porttennanttandoori.pos.ui.orders

import androidx.compose.ui.graphics.Color

/** Mirrors admin-frontend/src/pages/Configurations.tsx's BADGE_PALETTE dark-mode variant
 * (statusBadgeColor: displayOrder % palette.length) - a status looks the same shade whether
 * you're looking at it in the admin dashboard or on the terminal. POS is always dark-themed
 * (see ui/theme/Theme.kt), so this uses the "dark:" half of that Tailwind palette only. */
private data class StatusColorPair(val background: Color, val foreground: Color)

private val STATUS_COLOR_PALETTE = listOf(
    StatusColorPair(Color(0x1AEAB308), Color(0xFFFACC15)), // yellow
    StatusColorPair(Color(0x1A3B82F6), Color(0xFF60A5FA)), // blue
    StatusColorPair(Color(0x1AF97316), Color(0xFFFB923C)), // orange
    StatusColorPair(Color(0x1A22C55E), Color(0xFF4ADE80)), // green
    StatusColorPair(Color(0x1AA855F7), Color(0xFFC084FC)), // purple
    StatusColorPair(Color(0x1A6B7280), Color(0xFF9CA3AF)), // gray
    StatusColorPair(Color(0x1AEF4444), Color(0xFFF87171)), // red
)

fun statusBackgroundColor(displayOrder: Int): Color =
    STATUS_COLOR_PALETTE[displayOrder.mod(STATUS_COLOR_PALETTE.size)].background

fun statusForegroundColor(displayOrder: Int): Color =
    STATUS_COLOR_PALETTE[displayOrder.mod(STATUS_COLOR_PALETTE.size)].foreground
