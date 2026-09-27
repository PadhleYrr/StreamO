// libass matches `sub-font` against the family recorded INSIDE the font file,
// so a custom font registered under the wrong name renders as the default and
// the feature looks broken for exactly the people it exists for (CJK, Arabic,
// Devanagari). These run against the real fonts in assets/fonts/, so a parser
// that drifts fails here rather than on someone's TV.

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/playback/font_family_name.dart';
import 'package:watch_app/core/playback/playback_prefs.dart' show kBundledSubtitleFonts;
import 'package:watch_app/core/playback/tv_track_helpers.dart' show subtitleFontFileName;

Uint8List _font(String name) =>
    File('assets/fonts/$name').readAsBytesSync();

void main() {
  group('fontFamilyFromBytes', () {
    test('reads the family from every font the app ships or serves', () {
      // The name on the left is what libass must be told; getting any of these
      // wrong is the silent-failure case.
      const expected = {
        'Inter.ttf': 'Inter',
        'NotoSans-Regular.ttf': 'Noto Sans',
        'Poppins-Regular.ttf': 'Poppins',
        // Not 'Roboto': the file shipped under that name is the variable
        // Roboto Flex, and its name table says so. See the mismatch test below.
        'Roboto-Regular.ttf': 'Roboto Flex',
        'OpenSans-Regular.ttf': 'Open Sans',
        'Lato-Regular.ttf': 'Lato',
        'Montserrat-Regular.ttf': 'Montserrat',
        'Nunito-Regular.ttf': 'Nunito',
        'Rubik-Regular.ttf': 'Rubik',
        'SourceSans3-Regular.ttf': 'Source Sans 3',
      };
      for (final e in expected.entries) {
        expect(
          fontFamilyFromBytes(_font(e.key)),
          e.value,
          reason: '${e.key} should report "${e.value}"',
        );
      }
    });

    // Found while writing these: the app offers 'Roboto', but the file it
    // serves for it reports 'Roboto Flex'. libass matches sub-font against the
    // name in the file, so picking Roboto with styled subtitles on cannot
    // match and quietly falls back to the default font. Pinned so the day
    // someone swaps the file or renames the entry, this says why it mattered.
    test('the shipped Roboto file does not match the name we advertise', () {
      expect(fontFamilyFromBytes(_font('Roboto-Regular.ttf')), 'Roboto Flex');
      expect(kBundledSubtitleFonts, contains('Roboto'));
      expect(subtitleFontFileName('Roboto'), 'Roboto-Regular.ttf');
    });

    test('a family name never comes back padded or empty', () {
      final name = fontFamilyFromBytes(_font('Inter.ttf'))!;
      expect(name, name.trim());
      expect(name, isNotEmpty);
    });

    test('garbage is null, not an exception', () {
      expect(fontFamilyFromBytes(Uint8List(0)), isNull);
      expect(fontFamilyFromBytes(Uint8List.fromList([1, 2, 3])), isNull);
      // Plausible header, no tables behind it.
      expect(
        fontFamilyFromBytes(Uint8List.fromList(List.filled(64, 0))),
        isNull,
      );
    });

    test('a truncated font is null rather than a crash', () {
      final full = _font('Inter.ttf');
      // Header and table directory survive, the name table does not.
      expect(fontFamilyFromBytes(full.sublist(0, 200)), isNull);
    });

    test('a font with no name table is null', () {
      // Real header claiming zero tables.
      final b = Uint8List(12)
        ..[0] = 0x00
        ..[1] = 0x01
        ..[2] = 0x00
        ..[3] = 0x00;
      expect(fontFamilyFromBytes(b), isNull);
    });
  });
}
