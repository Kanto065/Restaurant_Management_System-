package com.porttennanttandoori.pos.data.network

import com.porttennanttandoori.pos.data.model.ApiResponse
import com.porttennanttandoori.pos.data.model.DeviceLoginRequest
import com.porttennanttandoori.pos.data.model.DeviceTokenResponse
import com.porttennanttandoori.pos.data.model.OrderDetailDto
import com.porttennanttandoori.pos.data.model.OrderListPageDto
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto
import com.porttennanttandoori.pos.data.model.UpdateOrderStatusRequest
import com.porttennanttandoori.pos.data.model.UpdatePaymentStatusRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("api/auth/device/login")
    suspend fun deviceLogin(@Body request: DeviceLoginRequest): Response<ApiResponse<DeviceTokenResponse>>

    // Used for the live New Orders working set - asks for the max page size (100) rather than
    // paging through, since it just needs everything not yet completed in memory for SSE patches
    // to update in place.
    @GET("api/admin/orders")
    suspend fun listOrders(@Query("pageSize") pageSize: Int = 100): Response<ApiResponse<OrderListPageDto>>

    // Same endpoint, full query params - used by Order History's search/filter/pagination, which
    // (unlike the live list above) genuinely pages through the admin-visible order history rather
    // than holding it all in memory. Matches admin-frontend/src/pages/Orders.tsx's query exactly.
    @GET("api/admin/orders")
    suspend fun searchOrders(
        @Query("status") status: String? = null,
        @Query("paymentStatus") paymentStatus: String? = null,
        @Query("search") search: String? = null,
        @Query("dateFrom") dateFrom: String? = null,
        @Query("dateTo") dateTo: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 25,
    ): Response<ApiResponse<OrderListPageDto>>

    @GET("api/admin/orders/{id}")
    suspend fun getOrder(@Path("id") id: String): Response<ApiResponse<OrderDetailDto>>

    @PUT("api/admin/orders/{id}/status")
    suspend fun updateOrderStatus(
        @Path("id") id: String,
        @Body request: UpdateOrderStatusRequest,
    ): Response<ApiResponse<OrderDetailDto>>

    @PUT("api/admin/orders/{id}/payment-status")
    suspend fun updatePaymentStatus(
        @Path("id") id: String,
        @Body request: UpdatePaymentStatusRequest,
    ): Response<ApiResponse<OrderDetailDto>>

    @GET("api/admin/order-statuses")
    suspend fun listOrderStatusDefinitions(): Response<ApiResponse<List<OrderStatusDefinitionDto>>>

    @GET("api/admin/payment-statuses")
    suspend fun listPaymentStatusDefinitions(): Response<ApiResponse<List<PaymentStatusDefinitionDto>>>
}
