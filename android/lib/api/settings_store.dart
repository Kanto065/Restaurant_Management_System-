import 'package:shared_preferences/shared_preferences.dart';

enum AlarmMode { untilConfirmed, tenSeconds, thirtySeconds, off }

class TerminalSettings {
  static const printerSunmi = 'sunmi';
  static const printerStar = 'star';
  static const printerEpson = 'epson';

  final bool darkTheme;
  final String printerId;
  final int copiesPerOrder;
  final int alarmVolume;
  final AlarmMode alarmMode;

  const TerminalSettings({
    this.darkTheme = true,
    this.printerId = printerSunmi,
    this.copiesPerOrder = 1,
    this.alarmVolume = 80,
    this.alarmMode = AlarmMode.untilConfirmed,
  });

  TerminalSettings copyWith({
    bool? darkTheme,
    String? printerId,
    int? copiesPerOrder,
    int? alarmVolume,
    AlarmMode? alarmMode,
  }) {
    return TerminalSettings(
      darkTheme: darkTheme ?? this.darkTheme,
      printerId: printerId ?? this.printerId,
      copiesPerOrder: copiesPerOrder ?? this.copiesPerOrder,
      alarmVolume: alarmVolume ?? this.alarmVolume,
      alarmMode: alarmMode ?? this.alarmMode,
    );
  }
}

/// Persists terminal-local preferences (theme, printer choice, copies per
/// order, new-order alarm volume/duration) - separate from TokenStore's
/// pairing/session data since these are device preferences, not credentials,
/// and have no reason to be cleared on sign-out. Mirrors SettingsStore.kt.
class SettingsStore {
  static const _kDarkTheme = 'dark_theme';
  static const _kPrinterId = 'printer_id';
  static const _kCopiesPerOrder = 'copies_per_order';
  static const _kAlarmVolume = 'alarm_volume';
  static const _kAlarmMode = 'alarm_mode';

  Future<TerminalSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    final modeName = prefs.getString(_kAlarmMode);
    return TerminalSettings(
      darkTheme: prefs.getBool(_kDarkTheme) ?? true,
      printerId: prefs.getString(_kPrinterId) ?? TerminalSettings.printerSunmi,
      copiesPerOrder: prefs.getInt(_kCopiesPerOrder) ?? 1,
      alarmVolume: prefs.getInt(_kAlarmVolume) ?? 80,
      alarmMode: AlarmMode.values.where((m) => m.name == modeName).firstOrNull ?? AlarmMode.untilConfirmed,
    );
  }

  Future<void> setDarkTheme(bool dark) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kDarkTheme, dark);
  }

  Future<void> setPrinterId(String printerId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPrinterId, printerId);
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
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
