package com.porttennanttandoori.pos.data.model

import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.serialization.Serializable

/** Matches AuthContracts.DeviceLoginRequest — id + secret issued at pairing time, no password. */
@Serializable
data class DeviceLoginRequest(
    val deviceId: String,
    val secret: String,
)

/** Matches AuthContracts.DeviceTokenResponse. No refresh token: the device re-authenticates with
 * its stored secret instead (see DeviceAuthenticator). */
@Serializable
data class DeviceTokenResponse(
    val accessToken: String,
    val accessTokenExpiresAt: String,
    val restaurantName: String,
) {
    // .NET's DateTimeOffset serializes with a numeric offset ("+00:00"), not the "Z" that
    // Instant.parse requires - OffsetDateTime accepts both.
    val accessTokenExpiresAtInstant: Instant
        get() = OffsetDateTime.parse(accessTokenExpiresAt).toInstant()
}
