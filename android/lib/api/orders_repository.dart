import 'dart:async';

import 'api_client.dart';
import 'models.dart';
import 'sse_client.dart';

/// Holds the terminal's working set of orders in memory, kept current by a
/// REST refresh plus whatever the SSE stream feeds it. No local cache - orders
/// are re-fetched from the API on cold start. Direct port of
/// OrdersRepository.kt's semantics onto a StreamController-based API.
class OrdersRepository {
  OrdersRepository({required this.apiClient, required this.sseClient});

  final ApiClient apiClient;
  final SseClient sseClient;

  final _ordersController = StreamController<List<OrderListItem>>.broadcast();
  final _orderStatusDefsController = StreamController<List<OrderStatusDefinition>>.broadcast();
  final _paymentStatusDefsController = StreamController<List<PaymentStatusDefinition>>.broadcast();

  List<OrderListItem> _orders = [];
  List<OrderStatusDefinition> _orderStatusDefs = [];
  List<PaymentStatusDefinition> _paymentStatusDefs = [];

  List<OrderListItem> get orders => _orders;
  List<OrderStatusDefinition> get orderStatusDefinitions => _orderStatusDefs;
  List<PaymentStatusDefinition> get paymentStatusDefinitions => _paymentStatusDefs;

  Stream<List<OrderListItem>> get ordersStream => _ordersController.stream;
  Stream<List<OrderStatusDefinition>> get orderStatusDefinitionsStream => _orderStatusDefsController.stream;
  Stream<List<PaymentStatusDefinition>> get paymentStatusDefinitionsStream => _paymentStatusDefsController.stream;

  /// Orders still sitting in the restaurant's starting status
  /// (isDefault=true, "Pending" out of the box) - these are the ones the
  /// new-order alarm/takeover keeps ringing for until staff confirm/cancel.
  List<OrderListItem> get ordersAwaitingConfirmation {
    final startingStatus = _orderStatusDefs.where((d) => d.isDefault).firstOrNull?.name;
    if (startingStatus == null) return const [];
    return _orders.where((o) => o.status == startingStatus).toList();
  }

  Future<void> loadStatusDefinitions() async {
    try {
      _orderStatusDefs = await apiClient.listOrderStatusDefinitions();
      _orderStatusDefsController.add(_orderStatusDefs);
    } catch (_) {
      // Non-fatal: stays empty until a later refresh succeeds.
    }
    try {
      _paymentStatusDefs = await apiClient.listPaymentStatusDefinitions();
      _paymentStatusDefsController.add(_paymentStatusDefs);
    } catch (_) {
      // Same as above.
    }
  }

  Future<void> refresh() async {
    // loadStatusDefinitions() only otherwise runs once at startup - retry it
    // on every refresh (every OrderCreated/PaymentReceived event, not just
    // cold start) until it actually succeeds, or the new-order alarm and
    // takeover screen silently stop matching anything forever.
    if (_orderStatusDefs.isEmpty || _paymentStatusDefs.isEmpty) {
      await loadStatusDefinitions();
    }
    final page = await apiClient.listOrders();
    _orders = page.items;
    _ordersController.add(_orders);
  }

  Future<OrderListPage> searchOrders({
    String? status,
    String? paymentStatus,
    String? search,
    String? dateFrom,
    String? dateTo,
    required int page,
    required int pageSize,
  }) =>
      apiClient.searchOrders(
        status: status,
        paymentStatus: paymentStatus,
        search: search,
        dateFrom: dateFrom,
        dateTo: dateTo,
        page: page,
        pageSize: pageSize,
      );

  Future<OrderDetail> getOrder(String id) => apiClient.getOrder(id);

  Future<OrderDetail> updateStatus(String orderId, String status, {String? note}) async {
    final detail = await apiClient.updateOrderStatus(orderId, status, note: note);
    _applyStatusLocally(orderId, status);
    return detail;
  }

  Future<OrderDetail> updatePaymentStatus(String orderId, String paymentStatus) async {
    final detail = await apiClient.updatePaymentStatus(orderId, paymentStatus);
    _applyPaymentStatusLocally(orderId, paymentStatus);
    return detail;
  }

  Stream<OrderEvent> eventStream({String? bearerToken}) => sseClient.stream(bearerToken: bearerToken);

  Future<void> onEvent(OrderEvent event) async {
    switch (event) {
      case OrderCreatedEvent():
        await refresh();
      case OrderStatusChangedEvent(:final orderId, :final status):
        _applyStatusLocally(orderId, status);
      case PaymentReceivedEvent():
        await refresh();
    }
  }

  void _applyStatusLocally(String orderId, String status) {
    _orders = _orders.map((o) => o.id == orderId ? o.copyWith(status: status) : o).toList();
    _ordersController.add(_orders);
  }

  void _applyPaymentStatusLocally(String orderId, String paymentStatus) {
    _orders = _orders.map((o) => o.id == orderId ? o.copyWith(paymentStatus: paymentStatus) : o).toList();
    _ordersController.add(_orders);
  }

  void dispose() {
    _ordersController.close();
    _orderStatusDefsController.close();
    _paymentStatusDefsController.close();
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

/// Mirrors StatusColors.kt's nextStatusAfter: one step past the current
/// status's displayOrder, falling back to itself if there's nowhere to go.
String nextStatusAfter(String current, List<OrderStatusDefinition> definitions) {
  final sorted = [...definitions]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  final index = sorted.indexWhere((d) => d.name == current);
  if (index == -1 || index + 1 >= sorted.length) return current;
  return sorted[index + 1].name;
}

/// The terminal status - matched by name like the admin dashboard - falling
/// back to the literal name if unconfigured.
String cancelledStatusName(List<OrderStatusDefinition> definitions) =>
    definitions.where((d) => d.name.toLowerCase() == 'cancelled').firstOrNull?.name ?? 'Cancelled';
