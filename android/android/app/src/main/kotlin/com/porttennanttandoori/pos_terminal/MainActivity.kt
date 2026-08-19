package com.porttennanttandoori.pos_terminal

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var sunmiPrinterPlugin: SunmiPrinterPlugin? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        val printerPlugin = SunmiPrinterPlugin(applicationContext)
        sunmiPrinterPlugin = printerPlugin
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.porttennanttandoori.pos/sunmi_printer",
        ).setMethodCallHandler(printerPlugin)
    }

    override fun onDestroy() {
        sunmiPrinterPlugin?.unbind()
        super.onDestroy()
    }
}
