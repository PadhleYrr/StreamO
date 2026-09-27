import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:watch_app/core/anilist/anilist_service.dart';
import 'package:watch_app/core/tracker/mal_service.dart';
import 'package:watch_app/core/tracker/relay/tracker_relay.dart';
import 'package:watch_app/core/tracker/simkl_service.dart';
import 'package:watch_app/features/auth/send_trackers_to_tv_screen.dart';
import 'package:watch_app/features/auth/tv_pairing_service.dart';

// ── Fakes (same pattern as test/features/shell/root_shell_tv_test.dart) ────

class _FakeAniListService extends ChangeNotifier implements AniListService {
  _FakeAniListService({required this.isConnected, this.viewerName});

  @override
  noSuchMethod(Invocation i) => super.noSuchMethod(i);

  @override
  final bool isConnected;

  @override
  String get displayName => 'AniList';

  @override
  final String? viewerName;

  @override
  String? get viewerAvatar => null;

  @override
  Map<String, dynamic>? exportSession() =>
      isConnected ? {'token': 'fake-anilist-token'} : null;
}

class _FakeMalService extends ChangeNotifier implements MalService {
  _FakeMalService({required this.isConnected, this.viewerName});

  @override
  noSuchMethod(Invocation i) => super.noSuchMethod(i);

  @override
  final bool isConnected;

  @override
  String get displayName => 'MyAnimeList';

  @override
  final String? viewerName;

  @override
  String? get viewerAvatar => null;

  @override
  Map<String, dynamic>? exportSession() =>
      isConnected ? {'token': 'fake-mal-token'} : null;
}

class _FakeSimklService extends ChangeNotifier implements SimklService {
  _FakeSimklService({required this.isConnected, this.viewerName});

  @override
  noSuchMethod(Invocation i) => super.noSuchMethod(i);

  @override
  final bool isConnected;

  @override
  String get displayName => 'Simkl';

  @override
  final String? viewerName;

  @override
  String? get viewerAvatar => null;

  @override
  Map<String, dynamic>? exportSession() =>
      isConnected ? {'token': 'fake-simkl-token'} : null;
}

/// Stub — the widget test never taps Send, so `approve` is never invoked.
class _FakeTvPairingService implements TvPairingService {
  @override
  noSuchMethod(Invocation i) => super.noSuchMethod(i);

  @override
  Future<bool> approve(String code, {String? trackerBlob, bool trackersOnly = false}) async => true;
}

void _register(
  GetIt sl, {
  required bool aniConnected,
  required bool malConnected,
  required bool simklConnected,
}) {
  final ani = _FakeAniListService(isConnected: aniConnected, viewerName: aniConnected ? 'kai' : null);
  final mal = _FakeMalService(isConnected: malConnected, viewerName: malConnected ? 'kai' : null);
  final simkl = _FakeSimklService(isConnected: simklConnected, viewerName: simklConnected ? 'kai' : null);
  sl.registerSingleton<AniListService>(ani);
  sl.registerSingleton<MalService>(mal);
  sl.registerSingleton<SimklService>(simkl);
  sl.registerSingleton<TrackerRelay>(
      TrackerRelay({'anilist': ani, 'mal': mal, 'simkl': simkl}));
  sl.registerSingleton<TvPairingService>(_FakeTvPairingService());
}

void main() {
  final sl = GetIt.instance;
  tearDown(sl.reset);

  testWidgets('lists connected trackers as selectable and shows a Send button',
      (tester) async {
    _register(sl, aniConnected: true, malConnected: false, simklConnected: false);
    await tester.pumpWidget(
      const MaterialApp(home: SendTrackersToTvScreen(code: 'ABCD2345', nonce: 'x')),
    );
    await tester.pumpAndSettle();
    expect(find.text('AniList'), findsOneWidget);
    expect(find.text('Send to TV'), findsOneWidget);
    // A not-connected tracker offers Connect instead of a checkbox.
    expect(find.text('Connect'), findsWidgets);
  });
}
