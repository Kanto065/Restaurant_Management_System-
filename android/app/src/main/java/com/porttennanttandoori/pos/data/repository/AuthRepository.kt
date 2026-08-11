package com.porttennanttandoori.pos.data.repository

import com.porttennanttandoori.pos.data.local.DeviceSession
import com.porttennanttandoori.pos.data.local.TokenStore
import com.porttennanttandoori.pos.data.model.ApiResponse
import com.porttennanttandoori.pos.data.model.DeviceLoginRequest
import com.porttennanttandoori.pos.data.model.DeviceTokenResponse
import com.porttennanttandoori.pos.data.network.ApiService
import com.porttennanttandoori.pos.data.network.TokenCache
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

class AuthRepository(
    private val apiService: ApiService,
    private val tokenStore: TokenStore,
    private val json: Json,
) {
    val session: Flow<DeviceSession?> = tokenStore.session

    /** Restores the in-memory token cache from disk on process start, so the very first request
     * after a restart already carries a bearer token instead of relying on the authenticator. */
    suspend fun restoreCachedToken() {
        TokenCache.update(tokenStore.currentSession()?.accessToken)
    }

    /** Pairs this terminal using the id + secret an admin generated in the dashboard (see
     * Admin/DevicesController.Create), then immediately logs in to get a working access token. */
    suspend fun pairAndLogin(deviceId: String, secret: String): Result<DeviceTokenResponse> {
        val result = login(deviceId, secret)
        if (result.isSuccess) {
            tokenStore.savePairing(deviceId, secret)
        }
        return result
    }

    private suspend fun login(deviceId: String, secret: String): Result<DeviceTokenResponse> {
        return try {
            val response = apiService.deviceLogin(DeviceLoginRequest(deviceId, secret))
            if (response.isSuccessful) {
                val token = response.body()?.data
                    ?: return Result.failure(IOException("Empty response from server."))

                tokenStore.saveAccessToken(
                    token.accessToken, token.accessTokenExpiresAtInstant, token.restaurantName,
                )
                TokenCache.update(token.accessToken)
                Result.success(token)
            } else {
                Result.failure(IOException(extractErrorMessage(response.errorBody()?.string())))
            }
        } catch (e: IOException) {
            Result.failure(IOException("Couldn't reach the server. Check the terminal's network connection.", e))
        }
    }

    suspend fun signOut() {
        TokenCache.update(null)
        tokenStore.clear()
    }

    private fun extractErrorMessage(errorBody: String?): String {
        if (errorBody.isNullOrBlank()) return "Invalid device ID or secret."
        return try {
            json.decodeFromString(ApiResponse.serializer(Unit.serializer()), errorBody).message
        } catch (e: Exception) {
            "Invalid device ID or secret."
        }
    }
}
