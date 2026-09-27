import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/tracker/relay/tracker_relay_crypto.dart';

void main() {
  test('newNonce is a 32-byte base64url key and is random', () {
    final a = TrackerRelayCrypto.newNonce();
    final b = TrackerRelayCrypto.newNonce();
    expect(a, isNot(equals(b)));
    // base64url of 32 bytes = 43 chars (no padding).
    expect(a.length, 43);
  });

  test('encrypt → decrypt round-trips', () {
    final key = TrackerRelayCrypto.newNonce();
    const msg = '{"v":1,"trackers":{"mal":{"accessToken":"x"}}}';
    final ct = TrackerRelayCrypto.encrypt(msg, key);
    expect(ct, isNot(contains('accessToken'))); // opaque
    expect(TrackerRelayCrypto.decrypt(ct, key), msg);
  });

  test('wrong key fails to decrypt (auth tag)', () {
    final ct = TrackerRelayCrypto.encrypt('secret', TrackerRelayCrypto.newNonce());
    expect(() => TrackerRelayCrypto.decrypt(ct, TrackerRelayCrypto.newNonce()),
        throwsA(anything));
  });

  test('tampered ciphertext fails to decrypt', () {
    final key = TrackerRelayCrypto.newNonce();
    final ct = TrackerRelayCrypto.encrypt('secret', key);
    final tampered = '${ct.substring(0, ct.length - 2)}${ct.endsWith("A") ? "B" : "A"}';
    expect(() => TrackerRelayCrypto.decrypt(tampered, key), throwsA(anything));
  });
}
