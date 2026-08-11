package com.porttennanttandoori.pos.data.network

import com.porttennanttandoori.pos.BuildConfig
import com.porttennanttandoori.pos.data.local.TokenStore
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/** Manual DI: this project has no Hilt/Koin dependency, so wiring lives here as a set of lazily
 * built singletons owned by PosApplication. */
class NetworkModule(private val tokenStore: TokenStore) {

    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    /** Bare client for the device re-login call itself - must not carry AuthInterceptor/
     * DeviceAuthenticator or a 401 there would recurse into itself. */
    private val plainClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor())
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC))
                }
            }
            .authenticator(DeviceAuthenticator(BuildConfig.API_BASE_URL, tokenStore, json, plainClient))
            .build()
    }

    val retrofit: Retrofit by lazy {
        val contentType = "application/json".toMediaType()
        Retrofit.Builder()
            // Retrofit requires a trailing slash; DeviceAuthenticator concatenates the raw
            // BuildConfig value itself, so the slash is added here rather than at the source.
            .baseUrl("${BuildConfig.API_BASE_URL}/")
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    val apiService: ApiService by lazy { retrofit.create(ApiService::class.java) }

    /** The SSE stream is long-lived and idle between events, so it needs no read timeout - reuses
     * okHttpClient's auth interceptor/authenticator via newBuilder() rather than duplicating them. */
    private val streamingClient: OkHttpClient by lazy {
        okHttpClient.newBuilder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()
    }

    val orderEventsClient: OrderEventsClient by lazy { OrderEventsClient(streamingClient, json) }
}
