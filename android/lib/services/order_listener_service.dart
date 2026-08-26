import 'dart:async';
import 'dart:ui';

import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../api/sse_client.dart';
import '../api/token_store.dart';

const _initialBackoff = Duration(seconds: 2);
const _maxBackoff = Duration(seconds: 30);

const _foregroundChannelId = 'order_listener';
const _foregroundChannelName = 'Order listener';
const _foregroundNotificationId = 1001;
const _newOrderChannelId = 'new_order_alert';
const _newOrderChannelName = 'New order alerts';
const _newOrderNotificationId = 1002;

final _localNotifications = FlutterLocalNotificationsPlugin();

/// Starts an Android foreground service that keeps a second SSE connection to
/// api/events/orders alive independent of the Flutter UI isolate, so a new
/// order is never missed just because the screen is off or the app has been
/// minimized. order_listener.dart (the foreground listener driving the UI and
/// the in-app alarm/queue) keeps working exactly as before whenever the app
/// is actually in front - this is purely the always-on safety net behind it.
///
/// This does NOT reuse the native "com.porttennanttandoori.pos/alarm" channel
/// (AlarmPlugin.kt) for the custom siren/bell/chime tones: that channel is
/// only wired up to the foreground UI's FlutterEngine in MainActivity, and
/// isn't reachable from this service's separate headless engine without
/// turning AlarmPlugin into a fully registered Flutter plugin package - a
/// bigger structural change left for later if needed. Instead, while the app
/// is backgrounded, a new order raises a high-priority local notification
/// (its own sound + heads-up banner), which is a plugin
/// (flutter_local_notifications) that registers correctly on any engine.
Future<void> initOrderListenerService() async {
  await _localNotifications.initialize(
    const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
  );
  final androidPlugin = _localNotifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
    _foregroundChannelId,
    _foregroundChannelName,
    description: 'Keeps listening for new orders while the app is in the background.',
    importance: Importance.low,
  ));
  await androidPlugin?.createNotificationChannel(const AndroidNotificationChannel(
    _newOrderChannelId,
    _newOrderChannelName,
    description: 'Alerts when a new order arrives while the app is backgrounded.',
    importance: Importance.max,
  ));

  final service = FlutterBackgroundService();
  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: _onStart,
      autoStart: true,
      isForegroundMode: true,
      notificationChannelId: _foregroundChannelId,
      initialNotificationTitle: 'Listening for orders',
      initialNotificationContent: 'The POS is running in the background.',
      foregroundServiceNotificationId: _foregroundNotificationId,
      foregroundServiceTypes: [AndroidForegroundType.dataSync],
    ),
    iosConfiguration: IosConfiguration(),
  );
  service.startService();
}

/// Runs in a background isolate backed by its own headless FlutterEngine -
/// the entrypoint has to be a top-level (or static) function annotated
/// vm:entry-point so the Android side can find it after a fresh app start.
@pragma('vm:entry-point')
void _onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  var appInForeground = false;
  service.on('app_foreground').listen((_) => appInForeground = true);
  service.on('app_background').listen((_) => appInForeground = false);
  service.on('stop_service').listen((_) => service.stopSelf());

  final notifications = FlutterLocalNotificationsPlugin();
  await notifications.initialize(
    const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
  );

  final apiClient = ApiClient(tokenStore: TokenStore());
  final sseClient = SseClient();
  var forceRelogin = false;
  var backoff = _initialBackoff;

  while (true) {
    try {
      final token = forceRelogin ? await apiClient.forceReLogin() : await apiClient.ensureFreshAccessToken();
      forceRelogin = false;
      await for (final event in sseClient.stream(bearerToken: token)) {
        backoff = _initialBackoff;
        if (event is OrderCreatedEvent && !appInForeground) {
          await notifications.show(
            _newOrderNotificationId,
            'New order received',
            'Open the POS app to confirm order #${event.orderId}.',
            const NotificationDetails(
              android: AndroidNotificationDetails(
                _newOrderChannelId,
                _newOrderChannelName,
                importance: Importance.max,
                priority: Priority.high,
                playSound: true,
                enableVibration: true,
              ),
            ),
          );
        }
      }
    } catch (e) {
      // A definite 401 forces a real re-login on the next attempt, same as
      // order_listener.dart - anything else just backs off and retries.
      if (e is SseUnauthorizedException) forceRelogin = true;
    }
    await Future.delayed(backoff);
    backoff = Duration(milliseconds: (backoff.inMilliseconds * 2).clamp(0, _maxBackoff.inMilliseconds));
  }
}
