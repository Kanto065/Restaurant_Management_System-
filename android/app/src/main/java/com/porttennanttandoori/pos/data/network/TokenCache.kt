package com.porttennanttandoori.pos.data.network

/** In-memory mirror of the current access token so AuthInterceptor can attach it synchronously
 * without blocking on DataStore for every request. TokenStore remains the source of truth across
 * restarts; whoever changes the token there (AuthRepository, DeviceAuthenticator) must call
 * update() too. */
object TokenCache {
    @Volatile
    var accessToken: String? = null
        private set

    fun update(token: String?) {
        accessToken = token
    }
}
