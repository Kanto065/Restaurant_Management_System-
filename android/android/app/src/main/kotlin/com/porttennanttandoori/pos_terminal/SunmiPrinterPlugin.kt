package com.porttennanttandoori.pos_terminal

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors
import woyou.aidlservice.jiuiv5.IWoyouService

/**
 * Backs the Dart-side PrinterService's "com.porttennanttandoori.pos/sunmi_printer" channel
 * (see printer_service.dart) by binding to the Sunmi Printer Service
 * (woyou.aidlservice.jiuiv5.IWoyouService, see the AIDL files under app/src/main/aidl - Sunmi's
 * published InnerPrinter interface) - the system app every Sunmi terminal ships for its
 * built-in printer, not a vendored SDK. Ported from the archived native Kotlin app's
 * PrinterManager (archive/kotlin-pos branch).
 *
 * Every binder call here is a blocking IPC transaction, so method-call handling runs on a single
 * background thread and results are posted back to the platform thread, since Flutter requires
 * MethodChannel.Result to be completed on the thread the call arrived on.
 */
class SunmiPrinterPlugin(private val context: Context) : MethodChannel.MethodCallHandler {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val bindLock = Object()

    @Volatile private var service: IWoyouService? = null
    private var bindRequested = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = IWoyouService.Stub.asInterface(binder)
            runCatching { service?.printerInit(null) }
            synchronized(bindLock) { bindLock.notifyAll() }
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isAvailable" -> executor.execute {
                val available = ensureBound()
                mainHandler.post { result.success(available) }
            }
            "printReceipt" -> executor.execute {
                try {
                    printReceiptBlocking(call)
                    mainHandler.post { result.success(null) }
                } catch (e: Exception) {
                    mainHandler.post { result.error("SUNMI_PRINT_FAILED", e.message, null) }
                }
            }
            else -> mainHandler.post { result.notImplemented() }
        }
    }

    /** True once bound to a real Sunmi Printer Service - false on any other device (dev phone,
     * emulator), where callers should surface a "not available" error instead of attempting to
     * print. Safe to call repeatedly; only actually (re)binds once. Must run off the main thread. */
    private fun ensureBound(): Boolean {
        if (service != null) return true
        synchronized(this) {
            if (!bindRequested) {
                bindRequested = true
                val intent = Intent("woyou.aidlservice.jiuiv5.IWoyouService").apply {
                    setPackage("woyou.aidlservice.jiuiv5")
                }
                runCatching { context.bindService(intent, connection, Context.BIND_AUTO_CREATE) }
            }
        }
        if (service == null) {
            synchronized(bindLock) {
                if (service == null) {
                    runCatching { bindLock.wait(2_000) }
                }
            }
        }
        return service != null
    }

    private fun printReceiptBlocking(call: MethodCall) {
        val svc = service ?: run { ensureBound(); service }
            ?: error("Sunmi printer service is not available on this device.")
        val title = call.argument<String>("title") ?: ""
        val subtitle = call.argument<String>("subtitle") ?: ""
        @Suppress("UNCHECKED_CAST")
        val lines = call.argument<List<String>>("lines") ?: emptyList()
        val copies = (call.argument<Int>("copies") ?: 1).coerceIn(1, 3)
        repeat(copies) {
            svc.setAlignment(1, null)
            svc.printTextWithFont("$title\n", null, 32f, null)
            svc.setAlignment(0, null)
            svc.printText("$subtitle\n\n", null)
            lines.forEach { line -> svc.printText("$line\n", null) }
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
