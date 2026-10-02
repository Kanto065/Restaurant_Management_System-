import 'dart:math';

final _random = Random.secure();

/// RFC 4122 version-4 GUID, the id the cloud uses for idempotent sync (ClientId).
String newGuid() {
  final b = List<int>.generate(16, (_) => _random.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  String hex(int from, int to) => b.sublist(from, to).map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}

const emptyGuid = '00000000-0000-0000-0000-000000000000';

/// Short order number, unique per hub: "P" + base-36 of the milliseconds since 2026.
/// Never clashes with web order codes (5 random letters/digits, no "P" prefix rule needed
/// because the cloud rejects a duplicate and the record is parked for a look).
String newOrderNumber([DateTime? now]) {
  final ms = (now ?? DateTime.now()).millisecondsSinceEpoch - DateTime.utc(2026).millisecondsSinceEpoch;
  return 'P${ms.toRadixString(36).toUpperCase()}';
}
