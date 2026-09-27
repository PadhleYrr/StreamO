import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/models/provider_info.dart';
import 'package:watch_app/core/provider/cloudstream_provider.dart';

// Proves the fix: an anime-ONLY CloudStream source must not let a coarse
// per-item TvType (many plugins tag anime episodes as "TvSeries"/"Movie")
// mislabel a title as movie. Mixed/non-anime sources stay exactly as before.
void main() {
  CloudStreamProvider src(List<String> types) =>
      CloudStreamProvider(name: 'X', lang: 'en', types: types);

  group('anime-only source → items stay anime (the fix)', () {
    final s = src(const ['Anime', 'AnimeMovie', 'OVA']);

    test('a "TvSeries" item is anime (BEFORE the fix this was movie)', () {
      expect(s.itemType('TvSeries'), ProviderType.anime);
    });
    test('a "Movie" item is anime (BEFORE the fix this was movie)', () {
      expect(s.itemType('Movie'), ProviderType.anime);
    });
    test('a null / absent type is anime', () {
      expect(s.itemType(null), ProviderType.anime);
    });
  });

  group('mixed source (anime + movie) → unchanged, no regression', () {
    final s = src(const ['Anime', 'Movie']);

    test('"TvSeries" stays movie (per-item hint still wins)', () {
      expect(s.itemType('TvSeries'), ProviderType.movie);
    });
    test('"Anime" stays anime', () {
      expect(s.itemType('Anime'), ProviderType.anime);
    });
  });

  group('non-anime source → unchanged', () {
    final s = src(const ['Movie', 'TvSeries']);

    test('"TvSeries" is movie', () {
      expect(s.itemType('TvSeries'), ProviderType.movie);
    });
    test('an item a plugin tags "Anime" is anime (existing behaviour)', () {
      expect(s.itemType('Anime'), ProviderType.anime);
    });
  });
}
