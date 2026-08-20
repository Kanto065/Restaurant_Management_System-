package com.porttennanttandoori.pos_terminal

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var alarmPlugin: AlarmPlugin? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        val alarm = AlarmPlugin(applicationContext)
        alarmPlugin = alarm
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.porttennanttandoori.pos/alarm",
        ).setMethodCallHandler(alarm)
    }

    override fun onDestroy() {
        alarmPlugin?.stop()
        super.onDestroy()
    }
}
