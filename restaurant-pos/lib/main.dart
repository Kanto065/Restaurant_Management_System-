import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import 'core/db.dart';
import 'printing/printer_windows.dart';
import 'state/pos_state.dart';
import 'ui/home.dart';
import 'ui/start_screens.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dir = await getApplicationSupportDirectory();
  final db = LocalDb.open('${dir.path}${Platform.pathSeparator}pos.db');
  db.purgeClosed(const Duration(days: 60));
  PrinterService().init(db);
  runApp(ChangeNotifierProvider(create: (_) => PosState(db), child: const PosApp()));
}

class PosApp extends StatelessWidget {
  const PosApp({super.key});

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
          ? const PairingScreen()
          : state.staff == null
              ? const LockScreen()
              : const HomeShell(),
    );
  }
}
