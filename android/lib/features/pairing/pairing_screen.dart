import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

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
    // Expect the paired QR payload as "deviceId:secret".
    final parts = result.split(':');
    if (parts.length != 2) {
      setState(() => _error = 'Unrecognised QR code.');
      return;
    }
    await _pair(parts[0], parts[1]);
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

class _QrScannerScreen extends StatelessWidget {
  const _QrScannerScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan pairing QR')),
      body: MobileScanner(
        onDetect: (capture) {
          final barcode = capture.barcodes.firstOrNull;
          final raw = barcode?.rawValue;
          if (raw != null) Navigator.of(context).pop(raw);
        },
      ),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
