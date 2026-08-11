package com.porttennanttandoori.pos.data.repository

import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderEvent
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.OrderStatus
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

    fun eventStream() = eventsClient.stream()

    suspend fun refresh(): Result<Unit> {
        return try {
            val response = apiService.listOrders()
            if (response.isSuccessful) {
                _orders.value = response.body()?.data.orEmpty()
                Result.success(Unit)
            } else {
                Result.failure(IOException("Failed to load orders (${response.code()})."))
            }
        } catch (e: IOException) {
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
