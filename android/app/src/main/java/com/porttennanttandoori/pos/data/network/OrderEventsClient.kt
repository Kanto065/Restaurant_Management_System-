package com.porttennanttandoori.pos.data.network

import com.porttennanttandoori.pos.BuildConfig
import com.porttennanttandoori.pos.data.model.OrderEvent
import com.porttennanttandoori.pos.data.model.OrderEventEnvelope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

/** Reads api/events/orders. The server sends every message as a bare `data:` line (no `event:`
 * line - see EventsController), so the event name is parsed out of the JSON body rather than
 * out of OkHttp's `type` callback parameter. OkHttp's SSE client doesn't auto-reconnect the way
 * a browser EventSource does, so reconnection is the caller's job (see OrderListenerService). */
class OrderEventsClient(
    private val okHttpClient: OkHttpClient,
    private val json: Json,
) {
    fun stream(): Flow<OrderEvent> = callbackFlow {
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL}/api/events/orders")
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                val event = parseEvent(data) ?: return
                trySend(event)
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                close(t ?: IllegalStateException("SSE connection failed: ${response?.code}"))
            }

            override fun onClosed(eventSource: EventSource) {
                close()
            }
        }

        val eventSource = EventSources.createFactory(okHttpClient).newEventSource(request, listener)
        awaitClose { eventSource.cancel() }
    }

    private fun parseEvent(data: String): OrderEvent? {
        val envelope = try {
            json.decodeFromString(OrderEventEnvelope.serializer(), data)
        } catch (e: Exception) {
            return null
        }

        return when (envelope.event) {
            "OrderCreated" -> OrderEvent.OrderCreated(envelope.data.orderId)
            "OrderStatusChanged" -> envelope.data.status?.let {
                OrderEvent.OrderStatusChanged(envelope.data.orderId, it)
            }
            "PaymentReceived" -> OrderEvent.PaymentReceived(envelope.data.orderId)
            else -> null
        }
    }
}
