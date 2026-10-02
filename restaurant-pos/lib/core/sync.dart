import 'dart:async';
import 'dart:io';

import 'api.dart';
import 'crypto.dart';
import 'db.dart';

enum LicenceState { active, grace, expired }

/// The signed licence from the cloud. Checked offline against the public key pinned at
/// pairing, so a subscription still runs out on time when the shop has no internet.
class Licence {
  Licence(this.payload);
  final Map<String, dynamic> payload;

  Map<String, bool> get features => {for (final e in (payload['features'] as Map? ?? {}).entries) e.key as String: e.value == true};
  DateTime? get subscriptionEnd => payload['subscriptionEnd'] == null ? null : DateTime.parse(payload['subscriptionEnd']);
  int get graceDays => payload['graceDays'] ?? 0;
  DateTime get issuedAt => DateTime.parse(payload['issuedAt']);

  bool has(String feature) => features[feature] == true;

  LicenceState stateAt(DateTime now) {
    if (payload['access'] == 'Expired') return LicenceState.expired;
    final end = subscriptionEnd;
    if (end == null || !now.isAfter(end)) return LicenceState.active;
    return now.isAfter(end.add(Duration(days: graceDays))) ? LicenceState.expired : LicenceState.grace;
  }

  /// Verifies [signed] ({payload, signature, publicKey}) against [pinnedKey]; null when it fails.
  static Licence? verify(Map<String, dynamic> signed, String pinnedKey) {
    if (signed['publicKey'] != pinnedKey) return null;
    final ok = verifyLicenceSignature(payload: signed['payload'], signature: signed['signature'], publicKeySpki: pinnedKey);
    return ok ? Licence(decodeLicencePayload(signed['payload'])) : null;
  }
}

/// Collections that come as rows with an "id" and may change one row at a time.
const _deltaCollections = ['categories', 'items', 'itemModifierGroups', 'modifierGroups', 'modifierOptions', 'tables'];

/// Applies a config-snapshot (or a changes response) to the local store. Snapshot: replace
/// everything. Changes: upsert the rows sent, then drop any row whose id isn't in liveIds
/// (that's how deletes arrive - some admin screens hard-delete). Small sets are always whole.
/// Returns an error message when the licence didn't verify (the old licence is kept).
String? applyConfig(LocalDb db, Map<String, dynamic> data, {required bool full}) {
  String? warning;
  db.transaction(() {
    Map<String, Map<String, dynamic>> byId(List rows, [String key = 'id']) =>
        {for (final r in rows) (r as Map)[key].toString(): Map<String, dynamic>.from(r)};

    final liveIds = data['liveIds'] as Map<String, dynamic>?;
    for (final name in _deltaCollections) {
      final incoming = byId(data[name] as List? ?? []);
      if (full) {
        db.saveCollection(name, incoming);
        continue;
      }
      final current = db.loadCatalog().collections[name] ?? {};
      current.addAll(incoming);
      final live = (liveIds?[name] as List?)?.map((e) => e.toString()).toSet();
      if (live != null) current.removeWhere((id, _) => !live.contains(id));
      db.saveCollection(name, current);
    }
    db.saveCollection('staff', byId(data['staff'] as List? ?? []));
    db.saveCollection('printers', byId(data['printers'] as List? ?? [], 'name'));
    db.saveCollection('orderStatuses', byId(data['orderStatuses'] as List? ?? [], 'name'));
    db.saveCollection('paymentStatuses', byId(data['paymentStatuses'] as List? ?? [], 'name'));
    if (data['restaurant'] case final Map r) db.saveCollection('restaurant', {'restaurant': Map<String, dynamic>.from(r)});

    if (data['licence'] case final Map signed) {
      final s = Map<String, dynamic>.from(signed);
      final pinned = db.get('licence.publicKey') ?? s['publicKey'] as String; // trust on first pairing
      final licence = Licence.verify(s, pinned);
      if (licence == null) {
        warning = 'The licence from the server did not verify. Keeping the last good one.';
      } else {
        db.set('licence.publicKey', pinned);
        db.setJson('licence', licence.payload);
      }
    }
    db.set('sync.since', data['serverTime'] as String);
  });
  return warning;
}

/// Keeps the till in step with the cloud: pulls config every minute and pushes closed orders
/// and refunds from the outbox. Everything in the shop keeps working while this is offline.
class SyncService {
  SyncService(this.db, this.api, {this.onChanged});

  final LocalDb db;
  final CloudApi api;
  final void Function()? onChanged;

  bool online = false;
  bool signedOut = false;
  DateTime? lastSync;
  String? lastError;
  Timer? _timer;
  Future<void>? _round;

  Future<void> pullSnapshot() async {
    final data = await api.get('/api/pos/config-snapshot') as Map<String, dynamic>;
    lastError = applyConfig(db, data, full: true);
    lastSync = DateTime.now();
    online = true;
    onChanged?.call();
  }

  void start({Duration every = const Duration(seconds: 60)}) {
    _timer?.cancel();
    _timer = Timer.periodic(every, (_) => syncNow());
    syncNow();
  }

  void stop() => _timer?.cancel();

  /// One round: config changes, then the outbox. Safe to call any time (e.g. right after a sale
  /// or an edit): if a round is already running it waits for it, then runs its own, so a change
  /// made just now is always pulled.
  Future<void> syncNow() async {
    while (_round != null) {
      await _round;
    }
    final round = _round = _syncRound();
    try {
      await round;
    } finally {
      _round = null;
    }
  }

  Future<void> _syncRound() async {
    try {
      final since = db.get('sync.since');
      if (since == null) {
        await pullSnapshot();
      } else {
        final data = await api.get('/api/pos/changes?since=${Uri.encodeQueryComponent(since)}') as Map<String, dynamic>;
        lastError = applyConfig(db, data, full: false);
      }
      await drainOutbox();
      online = true;
      signedOut = false;
      lastSync = DateTime.now();
    } on ApiException catch (e) {
      online = e.statusCode != 401;
      signedOut = e.statusCode == 401;
      lastError = signedOut ? 'This till has been signed out in the admin. Pair it again in Settings.' : e.message;
    } on SocketException {
      online = false;
      lastError = 'No connection to the server. Orders are kept here and sent later.';
    } on TimeoutException {
      online = false;
      lastError = 'The server is not answering. Orders are kept here and sent later.';
    } on HttpException {
      online = false;
      lastError = 'No connection to the server.';
    } finally {
      onChanged?.call();
    }
  }

  /// Sends queued orders/refunds in one batch. Each record succeeds or fails on its own: a
  /// rejected record is parked (shown in Settings) and never blocks the others.
  Future<void> drainOutbox() async {
    final entries = db.outbox();
    if (entries.isEmpty) return;
    final results = await api.post('/api/pos/orders/sync', {
      'orders': [for (final e in entries.where((e) => e.kind == 'order')) e.payload],
      'refunds': [for (final e in entries.where((e) => e.kind == 'refund')) e.payload],
    }) as List;
    db.transaction(() {
      for (final r in results.cast<Map>()) {
        final entry = entries.where((e) => e.kind == r['kind'] && e.clientId == r['clientId']).firstOrNull;
        if (entry == null) continue;
        if (r['ok'] == true) {
          db.outboxDone(entry.id);
        } else {
          // A refund can arrive before its order is accepted: retry it next round instead.
          db.outboxFailed(entry.id, r['error'] ?? 'Rejected', park: r['errorCode'] != 'ORDER_NOT_FOUND');
        }
      }
    });
  }
}
