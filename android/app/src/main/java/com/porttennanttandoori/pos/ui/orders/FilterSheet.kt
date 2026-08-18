@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.porttennanttandoori.pos.ui.orders

import android.app.DatePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** Status/payment/date filters shared by New Orders (applied client-side over the live set) and
 * Order History (passed to OrdersRepository.searchOrders) - see NewOrdersScreen/OrderHistoryScreen. */
data class OrderFilters(
    val status: String? = null,
    val paymentStatus: String? = null,
    val dateFrom: String? = null, // yyyy-MM-dd, matches the backend's DateOnly? query params
    val dateTo: String? = null,
) : java.io.Serializable {
    val isEmpty: Boolean get() = status == null && paymentStatus == null && dateFrom == null && dateTo == null
}

private val ISO_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

/** Short chip row shown under the top bar whenever any filter is active, e.g. "Status: Preparing"
 * · "Paid: Pending" · "Today", with a Clear action - mirrors the mockup's activeFilterChips. */
@Composable
fun ActiveFilterRow(filters: OrderFilters, onClear: () -> Unit) {
    if (filters.isEmpty) return
    val dateLabel = when {
        filters.dateFrom != null && filters.dateFrom == filters.dateTo -> "Date: ${filters.dateFrom}"
        filters.dateFrom != null && filters.dateTo != null -> "${filters.dateFrom} – ${filters.dateTo}"
        filters.dateFrom != null -> "From ${filters.dateFrom}"
        filters.dateTo != null -> "Until ${filters.dateTo}"
        else -> null
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
        FlowRow(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            filters.status?.let { ChipLabel("Status: $it") }
            filters.paymentStatus?.let { ChipLabel("Paid: $it") }
            dateLabel?.let { ChipLabel(it) }
        }
        androidx.compose.material3.TextButton(onClick = onClear) { Text("Clear") }
    }
}

@Composable
private fun ChipLabel(text: String) {
    androidx.compose.material3.Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterBottomSheet(
    sheetState: SheetState,
    orderStatusDefinitions: List<OrderStatusDefinitionDto>,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    filters: OrderFilters,
    resultCount: Int,
    onApply: (OrderFilters) -> Unit,
    onDismiss: () -> Unit,
) {
    var local by remember(filters) { mutableStateOf(filters) }
    val context = LocalContext.current

    fun pickDate(current: String?, onPicked: (String) -> Unit) {
        val base = current?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()
        DatePickerDialog(
            context,
            { _, year, month, day -> onPicked(LocalDate.of(year, month + 1, day).format(ISO_DATE)) },
            base.year, base.monthValue - 1, base.dayOfMonth,
        ).show()
    }

    ModalBottomSheet(sheetState = sheetState, onDismissRequest = onDismiss) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Filter orders", style = MaterialTheme.typography.titleMedium)
                Text(
                    "$resultCount of matching orders",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionLabel("Order status")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterPill(
                    label = "All statuses",
                    selected = local.status == null,
                    onClick = { local = local.copy(status = null) },
                )
                orderStatusDefinitions.sortedBy { it.displayOrder }.forEach { def ->
                    FilterPill(
                        label = def.name,
                        selected = local.status == def.name,
                        selectedColor = statusForegroundColor(def.displayOrder),
                        onClick = { local = local.copy(status = def.name) },
                    )
                }
            }

            SectionLabel("Payment status")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterPill(
                    label = "All payments",
                    selected = local.paymentStatus == null,
                    onClick = { local = local.copy(paymentStatus = null) },
                )
                paymentStatusDefinitions.sortedBy { it.displayOrder }.forEach { def ->
                    FilterPill(
                        label = def.name,
                        selected = local.paymentStatus == def.name,
                        selectedColor = paymentForegroundColor(def.name, def.displayOrder),
                        onClick = { local = local.copy(paymentStatus = def.name) },
                    )
                }
            }

            SectionLabel("Date range")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 4.dp)) {
                OutlinedButton(onClick = { pickDate(local.dateFrom) { local = local.copy(dateFrom = it) } }) {
                    Text(local.dateFrom ?: "From date")
                }
                OutlinedButton(onClick = { pickDate(local.dateTo) { local = local.copy(dateTo = it) } }) {
                    Text(local.dateTo ?: "To date")
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 12.dp)) {
                val today = LocalDate.now().format(ISO_DATE)
                val weekAgo = LocalDate.now().minusDays(6).format(ISO_DATE)
                FilterPill(
                    label = "Today",
                    selected = local.dateFrom == today && local.dateTo == today,
                    onClick = { local = local.copy(dateFrom = today, dateTo = today) },
                )
                FilterPill(
                    label = "Last 7 days",
                    selected = local.dateFrom == weekAgo && local.dateTo == today,
                    onClick = { local = local.copy(dateFrom = weekAgo, dateTo = today) },
                )
                FilterPill(
                    label = "Any date",
                    selected = local.dateFrom == null && local.dateTo == null,
                    onClick = { local = local.copy(dateFrom = null, dateTo = null) },
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 18.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = { local = OrderFilters() },
                    modifier = Modifier.weight(1f),
                ) { Text("Clear all") }
                Button(
                    onClick = { onApply(local); onDismiss() },
                    modifier = Modifier.weight(1.4f),
                ) { Text("Show $resultCount ${if (resultCount == 1) "order" else "orders"}") }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterPill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    selectedColor: androidx.compose.ui.graphics.Color? = null,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        colors = if (selectedColor != null) {
            FilterChipDefaults.filterChipColors(
                selectedContainerColor = selectedColor.copy(alpha = 0.16f),
                selectedLabelColor = selectedColor,
            )
        } else {
            FilterChipDefaults.filterChipColors()
        },
    )
}
