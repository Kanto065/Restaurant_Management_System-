package com.porttennanttandoori.pos_terminal

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlin.math.min
import kotlin.math.sin

/**
 * Backs the Dart-side NewOrderAlarmController's "com.porttennanttandoori.pos/alarm" channel (see
 * new_order_alarm.dart). Two families of tone, selected in Settings (see AlarmTone in
 * settings_store.dart):
 *  - "system" loops the device's default notification sound via MediaPlayer - ported from the
 *    archived native Kotlin app's NewOrderAlarm (archive/kotlin-pos branch), and the only tone
 *    that existed before this file.
 *  - siren/bell/chime are short PCM waveforms synthesized on-device by ToneSynth and looped via
 *    AudioTrack's native loop points - no bundled audio assets needed for any of them.
 *
 * Start/stop timing (auto-stop after N seconds, re-arming per unconfirmed order) stays owned by
 * the Dart side; this plugin only ever starts looping at a tone+volume, stops, or plays a short
 * one-shot preview for Settings' "Preview alarm" button.
 */
class AlarmPlugin(private val context: Context) : MethodChannel.MethodCallHandler {

    private var mediaPlayer: MediaPlayer? = null
    private var audioTrack: AudioTrack? = null
    private var previewMediaPlayer: MediaPlayer? = null
    private var previewTrack: AudioTrack? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "start" -> {
                val volume = (call.argument<Int>("volume") ?: 80).coerceIn(0, 100)
                val tone = call.argument<String>("tone") ?: "system"
                start(tone, volume)
                result.success(null)
            }
            "stop" -> {
                stop()
                result.success(null)
            }
            "preview" -> {
                val volume = (call.argument<Int>("volume") ?: 80).coerceIn(0, 100)
                val tone = call.argument<String>("tone") ?: "system"
                preview(tone, volume)
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun start(tone: String, volume: Int) {
        stop()
        if (tone == "system") {
            mediaPlayer = buildSystemPlayer(volume, looping = true)
        } else {
            audioTrack = ToneSynth.buildTrack(tone, volume, looping = true)?.also { it.play() }
        }
    }

    private fun preview(tone: String, volume: Int) {
        stopPreview()
        if (tone == "system") {
            val player = buildSystemPlayer(volume, looping = false) ?: return
            previewMediaPlayer = player
            player.setOnCompletionListener { stopPreview() }
            // Belt-and-braces auto-stop in case a device's notification sound is itself set to
            // loop, or completion never fires for some OEM MediaPlayer quirk.
            mainHandler.postDelayed({ stopPreview() }, 4_000)
        } else {
            val track = ToneSynth.buildTrack(tone, volume, looping = false) ?: return
            previewTrack = track
            track.play()
            mainHandler.postDelayed({ stopPreview() }, ToneSynth.durationMs(tone) + 200)
        }
    }

    private fun buildSystemPlayer(volume: Int, looping: Boolean): MediaPlayer? {
        val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
            ?: RingtoneManager.getValidRingtoneUri(context)
            ?: return null
        val level = volume / 100f
        return MediaPlayer().apply {
            // USAGE_ALARM, not USAGE_NOTIFICATION_EVENT: the notification stream is capped by
            // the device's notification volume (and silenced by some Do Not Disturb configs),
            // which is exactly why the alarm was too quiet on a busy counter before this - see
            // FLUTTER_PROMPT.md's "Non-negotiables". The alarm stream plays at full gain and
            // isn't subject to that cap.
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            isLooping = looping
            setVolume(level, level)
            runCatching {
                setDataSource(context, uri)
                prepare()
                start()
            }
        }
    }

    private fun stopPreview() {
        previewMediaPlayer?.runCatching { stop(); release() }
        previewMediaPlayer = null
        previewTrack?.runCatching { stop(); release() }
        previewTrack = null
    }

    fun stop() {
        mediaPlayer?.runCatching { stop(); release() }
        mediaPlayer = null
        audioTrack?.runCatching { stop(); release() }
        audioTrack = null
        stopPreview()
    }
}

/**
 * Synthesizes short looping PCM waveforms for the siren/bell/chime alarm tones, so they need zero
 * bundled audio assets. Each buffer is exactly one loop cycle; AudioTrack's native loop points
 * (MODE_STATIC) repeat it at the driver level with no Kotlin-side involvement once playback
 * starts - the same reason "system" gets away with a single MediaPlayer.isLooping flag.
 */
private object ToneSynth {
    private const val SAMPLE_RATE = 44100

    private fun durationS(tone: String) = when (tone) {
        "siren" -> 1.0
        "bell" -> 1.0
        "chime" -> 1.2
        else -> 1.0
    }

    fun durationMs(tone: String): Long = (durationS(tone) * 1000).toLong()

    fun buildTrack(tone: String, volume: Int, looping: Boolean): AudioTrack? {
        val samples = when (tone) {
            "siren" -> siren()
            "bell" -> bell()
            "chime" -> chime()
            else -> chime()
        }
        val track = runCatching {
            AudioTrack.Builder()
                .setAudioAttributes(
                    // USAGE_ALARM - see the comment in buildSystemPlayer above.
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                )
                .setBufferSizeInBytes(samples.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
        }.getOrNull() ?: return null
        track.write(samples, 0, samples.size)
        if (looping) track.setLoopPoints(0, samples.size, -1)
        track.setVolume(volume.coerceIn(0, 100) / 100f)
        return track
    }

    private fun envelope(i: Int, n: Int, fadeSamples: Int): Double {
        val fade = min(fadeSamples, n / 2)
        return when {
            fade <= 0 -> 1.0
            i < fade -> i / fade.toDouble()
            i > n - fade -> (n - i) / fade.toDouble()
            else -> 1.0
        }
    }

    /** Warbling up/down sweep, ~1s per cycle - a loud siren cutting through kitchen noise. */
    private fun siren(): ShortArray {
        val n = (SAMPLE_RATE * durationS("siren")).toInt()
        val out = ShortArray(n)
        var phase = 0.0
        for (i in 0 until n) {
            val t = i.toDouble() / n
            val freq = if (t < 0.5) 650 + (1300 - 650) * (t / 0.5) else 1300 - (1300 - 650) * ((t - 0.5) / 0.5)
            phase += 2 * Math.PI * freq / SAMPLE_RATE
            val env = envelope(i, n, (SAMPLE_RATE * 0.02).toInt())
            out[i] = (sin(phase) * Short.MAX_VALUE * 0.9 * env).toInt().toShort()
        }
        return out
    }

    /** Two short sharp beeps then silence - a counter-bell double chime, ~1s loop. */
    private fun bell(): ShortArray {
        val n = (SAMPLE_RATE * durationS("bell")).toInt()
        val out = ShortArray(n)
        val beepLen = (SAMPLE_RATE * 0.09).toInt()
        val gap = (SAMPLE_RATE * 0.08).toInt()
        fun writeBeep(start: Int) {
            for (i in 0 until beepLen) {
                val idx = start + i
                if (idx >= n) break
                val env = envelope(i, beepLen, (SAMPLE_RATE * 0.01).toInt())
                out[idx] = (sin(2 * Math.PI * 1568.0 * i / SAMPLE_RATE) * Short.MAX_VALUE * 0.9 * env).toInt().toShort()
            }
        }
        writeBeep(0)
        writeBeep(beepLen + gap)
        return out
    }

    /** Two-note rising chime, softer than the bell - ~1.2s loop. */
    private fun chime(): ShortArray {
        val n = (SAMPLE_RATE * durationS("chime")).toInt()
        val out = ShortArray(n)
        val noteLen = (SAMPLE_RATE * 0.35).toInt()
        fun writeNote(start: Int, freq: Double) {
            for (i in 0 until noteLen) {
                val idx = start + i
                if (idx >= n) break
                val env = envelope(i, noteLen, (SAMPLE_RATE * 0.05).toInt())
                out[idx] = (sin(2 * Math.PI * freq * i / SAMPLE_RATE) * Short.MAX_VALUE * 0.55 * env).toInt().toShort()
            }
        }
        writeNote(0, 880.0)
        writeNote(noteLen + (SAMPLE_RATE * 0.05).toInt(), 1318.5)
        return out
    }
}
