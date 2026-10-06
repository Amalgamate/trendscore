import '../models/driver_models.dart';
import '../network/api_client.dart';

/// Typed wrapper over the driver endpoints.
///
/// Every call here is identity-scoped on the server — the driver can only ever
/// read or write their own trips (server/src/routes/driver.routes.ts).
class DriverRepository {
  DriverRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  /// GET /api/v1/driver/today — the single call the app makes on launch.
  Future<DriverDay> fetchToday({DateTime? date}) async {
    final query = <String, dynamic>{
      if (date != null) 'date': _formatDate(date),
    };
    final body = await _api.get('/v1/driver/today', query: query);
    final data = body['data'];
    return DriverDay.fromJson(
      data is Map ? data.cast<String, dynamic>() : const {},
    );
  }

  /// GET /api/v1/driver/vehicle — null when no vehicle is assigned.
  Future<DriverVehicle?> fetchVehicle() async {
    final body = await _api.get('/v1/driver/vehicle');
    final data = body['data'];
    if (data is! Map) return null;
    return DriverVehicle.fromJson(data.cast<String, dynamic>());
  }

  /// GET /api/v1/driver/trips/:id/manifest
  Future<TripManifest> fetchManifest(String tripId) async {
    final body = await _api.get('/v1/driver/trips/$tripId/manifest');
    final data = body['data'];
    return TripManifest.fromJson(
      data is Map ? data.cast<String, dynamic>() : const {},
    );
  }

  /// POST /api/v1/driver/trips/:id/board
  ///
  /// [eventType] is `BOARDED` or `ALIGHTED`. [deviceId] lets support trace a
  /// report back to the handset that recorded it.
  Future<void> recordBoarding({
    required String tripId,
    required String learnerId,
    required String eventType,
    String? deviceId,
  }) async {
    final body = <String, dynamic>{
      'learnerId': learnerId,
      'eventType': eventType,
      'deviceId': deviceId ?? _api.deviceId,
    };
    await _api.post('/v1/driver/trips/$tripId/board', body: body);
  }

  /// PATCH /api/v1/driver/trips/:id/status — `IN_PROGRESS` or `COMPLETED`.
  Future<void> updateTripStatus({
    required String tripId,
    required String status,
  }) async {
    await _api.patch(
      '/v1/driver/trips/$tripId/status',
      body: {'status': status},
    );
  }

  /// POST /api/v1/driver/trips/:id/location — location for the active run only.
  Future<void> reportLocation({
    required String tripId,
    required double latitude,
    required double longitude,
    double? accuracyMeters,
    double? speedMps,
    double? headingDegrees,
    required DateTime capturedAt,
  }) async {
    await _api.post(
      '/v1/driver/trips/$tripId/location',
      body: {
        'latitude': latitude,
        'longitude': longitude,
        'accuracyMeters': accuracyMeters,
        'speedMps': speedMps,
        'headingDegrees': headingDegrees,
        'capturedAt': capturedAt.toUtc().toIso8601String(),
      },
    );
  }

  /// POST /api/v1/driver/trips/:id/skip
  ///
  /// Confirms the driver did NOT collect a learner, which alerts the guardian.
  /// Returns whether that alert actually went out: if it did not, the app must
  /// tell the driver to phone the office rather than let them assume the parent
  /// was told.
  Future<bool> recordSkip({
    required String tripId,
    required String learnerId,
    required SkipReason reason,
    String? note,
    String? deviceId,
  }) async {
    final body = await _api.post(
      '/v1/driver/trips/$tripId/skip',
      body: {
        'learnerId': learnerId,
        'reason': reason.wireValue,
        'note': ?note,
        'deviceId': deviceId ?? _api.deviceId,
      },
    );

    final meta = body['meta'];
    if (meta is Map) {
      return meta['guardianNotified'] == true;
    }
    return false;
  }

  /// GET /api/v1/driver/trips/:id/skips — drives the "not collected today" list.
  Future<TripSkips> fetchSkips(String tripId) async {
    final body = await _api.get('/v1/driver/trips/$tripId/skips');
    final data = body['data'];
    return TripSkips.fromJson(
      data is Map ? data.cast<String, dynamic>() : const {},
    );
  }

  /// The server compares against a `@db.Date` column, so send a plain ISO date
  /// with no timezone component.
  static String _formatDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}
