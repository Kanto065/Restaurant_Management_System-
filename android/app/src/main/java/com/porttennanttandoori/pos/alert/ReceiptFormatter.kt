package com.porttennanttandoori.pos.alert

import com.porttennanttandoori.pos.data.model.OrderDetailDto
import java.time.format.DateTimeFormatter
import java.util.Locale

private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.UK)

private fun money(amount: Double): String = "£" + String.format(Locale.UK, "%.2f", amount)

/** Formats an OrderDetailDto into a plain-text receipt for SunmiPrinterService - order #, type,
 * items with modifiers/notes, and the same fee/discount breakdown OrderDetailDto already carries. */
fun OrderDetailDto.toReceipt(): Receipt {
    val lines = buildList {
        add("Order #$orderNumber · $orderType")
        add(customerName ?: "Walk-in")
        add(createdAtInstantOrNull()?.let { TIME_FORMAT.format(it) } ?: "")
        add("")
        items.forEach { item ->
            add("${item.quantity}x ${item.nameSnapshot}  ${money(item.lineTotal)}")
            item.modifiers.forEach { modifier -> add("  + ${modifier.nameSnapshot}") }
            item.specialInstructions?.takeIf { it.isNotBlank() }?.let { add("  Note: $it") }
        }
        add("")
        add("Subtotal        ${money(subtotal)}")
        if (deliveryFee > 0) add("Delivery fee    ${money(deliveryFee)}")
        if (processingFee > 0) add("Processing fee  ${money(processingFee)}")
        if (discountAmount > 0) add("Discount       -${money(discountAmount)}")
        add("Total           ${money(totalAmount)}")
        specialRequests?.takeIf { it.isNotBlank() }?.let { add(""); add("Note: $it") }
    }
    return Receipt(title = "Port Tennant Tandoori", subtitle = "$paymentMethod · $paymentStatus", lines = lines)
}

private fun OrderDetailDto.createdAtInstantOrNull() =
    runCatching { java.time.OffsetDateTime.parse(createdAt).toInstant().atZone(java.time.ZoneId.systemDefault()) }
        .getOrNull()
