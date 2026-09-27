import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:pointycastle/export.dart';
import 'package:watch_app/core/download/hls_downloader.dart';

/// AES-128-CBC encrypt with PKCS7 padding — the inverse of [hlsAesCbcDecrypt],
/// used here to build encrypted fixtures for the round-trip test.
Uint8List _encrypt(Uint8List plain, Uint8List key, Uint8List iv) {
  final padLen = 16 - (plain.length % 16); // PKCS7 (always 1..16)
  final padded = Uint8List(plain.length + padLen)
    ..setRange(0, plain.length, plain);
  for (var i = plain.length; i < padded.length; i++) {
    padded[i] = padLen;
  }
  final cipher = CBCBlockCipher(AESEngine())
    ..init(true, ParametersWithIV<KeyParameter>(KeyParameter(key), iv));
  final out = Uint8List(padded.length);
  for (var off = 0; off < padded.length; off += 16) {
    cipher.processBlock(padded, off, out, off);
  }
  return out;
}

/// A run of [packets] valid 188-byte MPEG-TS packets (0x47 sync at each
/// boundary, 0x11 filler elsewhere so nothing else aligns).
Uint8List _ts(int packets) {
  final b = Uint8List(188 * packets)..fillRange(0, 188 * packets, 0x11);
  for (var p = 0; p < packets; p++) {
    b[p * 188] = 0x47;
  }
  return b;
}

void main() {
  final key = Uint8List.fromList(List.generate(16, (i) => i)); // 00..0f
  final iv = Uint8List.fromList(List.generate(16, (i) => 15 - i));

  test('AES-128-CBC decrypt round-trips and strips PKCS7 padding', () {
    final plain = Uint8List.fromList(
      List.generate(100, (i) => (i * 7) & 0xff), // not a multiple of 16
    );
    final enc = _encrypt(plain, key, iv);
    expect(enc.length % 16, 0);
    final dec = hlsAesCbcDecrypt(enc, key, iv);
    expect(dec, equals(plain));
  });

  test('AES-128-CBC round-trips a block-aligned payload', () {
    final plain = Uint8List.fromList(List.generate(64, (i) => i & 0xff));
    final dec = hlsAesCbcDecrypt(_encrypt(plain, key, iv), key, iv);
    expect(dec, equals(plain));
  });

  test('non-block-aligned ciphertext is returned unchanged', () {
    final data = Uint8List.fromList([1, 2, 3, 4, 5]); // 5 bytes
    expect(hlsAesCbcDecrypt(data, key, iv), equals(data));
  });

  test('seqIv encodes the media sequence big-endian', () {
    expect(hlsSeqIv(0), equals(Uint8List(16)));
    final one = Uint8List(16)..[15] = 1;
    expect(hlsSeqIv(1), equals(one));
    final big = Uint8List(16)
      ..[14] = 0x01
      ..[15] = 0x00;
    expect(hlsSeqIv(256), equals(big));
  });

  test('parseHexIv handles 0x prefix and rejects bad input', () {
    final parsed = hlsParseHexIv('0x000102030405060708090a0b0c0d0e0f');
    expect(parsed, equals(Uint8List.fromList(List.generate(16, (i) => i))));
    expect(hlsParseHexIv('0xdead'), isNull); // too short
    expect(hlsParseHexIv('zz0102030405060708090a0b0c0d0e0f'), isNull); // non-hex
  });

  test('stripToTsSync leaves a clean TS segment unchanged', () {
    final ts = _ts(4);
    expect(hlsStripToTsSync(ts), equals(ts));
  });

  test('stripToTsSync drops a decoy prefix before the TS start', () {
    // 1×1-PNG-ish + "Service"-ish junk (contains a stray 0x47 that must NOT
    // trigger a false match because it doesn't repeat at +188/+376).
    final junk = Uint8List.fromList(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x53],
    );
    final ts = _ts(4);
    final wrapped = Uint8List.fromList([...junk, ...ts]);
    expect(hlsStripToTsSync(wrapped), equals(ts));
  });

  test('stripToTsSync returns short input untouched', () {
    final short = Uint8List.fromList([0x47, 1, 2]);
    expect(hlsStripToTsSync(short), equals(short));
  });

  test('stripToTsSync leaves non-TS data (no aligned sync) alone', () {
    final noise = Uint8List(800); // no 0x47 anywhere
    expect(hlsStripToTsSync(noise), equals(noise));
  });
}
