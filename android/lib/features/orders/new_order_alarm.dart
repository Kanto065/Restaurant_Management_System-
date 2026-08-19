import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/settings_store.dart';
import '../../providers.dart';
import 'incoming_queue.dart';

/// Loops an alert tone while at least one order is unconfirmed, mirroring
/// NewOrderAlarm.kt's start()/stop() driven by ordersAwaitingConfirmation.
///
/// TODO: this uses SystemSound.play as a placeholder "beep" - the Kotlin app
/// looped the device's actual default notification ringtone via MediaPlayer,
/// which Flutter has no built-in equivalent for. Swap in a proper looping
/// audio package (e.g. audioplayers) once one's approved for this project;
/// wiring (start/stop timing, volume setting, alarm-mode auto-stop) is
/// already correct, only the actual sound playback is a stand-in.
class NewOrderAlarmController {
  Timer? _loopTimer;
  Timer? _autoStopTimer;
  bool _running = false;

  void start({required int volume, required AlarmMode mode}) {
    if (mode == AlarmMode.off) return;
    if (_running) return;
    _running = true;
    _loopTimer = Timer.periodic(const Duration(milliseconds: 1600), (_) {
      SystemSound.play(SystemSoundType.alert);
    });
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
    _loopTimer?.cancel();
    _autoStopTimer?.cancel();
    _loopTimer = null;
    _autoStopTimer = null;
    _running = false;
  }
}

final newOrderAlarmProvider = Provider<NewOrderAlarmController>((ref) {
  final controller = NewOrderAlarmController();
  ref.onDispose(controller.stop);

  ref.listen<List<String>>(incomingOrderIdsProvider, (previous, next) {
    final settings = ref.read(settingsProvider).valueOrNull;
    if (next.isEmpty) {
      controller.stop();
    } else if (settings != null) {
      controller.start(volume: settings.alarmVolume, mode: settings.alarmMode);
    }
  }, fireImmediately: true);

  return controller;
});
