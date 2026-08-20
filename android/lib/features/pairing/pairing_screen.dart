import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

import '../../providers.dart';

class PairingScreen extends ConsumerStatefulWidget {
  const PairingScreen({super.key});

  @override
  ConsumerState<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends ConsumerState<PairingScreen> {
  final _deviceIdController = TextEditingController();
  final _secretController = TextEditingController();
  bool _pairing = false;
  String? _error;

  @override
  void dispose() {
    _deviceIdController.dispose();
    _secretController.dispose();
    super.dispose();
  }

  Future<void> _pair(String deviceId, String secret) async {
    if (deviceId.isEmpty || secret.isEmpty) {
      setState(() => _error = 'Enter the device ID and secret.');
      return;
    }
    setState(() {
      _pairing = true;
      _error = null;
    });
    try {
      await ref.read(sessionProvider.notifier).pair(deviceId, secret);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Terminal paired · listening for orders')),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _pairing = false);
    }
  }

  Future<void> _scanQr() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _QrScannerScreen()),
    );
    if (result == null) return;
    // Admin's Devices page encodes the pairing QR as
    // JSON.stringify({ deviceId, secret }) — see admin-frontend/src/pages/Devices.tsx.
    try {
      final payload = jsonDecode(result) as Map<String, dynamic>;
      final deviceId = payload['deviceId'] as String?;
      final secret = payload['secret'] as String?;
      if (deviceId == null || secret == null) throw const FormatException();
      await _pair(deviceId, secret);
    } catch (_) {
      setState(() => _error = 'Unrecognised QR code.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(12)),
                      child: const Center(
                        child: SizedBox(width: 16, height: 16, child: DecoratedBox(decoration: BoxDecoration(color: Colors.white))),
                      ),
                    ),
                    const SizedBox(height: 22),
                    const Text('Pair this terminal', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 23)),
                    const SizedBox(height: 8),
                    Text(
                      'Scan the QR code shown when this terminal was registered in the admin dashboard, or enter the device ID and secret by hand.',
                      style: TextStyle(color: Theme.of(context).textTheme.bodyMedium?.color?.withValues(alpha: 0.6), fontSize: 13.5, height: 1.55),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _pairing ? null : _scanQr,
                      icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                      label: const Text('Scan QR to pair'),
                    ),
                    const SizedBox(height: 22),
                    Row(
                      children: [
                        Expanded(child: Divider(color: scheme.outline)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text('or', style: TextStyle(fontSize: 11, letterSpacing: 0.08, color: scheme.outline)),
                        ),
                        Expanded(child: Divider(color: scheme.outline)),
                      ],
                    ),
                    const SizedBox(height: 22),
                    const Text('Device ID', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5)),
                    const SizedBox(height: 7),
                    TextField(
                      controller: _deviceIdController,
                      style: const TextStyle(fontFamily: 'monospace'),
                      decoration: const InputDecoration(isDense: true),
                    ),
                    const SizedBox(height: 16),
                    const Text('Secret', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5)),
                    const SizedBox(height: 7),
                    TextField(
                      controller: _secretController,
                      obscureText: true,
                      decoration: const InputDecoration(isDense: true),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
                    ],
                    const SizedBox(height: 22),
                    OutlinedButton(
                      onPressed: _pairing ? null : () => _pair(_deviceIdController.text.trim(), _secretController.text.trim()),
                      child: _pairing
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Pair terminal'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QrScannerScreen extends StatefulWidget {
  const _QrScannerScreen();

  @override
  State<_QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<_QrScannerScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Stopping the camera stream before popping avoids a black-screen bug on
  // some devices (e.g. Mali GPUs): popping while CameraX is still bound to
  // its preview surface races the FlutterView recompositing and can leave
  // the whole app painted solid black.
  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    _handled = true;
    await _controller.stop();
    if (mounted) Navigator.of(context).pop(raw);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan pairing QR')),
      body: MobileScanner(
        controller: _controller,
        onDetect: _onDetect,
        errorBuilder: (context, error, child) => _ScannerError(error: error, onRetry: () => _controller.start()),
      ),
    );
  }
}

/// mobile_scanner's own auto-resume (on returning from the background) skips restarting the
/// camera once permission has been denied once - it checks the controller's cached
/// hasCameraPermission flag and bails, so even granting the permission in system Settings and
/// coming straight back to this screen won't self-heal. This screen needs its own explicit
/// "try again" after that round trip.
class _ScannerError extends StatelessWidget {
  const _ScannerError({required this.error, required this.onRetry});

  final MobileScannerException error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final permissionDenied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    // The errorCode message is a generic canned string ("An unexpected error occurred" for
    // genericError) - errorDetails carries the actual native/platform exception, which is what
    // actually explains a genericError (permissionDenied is already self-explanatory). Falls
    // back to the exception's own toString() (errorCode name + raw platform code/message) so
    // there's always *something* diagnostic on screen, even if the native side sent no message.
    final detail = error.errorDetails?.message?.trim();
    final diagnostic = (detail != null && detail.isNotEmpty) ? detail : error.toString();
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_rounded, color: Colors.white70, size: 42),
              const SizedBox(height: 16),
              Text(
                permissionDenied
                    ? 'Camera permission is needed to scan the pairing QR code.'
                    : 'Could not start the camera: ${error.errorCode.message}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 14.5),
              ),
              if (!permissionDenied) ...[
                const SizedBox(height: 8),
                Text(
                  diagnostic,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
              const SizedBox(height: 20),
              if (permissionDenied)
                FilledButton(
                  onPressed: () => ph.openAppSettings(),
                  child: const Text('Open app settings'),
                )
              else
                FilledButton(onPressed: onRetry, child: const Text('Try again')),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                style: TextButton.styleFrom(foregroundColor: Colors.white70),
                child: const Text('Enter device ID and secret instead'),
              ),
              if (permissionDenied) ...[
                const SizedBox(height: 10),
                TextButton(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(foregroundColor: Colors.white70),
                  child: const Text('Try again'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
