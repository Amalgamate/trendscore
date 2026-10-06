import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'driver_repository.dart';

/// Shares a phone's location only while one of its trips is IN_PROGRESS.
/// Android displays an ongoing foreground-service notification during sharing.
class DriverLocationTracker {
  DriverLocationTracker({required DriverRepository repository})
    : _repository = repository;

  final DriverRepository _repository;
  StreamSubscription<Position>? _subscription;
  String? _tripId;
  bool _sending = false;

  String? get activeTripId => _tripId;

  Future<void> requestAccess() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError('Turn on Location on the phone to share the trip.');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError(
        'Allow location access while using the app to share this trip.',
      );
    }
  }

  Future<void> start(String tripId) async {
    if (_tripId == tripId && _subscription != null) return;
    await stop();
    await requestAccess();

    _tripId = tripId;
    final settings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 20,
      intervalDuration: const Duration(seconds: 10),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Driver trip in progress',
        notificationText:
            'Your location is shared with the school during this trip.',
        enableWakeLock: true,
        setOngoing: true,
      ),
    );

    _subscription = Geolocator.getPositionStream(locationSettings: settings)
        .listen(
          (position) => unawaited(_send(position, tripId)),
          onError: (_) => unawaited(stop()),
          onDone: () => unawaited(stop()),
          cancelOnError: true,
        );
  }

  Future<void> _send(Position position, String tripId) async {
    if (_sending || _tripId != tripId) return;
    _sending = true;
    try {
      await _repository.reportLocation(
        tripId: tripId,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        speedMps: position.speed >= 0 ? position.speed : null,
        headingDegrees: position.heading >= 0 ? position.heading : null,
        capturedAt: position.timestamp,
      );
    } catch (_) {
      // Transient network failures are recovered by the next live GPS fix.
      // No offline location queue is kept after a trip has ended.
    } finally {
      _sending = false;
    }
  }

  Future<void> stop() async {
    _tripId = null;
    final subscription = _subscription;
    _subscription = null;
    await subscription?.cancel();
  }
}
