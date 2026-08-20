import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers.dart';

/// Order IDs currently sitting in the restaurant's starting ("Pending")
/// status - the full-screen takeover queues through these one at a time and
/// the alarm rings for as long as this list is non-empty. Recomputed
/// whenever the order list or status definitions change.
final incomingOrderIdsProvider = Provider<List<String>>((ref) {
  ref.watch(ordersProvider);
  final repo = ref.watch(ordersRepositoryProvider);
  return repo.ordersAwaitingConfirmation.map((o) => o.id).toList();
});
