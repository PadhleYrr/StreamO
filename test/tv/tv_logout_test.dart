import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

// The log-out confirm content is extracted as a top-level widget so it can be
// tested without booting the whole shell/DI. See tvLogoutSheet() in
// root_shell_tv.dart.
import 'package:watch_app/features/shell/root_shell_tv.dart';

void main() {
  testWidgets('log-out sheet fires the callback on OK', (tester) async {
    var loggedOut = false;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TvLogoutSheet(onConfirm: () => loggedOut = true),
      ),
    ));
    await tester.pump();
    // The "Log out" action autofocuses; OK selects it.
    await tester.sendKeyEvent(LogicalKeyboardKey.select);
    await tester.pump();
    expect(loggedOut, isTrue);
  });
}
