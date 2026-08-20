import 'package:shared_preferences/shared_preferences.dart';

enum AlarmMode { untilConfirmed, tenSeconds, thirtySeconds, off }

/// Which sound the new-order alarm loops. siren/bell/chime are synthesized
/// natively (see AlarmPlugin.kt) - system loops the device's own default
/// notification sound, same as before this setting existed.
enum AlarmTone { siren, bell, chime, system }

class AlarmToneInfo {
  final String name;
  final String detail;
  const AlarmToneInfo(this.name, this.detail);
}

const alarmToneInfo = {
  AlarmTone.siren: AlarmToneInfo('Loud siren', 'Default · cuts through a busy kitchen'),
  AlarmTone.bell: AlarmToneInfo('Counter bell', 'Loud · sharp double chime'),
  AlarmTone.chime: AlarmToneInfo('Chime', 'Moderate'),
  AlarmTone.system: AlarmToneInfo('System sound', 'Follows the device notification tone'),
};

class TerminalSettings {
  final bool darkTheme;
  final int copiesPerOrder;
  final int alarmVolume;
  final AlarmMode alarmMode;
  final AlarmTone alarmTone;

  const TerminalSettings({
    this.darkTheme = true,
    this.copiesPerOrder = 1,
    this.alarmVolume = 80,
    this.alarmMode = AlarmMode.untilConfirmed,
    this.alarmTone = AlarmTone.siren,
  });

  TerminalSettings copyWith({
    bool? darkTheme,
    int? copiesPerOrder,
    int? alarmVolume,
    AlarmMode? alarmMode,
    AlarmTone? alarmTone,
  }) {
    return TerminalSettings(
      darkTheme: darkTheme ?? this.darkTheme,
      copiesPerOrder: copiesPerOrder ?? this.copiesPerOrder,
      alarmVolume: alarmVolume ?? this.alarmVolume,
      alarmMode: alarmMode ?? this.alarmMode,
      alarmTone: alarmTone ?? this.alarmTone,
    );
  }
}

/// Persists terminal-local preferences (theme, printer choice, copies per
/// order, new-order alarm volume/duration) - separate from TokenStore's
/// pairing/session data since these are device preferences, not credentials,
/// and have no reason to be cleared on sign-out. Mirrors SettingsStore.kt.
class SettingsStore {
  static const _kDarkTheme = 'dark_theme';
  static const _kCopiesPerOrder = 'copies_per_order';
  static const _kAlarmVolume = 'alarm_volume';
  static const _kAlarmMode = 'alarm_mode';
  static const _kAlarmTone = 'alarm_tone';

  Future<TerminalSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    final modeName = prefs.getString(_kAlarmMode);
    final toneName = prefs.getString(_kAlarmTone);
    return TerminalSettings(
      darkTheme: prefs.getBool(_kDarkTheme) ?? true,
      copiesPerOrder: prefs.getInt(_kCopiesPerOrder) ?? 1,
      alarmVolume: prefs.getInt(_kAlarmVolume) ?? 80,
      alarmMode: AlarmMode.values.where((m) => m.name == modeName).firstOrNull ?? AlarmMode.untilConfirmed,
      alarmTone: AlarmTone.values.where((t) => t.name == toneName).firstOrNull ?? AlarmTone.siren,
    );
  }

  Future<void> setDarkTheme(bool dark) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kDarkTheme, dark);
  }

  Future<void> setCopiesPerOrder(int copies) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kCopiesPerOrder, copies.clamp(1, 3));
  }

  Future<void> setAlarmVolume(int volume) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kAlarmVolume, volume.clamp(0, 100));
  }

  Future<void> setAlarmMode(AlarmMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAlarmMode, mode.name);
  }

  Future<void> setAlarmTone(AlarmTone tone) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAlarmTone, tone.name);
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
