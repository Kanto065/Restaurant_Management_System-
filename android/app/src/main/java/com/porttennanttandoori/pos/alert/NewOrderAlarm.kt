package com.porttennanttandoori.pos.alert

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import com.porttennanttandoori.pos.data.local.AlarmMode

/** Loops the device's default notification sound while at least one order is sitting unconfirmed
 * (OrdersRepository.ordersAwaitingConfirmation is non-empty) - started/stopped by
 * OrderListenerService as that flow changes, so it rings even with the app backgrounded. Uses the
 * system notification tone rather than a bundled asset so it needs zero extra files and still
 * respects whatever the terminal's notification volume/sound is set to.
 *
 * [volume] (0-100, from SettingsStore) and [mode] control how it behaves once started: UNTIL_
 * CONFIRMED rings until stop() is called (an order gets confirmed/cancelled), TEN_SECONDS/
 * THIRTY_SECONDS auto-stop themselves after that many seconds even if the order is still pending
 * (screen alert only after that), and OFF never starts audio at all. */
class NewOrderAlarm(private val context: Context) {

    private var player: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private val autoStop = Runnable { stop() }

    fun start(volume: Int = 80, mode: AlarmMode = AlarmMode.UNTIL_CONFIRMED) {
        if (mode == AlarmMode.OFF) return
        if (player != null) return
        val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getValidRingtoneUri(context)
            ?: return
        val level = volume.coerceIn(0, 100) / 100f
        player = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            isLooping = true
            setVolume(level, level)
            runCatching {
                setDataSource(context, uri)
                prepare()
                start()
            }
        }
        val autoStopSeconds = when (mode) {
            AlarmMode.TEN_SECONDS -> 10L
            AlarmMode.THIRTY_SECONDS -> 30L
            else -> null
        }
        autoStopSeconds?.let { seconds -> handler.postDelayed(autoStop, seconds * 1000) }
    }

    fun stop() {
        handler.removeCallbacks(autoStop)
        player?.runCatching { stop(); release() }
        player = null
    }
}
