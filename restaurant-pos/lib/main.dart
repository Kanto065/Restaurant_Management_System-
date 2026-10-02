import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import 'core/db.dart';
import 'hub/lan_server.dart';
import 'printing/printer_windows.dart';
import 'state/pos_state.dart';
import 'tablet/tablet_screens.dart';
import 'tablet/tablet_state.dart';
import 'ui/home.dart';
import 'ui/start_screens.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dir = await getApplicationSupportDirectory();
  final db = LocalDb.open('${dir.path}${Platform.pathSeparator}pos.db');
  runApp(RootApp(db: db));
}

/// One codebase, two jobs (design 3.3): the main till (Windows) or a waiter tablet (Android).
/// The choice is kept in the local db; an unpaired device can switch on its first screen.
class RootApp extends StatefulWidget {
  const RootApp({super.key, required this.db});
  final LocalDb db;

  @override
  State<RootApp> createState() => _RootAppState();
}

class _RootAppState extends State<RootApp> {
  late String _mode = widget.db.get('mode') ?? (Platform.isAndroid ? 'tablet' : 'till');
  PosState? _till;
  TabletState? _tablet;

  void _switch(String mode) {
    widget.db.set('mode', mode);
    _till?.stop();
    _till?.lan?.stop();
    setState(() {
      _mode = mode;
      _till = null;
      _tablet = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_mode == 'tablet') {
      final tablet = _tablet ??= TabletState(widget.db);
      return ChangeNotifierProvider.value(value: tablet, child: TabletApp(onUseAsTill: () => _switch('till')));
    }
    final till = _till ??= () {
      widget.db.purgeClosed(const Duration(days: 60));
      PrinterService().init(widget.db);
      final s = PosState(widget.db);
      s.lan = LanServer(s)..start(); // the main POS serves the waiter tablets
      return s;
    }();
    return ChangeNotifierProvider.value(value: till, child: PosApp(onUseAsTablet: () => _switch('tablet')));
  }
}

class PosApp extends StatelessWidget {
  const PosApp({super.key, this.onUseAsTablet});
  final VoidCallback? onUseAsTablet;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<PosState>();
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Restaurant POS',
      theme: posTheme(Brightness.light),
      darkTheme: posTheme(Brightness.dark),
      themeMode: state.themeMode,
      home: !state.isPaired
          ? PairingScreen(onUseAsTablet: onUseAsTablet)
          : state.staff == null
              ? const LockScreen()
              : const HomeShell(),
    );
  }
}
