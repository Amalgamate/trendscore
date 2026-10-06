import '../network/api_client.dart';
import '../storage/token_store.dart';

/// Driver sign-in.
///
/// Uses the existing password endpoint. The parent-only phone-OTP flow
/// (`/auth/phone-otp/*`) is deliberately NOT used here — it validates that the
/// caller holds the PARENT role, so a driver would be rejected.
class AuthRepository {
  AuthRepository({required ApiClient api, required TokenStore tokenStore})
    : _api = api,
      _tokenStore = tokenStore;

  final ApiClient _api;
  final TokenStore _tokenStore;

  /// Sign in with the driver's phone number and password.
  ///
  /// Stores the returned tokens in the Keystore. The web client receives
  /// `__cookie__` placeholders because it authenticates with httpOnly cookies;
  /// a native client gets the real bearer tokens in the body
  /// (server/src/services/auth-login.service.ts).
  Future<Map<String, dynamic>> signIn({
    required String phone,
    required String password,
    bool rememberMe = true,
  }) async {
    final body = await _api.post(
      '/auth/login',
      body: buildLoginRequest(
        phone: phone,
        password: password,
        rememberMe: rememberMe,
        driverCode: _api.schoolCode,
        deviceId: _api.deviceId,
      ),
    );

    final user = (body['user'] as Map?)?.cast<String, dynamic>();
    final token = body['token']?.toString();
    final refreshToken = body['refreshToken']?.toString();

    if (token == null || token.isEmpty || token == '__cookie__') {
      // A '__cookie__' placeholder means the server answered for a browser
      // session. Treat it as unusable rather than storing a bogus token.
      throw StateError(
        'The server did not return a usable token for this app.',
      );
    }

    if (user != null && user['status'] != 'ACTIVE') {
      throw StateError(
        'This account is not active. Contact the school office.',
      );
    }

    await _tokenStore.save(
      accessToken: token,
      refreshToken: refreshToken,
      user: user,
    );

    return user ?? const {};
  }

  Future<bool> hasSession() => _tokenStore.hasSession;

  Future<void> signOut() => _tokenStore.clear();

  /// Request body consumed by the server's DEVICE_NOT_APPROVED login gate.
  static Map<String, dynamic> buildLoginRequest({
    required String phone,
    required String password,
    required String driverCode,
    required String deviceId,
    bool rememberMe = true,
  }) => {
    'phone': phone.trim(),
    'password': password,
    'rememberMe': rememberMe,
    'driverCode': driverCode,
    'deviceId': deviceId,
  };
}
