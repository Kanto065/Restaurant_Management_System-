package com.porttennanttandoori.pos.ui.orders

import androidx.compose.ui.graphics.Color
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto

/** The status a confirmed incoming order should move to - one step past whatever status it's
 * currently sitting in (its DisplayOrder), same "next" logic OrderStatusChanger's arrow button
 * uses. Falls back to the current status itself if there's nowhere to advance to (misconfigured
 * restaurant with only one status defined). */
fun nextStatusAfter(current: OrderStatus, definitions: List<OrderStatusDefinitionDto>): OrderStatus {
    val sorted = definitions.sortedBy { it.displayOrder }
    val index = sorted.indexOfFirst { it.name == current }
    return sorted.getOrNull(index + 1)?.name ?: current
}

/** The status a cancelled order should move to - matched by name like the rest of the admin
 * dashboard does for "Cancelled" (see isHistoryStatus in OrdersListScreen.kt), since it has no
 * dedicated boolean on the status definition. Falls back to the literal name if the restaurant
 * hasn't configured one (unlikely - StatusDefinitionSeeder.cs seeds it by default). */
fun cancelledStatusName(definitions: List<OrderStatusDefinitionDto>): OrderStatus =
    definitions.firstOrNull { it.name.equals("Cancelled", ignoreCase = true) }?.name ?: "Cancelled"

/** Mirrors admin-frontend/src/pages/Configurations.tsx's BADGE_PALETTE dark-mode variant
 * (statusBadgeColor: displayOrder % palette.length) - a status looks the same shade whether
 * you're looking at it in the admin dashboard or on the terminal. Uses the same saturated
 * "dark:" half of that Tailwind palette in both of the terminal's own light/dark themes (see
 * ui/theme/Theme.kt) rather than a separate light variant - it reads fine on either background. */
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

/** Mirrors admin-frontend/src/pages/Configurations.tsx's PAYMENT_STATUS_COLORS - payment statuses
 * get semantic colors by name (Paid=green, Failed=red, Pending=yellow, Authorized=blue,
 * Refunded=gray, PartiallyRefunded=orange) instead of the plain positional cycle above, so "Paid"
 * doesn't end up some arbitrary color depending on where it sits in displayOrder. Falls back to
 * the positional palette (by displayOrder) for any custom status name that isn't recognized. */
private val PAYMENT_STATUS_PALETTE_INDEX = mapOf(
    "paid" to 3,
    "failed" to 6,
    "pending" to 0,
    "authorized" to 1,
    "refunded" to 5,
    "partiallyrefunded" to 2,
)

private fun paymentPaletteIndex(name: String, displayOrder: Int): Int =
    PAYMENT_STATUS_PALETTE_INDEX[name.lowercase().replace(" ", "")] ?: displayOrder.mod(STATUS_COLOR_PALETTE.size)

fun paymentBackgroundColor(name: String, displayOrder: Int): Color =
    STATUS_COLOR_PALETTE[paymentPaletteIndex(name, displayOrder)].background

fun paymentForegroundColor(name: String, displayOrder: Int): Color =
    STATUS_COLOR_PALETTE[paymentPaletteIndex(name, displayOrder)].foreground
