package com.porttennanttandoori.pos.ui.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto
import com.porttennanttandoori.pos.data.repository.OrdersRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OrdersScreenState(
    val isRefreshing: Boolean = false,
    val errorMessage: String? = null,
    val updatingOrderId: String? = null,
)

/** The order list itself comes straight from OrdersRepository.orders, which OrderListenerService
 * keeps current via SSE - this view model only drives the pull-to-refresh gesture and status
 * update actions the user taps. */
class OrdersViewModel(private val repository: OrdersRepository) : ViewModel() {

    val orders = repository.orders
    val orderStatusDefinitions = repository.orderStatusDefinitions

    private val _screenState = MutableStateFlow(OrdersScreenState())
    val screenState: StateFlow<OrdersScreenState> = _screenState.asStateFlow()

    // Detail (items/modifiers/instructions) is fetched lazily per order as cards are expanded,
    // rather than upfront for the whole list - OrderListItemDto doesn't carry items at all.
    private val _orderDetails = MutableStateFlow<Map<String, OrderDetailDto>>(emptyMap())
    val orderDetails: StateFlow<Map<String, OrderDetailDto>> = _orderDetails.asStateFlow()

    init {
        refresh()
        viewModelScope.launch { repository.loadStatusDefinitions() }
    }

    fun loadDetail(orderId: String) {
        if (_orderDetails.value.containsKey(orderId)) return
        viewModelScope.launch {
            repository.getOrder(orderId).onSuccess { detail ->
                _orderDetails.value = _orderDetails.value + (orderId to detail)
            }
        }
    }

    fun refresh() {
        _screenState.value = _screenState.value.copy(isRefreshing = true, errorMessage = null)
        viewModelScope.launch {
            val result = repository.refresh()
            _screenState.value = _screenState.value.copy(
                isRefreshing = false,
                errorMessage = result.exceptionOrNull()?.message,
            )
        }
    }

    fun updateStatus(orderId: String, newStatus: OrderStatus, note: String? = null) {
        _screenState.value = _screenState.value.copy(updatingOrderId = orderId, errorMessage = null)
        viewModelScope.launch {
            val result = repository.updateStatus(orderId, newStatus, note)
            result.onSuccess { detail -> _orderDetails.value = _orderDetails.value + (orderId to detail) }
            _screenState.value = _screenState.value.copy(
                updatingOrderId = null,
                errorMessage = result.exceptionOrNull()?.message,
            )
        }
    }

    class Factory(private val repository: OrdersRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return OrdersViewModel(repository) as T
        }
    }
}
