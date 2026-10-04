import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the driver's session.
///
/// Tokens live in the Android Keystore via `flutter_secure_storage`, never in
/// SharedPreferences — a driver phone is shared on occasion and a plaintext JWT
/// on disk would expose a session to anyone who picks the device up.
///
/// Key names are namespaced by school code so a driver moving between schools
/// does not inherit a session from a different school stack.
class TokenStore {
  TokenStore({required this.schoolCode, FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
          );

  final String schoolCode;
  final FlutterSecureStorage _storage;

  static String accessKeyFor(String code) => 'driver_$code.access_token';
  static String refreshKeyFor(String code) => 'driver_$code.refresh_token';
  static String userKeyFor(String code) => 'driver_$code.user';

  String get _accessKey => accessKeyFor(schoolCode);
  String get _refreshKey => refreshKeyFor(schoolCode);
  String get _userKey => userKeyFor(schoolCode);

  Future<String?> get accessToken => _storage.read(key: _accessKey);
  Future<String?> get refreshToken => _storage.read(key: _refreshKey);

  /// Signed-in driver's identity, cached so the UI can render before the first
  /// network call completes. A corrupt cache is treated as "no user" rather than
  /// being allowed to break sign-in.
  Future<Map<String, dynamic>?> get user async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> save({
    required String accessToken,
    String? refreshToken,
    Map<String, dynamic>? user,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshKey, value: refreshToken);
    }
    if (user != null) {
      await _storage.write(key: _userKey, value: jsonEncode(user));
    }
  }

  /// Clear the session. Called on sign-out and whenever the server reports the
  /// session can no longer be refreshed.
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userKey);
  }

  Future<bool> get hasSession async {
    final token = await accessToken;
    return token != null && token.isNotEmpty;
  }
}
