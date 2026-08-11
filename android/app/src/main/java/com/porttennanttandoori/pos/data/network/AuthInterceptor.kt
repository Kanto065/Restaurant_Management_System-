package com.porttennanttandoori.pos.data.network

import okhttp3.Interceptor
import okhttp3.Response

/** Attaches the cached device access token to every request except the login call itself, which
 * has no token to send yet. */
class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.url.encodedPath.endsWith("/api/auth/device/login")) {
            return chain.proceed(request)
        }

        val token = TokenCache.accessToken ?: return chain.proceed(request)
        val authenticated = request.newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        return chain.proceed(authenticated)
    }
}
