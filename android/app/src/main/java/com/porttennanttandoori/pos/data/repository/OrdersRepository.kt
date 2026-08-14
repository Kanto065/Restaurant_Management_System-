package com.porttennanttandoori.pos.data.repository

import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderEvent
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.UpdateOrderStatusRequest
import com.porttennanttandoori.pos.data.network.ApiService
import com.porttennanttandoori.pos.data.network.OrderEventsClient
import java.io.IOException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Holds the terminal's working set of orders in memory, kept current by a REST refresh plus
 * whatever OrderListenerService feeds it from the SSE stream. No local Room cache yet - orders
 * are re-fetched from the API on cold start, which is fine as long as the terminal has network. */
class OrdersRepository(
    private val apiService: ApiService,
    private val eventsClient: OrderEventsClient,
) {
    private val _orders = MutableStateFlow<List<OrderListItemDto>>(emptyList())
    val orders: StateFlow<List<OrderListItemDto>> = _orders.asStateFlow()

    // Statuses are per-restaurant and admin-configurable (Admin/StatusDefinitionsController),
    // not a fixed enum - fetched once and kept ordered by DisplayOrder so nextStatus() can walk
    // the same sequence the admin Configurations page and web Orders stepper use.
    private val _orderStatusDefinitions = MutableStateFlow<List<OrderStatusDefinitionDto>>(emptyList())
    val orderStatusDefinitions: StateFlow<List<OrderStatusDefinitionDto>> = _orderStatusDefinitions.asStateFlow()

    private val _paymentStatusDefinitions = MutableStateFlow<List<PaymentStatusDefinitionDto>>(emptyList())
    val paymentStatusDefinitions: StateFlow<List<PaymentStatusDefinitionDto>> = _paymentStatusDefinitions.asStateFlow()

    fun eventStream() = eventsClient.stream()

    suspend fun loadStatusDefinitions() {
        try {
            val orderStatusesResponse = apiService.listOrderStatusDefinitions()
            if (orderStatusesResponse.isSuccessful) {
                _orderStatusDefinitions.value = orderStatusesResponse.body()?.data.orEmpty()
            }
            val paymentStatusesResponse = apiService.listPaymentStatusDefinitions()
            if (paymentStatusesResponse.isSuccessful) {
                _paymentStatusDefinitions.value = paymentStatusesResponse.body()?.data.orEmpty()
            }
        } catch (e: IOException) {
            // Non-fatal: the status stepper just won't offer a "next" action until this succeeds
            // on a later refresh; the order list itself doesn't depend on these.
        } catch (e: kotlinx.serialization.SerializationException) {
            // Same as above - a response-shape mismatch here shouldn't crash the terminal.
        }
    }

    /** Next status in DisplayOrder sequence after [current], or null if [current] is unrecognized
     * or already last. Mirrors the admin web Configurations ordering - there's no fixed
     * "Cancelled" concept anymore, so whatever the restaurant orders last is the terminal state. */
    fun nextStatus(current: OrderStatus): OrderStatus? {
        val sorted = _orderStatusDefinitions.value.sortedBy { it.displayOrder }
        val index = sorted.indexOfFirst { it.name == current }
        if (index == -1 || index >= sorted.size - 1) return null
        return sorted[index + 1].name
    }

    suspend fun refresh(): Result<Unit> {
        return try {
            val response = apiService.listOrders()
            if (response.isSuccessful) {
                _orders.value = response.body()?.data?.items.orEmpty()
                Result.success(Unit)
            } else {
                Result.failure(IOException("Failed to load orders (${response.code()})."))
            }
        } catch (e: IOException) {
            Result.failure(e)
        } catch (e: kotlinx.serialization.SerializationException) {
            Result.failure(e)
        }
    }

    suspend fun getOrder(orderId: String): Result<OrderDetailDto> {
        return try {
            val response = apiService.getOrder(orderId)
            val detail = response.body()?.data
            if (response.isSuccessful && detail != null) {
                Result.success(detail)
            } else {
                Result.failure(IOException("Failed to load order (${response.code()})."))
            }
        } catch (e: IOException) {
            Result.failure(e)
        } catch (e: kotlinx.serialization.SerializationException) {
            Result.failure(e)
        }
    }

    suspend fun updateStatus(orderId: String, status: OrderStatus): Result<OrderDetailDto> {
        return try {
            val response = apiService.updateOrderStatus(orderId, UpdateOrderStatusRequest(status))
            val detail = response.body()?.data
            if (response.isSuccessful && detail != null) {
                applyStatusLocally(orderId, status)
                Result.success(detail)
            } else {
                Result.failure(IOException("Failed to update order status (${response.code()})."))
            }
        } catch (e: IOException) {
            Result.failure(e)
        } catch (e: kotlinx.serialization.SerializationException) {
            Result.failure(e)
        }
    }

    /** Called from OrderListenerService when an SSE event arrives, so the list updates without
     * waiting for the next full refresh(). */
    suspend fun onEvent(event: OrderEvent) {
        when (event) {
            is OrderEvent.OrderCreated -> refresh()
            is OrderEvent.OrderStatusChanged -> applyStatusLocally(event.orderId, event.status)
            is OrderEvent.PaymentReceived -> refresh()
        }
    }

    private fun applyStatusLocally(orderId: String, status: OrderStatus) {
        _orders.value = _orders.value.map { if (it.id == orderId) it.copy(status = status) else it }
    }
}
