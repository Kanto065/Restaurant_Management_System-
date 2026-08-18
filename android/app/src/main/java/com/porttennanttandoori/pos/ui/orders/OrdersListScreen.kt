package com.porttennanttandoori.pos.ui.orders

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.PaymentStatus
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto

/** An order counts as "done" (moves out of New Orders, into History) once it reaches a status
 * flagged CountsAsCompleted, or is Cancelled - the latter has no dedicated boolean on the status
 * definition (see StatusDefinitionSeeder.cs), so it's matched by name like the rest of the admin
 * dashboard does for this one specific status. */
fun isHistoryStatus(status: String, definitions: List<OrderStatusDefinitionDto>): Boolean {
    if (definitions.any { it.name == status && it.countsAsCompleted }) return true
    return status.equals("Cancelled", ignoreCase = true)
}

private fun matchesFilters(order: OrderListItemDto, filters: OrderFilters): Boolean {
    if (filters.status != null && order.status != filters.status) return false
    if (filters.paymentStatus != null && order.paymentStatus != filters.paymentStatus) return false
    val date = order.createdAt.take(10) // "yyyy-MM-dd..." prefix of the ISO timestamp
    if (filters.dateFrom != null && date < filters.dateFrom) return false
    if (filters.dateTo != null && date > filters.dateTo) return false
    return true
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewOrdersScreen(viewModel: OrdersViewModel, onReprint: (String) -> Unit = {}) {
    val allOrders by viewModel.orders.collectAsStateWithLifecycle()
    val definitions by viewModel.orderStatusDefinitions.collectAsStateWithLifecycle()
    val paymentDefinitions by viewModel.paymentStatusDefinitions.collectAsStateWithLifecycle()
    val screenState by viewModel.screenState.collectAsStateWithLifecycle()
    val orderDetails by viewModel.orderDetails.collectAsStateWithLifecycle()

    var searchText by rememberSaveable { mutableStateOf("") }
    var searchExpanded by rememberSaveable { mutableStateOf(false) }
    var filters by rememberSaveable { mutableStateOf(OrderFilters()) }
    var filterSheetOpen by rememberSaveable { mutableStateOf(false) }
    val filterSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val visibleOrders = remember(allOrders, definitions, searchText, filters) {
        allOrders
            .filterNot { isHistoryStatus(it.status, definitions) }
            .filter { matchesFilters(it, filters) }
            .filter { order ->
                searchText.isBlank() ||
                    order.orderNumber.contains(searchText, ignoreCase = true) ||
                    order.customerName?.contains(searchText, ignoreCase = true) == true
            }
    }

    Scaffold(
        topBar = {
            Column {
                OrdersTopBar(
                    title = "New Orders",
                    searchText = searchText,
                    onSearchTextChange = { searchText = it },
                    searchExpanded = searchExpanded,
                    onSearchExpandedChange = { searchExpanded = it },
                    hasActiveFilters = !filters.isEmpty,
                    onOpenFilters = { filterSheetOpen = true },
                )
                ActiveFilterRow(filters = filters, onClear = { filters = OrderFilters() })
            }
        },
    ) { padding ->
        OrdersListBody(
            padding = padding,
            isLoading = screenState.isRefreshing && allOrders.isEmpty(),
            errorMessage = screenState.errorMessage,
            orders = visibleOrders,
            emptyMessage = if (searchText.isBlank() && filters.isEmpty) "No active orders." else "No orders match this search.",
            orderDetails = orderDetails,
            statusDefinitions = definitions,
            paymentStatusDefinitions = paymentDefinitions,
            updatingOrderId = screenState.updatingOrderId,
            onExpand = { viewModel.loadDetail(it) },
            onUpdateStatus = { orderId, status, note -> viewModel.updateStatus(orderId, status, note) },
            onUpdatePaymentStatus = { orderId, status -> viewModel.updatePaymentStatus(orderId, status) },
            onReprint = onReprint,
        )
    }

    if (filterSheetOpen) {
        FilterBottomSheet(
            sheetState = filterSheetState,
            orderStatusDefinitions = definitions.filterNot { it.countsAsCompleted },
            paymentStatusDefinitions = paymentDefinitions,
            filters = filters,
            resultCount = allOrders
                .filterNot { isHistoryStatus(it.status, definitions) }
                .count { matchesFilters(it, filters) },
            onApply = { filters = it },
            onDismiss = { filterSheetOpen = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(viewModel: OrdersViewModel, onReprint: (String) -> Unit = {}) {
    val definitions by viewModel.orderStatusDefinitions.collectAsStateWithLifecycle()
    val paymentDefinitions by viewModel.paymentStatusDefinitions.collectAsStateWithLifecycle()
    val coroutineScope = rememberCoroutineScope()

    var searchText by rememberSaveable { mutableStateOf("") }
    var debouncedSearch by rememberSaveable { mutableStateOf("") }
    var searchExpanded by rememberSaveable { mutableStateOf(false) }
    var filters by rememberSaveable { mutableStateOf(OrderFilters()) }
    var filterSheetOpen by rememberSaveable { mutableStateOf(false) }
    val filterSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var page by rememberSaveable { mutableStateOf(1) }

    val orderDetails by viewModel.orderDetails.collectAsStateWithLifecycle()
    var orders by remember { mutableStateOf<List<OrderListItemDto>>(emptyList()) }
    var totalCount by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var updatingOrderId by remember { mutableStateOf<String?>(null) }
    val pageSize = 25
    val totalPages = maxOf(1, (totalCount + pageSize - 1) / pageSize)

    // Same 350ms debounce as admin-frontend's Orders.tsx.
    LaunchedEffect(searchText) {
        delay(350)
        debouncedSearch = searchText.trim()
    }
    LaunchedEffect(debouncedSearch, filters) { page = 1 }

    suspend fun load() {
        isLoading = true
        errorMessage = null
        viewModel.searchOrders(
            status = filters.status,
            paymentStatus = filters.paymentStatus,
            search = debouncedSearch.ifBlank { null },
            dateFrom = filters.dateFrom,
            dateTo = filters.dateTo,
            page = page,
            pageSize = pageSize,
        ).fold(
            onSuccess = { result -> orders = result.items; totalCount = result.totalCount },
            onFailure = { error -> errorMessage = error.message },
        )
        isLoading = false
    }

    LaunchedEffect(debouncedSearch, filters, page) { load() }

    Scaffold(
        topBar = {
            Column {
                OrdersTopBar(
                    title = "Order History",
                    searchText = searchText,
                    onSearchTextChange = { searchText = it },
                    searchExpanded = searchExpanded,
                    onSearchExpandedChange = { searchExpanded = it },
                    hasActiveFilters = !filters.isEmpty,
                    onOpenFilters = { filterSheetOpen = true },
                )
                ActiveFilterRow(filters = filters, onClear = { filters = OrderFilters() })
            }
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            Column(modifier = Modifier.weight(1f)) {
                OrdersListBody(
                    padding = PaddingValues(0.dp),
                    isLoading = isLoading && orders.isEmpty(),
                    errorMessage = errorMessage,
                    orders = orders,
                    emptyMessage = "No orders found.",
                    orderDetails = orderDetails,
                    statusDefinitions = definitions,
                    paymentStatusDefinitions = paymentDefinitions,
                    updatingOrderId = updatingOrderId,
                    onExpand = { orderId -> viewModel.loadDetail(orderId) },
                    onUpdateStatus = { orderId, status, note ->
                        coroutineScope.launch {
                            updatingOrderId = orderId
                            viewModel.updateStatusAwait(orderId, status, note)
                            updatingOrderId = null
                            load()
                        }
                    },
                    onUpdatePaymentStatus = { orderId, status ->
                        coroutineScope.launch {
                            updatingOrderId = orderId
                            viewModel.updatePaymentStatusAwait(orderId, status)
                            updatingOrderId = null
                            load()
                        }
                    },
                    onReprint = onReprint,
                )
            }
            if (totalCount > pageSize) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(enabled = page > 1, onClick = { page -= 1 }) {
                        Icon(Icons.Outlined.ChevronLeft, contentDescription = "Previous page")
                    }
                    Text(
                        text = "Page $page of $totalPages",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(horizontal = 12.dp),
                    )
                    IconButton(enabled = page < totalPages, onClick = { page += 1 }) {
                        Icon(Icons.Outlined.ChevronRight, contentDescription = "Next page")
                    }
                }
            }
        }
    }

    if (filterSheetOpen) {
        FilterBottomSheet(
            sheetState = filterSheetState,
            orderStatusDefinitions = definitions,
            paymentStatusDefinitions = paymentDefinitions,
            filters = filters,
            resultCount = totalCount,
            onApply = { filters = it },
            onDismiss = { filterSheetOpen = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OrdersTopBar(
    title: String,
    searchText: String,
    onSearchTextChange: (String) -> Unit,
    searchExpanded: Boolean,
    onSearchExpandedChange: (Boolean) -> Unit,
    hasActiveFilters: Boolean,
    onOpenFilters: () -> Unit,
) {
    TopAppBar(
        title = {
            if (searchExpanded) {
                TextField(
                    value = searchText,
                    onValueChange = onSearchTextChange,
                    placeholder = { Text("Search order # or name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                Text(title)
            }
        },
        actions = {
            if (searchExpanded) {
                IconButton(onClick = { onSearchExpandedChange(false); onSearchTextChange("") }) {
                    Icon(Icons.Outlined.Close, contentDescription = "Close search")
                }
            } else {
                IconButton(onClick = { onSearchExpandedChange(true) }) {
                    Icon(Icons.Outlined.Search, contentDescription = "Search")
                }
            }
            IconButton(onClick = onOpenFilters) {
                Icon(
                    Icons.Outlined.FilterList,
                    contentDescription = "Filter orders",
                    tint = if (hasActiveFilters) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                )
            }
        },
    )
}

@Composable
private fun OrdersListBody(
    padding: PaddingValues,
    isLoading: Boolean,
    errorMessage: String?,
    orders: List<OrderListItemDto>,
    emptyMessage: String,
    orderDetails: Map<String, OrderDetailDto>,
    statusDefinitions: List<OrderStatusDefinitionDto>,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    updatingOrderId: String?,
    onExpand: (String) -> Unit,
    onUpdateStatus: (String, OrderStatus, String?) -> Unit,
    onUpdatePaymentStatus: (String, PaymentStatus) -> Unit,
    onReprint: (String) -> Unit,
) {
    Column(modifier = Modifier.padding(padding)) {
        errorMessage?.let { message ->
            Text(
                text = message,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }

        if (isLoading) {
            Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
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
                        isUpdating = updatingOrderId == order.id,
                        statusDefinitions = statusDefinitions,
                        paymentStatusDefinitions = paymentStatusDefinitions,
                        onExpand = { onExpand(order.id) },
                        onUpdateStatus = { newStatus, note -> onUpdateStatus(order.id, newStatus, note) },
                        onUpdatePaymentStatus = { newStatus -> onUpdatePaymentStatus(order.id, newStatus) },
                        onReprint = { onReprint(order.id) },
                    )
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
    statusDefinitions: List<OrderStatusDefinitionDto>,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    onExpand: () -> Unit,
    onUpdateStatus: (OrderStatus, String?) -> Unit,
    onUpdatePaymentStatus: (PaymentStatus) -> Unit,
    onReprint: () -> Unit,
) {
    var expanded by rememberSaveable(order.id) { mutableStateOf(false) }
    var showStatusDialog by rememberSaveable(order.id) { mutableStateOf(false) }
    var showPaymentDialog by rememberSaveable(order.id) { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                expanded = !expanded
                if (expanded) onExpand()
            },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "#${order.orderNumber} · ${order.orderType}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.padding(top = 4.dp))
            Text(
                text = (order.customerName ?: "Walk-in") + " · £" + String.format(Locale.UK, "%.2f", order.totalAmount),
                style = MaterialTheme.typography.bodyMedium,
            )

            Spacer(modifier = Modifier.padding(top = 12.dp))
            OrderStatusChanger(
                currentStatus = order.status,
                statusDefinitions = statusDefinitions,
                isUpdating = isUpdating,
                onQuickChange = { newStatus -> onUpdateStatus(newStatus, null) },
                onOpenNoteDialog = { showStatusDialog = true },
            )

            Spacer(modifier = Modifier.padding(top = 8.dp))
            PaymentStatusChanger(
                currentStatus = order.paymentStatus,
                paymentStatusDefinitions = paymentStatusDefinitions,
                isUpdating = isUpdating,
                onQuickChange = onUpdatePaymentStatus,
                onOpenNoteDialog = { showPaymentDialog = true },
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

                    TextButton(onClick = onReprint, modifier = Modifier.fillMaxWidth()) {
                        Text("Reprint receipt")
                    }
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

    if (showPaymentDialog) {
        UpdatePaymentStatusDialog(
            currentStatus = order.paymentStatus,
            paymentStatusDefinitions = paymentStatusDefinitions,
            onDismiss = { showPaymentDialog = false },
            onConfirm = { newStatus ->
                onUpdatePaymentStatus(newStatus)
                showPaymentDialog = false
            },
        )
    }
}

/** Same shape as the admin dashboard's "Update Order Status" dialog (Orders.tsx) - a dropdown of
 * every configured status plus an optional note. Reached via OrderStatusChanger's "..." overflow,
 * mirroring admin's "Jump to Status (with note)" menu item. */
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

/** Payment-status counterpart to UpdateStatusDialog - no note field, since
 * Admin/OrdersController.UpdatePaymentStatusRequest doesn't carry one. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UpdatePaymentStatusDialog(
    currentStatus: PaymentStatus,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    onDismiss: () -> Unit,
    onConfirm: (PaymentStatus) -> Unit,
) {
    var selectedStatus by rememberSaveable { mutableStateOf(currentStatus) }
    var menuExpanded by rememberSaveable { mutableStateOf(false) }
    val sortedDefinitions = paymentStatusDefinitions.sortedBy { it.displayOrder }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Payment Status") },
        text = {
            ExposedDropdownMenuBox(expanded = menuExpanded, onExpandedChange = { menuExpanded = it }) {
                OutlinedTextField(
                    value = selectedStatus,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("New Payment Status") },
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
        },
        confirmButton = {
            Button(onClick = { onConfirm(selectedStatus) }) { Text("Update Payment Status") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
