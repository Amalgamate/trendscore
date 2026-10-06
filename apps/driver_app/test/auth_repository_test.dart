import 'package:driver_app/core/data/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('driver login always carries school code and device id for server approval', () {
    final body = AuthRepository.buildLoginRequest(
      phone: '  0766543212 ',
      password: 'secret',
      driverCode: 'zawadi',
      deviceId: 'device-uuid',
    );

    expect(body, {
      'phone': '0766543212',
      'password': 'secret',
      'rememberMe': true,
      'driverCode': 'zawadi',
      'deviceId': 'device-uuid',
    });
  });
}
