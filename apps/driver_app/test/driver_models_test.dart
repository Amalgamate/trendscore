import 'package:driver_app/core/models/driver_models.dart';
import 'package:flutter_test/flutter_test.dart';

/// The model layer is the boundary between the server's JSON and the UI, so it
/// gets the most defensive tests: a driver should never see a crash because a
/// field arrived null, as a string, or missing entirely.
void main() {
  group('DriverDay.fromJson', () {
    test('parses a normal day', () {
      final day = DriverDay.fromJson({
        'date': '2026-09-18T00:00:00.000Z',
        'vehicle': {
          'id': 'v1',
          'registrationNumber': 'KBX 123A',
          'capacity': 40,
          'routes': [
            {'id': 'r1', 'name': 'Ngong Road'},
          ],
        },
        'trips': [
          {
            'trip': {
              'id': 't1',
              'routeName': 'Ngong Road',
              'direction': 'OUTBOUND',
              'status': 'SCHEDULED',
              'assignedToMe': true,
            },
            'vehicle': {
              'id': 'v1',
              'registrationNumber': 'KBX 123A',
              'capacity': 40,
            },
            'counts': {
              'totalAssigned': 12,
              'boarded': 0,
              'alighted': 0,
              'pending': 12,
            },
          },
        ],
      });

      expect(day.hasVehicle, isTrue);
      expect(day.vehicle!.registrationNumber, 'KBX 123A');
      expect(day.vehicle!.routes.single.name, 'Ngong Road');
      expect(day.hasTrips, isTrue);

      final trip = day.trips.single;
      expect(trip.id, 't1');
      expect(trip.isMorning, isTrue);
      expect(trip.isEvening, isFalse);
      expect(trip.directionLabel, 'Morning');
      expect(trip.totalAssigned, 12);
      expect(trip.pending, 12);
      expect(trip.assignedToMe, isTrue);
      expect(trip.isOpen, isTrue);
    });

    test('treats a null vehicle as "not assigned", not a crash', () {
      final day = DriverDay.fromJson({'vehicle': null, 'trips': []});

      expect(day.hasVehicle, isFalse);
      expect(day.vehicle, isNull);
      expect(day.hasTrips, isFalse);
      expect(day.nextTrip, isNull);
    });

    test('survives an entirely empty payload', () {
      final day = DriverDay.fromJson({});

      expect(day.date, isNull);
      expect(day.trips, isEmpty);
      expect(day.vehicle, isNull);
    });

    test('coerces string counts to ints', () {
      // Prisma Decimal columns can arrive as strings over JSON.
      final day = DriverDay.fromJson({
        'trips': [
          {
            'trip': {
              'id': 't1',
              'routeName': 'R',
              'direction': 'INBOUND',
              'status': 'IN_PROGRESS',
            },
            'counts': {
              'totalAssigned': '9',
              'boarded': '4',
              'alighted': '0',
              'pending': '5',
            },
          },
        ],
      });

      final trip = day.trips.single;
      expect(trip.totalAssigned, 9);
      expect(trip.boarded, 4);
      expect(trip.pending, 5);
      expect(trip.isEvening, isTrue);
      expect(trip.isOpen, isTrue);
    });

    test(
      'marks a completed trip as closed and defaults assignedToMe false',
      () {
        final day = DriverDay.fromJson({
          'trips': [
            {
              'trip': {'id': 't1', 'status': 'COMPLETED'},
              'counts': {},
            },
          ],
        });

        final trip = day.trips.single;
        expect(trip.isOpen, isFalse);
        // Matched via vehicle rather than explicit assignment.
        expect(trip.assignedToMe, isFalse);
      },
    );

    test('nextTrip picks the first open trip', () {
      final day = DriverDay.fromJson({
        'trips': [
          {
            'trip': {'id': 'done', 'status': 'COMPLETED'},
            'counts': {},
          },
          {
            'trip': {'id': 'live', 'status': 'SCHEDULED'},
            'counts': {},
          },
        ],
      });

      expect(day.nextTrip!.id, 'live');
    });

    test('ignores malformed entries instead of throwing', () {
      final day = DriverDay.fromJson({'trips': 'not-a-list'});
      expect(day.trips, isEmpty);

      final day2 = DriverDay.fromJson({
        'trips': [null, 'garbage', 42],
      });
      expect(day2.trips, isEmpty);
    });
  });

  group('TripManifest.fromJson', () {
    test('parses learners and their boarding state', () {
      final manifest = TripManifest.fromJson({
        'totalAssigned': 3,
        'boarded': 1,
        'alighted': 1,
        'pending': 1,
        'manifest': [
          {
            'learnerId': 'l1',
            'name': 'Alice Mwangi',
            'grade': 'Grade 5',
            'phone': '+254700111222',
            'pickupPoint': 'Kibera',
            'boardingStatus': 'BOARDED',
          },
          {
            'learnerId': 'l2',
            'name': 'Brian Otieno',
            'grade': 'Grade 4',
            'boardingStatus': 'ALIGHTED',
          },
          {'learnerId': 'l3', 'name': 'Carol Achieng'},
        ],
      });

      expect(manifest.totalAssigned, 3);
      expect(manifest.learners, hasLength(3));

      expect(manifest.learners[0].boardingStatus, BoardingStatus.boarded);
      expect(manifest.learners[0].hasContact, isTrue);
      expect(manifest.learners[0].pickupPoint, 'Kibera');

      expect(manifest.learners[1].boardingStatus, BoardingStatus.alighted);
      expect(manifest.learners[1].hasContact, isFalse);

      // Missing boardingStatus must default to NOT_BOARDED, not throw.
      expect(manifest.learners[2].boardingStatus, BoardingStatus.notBoarded);
      expect(manifest.learners[2].name, 'Carol Achieng');
    });

    test('handles an empty manifest', () {
      final manifest = TripManifest.fromJson({});
      expect(manifest.learners, isEmpty);
      expect(manifest.totalAssigned, 0);
    });

    test('treats an unrecognised boarding status as not boarded', () {
      final manifest = TripManifest.fromJson({
        'manifest': [
          {'learnerId': 'l1', 'boardingStatus': 'SOMETHING_ELSE'},
        ],
      });

      expect(
        manifest.learners.single.boardingStatus,
        BoardingStatus.notBoarded,
      );
    });
  });
}
