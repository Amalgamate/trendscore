import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/school_connection.dart';
import '../error/api_exception.dart';
import '../storage/token_store.dart';

/// Thin HTTP client for the driver app.
///
/// Mirrors the web client (src/services/api/axiosConfig.js):
///  - `Authorization: Bearer <token>` on every request.
///  - A 401 triggers a single refresh, and concurrent 401s share one refresh
///    call instead of stampeding the auth endpoint.
///
/// The backend already prefers the Bearer header over cookies
/// (server/src/middleware/auth.middleware.ts) and `requireCsrf` is never
/// mounted, so a native client does not need to fetch or echo a CSRF token.
class ApiClient {
  ApiClient({
    required SchoolConnection connection,
    required TokenStore tokenStore,
    required this.deviceId,
    http.Client? httpClient,
  }) : _connection = connection,
       _tokenStore = tokenStore,
       _http = httpClient ?? http.Client();

  final SchoolConnection _connection;
  final String deviceId;
  final TokenStore _tokenStore;
  final http.Client _http;

  String get schoolCode => _connection.schoolCode;

  /// De-duplicates concurrent refreshes, like the web refresh queue.
  Future<bool>? _inFlightRefresh;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final base = SchoolConnection.validateOrigin(
      _connection.schoolCode,
      _connection.apiOrigin,
    );
    // apiBaseUrl already ends with `/api`; never drop or double it.
    final basePath = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    final suffix = path.startsWith('/') ? path : '/$path';

    return base.replace(
      path: '$basePath$suffix',
      queryParameters: query?.map(
        (key, value) => MapEntry(key, value?.toString()),
      ),
    );
  }

  Map<String, String> _headers({bool json = true}) {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _tokenStore.accessToken;
    final headers = _headers();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// Decode the API envelope, raising a typed exception on failure.
  ///
  /// Every endpoint answers with `{ success, data | message }`; the message is
  /// written for humans and is safe to show a driver.
  String? _messageValue(Object? value) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    if (value is Map) {
      for (final key in const [
        'message',
        'detail',
        'description',
        'error_description',
        'title',
      ]) {
        final message = _messageValue(value[key]);
        if (message != null) return message;
      }
    }
    if (value is List) {
      final messages = value.map(_messageValue).whereType<String>().toList();
      if (messages.isNotEmpty) return messages.join(' ');
    }
    return null;
  }

  String? _codeValue(Object? value) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    if (value is Map) return _codeValue(value['code']);
    return null;
  }

  Map<String, dynamic> _decode(http.Response res) {
    Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        statusCode: res.statusCode,
        message: 'Unexpected response from the server.',
      );
    }

    if (res.statusCode >= 200 &&
        res.statusCode < 300 &&
        body['success'] != false) {
      return body;
    }

    throw ApiException(
      statusCode: res.statusCode,
      message:
          _messageValue(body['message']) ??
          _messageValue(body['error']) ??
          _messageValue(body['errors']) ??
          'Request failed (${res.statusCode}).',
      code: _codeValue(body['code']) ?? _codeValue(body['error']),
    );
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Object? body,
    bool retried = false,
  }) async {
    final headers = await _authHeaders();
    final uri = _uri(path, query);

    final request = http.Request(method, uri)..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);

    try {
      final streamed = await _http
          .send(request)
          .timeout(const Duration(seconds: 30));
      final res = await http.Response.fromStream(streamed);

      if (res.statusCode == 401 && !retried && !_isAuthPath(path)) {
        final refreshed = await _refreshTokens();
        if (refreshed) {
          return _send(method, path, query: query, body: body, retried: true);
        }
      }

      return res;
    } on TimeoutException {
      throw const ApiException(
        statusCode: 0,
        message: 'The server took too long to respond. Check your connection.',
        isNetworkError: true,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw const ApiException(
        statusCode: 0,
        message: 'Cannot reach the school server. Check your connection.',
        isNetworkError: true,
      );
    }
  }

  /// Never try to refresh while authenticating — that would loop.
  bool _isAuthPath(String path) =>
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/refresh') ||
      path.startsWith('/auth/phone-otp') ||
      path.startsWith('/auth/student-phone');

  /// Single-flight token refresh. Concurrent 401s await the same future.
  Future<bool> _refreshTokens() {
    return _inFlightRefresh ??= _doRefresh().whenComplete(() {
      _inFlightRefresh = null;
    });
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _tokenStore.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final res = await _http
          .post(
            _uri('/auth/refresh'),
            headers: _headers(),
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(const Duration(seconds: 20));

      if (res.statusCode != 200) return false;

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final token = body['token'] as String?;
      final newRefresh = body['refreshToken'] as String?;
      if (token == null) return false;

      await _tokenStore.save(
        accessToken: token,
        refreshToken: newRefresh ?? refreshToken,
      );
      return true;
    } catch (_) {
      // A failed refresh means the session is gone; the caller surfaces the 401
      // and the app routes back to sign-in.
      return false;
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _send('GET', path, query: query);
    return _decode(res);
  }

  Future<Map<String, dynamic>> post(String path, {Object? body}) async {
    final res = await _send('POST', path, body: body);
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, {Object? body}) async {
    final res = await _send('PATCH', path, body: body);
    return _decode(res);
  }

  void dispose() => _http.close();
}
