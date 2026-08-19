import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'history/history_tab.dart';
import 'orders/incoming_order_screen.dart';
import 'orders/incoming_queue.dart';
import 'orders/new_order_alarm.dart';
import 'orders/order_listener.dart';
import 'orders/orders_tab.dart';
import 'settings/settings_tab.dart';

/// Tabbed shell: New Orders / History / Settings, with the incoming-order
/// takeover rendered on top of everything and the alarm controller kept
/// alive for the lifetime of the app.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _index = 0;
  final _ordersKey = GlobalKey<OrdersTabState>();
  final _historyKey = GlobalKey<HistoryTabState>();
  final _settingsKey = GlobalKey<SettingsTabState>();

  @override
  Widget build(BuildContext context) {
    ref.watch(newOrderAlarmProvider); // keep the alarm controller alive
    ref.watch(orderListenerProvider); // keep the SSE listener alive
    final badgeCount = ref.watch(incomingOrderIdsProvider).length;

    final tabs = [
      OrdersTab(key: _ordersKey),
      HistoryTab(key: _historyKey),
      SettingsTab(key: _settingsKey),
    ];

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(index: _index, children: tabs),
          const IncomingOrderOverlay(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
            icon: badgeCount > 0 ? Badge(label: Text('$badgeCount'), child: const Icon(Icons.receipt_long_outlined)) : const Icon(Icons.receipt_long_outlined),
            label: 'New Orders',
          ),
          const NavigationDestination(icon: Icon(Icons.history_rounded), label: 'History'),
          const NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'Settings'),
        ],
      ),
    );
  }
}
