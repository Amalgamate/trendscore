import 'package:driver_app/core/models/school_branding.dart';
import 'package:flutter_test/flutter_test.dart';

/// Branding arrives from a backend other teams edit, so the parser must never
/// throw and never hand the theme a nonsense colour.
void main() {
  group('parseHexColor', () {
    test('parses a 6-digit hex with hash', () {
      expect(parseHexColor('#030b82'), 0xFF030B82);
    });

    test('parses without a leading hash', () {
      expect(parseHexColor('030b82'), 0xFF030B82);
    });

    test('expands 3-digit shorthand', () {
      expect(parseHexColor('#FFF'), 0xFFFFFFFF);
      expect(parseHexColor('#08f'), 0xFF0088FF);
    });

    test('preserves an explicit 8-digit alpha channel', () {
      expect(parseHexColor('#80030882'), 0x80030882);
    });

    test('returns null for unusable input instead of throwing', () {
      expect(parseHexColor(null), isNull);
      expect(parseHexColor(''), isNull);
      expect(parseHexColor('   '), isNull);
      expect(parseHexColor('not-a-colour'), isNull);
      // 5 digits is not a valid CSS colour length; accepting it would silently
      // produce a plausible-looking but wrong colour.
      expect(parseHexColor('#12345'), isNull);
    });
  });

  group('SchoolBranding.fromJson', () {
    test('parses a full payload', () {
      final branding = SchoolBranding.fromJson({
        'id': 'school-1',
        'name': 'Merti Complex School',
        'motto': 'Excellence',
        'logoUrl': '/uploads/logo.png',
        'pwaLogoUrl': '/uploads/pwa.png',
        'primaryColor': '#030b82',
        'secondaryColor': '#0D9488',
        'phone': '+254700000000',
      });

      expect(branding.name, 'Merti Complex School');
      expect(branding.primaryColor, 0xFF030B82);
      expect(branding.secondaryColor, 0xFF0D9488);
      expect(branding.hasLogo, isTrue);
      expect(branding.isEmpty, isFalse);
    });

    test('unwraps a { success, data } envelope', () {
      final branding = SchoolBranding.fromJson({
        'success': true,
        'data': {'name': 'Wrapped School', 'primaryColor': '#123456'},
      });

      expect(branding.name, 'Wrapped School');
      expect(branding.primaryColor, 0xFF123456);
    });

    test('ignores the legacy /logo512.png PWA placeholder', () {
      // Mirrors resolvePwaIconUrl in the web App.jsx: schools that never set a
      // custom PWA logo still carry the Flutter default path.
      final branding = SchoolBranding.fromJson({
        'name': 'School',
        'pwaLogoUrl': '/logo512.png',
        'logoUrl': '/uploads/real-logo.png',
      });

      expect(branding.bestLogoUrl, '/uploads/real-logo.png');
    });

    test('survives an empty or malformed payload', () {
      final branding = SchoolBranding.fromJson({});

      expect(branding.name, '');
      expect(branding.hasLogo, isFalse);
      expect(branding.primaryColor, isNull);
      expect(branding.isEmpty, isTrue);
    });

    test('treats a bad colour as absent rather than crashing', () {
      final branding = SchoolBranding.fromJson({
        'name': 'School',
        'primaryColor': 'octarine',
      });

      expect(branding.name, 'School');
      expect(branding.primaryColor, isNull);
    });
  });

  group('SchoolBranding round trip', () {
    test('survives serialise then parse (used by the offline cache)', () {
      final original = SchoolBranding.fromJson({
        'id': 's1',
        'name': 'Cached School',
        'motto': 'Persist',
        'pwaLogoUrl': '/pwa.png',
        'primaryColor': '#030b82',
      });

      final restored = SchoolBranding.fromJson(original.toJson());

      expect(restored.name, 'Cached School');
      expect(restored.motto, 'Persist');
      expect(restored.bestLogoUrl, '/pwa.png');
      expect(restored.primaryColor, 0xFF030B82);
    });
  });
}
