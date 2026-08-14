package com.porttennanttandoori.pos.data.model

import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.serialization.Serializable

// Mirrors Domain.Enums.Enums.cs exactly - kotlinx.serialization encodes/decodes enums by
// constant name, and the backend writes enums as strings (JsonStringEnumConverter in Program.cs).
@Serializable
enum class OrderType { DineIn, Collection, Delivery }

@Serializable
enum class PaymentMethod { Card, Cash, ApplePay, GooglePay }

// Order/payment status are no longer fixed enums on the backend - they're per-restaurant,
// admin-configurable rows (Admin/StatusDefinitionsController). The terminal fetches the current
// ordered list via OrderStatusDefinitionDto/PaymentStatusDefinitionDto and treats the values
// themselves as opaque strings.
typealias OrderStatus = String
typealias PaymentStatus = String

/** Matches Admin/StatusDefinitionsController.OrderStatusDefinitionDto. */
@Serializable
data class OrderStatusDefinitionDto(
    val id: String,
    val name: String,
    val displayOrder: Int,
    val countsAsPending: Boolean,
    val countsAsCompleted: Boolean,
    val isDefault: Boolean,
)

/** Matches Admin/StatusDefinitionsController.PaymentStatusDefinitionDto. */
@Serializable
data class PaymentStatusDefinitionDto(
    val id: String,
    val name: String,
    val displayOrder: Int,
    val isDefault: Boolean,
)

/** Matches Admin/OrdersController.OrderListItemDto. */
@Serializable
data class OrderListItemDto(
    val id: String,
    val orderNumber: Long,
    val orderType: OrderType,
    val status: OrderStatus,
    val paymentStatus: PaymentStatus,
    val paymentMethod: PaymentMethod,
    val totalAmount: Double,
    val customerName: String?,
    val createdAt: String,
) {
    val createdAtInstant: Instant get() = OffsetDateTime.parse(createdAt).toInstant()
}

@Serializable
data class OrderItemModifierDto(
    val id: String,
    val nameSnapshot: String,
    val priceDeltaSnapshot: Double,
)

/** Matches Admin/OrdersController.OrderItemDto. */
@Serializable
data class OrderItemDto(
    val id: String,
    val nameSnapshot: String,
    val unitPriceSnapshot: Double,
    val quantity: Int,
    val specialInstructions: String?,
    val lineTotal: Double,
    val modifiers: List<OrderItemModifierDto>,
)

@Serializable
data class OrderStatusHistoryDto(
    val status: OrderStatus,
    val note: String?,
    val timestamp: String,
)

/** Matches Admin/OrdersController.OrderDetailDto. */
@Serializable
data class OrderDetailDto(
    val id: String,
    val orderNumber: Long,
    val orderType: OrderType,
    val status: OrderStatus,
    val paymentStatus: PaymentStatus,
    val paymentMethod: PaymentMethod,
    val subtotal: Double,
    val deliveryFee: Double,
    val processingFee: Double,
    val discountAmount: Double,
    val totalAmount: Double,
    val customerName: String?,
    val customerPhone: String?,
    val customerEmail: String?,
    val specialRequests: String?,
    val estimatedReadyAt: String?,
    val createdAt: String,
    val items: List<OrderItemDto>,
    val statusHistory: List<OrderStatusHistoryDto>,
)

@Serializable
data class UpdateOrderStatusRequest(
    val status: OrderStatus,
    val note: String? = null,
)
