package com.porttennanttandoori.pos

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.porttennanttandoori.pos.data.network.OrderListenerService
import com.porttennanttandoori.pos.ui.login.PairingScreen
import com.porttennanttandoori.pos.ui.login.PairingViewModel
import com.porttennanttandoori.pos.ui.orders.OrdersListScreen
import com.porttennanttandoori.pos.ui.orders.OrdersViewModel
import com.porttennanttandoori.pos.ui.theme.PosAppTheme

class MainActivity : ComponentActivity() {

    private val pairingViewModel: PairingViewModel by viewModels {
        PairingViewModel.Factory((application as PosApplication).authRepository)
    }

    private val ordersViewModel: OrdersViewModel by viewModels {
        OrdersViewModel.Factory((application as PosApplication).ordersRepository)
    }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op either way - the
            foreground service still runs, it just won't show a notification if this is denied */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val authRepository = (application as PosApplication).authRepository
            // DataStore emits a new session as soon as pairAndLogin() persists it, so this
            // recomposes straight past the pairing screen without any extra navigation state.
            val session by authRepository.session.collectAsStateWithLifecycle(initialValue = null)

            PosAppTheme {
                val currentSession = session
                if (currentSession != null) {
                    LaunchedEffect(Unit) { startOrderListener() }
                    OrdersListScreen(viewModel = ordersViewModel, restaurantName = currentSession.restaurantName)
                } else {
                    PairingScreen(viewModel = pairingViewModel)
                }
            }
        }
    }

    private fun startOrderListener() {
        requestNotificationPermissionIfNeeded()
        ContextCompat.startForegroundService(this, Intent(this, OrderListenerService::class.java))
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
