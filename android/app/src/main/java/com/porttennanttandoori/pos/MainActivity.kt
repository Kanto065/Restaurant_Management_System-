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
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.porttennanttandoori.pos.alert.toReceipt
import com.porttennanttandoori.pos.data.local.TerminalSettings
import com.porttennanttandoori.pos.data.network.OrderListenerService
import com.porttennanttandoori.pos.ui.login.PairingScreen
import com.porttennanttandoori.pos.ui.login.PairingViewModel
import com.porttennanttandoori.pos.ui.orders.IncomingOrderScreen
import com.porttennanttandoori.pos.ui.orders.NewOrdersScreen
import com.porttennanttandoori.pos.ui.orders.OrderHistoryScreen
import com.porttennanttandoori.pos.ui.orders.OrdersViewModel
import com.porttennanttandoori.pos.ui.orders.cancelledStatusName
import com.porttennanttandoori.pos.ui.orders.isHistoryStatus
import com.porttennanttandoori.pos.ui.orders.nextStatusAfter
import com.porttennanttandoori.pos.ui.settings.SettingsScreen
import com.porttennanttandoori.pos.ui.theme.PosAppTheme
import com.porttennanttandoori.pos.update.AvailableUpdate
import kotlinx.coroutines.launch

// Outlined icons to match the admin dashboard's lucide-react sidebar (Bell for Notifications,
// Clock3 for hours, Settings2) rather than Material's default filled style.
private sealed class Destination(val route: String, val label: String, val icon: ImageVector) {
    data object NewOrders : Destination("new_orders", "New Orders", Icons.Outlined.Notifications)
    data object OrderHistory : Destination("order_history", "History", Icons.Outlined.History)
    data object Settings : Destination("settings", "Settings", Icons.Outlined.Settings)
}

private val BOTTOM_NAV_DESTINATIONS = listOf(Destination.NewOrders, Destination.OrderHistory, Destination.Settings)

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
            val app = application as PosApplication
            val authRepository = app.authRepository
            val updateChecker = app.updateChecker
            val coroutineScope = rememberCoroutineScope()
            var availableUpdate by remember { mutableStateOf<AvailableUpdate?>(null) }
            var downloading by remember { mutableStateOf(false) }
            var checkingForUpdate by remember { mutableStateOf(false) }
            var testingPrint by remember { mutableStateOf(false) }
            val snackbarHostState = remember { SnackbarHostState() }

            fun toast(message: String) {
                coroutineScope.launch { snackbarHostState.showSnackbar(message) }
            }

            // DataStore emits a new session as soon as pairAndLogin() persists it, so this
            // recomposes straight past the pairing screen without any extra navigation state.
            val session by authRepository.session.collectAsStateWithLifecycle(initialValue = null)
            val settings by app.settingsStore.settings.collectAsStateWithLifecycle(initialValue = TerminalSettings())

            fun checkForUpdate() {
                checkingForUpdate = true
                coroutineScope.launch {
                    availableUpdate = updateChecker.checkForUpdate()
                    checkingForUpdate = false
                }
            }

            PosAppTheme(darkTheme = settings.darkTheme) {
                val currentSession = session
                if (currentSession != null) {
                    LaunchedEffect(Unit) {
                        startOrderListener()
                        checkForUpdate()
                    }

                    val navController = rememberNavController()
                    val backStackEntry by navController.currentBackStackEntryAsState()
                    val currentRoute = backStackEntry?.destination?.route

                    val allOrders by ordersViewModel.orders.collectAsStateWithLifecycle()
                    val orderStatusDefinitions by ordersViewModel.orderStatusDefinitions.collectAsStateWithLifecycle()
                    val orderDetails by ordersViewModel.orderDetails.collectAsStateWithLifecycle()
                    val awaitingConfirmation by ordersViewModel.ordersAwaitingConfirmation.collectAsStateWithLifecycle(initialValue = emptyList())
                    val paymentStatusDefinitions by ordersViewModel.paymentStatusDefinitions.collectAsStateWithLifecycle()
                    var processingOrderId by remember { mutableStateOf<String?>(null) }
                    val incomingOrder = awaitingConfirmation.firstOrNull { it.id != processingOrderId }
                    val newOrdersBadgeCount = allOrders.count { !isHistoryStatus(it.status, orderStatusDefinitions) }

                    fun reprintOrder(orderId: String) {
                        val detail = orderDetails[orderId]
                        if (detail == null) {
                            toast("Order details still loading - try again in a moment.")
                            return
                        }
                        coroutineScope.launch {
                            val result = runCatching { app.printerManager.printReceipt(detail.toReceipt(), settings.copiesPerOrder) }
                            toast(if (result.isSuccess) "Receipt reprinted" else "Printer unavailable on this device")
                        }
                    }

                    Scaffold(
                        snackbarHost = { SnackbarHost(snackbarHostState) },
                        bottomBar = {
                            // No selection-indicator pill and no per-item container color - the
                            // design's tab bar is just icon+label colored by selection state, not
                            // stock Material's capsule-behind-the-icon look.
                            NavigationBar(containerColor = MaterialTheme.colorScheme.background) {
                                BOTTOM_NAV_DESTINATIONS.forEach { destination ->
                                    val badgeCount = if (destination == Destination.NewOrders) newOrdersBadgeCount else 0
                                    NavigationBarItem(
                                        selected = currentRoute == destination.route,
                                        onClick = {
                                            navController.navigate(destination.route) {
                                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        },
                                        icon = {
                                            BadgedBox(badge = { if (badgeCount > 0) Badge { Text(badgeCount.toString()) } }) {
                                                Icon(destination.icon, contentDescription = destination.label)
                                            }
                                        },
                                        label = { Text(destination.label) },
                                        colors = NavigationBarItemDefaults.colors(
                                            indicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                                            selectedIconColor = MaterialTheme.colorScheme.primary,
                                            selectedTextColor = MaterialTheme.colorScheme.primary,
                                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                        ),
                                    )
                                }
                            }
                        },
                    ) { padding ->
                        NavHost(
                            navController = navController,
                            startDestination = Destination.NewOrders.route,
                            modifier = Modifier.padding(padding),
                        ) {
                            composable(Destination.NewOrders.route) {
                                NewOrdersScreen(viewModel = ordersViewModel, onReprint = ::reprintOrder)
                            }
                            composable(Destination.OrderHistory.route) {
                                OrderHistoryScreen(viewModel = ordersViewModel, onReprint = ::reprintOrder)
                            }
                            composable(Destination.Settings.route) {
                                SettingsScreen(
                                    restaurantName = currentSession.restaurantName,
                                    settings = settings,
                                    checkingForUpdate = checkingForUpdate,
                                    testingPrint = testingPrint,
                                    onSetDarkTheme = { dark -> coroutineScope.launch { app.settingsStore.setDarkTheme(dark) } },
                                    onSetPrinter = { id -> coroutineScope.launch { app.settingsStore.setPrinterId(id) } },
                                    onSetCopies = { copies -> coroutineScope.launch { app.settingsStore.setCopiesPerOrder(copies) } },
                                    onSetVolume = { volume -> coroutineScope.launch { app.settingsStore.setAlarmVolume(volume) } },
                                    onSetAlarmMode = { mode -> coroutineScope.launch { app.settingsStore.setAlarmMode(mode) } },
                                    onTestPrint = {
                                        testingPrint = true
                                        coroutineScope.launch {
                                            val receipt = com.porttennanttandoori.pos.alert.Receipt(
                                                title = "Port Tennant Tandoori",
                                                subtitle = "Test print",
                                                lines = listOf("This is a test receipt.", "If you can read this, printing works."),
                                            )
                                            val result = runCatching { app.printerManager.printReceipt(receipt, 1) }
                                            testingPrint = false
                                            toast(if (result.isSuccess) "Test receipt printed" else "Printer unavailable on this device")
                                        }
                                    },
                                    onCheckForUpdate = ::checkForUpdate,
                                    onSignOut = { coroutineScope.launch { authRepository.signOut() } },
                                )
                            }
                        }
                    }

                    if (incomingOrder != null) {
                        LaunchedEffect(incomingOrder.id) { ordersViewModel.loadDetail(incomingOrder.id) }
                        val detail = orderDetails[incomingOrder.id]
                        IncomingOrderScreen(
                            order = incomingOrder,
                            detail = detail,
                            paymentStatusDefinitions = paymentStatusDefinitions,
                            isProcessing = processingOrderId == incomingOrder.id,
                            onConfirm = {
                                val orderDetail = detail ?: return@IncomingOrderScreen
                                processingOrderId = incomingOrder.id
                                coroutineScope.launch {
                                    val printResult = runCatching {
                                        app.printerManager.printReceipt(orderDetail.toReceipt(), settings.copiesPerOrder)
                                    }
                                    val next = nextStatusAfter(incomingOrder.status, orderStatusDefinitions)
                                    ordersViewModel.updateStatusAwait(incomingOrder.id, next)
                                    processingOrderId = null
                                    toast(
                                        if (printResult.isSuccess) {
                                            "#${incomingOrder.orderNumber} confirmed · receipt printed"
                                        } else {
                                            "#${incomingOrder.orderNumber} confirmed · printer unavailable"
                                        },
                                    )
                                }
                            },
                            onCancel = {
                                processingOrderId = incomingOrder.id
                                coroutineScope.launch {
                                    val cancelled = cancelledStatusName(orderStatusDefinitions)
                                    ordersViewModel.updateStatusAwait(incomingOrder.id, cancelled)
                                    processingOrderId = null
                                    toast("#${incomingOrder.orderNumber} cancelled · nothing printed")
                                }
                            },
                        )
                    }
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
