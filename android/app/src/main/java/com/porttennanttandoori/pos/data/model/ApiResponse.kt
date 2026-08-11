package com.porttennanttandoori.pos.data.model

import kotlinx.serialization.Serializable

/** Mirrors the backend's { success, statusCode, message, data } envelope (see ApiResponse.cs). */
@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val statusCode: Int,
    val message: String,
    val data: T? = null,
)
