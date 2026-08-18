package com.porttennanttandoori.pos.alert

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import woyou.aidlservice.jiuiv5.IWoyouService

/** A receipt formatted as plain print commands, decoupled from the specific printer driving
 * them - PrinterManager/Sunmi is the only implementation today (see the POS Terminal design plan:
 * Star/Epson stay "coming soon" until that hardware exists to test against), but keeping the
 * receipt shape printer-agnostic means adding a second driver later doesn't touch call sites. */
data class Receipt(val title: String, val subtitle: String, val lines: List<String>)

/** Binds to the Sunmi Printer Service (woyou.aidlservice.jiuiv5.IWoyouService, see the AIDL files
 * under app/src/main/aidl - Sunmi's published InnerPrinter interface, committed back when this
 * project was first scaffolded) - the system app every Sunmi terminal ships for its built-in
 * printer, not a vendored SDK. Every call here is a blocking binder transaction, so this always
 * runs on Dispatchers.IO. */
class PrinterManager(private val context: Context) {

    @Volatile private var service: IWoyouService? = null
    private var bindRequested = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IWoyouService.Stub.asInterface(binder)
            runCatching { service?.printerInit(null) }
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
        }
    }

    /** True once bound to a real Sunmi Printer Service - false on any other device (dev phone,
     * emulator), where callers should show a toast instead of attempting to print. Safe to call
     * repeatedly; only actually (re)binds once. */
    suspend fun isAvailable(): Boolean = withContext(Dispatchers.IO) { ensureBound() }

    private suspend fun ensureBound(): Boolean {
        if (service != null) return true
        if (!bindRequested) {
            bindRequested = true
            val intent = Intent("woyou.aidlservice.jiuiv5.IWoyouService").apply {
                setPackage("woyou.aidlservice.jiuiv5")
            }
            runCatching { context.bindService(intent, connection, Context.BIND_AUTO_CREATE) }
        }
        withTimeoutOrNull(2_000) {
            while (service == null) delay(50)
        }
        return service != null
    }

    /** Prints [copies] copies of [receipt]. Throws IllegalStateException if the Sunmi printer
     * service isn't available on this device - callers (IncomingOrderScreen, OrderCard's
     * "Reprint receipt") catch this and toast rather than crash, since that's the expected outcome
     * on any non-Sunmi dev/test device. */
    suspend fun printReceipt(receipt: Receipt, copies: Int = 1) = withContext(Dispatchers.IO) {
        val svc = service.takeIf { it != null } ?: run { ensureBound(); service }
            ?: error("Sunmi printer service is not available on this device.")
        repeat(copies.coerceIn(1, 3)) {
            svc.setAlignment(1, null)
            svc.printTextWithFont("${receipt.title}\n", null, 32f, null)
            svc.setAlignment(0, null)
            svc.printText("${receipt.subtitle}\n\n", null)
            receipt.lines.forEach { line -> svc.printText("$line\n", null) }
            svc.lineWrap(4, null)
            svc.cutPaper(null)
        }
    }

    fun unbind() {
        if (service != null) runCatching { context.unbindService(connection) }
        service = null
        bindRequested = false
    }
}
