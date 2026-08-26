import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import 'features/app_shell.dart';
import 'features/pairing/pairing_screen.dart';
import 'providers.dart';
import 'services/order_listener_service.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Dedicated, always-plugged-in counter terminal - the screen should never
  // sleep so the app stays foregrounded and its SSE order listener keeps
  // running. The background service below is the safety net for whenever
  // that's not enough (screen off despite this, app minimized, OS restart).
  unawaited(WakelockPlus.enable());
  unawaited(initOrderListenerService());
  runApp(const ProviderScope(child: PosApp()));
}

class PosApp extends StatefulWidget {
  const PosApp({super.key});

  @override
  State<PosApp> createState() => _PosAppState();
}

class _PosAppState extends State<PosApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Tells the background listener service whether the foreground UI is
  // actually visible, so it only raises its own "new order" notification
  // when this Activity isn't the one already showing/alarming for it.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final event = state == AppLifecycleState.resumed ? 'app_foreground' : 'app_background';
    FlutterBackgroundService().invoke(event);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final settings = ref.watch(settingsProvider).valueOrNull;
        final brightness = (settings?.darkTheme ?? true) ? Brightness.dark : Brightness.light;

        return MaterialApp(
          title: 'PTT POS Terminal',
          debugShowCheckedModeBanner: false,
          theme: buildPosTheme(brightness),
          home: const _Root(),
        );
      },
    );
  }
}

class _Root extends ConsumerWidget {
  const _Root();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionAsync = ref.watch(sessionProvider);
    return sessionAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('Failed to start: $e'))),
      data: (session) => session == null ? const PairingScreen() : const AppShell(),
    );
  }
}
