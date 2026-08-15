package com.porttennanttandoori.pos

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.porttennanttandoori.pos.data.network.OrderListenerService
import com.porttennanttandoori.pos.ui.login.PairingScreen
import com.porttennanttandoori.pos.ui.login.PairingViewModel
import com.porttennanttandoori.pos.ui.orders.OrdersListScreen
import com.porttennanttandoori.pos.ui.orders.OrdersViewModel
import com.porttennanttandoori.pos.ui.theme.PosAppTheme
import com.porttennanttandoori.pos.update.AvailableUpdate
import kotlinx.coroutines.launch

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

    // Only used to send the terminal to the "allow installs from this app" settings screen when
    // an update is ready but the OS hasn't granted that yet; the actual outcome is re-checked via
    // Settings.canRequestPackageInstalls() when the user backs out, not from the result code.
    private val installSourceSettingsLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { retryInstallIfPermitted() }

    private var pendingInstall: java.io.File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val authRepository = (application as PosApplication).authRepository
            val updateChecker = (application as PosApplication).updateChecker
            val coroutineScope = rememberCoroutineScope()
            var availableUpdate by remember { mutableStateOf<AvailableUpdate?>(null) }
            var downloading by remember { mutableStateOf(false) }

            // DataStore emits a new session as soon as pairAndLogin() persists it, so this
            // recomposes straight past the pairing screen without any extra navigation state.
            val session by authRepository.session.collectAsStateWithLifecycle(initialValue = null)

            PosAppTheme {
                val currentSession = session
                if (currentSession != null) {
                    LaunchedEffect(Unit) {
                        startOrderListener()
                        availableUpdate = updateChecker.checkForUpdate()
                    }
                    OrdersListScreen(viewModel = ordersViewModel, restaurantName = currentSession.restaurantName)
                } else {
                    PairingScreen(viewModel = pairingViewModel)
                }

                val update = availableUpdate
                if (update != null) {
                    AlertDialog(
                        onDismissRequest = { if (!downloading) availableUpdate = null },
                        title = { Text("Update available") },
                        text = { Text(if (downloading) "Downloading ${update.label}…" else "${update.label} is ready to install.") },
                        confirmButton = {
                            TextButton(
                                enabled = !downloading,
                                onClick = {
                                    downloading = true
                                    coroutineScope.launch {
                                        val apkFile = updateChecker.download(update)
                                        downloading = false
                                        availableUpdate = null
                                        beginInstall(apkFile)
                                    }
                                },
                            ) { Text("Install") }
                        },
                        dismissButton = {
                            TextButton(enabled = !downloading, onClick = { availableUpdate = null }) { Text("Later") }
                        },
                    )
                }
            }
        }
    }

    /** Requests the "install from this source" permission first if needed (API 26+); otherwise
     * launches the system package installer directly. */
    private fun beginInstall(apkFile: java.io.File) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            pendingInstall = apkFile
            installSourceSettingsLauncher.launch(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")),
            )
            return
        }
        startActivity((application as PosApplication).updateChecker.installIntent(apkFile))
    }

    private fun retryInstallIfPermitted() {
        val apkFile = pendingInstall ?: return
        pendingInstall = null
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()) {
            startActivity((application as PosApplication).updateChecker.installIntent(apkFile))
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
