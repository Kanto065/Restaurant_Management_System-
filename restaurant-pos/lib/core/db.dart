import 'dart:convert';

import 'package:sqlite3/sqlite3.dart';

import 'models.dart';

class OutboxEntry {
  OutboxEntry(this.id, this.kind, this.clientId, this.payload, this.attempts, this.lastError, this.parked);
  final int id;

  /// order | refund
  final String kind;
  final String clientId;
  final Map<String, dynamic> payload;
  final int attempts;
  final String? lastError;

  /// Rejected by the cloud (4xx): kept for a look in Settings, never retried automatically.
  final bool parked;
}

/// The till's own SQLite file (WAL, so a crash or power cut never loses a committed write).
/// Holds the mirrored catalog, every order taken on this till, and the outbox to the cloud.
class LocalDb {
  LocalDb(this._db) {
    _db.execute('PRAGMA journal_mode=WAL;');
    _db.execute('PRAGMA synchronous=NORMAL;');
    _db.execute('''
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (
        client_id TEXT PRIMARY KEY, closed_at TEXT, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS orders_closed ON orders(closed_at);
      CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, client_id TEXT NOT NULL, payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, parked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    ''');
  }

  factory LocalDb.open(String path) => LocalDb(sqlite3.open(path));
  factory LocalDb.memory() => LocalDb(sqlite3.openInMemory());

  final Database _db;

  // ---- key/value -----------------------------------------------------------

  String? get(String key) => _db.select('SELECT value FROM kv WHERE key = ?', [key]).firstOrNull?['value'] as String?;

  void set(String key, String? value) => value == null
      ? _db.execute('DELETE FROM kv WHERE key = ?', [key])
      : _db.execute('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);

  Map<String, dynamic>? getJson(String key) => switch (get(key)) { final s? => jsonDecode(s) as Map<String, dynamic>, _ => null };
  void setJson(String key, Object? value) => set(key, value == null ? null : jsonEncode(value));

  // ---- catalog ---------------------------------------------------------------

  static const catalogCollections = [
    'restaurant', 'categories', 'items', 'itemModifierGroups', 'modifierGroups', 'modifierOptions', 'tables', 'staff',
    'printers', 'orderStatuses', 'paymentStatuses',
  ];

  Catalog loadCatalog() => Catalog({
        for (final name in catalogCollections)
          name: {
            for (final e in (getJson('catalog.$name') ?? {}).entries) e.key: Map<String, dynamic>.from(e.value as Map),
          },
      });

  void saveCollection(String name, Map<String, Map<String, dynamic>> rows) => setJson('catalog.$name', rows);

  // ---- orders ----------------------------------------------------------------

  void saveOrder(PosOrder order) => _db.execute(
        'INSERT INTO orders(client_id, closed_at, json) VALUES(?, ?, ?) '
        'ON CONFLICT(client_id) DO UPDATE SET closed_at = excluded.closed_at, json = excluded.json',
        [order.clientId, order.closedAt?.toUtc().toIso8601String(), jsonEncode(order.toJson())],
      );

  void deleteOrder(String clientId) => _db.execute('DELETE FROM orders WHERE client_id = ?', [clientId]);

  List<PosOrder> openOrders() => _orders('WHERE closed_at IS NULL');

  /// Closed orders since [from] (UTC compare on the stored ISO string), newest first.
  List<PosOrder> closedSince(DateTime from) =>
      _orders('WHERE closed_at >= ? ORDER BY closed_at DESC', [from.toUtc().toIso8601String()]);

  List<PosOrder> _orders(String where, [List<Object?> args = const []]) =>
      [for (final r in _db.select('SELECT json FROM orders $where', args)) PosOrder.fromJson(jsonDecode(r['json'] as String))];

  /// Drops closed orders older than [keep] that are no longer waiting in the outbox.
  void purgeClosed(Duration keep) => _db.execute(
        'DELETE FROM orders WHERE closed_at < ? AND client_id NOT IN (SELECT client_id FROM outbox)',
        [DateTime.now().subtract(keep).toUtc().toIso8601String()],
      );

  // ---- outbox ----------------------------------------------------------------

  void enqueue(String kind, String clientId, Map<String, dynamic> payload) => _db.execute(
        'INSERT INTO outbox(kind, client_id, payload, created_at) VALUES(?, ?, ?, ?)',
        [kind, clientId, jsonEncode(payload), DateTime.now().toUtc().toIso8601String()],
      );

  List<OutboxEntry> outbox({bool parked = false, int limit = 200}) => [
        for (final r in _db.select('SELECT * FROM outbox WHERE parked = ? ORDER BY id LIMIT ?', [parked ? 1 : 0, limit]))
          OutboxEntry(r['id'] as int, r['kind'] as String, r['client_id'] as String, jsonDecode(r['payload'] as String),
              r['attempts'] as int, r['last_error'] as String?, (r['parked'] as int) == 1),
      ];

  int get pendingCount => _db.select('SELECT COUNT(*) AS n FROM outbox WHERE parked = 0').first['n'] as int;

  void outboxDone(int id) => _db.execute('DELETE FROM outbox WHERE id = ?', [id]);

  void outboxFailed(int id, String error, {required bool park}) => _db.execute(
        'UPDATE outbox SET attempts = attempts + 1, last_error = ?, parked = ? WHERE id = ?', [error, park ? 1 : 0, id]);

  /// Puts a parked record back in the queue (after fixing the cause in the admin).
  void retryParked(int id) => _db.execute('UPDATE outbox SET parked = 0, last_error = NULL WHERE id = ?', [id]);

  void transaction(void Function() body) {
    _db.execute('BEGIN');
    try {
      body();
      _db.execute('COMMIT');
    } catch (_) {
      _db.execute('ROLLBACK');
      rethrow;
    }
  }

  void close() => _db.close();
}
