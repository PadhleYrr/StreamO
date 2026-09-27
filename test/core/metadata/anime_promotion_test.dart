import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/metadata/metadata_enrichment.dart';

// Proves the guard that promotes a movie-typed title to anime: it fires ONLY on
// an exact normalized title match AND a year within ±1. Anything looser is
// rejected, so a real movie can't be mislabeled as anime.
void main() {
  List<Map<String, dynamic>> c(
    String romaji,
    int year, {
    int idMal = 111,
    String? english,
  }) =>
      [
        {
          'idMal': idMal,
          'seasonYear': year,
          'title': {'romaji': romaji, 'english': english},
        },
      ];

  final match = MetadataEnrichment.confidentAnimeMalId;

  group('promotes on a confident match', () {
    test('exact title + same year → returns the MAL id', () {
      expect(match('Frieren', 2023, c('Frieren', 2023, idMal: 52991)), 52991);
    });
    test('year off by 1 still matches', () {
      expect(match('Frieren', 2024, c('Frieren', 2023)), 111);
    });
    test('punctuation/spacing is ignored (Re:Zero == Re Zero)', () {
      expect(match('Re Zero', 2016, c('Re:ZERO', 2016)), 111);
    });
    test('matches on the english title too', () {
      expect(
        match('Your Name', 2016, c('Kimi no Na wa', 2016, english: 'Your Name')),
        111,
      );
    });
  });

  group('rejects anything not confident (no false promotion)', () {
    test('year off by 3 → null (a live-action remake, say)', () {
      expect(match('Frieren', 2020, c('Frieren', 2023)), isNull);
    });
    test('partial / contains title → null', () {
      expect(match('Frieren', 2023, c('Frieren: Beyond Journey', 2023)), isNull);
    });
    test('candidate with no year → null (can\'t verify)', () {
      expect(match('Frieren', 2023, [
        {'idMal': 111, 'title': {'romaji': 'Frieren'}},
      ]), isNull);
    });
    test('no candidates → null', () {
      expect(match('Frieren', 2023, const []), isNull);
    });
    test('empty query title → null', () {
      expect(match('', 2023, c('Frieren', 2023)), isNull);
    });
  });

  // The MovieBox case: a movie source lists one entry with the LATEST year;
  // AniList splits it per season with a "Season N" marker on the title.
  group('season / sequel matching (the MovieBox case)', () {
    test('base title matches the year-correct "Season 4" entry', () {
      // Source: "The Rising of the Shield Hero", year 2025.
      // AniList: S1 exact/2019 (wrong year) + S4 "...Season 4"/2025.
      final cands = [
        {'idMal': 1, 'seasonYear': 2019, 'title': {'romaji': 'x', 'english': 'The Rising of the Shield Hero'}},
        {'idMal': 4, 'seasonYear': 2025, 'title': {'romaji': 'x', 'english': 'The Rising of the Shield Hero Season 4'}},
      ];
      expect(match('The Rising of the Shield Hero', 2025, cands), 4);
    });
    test('"2nd Season" marker matches', () {
      expect(match('Re Zero', 2020, c('Re:ZERO 2nd Season', 2020)), 111);
    });
    test('roman-numeral sequel (Overlord III) matches', () {
      expect(match('Overlord', 2018, c('Overlord III', 2018)), 111);
    });

    test('SAFETY: "Monster" does NOT grab "Monster Musume"', () {
      // Same-year prefix, but "Musume" is not a season marker → reject.
      expect(match('Monster', 2015, c('Monster Musume', 2015)), isNull);
    });
    test('SAFETY: a subtitle (not a season) is not matched from a bare base', () {
      expect(match('Frieren', 2023, c('Frieren: Beyond Journey', 2023)), isNull);
    });
  });
}
