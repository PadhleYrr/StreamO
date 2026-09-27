import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:pointycastle/export.dart';

/// AES-256-GCM for the tracker relay. The nonce is a 32-byte key that only
/// travels in the pairing QR, so the backend (which only ever sees the output
/// of [encrypt]) can never read the tracker tokens.
class TrackerRelayCrypto {
  static final Random _rnd = Random.secure();

  static Uint8List _randomBytes(int n) =>
      Uint8List.fromList(List<int>.generate(n, (_) => _rnd.nextInt(256)));

  /// A fresh 32-byte AES-256 key, base64Url (no padding) → 43 chars.
  static String newNonce() => base64Url.encode(_randomBytes(32)).replaceAll('=', '');

  static Uint8List _key(String nonceKey) =>
      base64Url.decode(base64Url.normalize(nonceKey));

  /// Returns base64Url( iv(12) || ciphertext+tag ).
  static String encrypt(String plaintext, String nonceKey) {
    final iv = _randomBytes(12);
    final gcm = GCMBlockCipher(AESEngine())
      ..init(true, AEADParameters(KeyParameter(_key(nonceKey)), 128, iv, Uint8List(0)));
    final out = gcm.process(Uint8List.fromList(utf8.encode(plaintext)));
    return base64Url.encode(Uint8List.fromList(<int>[...iv, ...out])).replaceAll('=', '');
  }

  /// Inverse. Throws [InvalidCipherTextException] on a wrong key / tampered blob.
  static String decrypt(String blob, String nonceKey) {
    final raw = base64Url.decode(base64Url.normalize(blob));
    final iv = Uint8List.sublistView(raw, 0, 12);
    final body = Uint8List.sublistView(raw, 12);
    final gcm = GCMBlockCipher(AESEngine())
      ..init(false, AEADParameters(KeyParameter(_key(nonceKey)), 128, iv, Uint8List(0)));
    return utf8.decode(gcm.process(body));
  }
}
