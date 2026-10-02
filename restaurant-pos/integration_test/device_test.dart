import 'package:integration_test/integration_test.dart';

import '../test/crypto_test.dart' as crypto;
import '../test/lan_server_test.dart' as lan;
import '../test/manage_test.dart' as manage;
import '../test/pos_flow_test.dart' as flow;
import '../test/receipt_generation_test.dart' as receipts;
import '../test/tablet_test.dart' as tablet;
import '../test/workflow_test.dart' as workflow;

/// The desktop suite again, but on a real Android device: proves SQLite (native library),
/// PIN hashing, the LAN server, sockets and WebSockets all work there, not just on Windows.
/// Run: `flutter test integration_test -d <device id>`
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  crypto.main();
  flow.main();
  receipts.main();
  lan.main();
  tablet.main();
  workflow.main();
  manage.main();
}
