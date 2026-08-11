package com.porttennanttandoori.pos.data.model

import kotlinx.serialization.Serializable

/** The envelope EventsController writes for every SSE message: {"event":"OrderCreated",
 * "data":{...}}. There's no SSE `event:` line - the event name lives inside the JSON `data:`
 * payload instead (see OrderNotifier.SendAndPersist), so we parse this ourselves rather than
 * relying on OkHttp's EventSourceListener `type` parameter. */
@Serializable
data class OrderEventEnvelope(
    val event: String,
    val data: OrderEventPayload,
)

@Serializable
data class OrderEventPayload(
    val orderId: String,
    val status: OrderStatus? = null,
)

sealed class OrderEvent {
    data class OrderCreated(val orderId: String) : OrderEvent()
    data class OrderStatusChanged(val orderId: String, val status: OrderStatus) : OrderEvent()
    data class PaymentReceived(val orderId: String) : OrderEvent()
}
