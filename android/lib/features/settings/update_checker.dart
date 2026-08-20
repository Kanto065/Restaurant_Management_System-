import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

const _versionUrl = 'https://admin.porttennanttandoori.co.uk/download/pos-version';
const _apkUrl = 'https://admin.porttennanttandoori.co.uk/download/pos';

class UpdateInfo {
  final int buildNumber;
  final String versionName;
  const UpdateInfo({required this.buildNumber, required this.versionName});
}

class UpdateCheckException implements Exception {
  final String message;
  UpdateCheckException(this.message);
  @override
  String toString() => message;
}

/// Polls the same version.json the "Android POS release" CI workflow uploads to MinIO
/// alongside the APK on every build touching android/** (see android-release.yml and
/// deploy/caddy/Caddyfile's /download/pos-version, /download/pos routes) - works the same
/// whether the repo is public or private, since it never touches GitHub at runtime.
class UpdateChecker {
  Future<PackageInfo> _installedInfo() => PackageInfo.fromPlatform();

  Future<String> installedVersionLabel() async {
    final info = await _installedInfo();
    return 'PTT POS v${info.version} (${info.buildNumber})';
  }

  /// Returns the remote build's info if it's newer than what's installed, or null if this
  /// terminal is already on the latest version.
  Future<UpdateInfo?> checkForUpdate() async {
    final installed = await _installedInfo();
    final installedBuild = int.tryParse(installed.buildNumber) ?? 0;

    final http.Response response;
    try {
      response = await http.get(Uri.parse(_versionUrl)).timeout(const Duration(seconds: 10));
    } catch (_) {
      throw UpdateCheckException('Could not reach the update server. Check the connection and try again.');
    }
    if (response.statusCode != 200) {
      throw UpdateCheckException('Could not reach the update server (${response.statusCode}).');
    }

    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final remoteBuild = json['buildNumber'] as int;
    final remoteVersion = json['versionName'] as String;

    if (remoteBuild <= installedBuild) return null;
    return UpdateInfo(buildNumber: remoteBuild, versionName: remoteVersion);
  }

  /// Downloads the latest APK and hands it to the system installer. Android still requires the
  /// user to tap through the install prompt (there's no device-owner/system privilege here for a
  /// silent self-update) and, on first use, to grant "install unknown apps" for this app
  /// specifically - a permissionDenied result means that hasn't been granted yet.
  Future<void> downloadAndInstall({void Function(double progress)? onProgress}) async {
    final client = http.Client();
    final List<int> bytes;
    try {
      final response = await client.send(http.Request('GET', Uri.parse(_apkUrl))).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw UpdateCheckException('Download failed (${response.statusCode}).');
      }
      final total = response.contentLength ?? 0;
      var received = 0;
      final buffer = <int>[];
      await for (final chunk in response.stream) {
        buffer.addAll(chunk);
        received += chunk.length;
        if (total > 0) onProgress?.call(received / total);
      }
      bytes = buffer;
    } catch (e) {
      if (e is UpdateCheckException) rethrow;
      throw UpdateCheckException('Download failed: $e');
    } finally {
      client.close();
    }

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/porttennanttandoori-pos-update.apk');
    await file.writeAsBytes(bytes, flush: true);

    final result = await OpenFilex.open(file.path, type: 'application/vnd.android.package-archive');
    if (result.type != ResultType.done) {
      throw UpdateCheckException(_describeOpenResult(result));
    }
  }

  String _describeOpenResult(OpenResult result) {
    switch (result.type) {
      case ResultType.permissionDenied:
        return 'Allow "Install unknown apps" for this app in Settings, then try again.';
      case ResultType.noAppToOpen:
        return 'No installer app found on this device.';
      case ResultType.fileNotFound:
        return 'The downloaded update file went missing.';
      case ResultType.done:
      case ResultType.error:
        return result.message;
    }
  }
}
