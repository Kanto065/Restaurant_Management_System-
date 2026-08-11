package com.porttennanttandoori.pos.data.network

import com.porttennanttandoori.pos.data.model.ApiResponse
import com.porttennanttandoori.pos.data.model.DeviceLoginRequest
import com.porttennanttandoori.pos.data.model.DeviceTokenResponse
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderListItemDto
import com.porttennanttandoori.pos.data.model.UpdateOrderStatusRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface ApiService {
    @POST("api/auth/device/login")
    suspend fun deviceLogin(@Body request: DeviceLoginRequest): Response<ApiResponse<DeviceTokenResponse>>

    @GET("api/admin/orders")
    suspend fun listOrders(): Response<ApiResponse<List<OrderListItemDto>>>

    @GET("api/admin/orders/{id}")
    suspend fun getOrder(@Path("id") id: String): Response<ApiResponse<OrderDetailDto>>

    @PUT("api/admin/orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") id: String,
        @Body request: UpdateOrderStatusRequest,
    ): Response<ApiResponse<OrderDetailDto>>
}
