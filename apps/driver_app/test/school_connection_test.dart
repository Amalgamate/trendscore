import 'dart:convert';

import 'package:driver_app/core/data/school_connection_repository.dart';
import 'package:driver_app/core/models/school_connection.dart';
import 'package:driver_app/core/storage/school_connection_store.dart';
import 'package:driver_app/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SchoolConnection origin validation', () {
    test('accepts the resolver origin for the matching code', () {
      final connection = SchoolConnection.fromResolvedJson({
        'schoolCode': 'ZAWADI',
        'schoolId': 'school-uuid',
        'apiOrigin': 'https://zawadi.trendscore.co.ke/api',
        'branding': {
          'displayName': 'Zawadi Academy',
          'brandColorHex': '#030B82',
        },
      });
      expect(connection.schoolCode, 'zawadi');
      expect(connection.branding.name, 'Zawadi Academy');
      expect(connection.branding.primaryColor, 0xFF030B82);
    });

    test('rejects a URL that is not the exact school origin', () {
      for (final url in [
        'http://zawadi.trendscore.co.ke/api',
        'https://attacker.example/api',
        'https://zawadi.trendscore.co.ke.evil.example/api',
        'https://zawadi.trendscore.co.ke/api?redirect=evil',
        'https://zawadi.trendscore.co.ke:444/api',
        'https://zawadi.trendscore.co.ke/api/v2',
      ]) {
        expect(
          () => SchoolConnection.validateOrigin('zawadi', url),
          throwsFormatException,
          reason: 'accepted $url',
        );
      }
    });
  });

  test(
    'resolver maps its response into a persisted runtime connection',
    () async {
      SharedPreferences.setMockInitialValues({});
      final store = SchoolConnectionStore();
      final repository = SchoolConnectionRepository(
        store: store,
        client: MockClient((request) async {
          expect(
            request.url.toString(),
            'https://zawadi.trendscore.co.ke/api/driver-connection/resolve',
          );
          expect(jsonDecode(request.body), {'code': 'zawadi'});
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'schoolCode': 'zawadi',
                'schoolId': 'school-uuid',
                'apiOrigin': 'https://zawadi.trendscore.co.ke/api',
                'branding': {
                  'displayName': 'Zawadi Academy',
                  'motto': 'Learn',
                  'brandColorHex': '#030B82',
                },
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final resolved = await repository.resolve(' ZAWADI ');
      final persisted = await store.active();
      expect(resolved.schoolCode, 'zawadi');
      expect(persisted?.apiOrigin, 'https://zawadi.trendscore.co.ke/api');
      expect(persisted?.branding.name, 'Zawadi Academy');
      repository.dispose();
    },
  );

  test('tokens are isolated by school code', () {
    expect(
      TokenStore.accessKeyFor('zawadi'),
      isNot(TokenStore.accessKeyFor('merti')),
    );
    expect(
      TokenStore.refreshKeyFor('zawadi'),
      isNot(TokenStore.refreshKeyFor('merti')),
    );
    expect(
      TokenStore.userKeyFor('zawadi'),
      isNot(TokenStore.userKeyFor('merti')),
    );
    expect(TokenStore.accessKeyFor('zawadi'), 'driver_zawadi.access_token');
  });
}
