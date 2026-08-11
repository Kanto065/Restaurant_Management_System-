package com.porttennanttandoori.pos.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.time.Instant
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "pos_session")

/** What the app needs to authenticate a paired device: its id/secret (for re-login when the
 * access token expires) plus the current access token and when it stops being valid. */
data class DeviceSession(
    val deviceId: String,
    val deviceSecret: String,
    val accessToken: String,
    val accessTokenExpiresAt: Instant,
    val restaurantName: String,
) {
    val isAccessTokenExpired: Boolean
        get() = Instant.now().isAfter(accessTokenExpiresAt.minusSeconds(30))
}

/** Persists device pairing + the current access token across restarts. The secret never leaves
 * the device after pairing - it's only ever sent over HTTPS to device/login. */
class TokenStore(private val context: Context) {

    private object Keys {
        val DEVICE_ID = stringPreferencesKey("device_id")
        val DEVICE_SECRET = stringPreferencesKey("device_secret")
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val ACCESS_TOKEN_EXPIRES_AT = stringPreferencesKey("access_token_expires_at")
        val RESTAURANT_NAME = stringPreferencesKey("restaurant_name")
    }

    val session: Flow<DeviceSession?> = context.dataStore.data.map { prefs ->
        val deviceId = prefs[Keys.DEVICE_ID] ?: return@map null
        val deviceSecret = prefs[Keys.DEVICE_SECRET] ?: return@map null
        val accessToken = prefs[Keys.ACCESS_TOKEN] ?: return@map null
        val expiresAt = prefs[Keys.ACCESS_TOKEN_EXPIRES_AT]?.let { Instant.parse(it) } ?: return@map null
        val restaurantName = prefs[Keys.RESTAURANT_NAME] ?: return@map null
        DeviceSession(deviceId, deviceSecret, accessToken, expiresAt, restaurantName)
    }

    suspend fun currentSession(): DeviceSession? = session.first()

    suspend fun savePairing(deviceId: String, deviceSecret: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.DEVICE_ID] = deviceId
            prefs[Keys.DEVICE_SECRET] = deviceSecret
        }
    }

    suspend fun saveAccessToken(accessToken: String, expiresAt: Instant, restaurantName: String) {
        context.dataStore.edit { prefs ->
            prefs[Keys.ACCESS_TOKEN] = accessToken
            prefs[Keys.ACCESS_TOKEN_EXPIRES_AT] = expiresAt.toString()
            prefs[Keys.RESTAURANT_NAME] = restaurantName
        }
    }

    /** Forgets everything, including the paired device secret - used when the device is
     * deactivated from the admin dashboard and 401s can no longer be recovered from. */
    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
