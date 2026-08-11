package com.porttennanttandoori.pos.data.network

import com.porttennanttandoori.pos.data.local.TokenStore
import com.porttennanttandoori.pos.data.model.ApiResponse
import com.porttennanttandoori.pos.data.model.DeviceLoginRequest
import com.porttennanttandoori.pos.data.model.DeviceTokenResponse
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

/** A device token is short-lived and there's no refresh token (see DeviceTokenResponse) - instead,
 * when a request comes back 401 we use the device's stored id/secret to log in again and retry.
 * Runs on a plain OkHttpClient (no interceptor/authenticator of its own) to avoid recursing. */
class DeviceAuthenticator(
    private val baseUrl: String,
    private val tokenStore: TokenStore,
    private val json: Json,
    private val plainClient: OkHttpClient,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Already retried once for this request chain - the fresh token didn't help, give up.
        if (responseCount(response) >= 2) return null

        val session = runBlocking { tokenStore.currentSession() } ?: return null

        val requestJson = json.encodeToString(
            DeviceLoginRequest.serializer(),
            DeviceLoginRequest(session.deviceId, session.deviceSecret),
        )
        val loginRequest = Request.Builder()
            .url("$baseUrl/api/auth/device/login")
            .post(requestJson.toRequestBody("application/json".toMediaType()))
            .build()

        val loginResponse = plainClient.newCall(loginRequest).execute()
        loginResponse.use {
            if (!it.isSuccessful) return null
            val body = it.body?.string() ?: return null
            val parsed = json.decodeFromString(
                ApiResponse.serializer(DeviceTokenResponse.serializer()), body,
            )
            val token = parsed.data ?: return null

            runBlocking {
                tokenStore.saveAccessToken(
                    token.accessToken, token.accessTokenExpiresAtInstant, token.restaurantName,
                )
            }
            TokenCache.update(token.accessToken)

            return response.request.newBuilder()
                .header("Authorization", "Bearer ${token.accessToken}")
                .build()
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
