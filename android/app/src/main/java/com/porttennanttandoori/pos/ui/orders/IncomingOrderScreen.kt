package com.porttennanttandoori.pos.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Print
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.Locale
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto

/** Full-screen takeover shown while a new order sits in the restaurant's starting status
 * (OrdersRepository.ordersAwaitingConfirmation) - the terminal is meant to be unusable for
 * anything else until staff confirms or cancels it, same as the design canvas's "hasIncoming"
 * state. "Confirm & print" is wired by the caller (MainActivity) to SunmiPrinterService +
 * OrdersViewModel.updateStatus; this composable only renders and reports taps. */
@Composable
fun IncomingOrderScreen(
    order: OrderListItemDto,
    detail: OrderDetailDto?,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    isProcessing: Boolean,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    var showCancelConfirm by remember { mutableStateOf(false) }
    val paymentDisplayOrder = paymentStatusDefinitions.firstOrNull { it.name == order.paymentStatus }?.displayOrder ?: 0

    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.primary)
                    .padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.22f)),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "New order",
                        color = MaterialTheme.colorScheme.onPrimary,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Confirm to start preparing",
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text(
                    "#${order.orderNumber}",
                    color = MaterialTheme.colorScheme.onPrimary,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }

            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(18.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Pill(order.orderType.toString(), MaterialTheme.colorScheme.secondary, Color.White)
                        Pill(order.paymentMethod.toString(), MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurface)
                        Pill(
                            order.paymentStatus,
                            paymentBackgroundColor(order.paymentStatus, paymentDisplayOrder),
                            paymentForegroundColor(order.paymentStatus, paymentDisplayOrder),
                        )
                    }
                    Spacer(modifier = Modifier.padding(top = 10.dp))
                    Text(order.customerName ?: "Walk-in", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    detail?.customerPhone?.let {
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.padding(top = 12.dp))
                }

                if (detail == null) {
                    item { CircularProgressIndicator(modifier = Modifier.padding(24.dp)) }
                } else {
                    items(detail.items) { item ->
                        Column(modifier = Modifier.padding(vertical = 7.dp)) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    "${item.quantity}x ${item.nameSnapshot}",
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f),
                                )
                                Text("£" + String.format(Locale.UK, "%.2f", item.lineTotal), style = MaterialTheme.typography.bodyMedium)
                            }
                            item.modifiers.forEach { modifier ->
                                Text(
                                    "+ ${modifier.nameSnapshot}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            item.specialInstructions?.takeIf { it.isNotBlank() }?.let {
                                Text(
                                    "Note: $it",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }

                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 14.dp),
                        ) {
                            Column(modifier = Modifier.padding(13.dp)) {
                                TotalRow("Subtotal", detail.subtotal)
                                if (detail.deliveryFee > 0) TotalRow("Delivery fee", detail.deliveryFee)
                                if (detail.processingFee > 0) TotalRow("Processing fee", detail.processingFee)
                                if (detail.discountAmount > 0) TotalRow("Discount", -detail.discountAmount)
                                Spacer(modifier = Modifier.padding(top = 6.dp))
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                    Text("Total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(
                                        "£" + String.format(Locale.UK, "%.2f", detail.totalAmount),
                                        style = MaterialTheme.typography.headlineSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }
                        }
                    }

                    detail.specialRequests?.takeIf { it.isNotBlank() }?.let { requests ->
                        item {
                            Card(modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                                Column(modifier = Modifier.padding(13.dp)) {
                                    Text(
                                        "SPECIAL REQUESTS",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(requests, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = { showCancelConfirm = true },
                    enabled = !isProcessing,
                    modifier = Modifier.weight(1f),
                ) { Text("Cancel") }
                Button(
                    onClick = onConfirm,
                    enabled = !isProcessing && detail != null,
                    modifier = Modifier.weight(1.6f),
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp).padding(end = 8.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Outlined.Print, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    }
                    Text(if (isProcessing) "Printing..." else "Confirm & print")
                }
            }
        }
    }

    if (showCancelConfirm) {
        AlertDialog(
            onDismissRequest = { showCancelConfirm = false },
            title = { Text("Cancel order #${order.orderNumber}?") },
            text = { Text("The customer is notified and the order moves to History as Cancelled. Nothing prints.") },
            confirmButton = {
                TextButton(onClick = { showCancelConfirm = false; onCancel() }) { Text("Cancel order") }
            },
            dismissButton = {
                TextButton(onClick = { showCancelConfirm = false }) { Text("Keep") }
            },
        )
    }
}

@Composable
private fun TotalRow(label: String, amount: Double) {
    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            (if (amount < 0) "−£" else "£") + String.format(Locale.UK, "%.2f", kotlin.math.abs(amount)),
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun Pill(label: String, background: Color, foreground: Color) {
    Surface(color = background, shape = RoundedCornerShape(999.dp)) {
        Text(
            label,
            color = foreground,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
        )
    }
}
