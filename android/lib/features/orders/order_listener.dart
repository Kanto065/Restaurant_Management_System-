import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers.dart';

const _initialBackoff = Duration(seconds: 2);
const _maxBackoff = Duration(seconds: 30);

/// Keeps the SSE connection to api/events/orders alive for the lifetime of
/// the app, reconnecting with exponential backoff on failure - mirrors
/// OrderListenerService.kt's listenWithReconnect, minus the Android
/// foreground-service piece (Flutter has no direct equivalent; the stream
/// simply runs for as long as the app process is alive).
final orderListenerProvider = Provider<void>((ref) {
  final repo = ref.watch(ordersRepositoryProvider);
  var cancelled = false;
  ref.onDispose(() => cancelled = true);

  Future<void> listenWithReconnect() async {
    var backoff = _initialBackoff;
    while (!cancelled) {
      try {
        final session = ref.read(sessionProvider).valueOrNull;
        await for (final event in repo.eventStream(bearerToken: session?.accessToken)) {
          if (cancelled) return;
          backoff = _initialBackoff;
          await repo.onEvent(event);
        }
      } catch (_) {
        // Connection dropped or failed - back off and retry.
      }
      if (cancelled) return;
      await Future.delayed(backoff);
      backoff = Duration(milliseconds: (backoff.inMilliseconds * 2).clamp(0, _maxBackoff.inMilliseconds));
    }
  }

  listenWithReconnect();
});
