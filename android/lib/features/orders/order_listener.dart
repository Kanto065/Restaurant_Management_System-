import 'dart:async';

import 'package:flutter/foundation.dart';
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
        // Reads (and if needed, refreshes) the token fresh on every connect
        // attempt - the device token is short-lived, and ApiClient's normal
        // on-401 retry only covers _request() calls, not this hand-rolled
        // SSE connection, so without this an expired token here would 401
        // forever instead of self-healing on the next reconnect.
        final token = await ref.read(apiClientProvider).ensureFreshAccessToken();
        await for (final event in repo.eventStream(bearerToken: token)) {
          if (cancelled) return;
          backoff = _initialBackoff;
          debugPrint('[SSE] handling event: ${event.runtimeType}');
          await repo.onEvent(event);
        }
        debugPrint('[SSE] event loop ended without error (stream closed)');
      } catch (e) {
        debugPrint('[SSE] listenWithReconnect caught: $e');
      }
      if (cancelled) return;
      debugPrint('[SSE] reconnecting in ${backoff.inSeconds}s');
      await Future.delayed(backoff);
      backoff = Duration(milliseconds: (backoff.inMilliseconds * 2).clamp(0, _maxBackoff.inMilliseconds));
    }
  }

  listenWithReconnect();
});
