/// Mirrors backend/admin-frontend DTOs exactly - see the archived Kotlin
/// implementation (git show archive/kotlin-pos:.../pos/data/model/*.kt) which
/// this is a straight port of. Order/payment status are opaque, admin-
/// configurable strings, never a fixed enum - see [OrderStatusDefinition].

class ApiResponse<T> {
  final bool success;
  final int statusCode;
  final String message;
  final T? data;

  ApiResponse({required this.success, required this.statusCode, required this.message, this.data});

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic) parseData) {
    return ApiResponse(
      success: json['success'] as bool,
      statusCode: json['statusCode'] as int,
      message: json['message'] as String? ?? '',
      data: json['data'] == null ? null : parseData(json['data']),
    );
  }
}

class DeviceTokenResponse {
  final String accessToken;
  final DateTime accessTokenExpiresAt;
  final String restaurantName;

  DeviceTokenResponse({required this.accessToken, required this.accessTokenExpiresAt, required this.restaurantName});

  factory DeviceTokenResponse.fromJson(Map<String, dynamic> json) => DeviceTokenResponse(
        accessToken: json['accessToken'] as String,
        accessTokenExpiresAt: DateTime.parse(json['accessTokenExpiresAt'] as String),
        restaurantName: json['restaurantName'] as String,
      );
}

class OrderStatusDefinition {
  final String id;
  final String name;
  final int displayOrder;
  final bool countsAsPending;
  final bool countsAsCompleted;
  final bool isDefault;

  OrderStatusDefinition({
    required this.id,
    required this.name,
    required this.displayOrder,
    required this.countsAsPending,
    required this.countsAsCompleted,
    required this.isDefault,
  });

  factory OrderStatusDefinition.fromJson(Map<String, dynamic> json) => OrderStatusDefinition(
        id: json['id'] as String,
        name: json['name'] as String,
        displayOrder: json['displayOrder'] as int,
        countsAsPending: json['countsAsPending'] as bool,
        countsAsCompleted: json['countsAsCompleted'] as bool,
        isDefault: json['isDefault'] as bool,
      );
}

class PaymentStatusDefinition {
  final String id;
  final String name;
  final int displayOrder;
  final bool isDefault;

  PaymentStatusDefinition({
    required this.id,
    required this.name,
    required this.displayOrder,
    required this.isDefault,
  });

  factory PaymentStatusDefinition.fromJson(Map<String, dynamic> json) => PaymentStatusDefinition(
        id: json['id'] as String,
        name: json['name'] as String,
        displayOrder: json['displayOrder'] as int,
        isDefault: json['isDefault'] as bool,
      );
}

class OrderListItem {
  final String id;
  final String orderNumber;
  final String orderType;
  final String status;
  final String paymentStatus;
  final String paymentMethod;
  final double totalAmount;
  final String? customerName;
  final DateTime createdAt;

  OrderListItem({
    required this.id,
    required this.orderNumber,
    required this.orderType,
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.totalAmount,
    required this.customerName,
    required this.createdAt,
  });

  OrderListItem copyWith({String? status, String? paymentStatus}) => OrderListItem(
        id: id,
        orderNumber: orderNumber,
        orderType: orderType,
        status: status ?? this.status,
        paymentStatus: paymentStatus ?? this.paymentStatus,
        paymentMethod: paymentMethod,
        totalAmount: totalAmount,
        customerName: customerName,
        createdAt: createdAt,
      );

  factory OrderListItem.fromJson(Map<String, dynamic> json) => OrderListItem(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String,
        orderType: json['orderType'] as String,
        status: json['status'] as String,
        paymentStatus: json['paymentStatus'] as String,
        paymentMethod: json['paymentMethod'] as String,
        totalAmount: (json['totalAmount'] as num).toDouble(),
        customerName: json['customerName'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class OrderListPage {
  final List<OrderListItem> items;
  final int totalCount;

  OrderListPage({required this.items, required this.totalCount});

  factory OrderListPage.fromJson(Map<String, dynamic> json) => OrderListPage(
        items: (json['items'] as List).map((e) => OrderListItem.fromJson(e as Map<String, dynamic>)).toList(),
        totalCount: json['totalCount'] as int,
      );
}

class OrderItemModifier {
  final String id;
  final String nameSnapshot;
  final double priceDeltaSnapshot;

  OrderItemModifier({required this.id, required this.nameSnapshot, required this.priceDeltaSnapshot});

  factory OrderItemModifier.fromJson(Map<String, dynamic> json) => OrderItemModifier(
        id: json['id'] as String,
        nameSnapshot: json['nameSnapshot'] as String,
        priceDeltaSnapshot: (json['priceDeltaSnapshot'] as num).toDouble(),
      );
}

class OrderItem {
  final String id;
  final String nameSnapshot;
  final double unitPriceSnapshot;
  final int quantity;
  final String? specialInstructions;
  final double lineTotal;
  final List<OrderItemModifier> modifiers;

  OrderItem({
    required this.id,
    required this.nameSnapshot,
    required this.unitPriceSnapshot,
    required this.quantity,
    required this.specialInstructions,
    required this.lineTotal,
    required this.modifiers,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id: json['id'] as String,
        nameSnapshot: json['nameSnapshot'] as String,
        unitPriceSnapshot: (json['unitPriceSnapshot'] as num).toDouble(),
        quantity: json['quantity'] as int,
        specialInstructions: json['specialInstructions'] as String?,
        lineTotal: (json['lineTotal'] as num).toDouble(),
        modifiers: (json['modifiers'] as List).map((e) => OrderItemModifier.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class OrderDetail {
  final String id;
  final String orderNumber;
  final String orderType;
  final String status;
  final String paymentStatus;
  final String paymentMethod;
  final double subtotal;
  final double deliveryFee;
  final double processingFee;
  final double discountAmount;
  final double totalAmount;
  final String? customerName;
  final String? customerPhone;
  final String? customerEmail;
  final String? specialRequests;
  final DateTime createdAt;
  final List<OrderItem> items;

  OrderDetail({
    required this.id,
    required this.orderNumber,
    required this.orderType,
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.subtotal,
    required this.deliveryFee,
    required this.processingFee,
    required this.discountAmount,
    required this.totalAmount,
    required this.customerName,
    required this.customerPhone,
    required this.customerEmail,
    required this.specialRequests,
    required this.createdAt,
    required this.items,
  });

  factory OrderDetail.fromJson(Map<String, dynamic> json) => OrderDetail(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String,
        orderType: json['orderType'] as String,
        status: json['status'] as String,
        paymentStatus: json['paymentStatus'] as String,
        paymentMethod: json['paymentMethod'] as String,
        subtotal: (json['subtotal'] as num).toDouble(),
        deliveryFee: (json['deliveryFee'] as num).toDouble(),
        processingFee: (json['processingFee'] as num).toDouble(),
        discountAmount: (json['discountAmount'] as num).toDouble(),
        totalAmount: (json['totalAmount'] as num).toDouble(),
        customerName: json['customerName'] as String?,
        customerPhone: json['customerPhone'] as String?,
        customerEmail: json['customerEmail'] as String?,
        specialRequests: json['specialRequests'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        items: (json['items'] as List).map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

/// The envelope EventsController writes for every SSE message:
/// {"event":"OrderCreated","data":{...}}. There's no SSE `event:` line - the
/// event name lives inside the JSON payload, same as the Kotlin client.
sealed class OrderEvent {
  const OrderEvent();
}

class OrderCreatedEvent extends OrderEvent {
  final String orderId;
  const OrderCreatedEvent(this.orderId);
}

class OrderStatusChangedEvent extends OrderEvent {
  final String orderId;
  final String status;
  const OrderStatusChangedEvent(this.orderId, this.status);
}

class PaymentReceivedEvent extends OrderEvent {
  final String orderId;
  const PaymentReceivedEvent(this.orderId);
}

OrderEvent? parseOrderEvent(Map<String, dynamic> envelope) {
  final event = envelope['event'] as String?;
  final data = envelope['data'] as Map<String, dynamic>?;
  final orderId = data?['orderId'] as String?;
  if (event == null || orderId == null) return null;
  switch (event) {
    case 'OrderCreated':
      return OrderCreatedEvent(orderId);
    case 'OrderStatusChanged':
      final status = data?['status'] as String?;
      return status == null ? null : OrderStatusChangedEvent(orderId, status);
    case 'PaymentReceived':
      return PaymentReceivedEvent(orderId);
    default:
      return null;
  }
}
