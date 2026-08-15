package com.porttennanttandoori.pos.ui.orders

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.util.Locale
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto

@Composable
fun NewOrdersScreen(viewModel: OrdersViewModel) {
    val allOrders by viewModel.orders.collectAsStateWithLifecycle()
    val definitions by viewModel.orderStatusDefinitions.collectAsStateWithLifecycle()
    val completedNames = definitions.filter { it.countsAsCompleted }.map { it.name }.toSet()
    OrdersListScreen(
        viewModel = viewModel,
        title = "New Orders",
        orders = allOrders.filter { it.status !in completedNames },
        emptyMessage = "No active orders.",
    )
}

@Composable
fun OrderHistoryScreen(viewModel: OrdersViewModel) {
    val allOrders by viewModel.orders.collectAsStateWithLifecycle()
    val definitions by viewModel.orderStatusDefinitions.collectAsStateWithLifecycle()
    val completedNames = definitions.filter { it.countsAsCompleted }.map { it.name }.toSet()
    OrdersListScreen(
        viewModel = viewModel,
        title = "Order History",
        orders = allOrders.filter { it.status in completedNames },
        emptyMessage = "No completed orders yet.",
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrdersListScreen(
    viewModel: OrdersViewModel,
    title: String,
    orders: List<OrderListItemDto>,
    emptyMessage: String,
) {
    val screenState by viewModel.screenState.collectAsStateWithLifecycle()
    val orderDetails by viewModel.orderDetails.collectAsStateWithLifecycle()
    val definitions by viewModel.orderStatusDefinitions.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text(title) }) },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            screenState.errorMessage?.let { message ->
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

            if (screenState.isRefreshing && orders.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            } else if (orders.isEmpty()) {
                Text(
                    text = emptyMessage,
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(orders, key = { it.id }) { order ->
                        OrderCard(
                            order = order,
                            detail = orderDetails[order.id],
                            isUpdating = screenState.updatingOrderId == order.id,
                            statusDefinitions = definitions,
                            onExpand = { viewModel.loadDetail(order.id) },
                            onUpdateStatus = { newStatus, note -> viewModel.updateStatus(order.id, newStatus, note) },
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrderCard(
    order: OrderListItemDto,
    detail: OrderDetailDto?,
    isUpdating: Boolean,
    statusDefinitions: List<OrderStatusDefinitionDto>,
    onExpand: () -> Unit,
    onUpdateStatus: (OrderStatus, String?) -> Unit,
) {
    var expanded by rememberSaveable(order.id) { mutableStateOf(false) }
    var showStatusDialog by rememberSaveable(order.id) { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                expanded = !expanded
                if (expanded) onExpand()
            },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "#${order.orderNumber} · ${order.orderType}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(text = order.status, style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.padding(top = 4.dp))
            Text(
                text = (order.customerName ?: "Walk-in") + " · £" + String.format(Locale.UK, "%.2f", order.totalAmount),
                style = MaterialTheme.typography.bodyMedium,
            )

            if (expanded) {
                Spacer(modifier = Modifier.padding(top = 12.dp))
                if (detail == null) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    detail.items.forEach { item ->
                        Column(modifier = Modifier.padding(bottom = 8.dp)) {
                            Text(
                                text = "${item.quantity}x ${item.nameSnapshot}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            item.modifiers.forEach { modifier ->
                                Text(
                                    text = "  + ${modifier.nameSnapshot}",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            item.specialInstructions?.takeIf { it.isNotBlank() }?.let { instructions ->
                                Text(
                                    text = "  Note: $instructions",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.secondary,
                                )
                            }
                        }
                    }

                    detail.specialRequests?.takeIf { it.isNotBlank() }?.let { requests ->
                        Text(
                            text = "Order note: $requests",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                }

                Button(
                    onClick = { showStatusDialog = true },
                    enabled = !isUpdating,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (isUpdating) "Updating..." else "Update Status")
                }
            }
        }
    }

    if (showStatusDialog) {
        UpdateStatusDialog(
            currentStatus = order.status,
            statusDefinitions = statusDefinitions,
            onDismiss = { showStatusDialog = false },
            onConfirm = { newStatus, note ->
                onUpdateStatus(newStatus, note)
                showStatusDialog = false
            },
        )
    }
}

/** Same shape as the admin dashboard's "Update Order Status" dialog (Orders.tsx) - a dropdown of
 * every configured status plus an optional note, rather than just stepping to the next one, so
 * staff can jump straight to e.g. Cancelled without walking the whole sequence. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UpdateStatusDialog(
    currentStatus: OrderStatus,
    statusDefinitions: List<OrderStatusDefinitionDto>,
    onDismiss: () -> Unit,
    onConfirm: (OrderStatus, String?) -> Unit,
) {
    var selectedStatus by rememberSaveable { mutableStateOf(currentStatus) }
    var note by rememberSaveable { mutableStateOf("") }
    var menuExpanded by rememberSaveable { mutableStateOf(false) }
    val sortedDefinitions = statusDefinitions.sortedBy { it.displayOrder }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Order Status") },
        text = {
            Column {
                ExposedDropdownMenuBox(expanded = menuExpanded, onExpandedChange = { menuExpanded = it }) {
                    OutlinedTextField(
                        value = selectedStatus,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("New Status") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = menuExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    )
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                        modifier = Modifier.exposedDropdownSize(),
                    ) {
                        sortedDefinitions.forEach { definition ->
                            DropdownMenuItem(
                                text = { Text(definition.name) },
                                onClick = { selectedStatus = definition.name; menuExpanded = false },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note (optional)") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                )
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selectedStatus, note.takeIf { it.isNotBlank() }) }) {
                Text("Update Status")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
