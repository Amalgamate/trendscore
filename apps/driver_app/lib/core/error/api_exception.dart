/// Typed failure for anything the driver API can return.
///
/// [isNetworkError] matters because boarding must work offline: network failures
/// are queued for retry, whereas a 403 (wrong driver) must surface immediately.
class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.message,
    this.code,
    this.isNetworkError = false,
  });

  final int statusCode;

  /// Human-readable, already safe to display to a driver.
  final String message;

  /// Optional backend error code, e.g. `ACCESS_DENIED`.
  final String? code;

  /// True when the request never reached the server.
  final bool isNetworkError;

  /// 401 — the session is gone and the app must return to sign-in.
  bool get isUnauthorized => statusCode == 401;

  /// 403 — authenticated but not permitted (e.g. not this driver's trip).
  bool get isForbidden => statusCode == 403;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
