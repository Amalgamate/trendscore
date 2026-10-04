import 'package:flutter/material.dart';

/// Domain models for the driver app.
///
/// These mirror the JSON returned by the driver endpoints
/// (server/src/routes/driver.routes.ts) and are deliberately defensive about
/// types  a driver on a cheap handset should never see a crash from an
/// unexpected null or a number arriving as a string.

/// Boarding state of one learner on a trip.
enum BoardingStatus { notBoarded, boarded, alighted }

BoardingStatus _parseBoardingStatus(String? raw) {
  switch (raw) {
    case 'BOARDED':
      return BoardingStatus.boarded;
    case 'ALIGHTED':
      return BoardingStatus.alighted;
    default:
      return BoardingStatus.notBoarded;
  }
}

int _asInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

DateTime? _asDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

class DriverVehicleRoute {
  const DriverVehicleRoute({required this.id, required this.name});

  final String id;
  final String name;
}

/// The vehicle a driver is permanently assigned to.
class DriverVehicle {
  const DriverVehicle({
    required this.id,
    required this.registrationNumber,
    required this.capacity,
    this.routes = const [],
  });

  final String id;
  final String registrationNumber;
  final int capacity;

  /// Routes served by this vehicle.
  final List<DriverVehicleRoute> routes;

  factory DriverVehicle.fromJson(Map<String, dynamic> json) {
    final rawRoutes = json['routes'];
    return DriverVehicle(
      id: json['id']?.toString() ?? '',
      registrationNumber:
          json['registrationNumber']?.toString() ?? 'Unassigned',
      capacity: _asInt(json['capacity']),
      routes: rawRoutes is List
          ? rawRoutes
                .whereType<Map>()
                .map(
                  (r) => DriverVehicleRoute(
                    id: r['id']?.toString() ?? '',
                    name: r['name']?.toString() ?? '',
                  ),
                )
                .toList()
          : const [],
    );
  }
}

/// A trip (one daily run of a route) the signed-in driver is responsible for.
class DriverTrip {
  const DriverTrip({
    required this.id,
    required this.routeName,
    required this.direction,
    required this.status,
    required this.totalAssigned,
    required this.boarded,
    required this.alighted,
    required this.pending,
    required this.assignedToMe,
    this.vehicle,
    this.departedAt,
    this.arrivedAt,
  });

  final String id;
  final String routeName;

  /// `OUTBOUND` (morning, home  school) or `INBOUND` (afternoon).
  final String direction;
  final String status;

  final int totalAssigned;
  final int boarded;
  final int alighted;
  final int pending;

  /// False when the trip was matched through the vehicle rather than an explicit
  /// assignment  the app highlights these so a driver knows it may not be theirs.
  final bool assignedToMe;

  final DriverVehicle? vehicle;
  final DateTime? departedAt;
  final DateTime? arrivedAt;

  bool get isMorning => direction == 'OUTBOUND';
  bool get isEvening => direction == 'INBOUND';

  /// Can the driver still act on this trip?
  bool get isOpen => status == 'SCHEDULED' || status == 'IN_PROGRESS';

  String get directionLabel => isMorning ? 'Morning' : 'Afternoon';

  factory DriverTrip.fromJson(Map<String, dynamic> json) {
    final trip = (json['trip'] as Map?)?.cast<String, dynamic>() ?? const {};
    final counts =
        (json['counts'] as Map?)?.cast<String, dynamic>() ?? const {};
    final vehicleJson = json['vehicle'];

    return DriverTrip(
      id: trip['id']?.toString() ?? '',
      routeName: trip['routeName']?.toString() ?? 'Route',
      direction: trip['direction']?.toString() ?? 'OUTBOUND',
      status: trip['status']?.toString() ?? 'SCHEDULED',
      totalAssigned: _asInt(counts['totalAssigned']),
      boarded: _asInt(counts['boarded']),
      alighted: _asInt(counts['alighted']),
      pending: _asInt(counts['pending']),
      assignedToMe: trip['assignedToMe'] == true,
      vehicle: vehicleJson is Map
          ? DriverVehicle.fromJson(vehicleJson.cast<String, dynamic>())
          : null,
      departedAt: _asDate(trip['departedAt']),
      arrivedAt: _asDate(trip['arrivedAt']),
    );
  }
}

/// Everything the app needs for one day.
class DriverDay {
  const DriverDay({required this.date, required this.trips, this.vehicle});

  final DateTime? date;
  final List<DriverTrip> trips;

  /// Null when no vehicle has been assigned yet  the app shows an explicit
  /// "ask your administrator" state rather than an error.
  final DriverVehicle? vehicle;

  bool get hasVehicle => vehicle != null;
  bool get hasTrips => trips.isNotEmpty;

  /// The trip the driver should act on next: the first open one.
  DriverTrip? get nextTrip {
    for (final trip in trips) {
      if (trip.isOpen) return trip;
    }
    return null;
  }

  factory DriverDay.fromJson(Map<String, dynamic> json) {
    final rawTrips = json['trips'];
    final vehicleJson = json['vehicle'];
    return DriverDay(
      date: _asDate(json['date']),
      trips: rawTrips is List
          ? rawTrips
                .whereType<Map>()
                .map((t) => DriverTrip.fromJson(t.cast<String, dynamic>()))
                .toList()
          : const [],
      vehicle: vehicleJson is Map
          ? DriverVehicle.fromJson(vehicleJson.cast<String, dynamic>())
          : null,
    );
  }
}

/// One learner on the boarding manifest.
class ManifestLearner {
  const ManifestLearner({
    required this.learnerId,
    required this.name,
    required this.boardingStatus,
    this.admissionNumber,
    this.grade,
    this.stream,
    this.phone,
    this.pickupPoint,
    this.dropoffPoint,
    this.boardedAt,
    this.alightedAt,
  });

  final String learnerId;
  final String name;
  final String? admissionNumber;
  final String? grade;
  final String? stream;

  /// Guardian contact  needed for an emergency on the road.
  final String? phone;
  final String? pickupPoint;
  final String? dropoffPoint;

  final BoardingStatus boardingStatus;
  final DateTime? boardedAt;
  final DateTime? alightedAt;

  bool get hasContact => phone != null && phone!.isNotEmpty;

  factory ManifestLearner.fromJson(Map<String, dynamic> json) {
    return ManifestLearner(
      learnerId: json['learnerId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Learner',
      admissionNumber: json['admissionNumber']?.toString(),
      grade: json['grade']?.toString(),
      stream: json['stream']?.toString(),
      phone: json['phone']?.toString(),
      pickupPoint: json['pickupPoint']?.toString(),
      dropoffPoint: json['dropoffPoint']?.toString(),
      boardingStatus: _parseBoardingStatus(json['boardingStatus']?.toString()),
      boardedAt: _asDate(json['boardedAt']),
      alightedAt: _asDate(json['alightedAt']),
    );
  }
}

/// The boarding manifest for one trip.
class TripManifest {
  const TripManifest({
    required this.learners,
    required this.totalAssigned,
    required this.boarded,
    required this.alighted,
    required this.pending,
  });

  final List<ManifestLearner> learners;
  final int totalAssigned;
  final int boarded;
  final int alighted;
  final int pending;

  factory TripManifest.fromJson(Map<String, dynamic> json) {
    final raw = json['manifest'];
    return TripManifest(
      learners: raw is List
          ? raw
                .whereType<Map>()
                .map((l) => ManifestLearner.fromJson(l.cast<String, dynamic>()))
                .toList()
          : const [],
      totalAssigned: _asInt(json['totalAssigned']),
      boarded: _asInt(json['boarded']),
      alighted: _asInt(json['alighted']),
      pending: _asInt(json['pending']),
    );
  }
}

/// Why a learner was not collected on a run.
///
/// Mirrors the server enum exactly. The driver picks this at the pickup point,
/// so the labels are phrased for someone standing on a roadside rather than for
/// a database reader.
enum SkipReason {
  noAnswer('NO_ANSWER', 'Nobody at pickup', Icons.person_off),
  refused('REFUSED', 'Learner refused', Icons.block),
  absent('ABSENT', 'Learner not there', Icons.help_outline),
  alreadyCollected(
    'ALREADY_COLLECTED',
    'Someone else collected',
    Icons.people_outline,
  ),
  late('LATE', 'Running late', Icons.schedule),
  other('OTHER', 'Other reason', Icons.more_horiz);

  const SkipReason(this.wireValue, this.label, this.icon);

  /// Value sent to and received from the API.
  final String wireValue;

  /// Short label shown on the picker.
  final String label;

  final IconData icon;

  /// Whether the driver must type a note. Mirrors the server rule for OTHER.
  bool get requiresNote => this == SkipReason.other;

  static SkipReason fromWire(String? raw) {
    for (final reason in SkipReason.values) {
      if (reason.wireValue == raw) return reason;
    }
    return SkipReason.noAnswer;
  }
}

/// One confirmed skip, as returned by GET /trips/:id/skips.
class SkippedLearner {
  const SkippedLearner({
    required this.learnerId,
    required this.name,
    required this.reason,
    required this.guardianNotified,
    this.grade,
    this.note,
    this.reportedAt,
  });

  final String learnerId;
  final String name;
  final String? grade;
  final SkipReason reason;
  final String? note;
  final DateTime? reportedAt;

  /// False when the guardian alert failed and the office must resend it.
  final bool guardianNotified;

  factory SkippedLearner.fromJson(Map<String, dynamic> json) {
    return SkippedLearner(
      learnerId: json['learnerId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Learner',
      grade: json['grade']?.toString(),
      reason: SkipReason.fromWire(json['reason']?.toString()),
      note: json['note']?.toString(),
      reportedAt: _asDate(json['reportedAt']),
      guardianNotified: json['guardianNotified'] == true,
    );
  }
}

/// Confirmed skips for a trip.
class TripSkips {
  const TripSkips({required this.skips, required this.unnotified});

  final List<SkippedLearner> skips;

  /// Skips whose guardian never got the alert. Anything above zero is an
  /// operational problem the office has to chase.
  final int unnotified;

  bool get hasAny => skips.isNotEmpty;

  factory TripSkips.fromJson(Map<String, dynamic> json) {
    final raw = json['noShows'];
    return TripSkips(
      skips: raw is List
          ? raw
                .whereType<Map>()
                .map((s) => SkippedLearner.fromJson(s.cast<String, dynamic>()))
                .toList()
          : const [],
      unnotified: _asInt(json['unnotified']),
    );
  }
}
