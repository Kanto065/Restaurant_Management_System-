import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/auth_repository.dart';
import 'api/models.dart';
import 'api/orders_repository.dart';
import 'api/settings_store.dart';
import 'api/sse_client.dart';
import 'api/token_store.dart';
import 'features/printing/printer_service.dart';

final tokenStoreProvider = Provider((ref) => TokenStore());
final apiClientProvider = Provider((ref) => ApiClient(tokenStore: ref.watch(tokenStoreProvider)));
final authRepositoryProvider =
    Provider((ref) => AuthRepository(apiClient: ref.watch(apiClientProvider), tokenStore: ref.watch(tokenStoreProvider)));
final ordersRepositoryProvider =
    Provider((ref) => OrdersRepository(apiClient: ref.watch(apiClientProvider), sseClient: SseClient()));
final settingsStoreProvider = Provider((ref) => SettingsStore());
final printerServiceProvider = Provider((ref) => PrinterService());

/// The current paired session, or null if unpaired. Drives whether the app
/// shows Pairing or the tabbed shell.
class SessionNotifier extends AsyncNotifier<DeviceSession?> {
  @override
  Future<DeviceSession?> build() async {
    return ref.read(authRepositoryProvider).restoreSession();
  }

  Future<void> pair(String deviceId, String secret) async {
    final session = await ref.read(authRepositoryProvider).pairAndLogin(deviceId, secret);
    state = AsyncValue.data(session);
  }

  Future<void> signOut() async {
    await ref.read(authRepositoryProvider).signOut();
    state = const AsyncValue.data(null);
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, DeviceSession?>(SessionNotifier.new);

class SettingsNotifier extends AsyncNotifier<TerminalSettings> {
  @override
  Future<TerminalSettings> build() => ref.read(settingsStoreProvider).load();

  Future<void> setDarkTheme(bool dark) async {
    await ref.read(settingsStoreProvider).setDarkTheme(dark);
    state = AsyncValue.data(state.requireValue.copyWith(darkTheme: dark));
  }

  Future<void> setPrinterId(String id) async {
    await ref.read(settingsStoreProvider).setPrinterId(id);
    state = AsyncValue.data(state.requireValue.copyWith(printerId: id));
  }

  Future<void> setCopiesPerOrder(int copies) async {
    await ref.read(settingsStoreProvider).setCopiesPerOrder(copies);
    state = AsyncValue.data(state.requireValue.copyWith(copiesPerOrder: copies.clamp(1, 3)));
  }

  Future<void> setAlarmVolume(int volume) async {
    await ref.read(settingsStoreProvider).setAlarmVolume(volume);
    state = AsyncValue.data(state.requireValue.copyWith(alarmVolume: volume.clamp(0, 100)));
  }

  Future<void> setAlarmMode(AlarmMode mode) async {
    await ref.read(settingsStoreProvider).setAlarmMode(mode);
    state = AsyncValue.data(state.requireValue.copyWith(alarmMode: mode));
  }

  Future<void> setAlarmTone(AlarmTone tone) async {
    await ref.read(settingsStoreProvider).setAlarmTone(tone);
    state = AsyncValue.data(state.requireValue.copyWith(alarmTone: tone));
  }
}

final settingsProvider = AsyncNotifierProvider<SettingsNotifier, TerminalSettings>(SettingsNotifier.new);

final currencySymbolProvider = FutureProvider<String>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return '£';
  try {
    final code = await ref.read(apiClientProvider).getRestaurantCurrency();
    const symbols = {'GBP': '£', 'USD': '\$', 'EUR': '€', 'AUD': '\$', 'CAD': '\$', 'INR': '₹', 'BDT': '৳'};
    return symbols[code] ?? code;
  } catch (_) {
    return '£';
  }
});

/// Live order list + status/payment definitions, kept current by REST
/// refresh + SSE. See OrdersRepository for the underlying logic.
class OrdersNotifier extends AsyncNotifier<List<OrderListItem>> {
  @override
  Future<List<OrderListItem>> build() async {
    final repo = ref.read(ordersRepositoryProvider);
    ref.onDispose(repo.dispose);
    await repo.refresh();
    final sub = repo.ordersStream.listen((orders) => state = AsyncValue.data(orders));
    ref.onDispose(sub.cancel);
    return repo.orders;
  }

  Future<void> refresh() => ref.read(ordersRepositoryProvider).refresh();

  Future<void> updateStatus(String orderId, String status, {String? note}) =>
      ref.read(ordersRepositoryProvider).updateStatus(orderId, status, note: note);

  Future<void> updatePaymentStatus(String orderId, String paymentStatus) =>
      ref.read(ordersRepositoryProvider).updatePaymentStatus(orderId, paymentStatus);
}

final ordersProvider = AsyncNotifierProvider<OrdersNotifier, List<OrderListItem>>(OrdersNotifier.new);

final orderStatusDefinitionsProvider = Provider<List<OrderStatusDefinition>>((ref) {
  ref.watch(ordersProvider); // rebuild alongside the order list
  return ref.watch(ordersRepositoryProvider).orderStatusDefinitions;
});

final paymentStatusDefinitionsProvider = Provider<List<PaymentStatusDefinition>>((ref) {
  ref.watch(ordersProvider);
  return ref.watch(ordersRepositoryProvider).paymentStatusDefinitions;
});
