import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart' as ph;
import 'package:sunmi_scanner/sunmi_scanner.dart';

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

/// Sunmi V2/V2 Pro/P2 terminals have a dedicated hardware barcode/QR scan
/// engine (bound via the com.sunmi.scanner AIDL service - see sunmi_scanner)
/// separate from the general-purpose camera; mobile_scanner's CameraX-based
/// approach proved unreliable on this hardware (worked in a debug build,
/// silently failed in release). This screen checks for that hardware first
/// and uses it when present, falling back to the generic camera (mobile_scanner)
/// for any device without it - a dev phone, an emulator, or a Sunmi model
/// this scanner package doesn't recognise.
class _QrScannerScreen extends StatefulWidget {
  const _QrScannerScreen();

  @override
  State<_QrScannerScreen> createState() => _QrScannerScreenState();
}

enum _ScannerBackend { checking, sunmiHardware, genericCamera }

class _QrScannerScreenState extends State<_QrScannerScreen> {
  _ScannerBackend _backend = _ScannerBackend.checking;
  bool _handled = false;

  // Generic-camera path
  MobileScannerController? _cameraController;

  // Sunmi hardware-scanner path
  StreamSubscription<String>? _sunmiBarcodeSub;
  StreamSubscription<ScannerConnectionStatus>? _sunmiStatusSub;
  String? _sunmiError;

  @override
  void initState() {
    super.initState();
    _init();
  }

  // isScannerAvailable() calls GET_MODEL, which only works once the AIDL
  // service connection has actually completed - bindService() itself just
  // *starts* that (async) connection. Checking availability before binding
  // always hit "service not bound" here, regardless of whether the hardware
  // scanner actually exists, so this binds first and waits for the real
  // CONNECTED/FAILED_TO_CONNECT event (with a timeout as a backstop) before
  // deciding which backend to use.
  Future<void> _init() async {
    final connected = Completer<bool>();
    _sunmiStatusSub = SunmiScanner.onScannerStatusChanged().listen((status) {
      if (!connected.isCompleted) {
        connected.complete(status == ScannerConnectionStatus.connected);
        return;
      }
      if (mounted && status == ScannerConnectionStatus.failedToConnect) {
        setState(() => _sunmiError = 'Could not connect to the hardware scanner.');
      }
    });

    var sunmiReady = false;
    try {
      await SunmiScanner.bindService(showToast: false);
      sunmiReady = await connected.future.timeout(const Duration(seconds: 3), onTimeout: () => false);
      if (sunmiReady) {
        final model = await SunmiScanner.getScannerModel();
        sunmiReady = model > 100;
      }
    } catch (_) {
      sunmiReady = false;
    }

    if (!mounted) return;

    if (sunmiReady) {
      setState(() {
        _backend = _ScannerBackend.sunmiHardware;
        // The AIDL scan engine has no video feed of its own (see class doc) - this
        // controller only drives a cosmetic camera preview behind the Sunmi status
        // panel, and doubles as a backup decode path if the camera manages to read
        // the code before the hardware trigger does. If it fails to start (the
        // release-build CameraX issue on this legacy-HAL hardware), errorBuilder
        // below just falls back to a black background - the Sunmi path still works.
        _cameraController = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
      });
      _sunmiBarcodeSub = SunmiScanner.onBarcodeScanned().listen(_onDetected);
      SunmiScanner.scan();
    } else {
      await _sunmiStatusSub?.cancel();
      _sunmiStatusSub = null;
      await SunmiScanner.unbindService();
      setState(() {
        _backend = _ScannerBackend.genericCamera;
        _cameraController = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
      });
    }
  }

  // Stopping the camera stream before popping avoids a black-screen bug on
  // some devices (e.g. Mali GPUs): popping while CameraX is still bound to
  // its preview surface races the FlutterView recompositing and can leave
  // the whole app painted solid black. Single entry point for both the Sunmi
  // hardware decode and the (optional, cosmetic-or-backup) camera decode.
  Future<void> _onDetected(String raw) async {
    if (_handled || raw.isEmpty) return;
    _handled = true;
    if (_backend == _ScannerBackend.sunmiHardware) SunmiScanner.stop();
    await _cameraController?.stop();
    if (mounted) Navigator.of(context).pop(raw);
  }

  void _onCameraDetect(BarcodeCapture capture) {
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw != null) _onDetected(raw);
  }

  @override
  void dispose() {
    _sunmiBarcodeSub?.cancel();
    _sunmiStatusSub?.cancel();
    if (_backend == _ScannerBackend.sunmiHardware) {
      SunmiScanner.stop();
      SunmiScanner.unbindService();
    }
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan pairing QR')),
      body: switch (_backend) {
        _ScannerBackend.checking => const ColoredBox(color: Colors.black, child: Center(child: CircularProgressIndicator())),
        _ScannerBackend.sunmiHardware => Stack(
            fit: StackFit.expand,
            children: [
              MobileScanner(
                controller: _cameraController,
                onDetect: _onCameraDetect,
                errorBuilder: (context, error, child) => const ColoredBox(color: Colors.black),
              ),
              _SunmiScannerBody(error: _sunmiError, onScan: SunmiScanner.scan, overlay: true),
            ],
          ),
        _ScannerBackend.genericCamera => MobileScanner(
            controller: _cameraController,
            onDetect: _onCameraDetect,
            errorBuilder: (context, error, child) => _ScannerError(error: error, onRetry: () => _cameraController?.start()),
          ),
      },
    );
  }
}

/// The hardware scanner has no camera preview of its own - it's a dedicated
/// scan engine, not a viewfinder - so this is status text plus a manual
/// "Scan" button for re-triggering (the trigger key on the terminal itself
/// also starts a scan, this just covers the on-screen path). When [overlay]
/// is set, this renders as a translucent bottom panel over a cosmetic camera
/// preview instead of filling the whole screen (see the sunmiHardware case
/// in _QrScannerScreenState.build).
class _SunmiScannerBody extends StatelessWidget {
  const _SunmiScannerBody({required this.error, required this.onScan, this.overlay = false});

  final String? error;
  final VoidCallback onScan;
  final bool overlay;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: EdgeInsets.fromLTRB(28, overlay ? 20 : 0, 28, overlay ? 16 : 0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            error != null ? Icons.error_outline_rounded : Icons.qr_code_scanner_rounded,
            color: Colors.white70,
            size: overlay ? 36 : 56,
          ),
          SizedBox(height: overlay ? 10 : 16),
          Text(
            error ?? 'Point the terminal at the QR code and tap Scan.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 15),
          ),
          SizedBox(height: overlay ? 16 : 24),
          FilledButton(onPressed: onScan, child: const Text('Scan')),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            style: TextButton.styleFrom(foregroundColor: Colors.white70),
            child: const Text('Enter device ID and secret instead'),
          ),
        ],
      ),
    );

    if (!overlay) {
      return ColoredBox(color: Colors.black, child: Center(child: content));
    }

    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: Color(0xCC000000),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(top: false, child: content),
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
