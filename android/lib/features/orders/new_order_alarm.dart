import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/settings_store.dart';
import '../../providers.dart';
import 'incoming_queue.dart';

/// Loops an alert tone while at least one order is unconfirmed, mirroring
/// NewOrderAlarm.kt's start()/stop() driven by ordersAwaitingConfirmation.
///
/// The actual sound is played natively (AlarmPlugin.kt, ported from the
/// archived native Kotlin app's NewOrderAlarm) by looping the device's
/// default notification ringtone via MediaPlayer - Flutter has no built-in
/// equivalent, and this needs zero bundled audio assets while still
/// respecting the terminal's notification volume/sound. Start/stop timing
/// (auto-stop after N seconds, re-arming per unconfirmed order) stays here.
class NewOrderAlarmController {
  static const _channel = MethodChannel('com.porttennanttandoori.pos/alarm');

  Timer? _autoStopTimer;
  bool _running = false;

  void start({required int volume, required AlarmMode mode, required AlarmTone tone}) {
    if (mode == AlarmMode.off) return;
    if (_running) return;
    _running = true;
    unawaited(_channel.invokeMethod('start', {'volume': volume, 'tone': tone.name}).catchError((_) => null));
    final autoStopSeconds = switch (mode) {
      AlarmMode.tenSeconds => 10,
      AlarmMode.thirtySeconds => 30,
      _ => null,
    };
    if (autoStopSeconds != null) {
      _autoStopTimer = Timer(Duration(seconds: autoStopSeconds), stop);
    }
  }

  void stop() {
    _autoStopTimer?.cancel();
    _autoStopTimer = null;
    if (!_running) return;
    _running = false;
    unawaited(_channel.invokeMethod('stop').catchError((_) => null));
  }

  /// One-shot playback for Settings' "Preview alarm" button - a separate
  /// native call so it never touches the looping start/stop state above
  /// (previewing shouldn't require - or interfere with - an active alarm).
  static Future<void> preview({required int volume, required AlarmTone tone}) =>
      _channel.invokeMethod('preview', {'volume': volume, 'tone': tone.name}).catchError((_) => null);
}

final newOrderAlarmProvider = Provider<NewOrderAlarmController>((ref) {
  final controller = NewOrderAlarmController();
  ref.onDispose(controller.stop);

  ref.listen<List<String>>(incomingOrderIdsProvider, (previous, next) {
    final settings = ref.read(settingsProvider).valueOrNull;
    if (next.isEmpty) {
      controller.stop();
    } else if (settings != null) {
      controller.start(volume: settings.alarmVolume, mode: settings.alarmMode, tone: settings.alarmTone);
    }
  }, fireImmediately: true);

  return controller;
});
