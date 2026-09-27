import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/tracker/relay/tracker_blob.dart';

void main() {
  test('encode → decode round-trips trackers verbatim', () {
    const blob = TrackerBlob(
      version: TrackerBlob.currentVersion,
      trackers: {
        'anilist': {'accessToken': 'a', 'expiresAt': 123, 'viewerId': 7},
        'mal': {'accessToken': 'm', 'refreshToken': 'r', 'expiresAt': 456},
      },
    );
    final back = TrackerBlob.decode(blob.encode());
    expect(back.version, 1);
    expect(back.trackers['anilist'], {'accessToken': 'a', 'expiresAt': 123, 'viewerId': 7});
    expect(back.trackers['mal']!['refreshToken'], 'r');
    expect(back.trackers.containsKey('simkl'), isFalse);
  });

  test('fromJson tolerates a missing/absent trackers map and version', () {
    final b = TrackerBlob.fromJson(const {});
    expect(b.version, 0);
    expect(b.trackers, isEmpty);
  });
}
