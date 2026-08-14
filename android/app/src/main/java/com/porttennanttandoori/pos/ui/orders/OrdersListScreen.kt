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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrdersListScreen(viewModel: OrdersViewModel, restaurantName: String) {
    val orders by viewModel.orders.collectAsStateWithLifecycle()
    val screenState by viewModel.screenState.collectAsStateWithLifecycle()
    val orderDetails by viewModel.orderDetails.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(restaurantName) })
        },
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
                    text = "No orders yet.",
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
                            onExpand = { viewModel.loadDetail(order.id) },
                            onAdvanceStatus = { newStatus -> viewModel.advanceStatus(order.id, newStatus) },
                            nextStatusFor = { current -> viewModel.nextStatus(current) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderCard(
    order: OrderListItemDto,
    detail: OrderDetailDto?,
    isUpdating: Boolean,
    onExpand: () -> Unit,
    onAdvanceStatus: (OrderStatus) -> Unit,
    nextStatusFor: (OrderStatus) -> OrderStatus?,
) {
    var expanded by rememberSaveable(order.id) { mutableStateOf(false) }

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

                nextStatusFor(order.status)?.let { next ->
                    Button(
                        onClick = { onAdvanceStatus(next) },
                        enabled = !isUpdating,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (isUpdating) "Updating..." else "Mark as $next")
                    }
                }
            }
        }
    }
}
