import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import '../di/injector.dart';
import '../../core/platform/app_paths.dart';

import 'playback_prefs.dart' show PlaybackPrefs;
import 'tv_track_helpers.dart' show subtitleFontAsset, subtitleFontFileName;

/// Copies / locates a subtitle font under `<appSupport>/sub_fonts/` so native
/// TV players can `Typeface.createFromFile` it.
///
/// Callers must [SubtitleFontService.ensure] download-on-demand families first.
/// Bundled APK fonts (Inter, Noto Sans) are copied from assets here.
/// Returns null for Default ('') or when the file is missing.
Future<String?> stageSubtitleFont(String family) async {
  if (family.isEmpty) return null;

  final dir = await writableAppSubdir('sub_fonts');

  final asset = subtitleFontAsset(family);
  if (asset != null) {
    // Bundled in the APK — copy from assets once.
    try {
      final out = File('${dir.path}/${asset.split('/').last}');
      if (!await out.exists()) {
        final bytes = await rootBundle.load(asset);
        await out.writeAsBytes(bytes.buffer.asUint8List(), flush: true);
      }
      return out.path;
    } catch (_) {
      return null;
    }
  }

  // A font the user added, or one downloaded on demand — both already sit in
  // this folder. Customs are looked up first because [subtitleFontFileName]
  // only knows the built-in families and answers null for anything else.
  //
  // On a TV this lookup finds nothing for a custom family (the file cannot
  // travel between devices), so it returns null and the native player falls
  // back to Typeface.DEFAULT — the same path any unknown family takes.
  final custom = sl.isRegistered<PlaybackPrefs>()
      ? sl<PlaybackPrefs>().customSubtitleFonts[family]
      : null;
  final fname = custom ?? subtitleFontFileName(family);
  if (fname == null) return null;
  final f = File('${dir.path}/$fname');
  return f.existsSync() ? f.path : null;
}
