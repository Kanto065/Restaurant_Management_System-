package com.porttennanttandoori.pos.data.local

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "pos_settings")

enum class AlarmMode { UNTIL_CONFIRMED, TEN_SECONDS, THIRTY_SECONDS, OFF }

data class TerminalSettings(
    val darkTheme: Boolean = true,
    val printerId: String = PRINTER_SUNMI,
    val copiesPerOrder: Int = 1,
    val alarmVolume: Int = 80,
    val alarmMode: AlarmMode = AlarmMode.UNTIL_CONFIRMED,
) {
    companion object {
        const val PRINTER_SUNMI = "sunmi"
        const val PRINTER_STAR = "star"
        const val PRINTER_EPSON = "epson"
    }
}

/** Persists the terminal-local preferences from the redesigned Settings screen (theme, printer
 * choice, copies per order, new-order alarm volume/duration) - separate DataStore from
 * TokenStore.kt's pairing/session data since these are device preferences, not credentials, and
 * have no reason to be cleared on sign-out. */
class SettingsStore(private val context: Context) {

    private object Keys {
        val DARK_THEME = booleanPreferencesKey("dark_theme")
        val PRINTER_ID = stringPreferencesKey("printer_id")
        val COPIES_PER_ORDER = intPreferencesKey("copies_per_order")
        val ALARM_VOLUME = intPreferencesKey("alarm_volume")
        val ALARM_MODE = stringPreferencesKey("alarm_mode")
    }

    val settings: Flow<TerminalSettings> = context.settingsDataStore.data.map { prefs ->
        TerminalSettings(
            darkTheme = prefs[Keys.DARK_THEME] ?: true,
            printerId = prefs[Keys.PRINTER_ID] ?: TerminalSettings.PRINTER_SUNMI,
            copiesPerOrder = prefs[Keys.COPIES_PER_ORDER] ?: 1,
            alarmVolume = prefs[Keys.ALARM_VOLUME] ?: 80,
            alarmMode = prefs[Keys.ALARM_MODE]?.let { name -> runCatching { AlarmMode.valueOf(name) }.getOrNull() }
                ?: AlarmMode.UNTIL_CONFIRMED,
        )
    }

    suspend fun setDarkTheme(dark: Boolean) {
        context.settingsDataStore.edit { it[Keys.DARK_THEME] = dark }
    }

    suspend fun setPrinterId(printerId: String) {
        context.settingsDataStore.edit { it[Keys.PRINTER_ID] = printerId }
    }

    suspend fun setCopiesPerOrder(copies: Int) {
        context.settingsDataStore.edit { it[Keys.COPIES_PER_ORDER] = copies.coerceIn(1, 3) }
    }

    suspend fun setAlarmVolume(volume: Int) {
        context.settingsDataStore.edit { it[Keys.ALARM_VOLUME] = volume.coerceIn(0, 100) }
    }

    suspend fun setAlarmMode(mode: AlarmMode) {
        context.settingsDataStore.edit { it[Keys.ALARM_MODE] = mode.name }
    }
}
