package com.porttennanttandoori.pos.data.network

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.porttennanttandoori.pos.MainActivity
import com.porttennanttandoori.pos.PosApplication
import com.porttennanttandoori.pos.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Keeps the SSE connection to api/events/orders alive while the terminal is in use, so new
 * orders and status changes show up without polling. Runs as a foreground service because a POS
 * terminal is expected to keep receiving orders even if the screen is off or another app is in
 * front - Android would otherwise kill the socket in the background. */
class OrderListenerService : Service() {

    private val job = Job()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val app = application as PosApplication
        scope.launch { app.ordersRepository.refresh() }
        scope.launch { listenWithReconnect(app) }
        return START_STICKY
    }

    private suspend fun listenWithReconnect(app: PosApplication) {
        var backoffMillis = INITIAL_BACKOFF_MS
        while (scope.isActive) {
            try {
                app.ordersRepository.eventStream().collect { event ->
                    backoffMillis = INITIAL_BACKOFF_MS
                    app.ordersRepository.onEvent(event)
                }
            } catch (e: Exception) {
                // Connection dropped or failed - back off and retry rather than spinning.
            }
            delay(backoffMillis)
            backoffMillis = (backoffMillis * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        job.cancel()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Order updates", NotificationManager.IMPORTANCE_LOW),
            )
        }

        val openApp = android.app.PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            android.app.PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Listening for orders")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(openApp)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "order_listener"
        private const val NOTIFICATION_ID = 1
        private const val INITIAL_BACKOFF_MS = 2_000L
        private const val MAX_BACKOFF_MS = 30_000L
    }
}
