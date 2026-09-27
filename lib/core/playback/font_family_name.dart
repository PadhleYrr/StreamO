import 'dart:convert';
import 'dart:typed_data';

/// The family name written inside a TrueType/OpenType font file.
///
/// Needed because libass matches `sub-font` against the family recorded in the
/// font itself, not against the filename or any label we invent. A custom font
/// registered under the wrong name renders as the default and looks like the
/// feature is broken — see `PlayerController.applySubtitleStyle`.
///
/// Flutter's `FontLoader` and Android's `Typeface.createFromFile` both take the
/// file directly and do not care about the name, so this only has to be right
/// for the libass path. Callers fall back to the filename when it returns null.
///
/// Returns null rather than throwing on anything unexpected: a font we cannot
/// read is still usable everywhere except libass, so a bad parse must not stop
/// the user adding it.
String? fontFamilyFromBytes(Uint8List bytes) {
  try {
    final d = ByteData.sublistView(bytes);
    // sfnt header: tag(4) numTables(2) searchRange(2) entrySelector(2)
    // rangeShift(2), then one 16-byte record per table.
    if (bytes.length < 12) return null;
    final numTables = d.getUint16(4);
    var nameOffset = -1;
    for (var i = 0; i < numTables; i++) {
      final rec = 12 + i * 16;
      if (rec + 16 > bytes.length) return null;
      // Tag is four ASCII bytes; compare without allocating a string.
      if (d.getUint8(rec) == 0x6E && // n
          d.getUint8(rec + 1) == 0x61 && // a
          d.getUint8(rec + 2) == 0x6D && // m
          d.getUint8(rec + 3) == 0x65) {
        nameOffset = d.getUint32(rec + 8);
        break;
      }
    }
    if (nameOffset < 0 || nameOffset + 6 > bytes.length) return null;

    final count = d.getUint16(nameOffset + 2);
    final storage = nameOffset + d.getUint16(nameOffset + 4);

    // nameID 16 is the typographic family ("Noto Sans"); nameID 1 is the
    // legacy family, which on a weighted face can read "Noto Sans SemiBold".
    // Prefer 16, fall back to 1 — libass wants the family, not the face.
    String? typographic;
    String? legacy;

    for (var i = 0; i < count; i++) {
      final rec = nameOffset + 6 + i * 12;
      if (rec + 12 > bytes.length) break;
      final platform = d.getUint16(rec);
      final encoding = d.getUint16(rec + 2);
      final nameId = d.getUint16(rec + 6);
      if (nameId != 1 && nameId != 16) continue;
      final len = d.getUint16(rec + 8);
      final off = storage + d.getUint16(rec + 10);
      if (len == 0 || off + len > bytes.length) continue;

      final raw = bytes.sublist(off, off + len);
      String? value;
      if (platform == 3 && (encoding == 1 || encoding == 0)) {
        // Windows: UTF-16BE.
        if (len.isEven) {
          final units = <int>[];
          for (var j = 0; j < len; j += 2) {
            units.add((raw[j] << 8) | raw[j + 1]);
          }
          value = String.fromCharCodes(units);
        }
      } else if (platform == 1 && encoding == 0) {
        // Macintosh Roman — ASCII for every name we care about.
        value = latin1.decode(raw, allowInvalid: true);
      }

      value = value?.trim();
      if (value == null || value.isEmpty) continue;
      if (nameId == 16) {
        typographic ??= value;
      } else {
        legacy ??= value;
      }
    }
    return typographic ?? legacy;
  } catch (_) {
    return null;
  }
}
