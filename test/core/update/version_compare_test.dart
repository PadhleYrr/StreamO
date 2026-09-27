import 'package:flutter_test/flutter_test.dart';
import 'package:watch_app/core/update/update_service.dart';

void main() {
  int cmp(String a, String b) => UpdateService.compareVersions(a, b);

  test('strictly increasing: stable > its betas, later beta > earlier', () {
    const chain = ['1.9.1', '1.9.2-beta1', '1.9.2-beta2', '1.9.2', '1.9.3-beta1'];
    for (var i = 0; i < chain.length - 1; i++) {
      expect(cmp(chain[i], chain[i + 1]), lessThan(0),
          reason: '${chain[i]} should be < ${chain[i + 1]}');
      expect(cmp(chain[i + 1], chain[i]), greaterThan(0),
          reason: '${chain[i + 1]} should be > ${chain[i]}');
    }
  });

  test('equality, leading v ignored', () {
    expect(cmp('1.9.2', '1.9.2'), 0);
    expect(cmp('v1.9.2', '1.9.2'), 0);
    expect(cmp('1.9.2-beta1', '1.9.2-beta1'), 0);
  });

  test('final release beats its own pre-release', () {
    expect(cmp('1.9.2', '1.9.2-beta9'), greaterThan(0));
    expect(cmp('1.9.2-beta9', '1.9.2'), lessThan(0));
  });
}
