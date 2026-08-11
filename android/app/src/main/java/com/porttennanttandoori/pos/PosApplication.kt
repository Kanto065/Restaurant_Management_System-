package com.porttennanttandoori.pos

import android.app.Application
import com.porttennanttandoori.pos.data.local.TokenStore
import com.porttennanttandoori.pos.data.network.NetworkModule
import com.porttennanttandoori.pos.data.repository.AuthRepository
import com.porttennanttandoori.pos.data.repository.OrdersRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Holds this app's hand-rolled dependency graph - no Hilt/Koin, just lazily built singletons
 * that Activities/ViewModels reach via (application as PosApplication). */
class PosApplication : Application() {

    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val tokenStore: TokenStore by lazy { TokenStore(this) }
    val networkModule: NetworkModule by lazy { NetworkModule(tokenStore) }
    val authRepository: AuthRepository by lazy {
        AuthRepository(networkModule.apiService, tokenStore, networkModule.json)
    }
    val ordersRepository: OrdersRepository by lazy {
        OrdersRepository(networkModule.apiService, networkModule.orderEventsClient)
    }

    override fun onCreate() {
        super.onCreate()
        applicationScope.launch { authRepository.restoreCachedToken() }
    }
}
