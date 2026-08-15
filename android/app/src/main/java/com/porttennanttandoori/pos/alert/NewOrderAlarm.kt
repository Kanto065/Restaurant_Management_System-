package com.porttennanttandoori.pos.alert

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager

/** Loops the device's default notification sound while at least one order is sitting unconfirmed
 * (OrdersRepository.ordersAwaitingConfirmation is non-empty) - started/stopped by
 * OrderListenerService as that flow changes, so it rings even with the app backgrounded. Uses the
 * system notification tone rather than a bundled asset so it needs zero extra files and still
 * respects whatever the terminal's notification volume/sound is set to. */
class NewOrderAlarm(private val context: Context) {

    private var player: MediaPlayer? = null

    fun start() {
        if (player != null) return
        val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getValidRingtoneUri(context)
            ?: return
        player = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            isLooping = true
            runCatching {
                setDataSource(context, uri)
                prepare()
                start()
            }
        }
    }

    fun stop() {
        player?.runCatching { stop(); release() }
        player = null
    }
}
