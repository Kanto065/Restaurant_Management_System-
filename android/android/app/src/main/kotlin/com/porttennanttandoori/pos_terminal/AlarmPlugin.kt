package com.porttennanttandoori.pos_terminal

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Backs the Dart-side NewOrderAlarmController's "com.porttennanttandoori.pos/alarm" channel (see
 * new_order_alarm.dart) by looping the device's default notification sound - ported from the
 * archived native Kotlin app's NewOrderAlarm (archive/kotlin-pos branch). Uses the system
 * notification tone rather than a bundled asset so it needs zero extra files and still respects
 * whatever the terminal's notification volume/sound is set to.
 *
 * Start/stop timing (auto-stop after N seconds, re-arming per unconfirmed order) stays owned by
 * the Dart side; this plugin only ever does two things: start looping at a volume, and stop.
 */
class AlarmPlugin(private val context: Context) : MethodChannel.MethodCallHandler {

    private var player: MediaPlayer? = null

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "start" -> {
                val volume = (call.argument<Int>("volume") ?: 80).coerceIn(0, 100)
                start(volume)
                result.success(null)
            }
            "stop" -> {
                stop()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun start(volume: Int) {
        if (player != null) return
        val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getValidRingtoneUri(context)
            ?: return
        val level = volume / 100f
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
    }

    fun stop() {
        player?.runCatching { stop(); release() }
        player = null
    }
}
