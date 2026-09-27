import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/models/media_item.dart';
import 'package:watch_app/core/models/provider_info.dart';
import 'package:watch_app/features/search/bloc/search_state.dart';

MediaItem _item(String sourceId, ProviderType type) => MediaItem(
  id: '$sourceId-${type.name}',
  title: 'Result',
  url: 'https://example.com/$sourceId',
  type: type,
  sourceId: sourceId,
);

SourceResultGroup _group(String sourceId, List<ProviderType> types) =>
    SourceResultGroup(
      sourceId: sourceId,
      sourceName: sourceId,
      items: [for (final t in types) _item(sourceId, t)],
    );

void main() {
  group('sourceChipGroups (drives the filter chip row)', () {
    test('ignores the content filter so the chip row survives an empty view',
        () {
      // Two sources, each with only movies. With the "Anime" content filter,
      // visibleGroups goes empty — but sourceChipGroups must keep both so the
      // chips (and the selected one) stay on screen.
      final state = SearchState(
        status: SearchStatus.success,
        query: 'x',
        contentFilter: SearchContentFilter.anime,
        groups: [
          _group('cs:A', [ProviderType.movie]),
          _group('cs:B', [ProviderType.movie]),
        ],
      );
      expect(state.visibleGroups, isEmpty); // nothing matches the filter
      expect(state.sourceChipGroups.map((g) => g.sourceId),
          ['cs:A', 'cs:B']); // chips still there
    });

    test('drops sources that returned nothing', () {
      final state = SearchState(
        status: SearchStatus.success,
        query: 'x',
        groups: [
          _group('cs:A', [ProviderType.anime]),
          _group('cs:B', const []), // returned no results
        ],
      );
      expect(state.sourceChipGroups.map((g) => g.sourceId), ['cs:A']);
    });

    test('narrows to the active ecosystem tab', () {
      final state = SearchState(
        status: SearchStatus.success,
        query: 'x',
        ecosystem: SearchEcosystem.aniyomi,
        groups: [
          _group('ani:1', [ProviderType.anime]),
          _group('cs:B', [ProviderType.anime]),
        ],
      );
      // Only the Aniyomi source's chip shows on the Aniyomi tab.
      expect(state.sourceChipGroups.map((g) => g.sourceId), ['ani:1']);
    });
  });
}
