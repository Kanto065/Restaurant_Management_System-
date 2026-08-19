import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'features/app_shell.dart';
import 'features/pairing/pairing_screen.dart';
import 'providers.dart';
import 'theme.dart';

void main() {
  runApp(const ProviderScope(child: PosApp()));
}

class PosApp extends ConsumerWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider).valueOrNull;
    final brightness = (settings?.darkTheme ?? true) ? Brightness.dark : Brightness.light;

    return MaterialApp(
      title: 'PTT POS Terminal',
      debugShowCheckedModeBanner: false,
      theme: buildPosTheme(brightness),
      home: const _Root(),
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
