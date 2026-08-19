import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'models.dart';

/// A 401 specifically, distinguished from other non-200s so the caller
/// (OrderListener) can force a real re-login on the next attempt instead of
/// trusting the client-side expiry check, which can't predict every reason a
/// token gets rejected (revoked device, backend restart invalidating
/// sessions, clock drift).
class SseUnauthorizedException implements Exception {
  @override
  String toString() => 'SSE connection failed: 401';
}

/// Reads api/events/orders. The server sends every message as a bare `data:`
/// line (no `event:` line), so the event name is parsed out of the JSON body
/// - same as OrderEventsClient.kt. `package:http` has no built-in
/// reconnecting EventSource, so this is a hand-rolled line-buffered SSE
/// parser over a streamed GET; reconnection with backoff is the caller's job
/// (see OrdersRepository.listenWithReconnect).
class SseClient {
  SseClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  final http.Client _http;

  Stream<OrderEvent> stream({String? bearerToken}) {
    late StreamController<OrderEvent> controller;
    StreamSubscription<String>? sub;
    http.StreamedResponse? response;

    Future<void> start() async {
      debugPrint('[SSE] connecting, bearerToken=${bearerToken == null ? 'null' : 'present (${bearerToken.length} chars)'}');
      final request = http.Request('GET', Uri.parse('$apiBaseUrl/api/events/orders'));
      request.headers['Accept'] = 'text/event-stream';
      if (bearerToken != null) request.headers['Authorization'] = 'Bearer $bearerToken';

      try {
        response = await _http.send(request);
      } catch (e) {
        debugPrint('[SSE] send() failed: $e');
        controller.addError(e);
        return;
      }
      debugPrint('[SSE] connected, status=${response!.statusCode}');
      if (response!.statusCode == 401) {
        controller.addError(SseUnauthorizedException());
        return;
      }
      if (response!.statusCode != 200) {
        controller.addError(Exception('SSE connection failed: ${response!.statusCode}'));
        return;
      }

      final buffer = StringBuffer();
      sub = response!.stream.transform(utf8.decoder).listen(
        (chunk) {
          debugPrint('[SSE] chunk received (${chunk.length} chars): ${chunk.replaceAll('\n', '\\n')}');
          buffer.write(chunk);
          while (true) {
            final text = buffer.toString();
            final newlineIndex = text.indexOf('\n');
            if (newlineIndex == -1) break;
            final line = text.substring(0, newlineIndex).trim();
            buffer
              ..clear()
              ..write(text.substring(newlineIndex + 1));
            if (line.startsWith('data:')) {
              final payload = line.substring(5).trim();
              if (payload.isEmpty) continue;
              final event = _parseEvent(payload);
              debugPrint('[SSE] parsed event: ${event?.runtimeType ?? 'null (unparseable: $payload)'}');
              if (event != null) controller.add(event);
            }
          }
        },
        onError: (e) {
          debugPrint('[SSE] stream error: $e');
          controller.addError(e);
        },
        onDone: () {
          debugPrint('[SSE] stream closed (onDone)');
          controller.close();
        },
      );
    }

    controller = StreamController<OrderEvent>(
      onListen: start,
      onCancel: () async {
        await sub?.cancel();
      },
    );
    return controller.stream;
  }

  OrderEvent? _parseEvent(String data) {
    try {
      final envelope = jsonDecode(data) as Map<String, dynamic>;
      return parseOrderEvent(envelope);
    } catch (_) {
      return null;
    }
  }
}
