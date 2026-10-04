/**
 * Unit tests for TripService
 * Prisma fully mocked — no DB required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transportTrip: {
      findUnique: jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      findMany:   jest.fn(),
    },
    transportRoute: {
      findUnique: jest.fn(),
      findMany:  jest.fn(),
    },
    transportVehicle: {
      findFirst: jest.fn(),
    },
    transportAssignment: {
      findFirst: jest.fn(),
      findMany:  jest.fn(),
    },
    transportBoardingEvent: {
      create:  jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    transportNoShow: {
      create:  jest.fn(),
      update:  jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    learner: {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../presence/presence.service', () => ({
  presenceService: { emit: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../../services/attendance-notification.service', () => ({
  attendanceNotificationService: { notify: jest.fn().mockResolvedValue(undefined) },
}));

import prisma from '../../config/database';
import { TripService } from './trip.service';
import { presenceService } from '../presence/presence.service';
import { attendanceNotificationService } from '../../services/attendance-notification.service';

const db = prisma as any;
const mockPresence = presenceService as any;
const mockNotifications = attendanceNotificationService as any;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHOOL_ID = 'school-1';
const ROUTE_ID  = 'route-1';
const TRIP_ID   = 'trip-1';
const LEARNER_ID = 'learner-1';

const MOCK_ROUTE = {
  id: ROUTE_ID, name: 'Route 3 Ngong', archived: false, amount: 500,
  vehicle: { id: 'v1', registrationNumber: 'KBX 123A', capacity: 40, driverName: 'John' },
};

const MOCK_TRIP = {
  id: TRIP_ID, schoolId: SCHOOL_ID, routeId: ROUTE_ID,
  date: new Date('2026-08-04'), direction: 'OUTBOUND',
  status: 'SCHEDULED', archived: false,
  route: MOCK_ROUTE, boardingEvents: [],
};

const MOCK_LEARNER = {
  id: LEARNER_ID, firstName: 'Alice', lastName: 'Mwangi',
  admissionNumber: 'ADM-001', grade: 'Grade 5',
};

const MOCK_ASSIGNMENT = {
  routeId: ROUTE_ID, passengerId: LEARNER_ID, passengerType: 'LEARNER', archived: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TripService.getOrCreateTrip()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  it('returns existing trip when one already exists', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);

    const result = await service.getOrCreateTrip({
      schoolId: SCHOOL_ID, routeId: ROUTE_ID,
      date: new Date('2026-08-04'), direction: 'OUTBOUND',
    });

    expect(result.id).toBe(TRIP_ID);
    expect(db.transportTrip.create).not.toHaveBeenCalled();
  });

  it('creates a new trip when none exists', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(null);
    db.transportRoute.findUnique.mockResolvedValueOnce(MOCK_ROUTE);
    db.transportTrip.create.mockResolvedValueOnce(MOCK_TRIP);

    const result = await service.getOrCreateTrip({
      schoolId: SCHOOL_ID, routeId: ROUTE_ID,
      date: new Date('2026-08-04'), direction: 'OUTBOUND',
    });

    expect(db.transportTrip.create).toHaveBeenCalledTimes(1);
    const data = db.transportTrip.create.mock.calls[0][0].data;
    expect(data.direction).toBe('OUTBOUND');
    expect(data.status).toBe('SCHEDULED');
    expect(result.id).toBe(TRIP_ID);
  });

  it('throws 404 when route not found', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(null);
    db.transportRoute.findUnique.mockResolvedValueOnce(null);

    await expect(service.getOrCreateTrip({
      schoolId: SCHOOL_ID, routeId: 'nonexistent',
      date: new Date(), direction: 'OUTBOUND',
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TripService.updateTripStatus()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  it('updates status with timestamps', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    const now = new Date();
    db.transportTrip.update.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'IN_PROGRESS', departedAt: now });

    const result = await service.updateTripStatus(TRIP_ID, 'IN_PROGRESS', { departedAt: now });
    expect(db.transportTrip.update).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('throws 404 for unknown tripId', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateTripStatus('bad-id', 'COMPLETED')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TripService.recordBoardingEvent()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  function setupSuccessfulBoarding() {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.create.mockResolvedValueOnce({
      id: 'event-1', tripId: TRIP_ID, learnerId: LEARNER_ID,
      eventType: 'BOARDED', method: 'MANUAL', recordedAt: new Date(),
    });
    db.transportTrip.update.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'IN_PROGRESS' });
  }

  it('creates boarding event for a valid learner', async () => {
    setupSuccessfulBoarding();

    const result = await service.recordBoardingEvent({
      tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED',
    });

    expect(db.transportBoardingEvent.create).toHaveBeenCalledTimes(1);
    expect(result.boardingEvent.eventType).toBe('BOARDED');
  });

  it('transitions SCHEDULED trip to IN_PROGRESS on first boarding', async () => {
    setupSuccessfulBoarding();
    await service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED' });
    expect(db.transportTrip.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'IN_PROGRESS' }),
    }));
  });

  it('emits BUS_BOARDED presence event', async () => {
    setupSuccessfulBoarding();
    await service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED' });
    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'BUS_BOARDED',
      personId: LEARNER_ID,
      personType: 'LEARNER',
      context: 'BUS',
      sourceModule: 'TRANSPORT',
    }));
  });

  it('emits BUS_ALIGHTED for ALIGHTED event type', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'IN_PROGRESS' });
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.create.mockResolvedValueOnce({
      id: 'e2', tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'ALIGHTED',
      method: 'MANUAL', recordedAt: new Date(),
    });
    db.transportTrip.update.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'IN_PROGRESS' });

    await service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'ALIGHTED' });
    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BUS_ALIGHTED' }));
  });

  it('throws 404 when learner not found', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(null);
    await expect(service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: 'bad', eventType: 'BOARDED' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 422 when learner not assigned to route', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(null);
    await expect(service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED' }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 422 for cancelled trip', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'CANCELLED' });
    await expect(service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED' }))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('presence emit failure does not throw to caller', async () => {
    setupSuccessfulBoarding();
    mockPresence.emit.mockRejectedValueOnce(new Error('presence down'));
    // Should still resolve
    await expect(service.recordBoardingEvent({ tripId: TRIP_ID, learnerId: LEARNER_ID, eventType: 'BOARDED' }))
      .resolves.toBeDefined();
  });
});

describe('TripService.bulkRecordBoarding()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  it('returns ok for successful learners and skipped for unassigned', async () => {
    const learnerA = 'learner-a';
    const learnerB = 'learner-b';

    // learnerA succeeds
    db.transportTrip.findUnique
      .mockResolvedValueOnce(MOCK_TRIP)  // for A
      .mockResolvedValueOnce(MOCK_TRIP); // for B
    db.learner.findUnique
      .mockResolvedValueOnce({ ...MOCK_LEARNER, id: learnerA })
      .mockResolvedValueOnce({ ...MOCK_LEARNER, id: learnerB });
    db.transportAssignment.findFirst
      .mockResolvedValueOnce({ ...MOCK_ASSIGNMENT, passengerId: learnerA }) // A assigned
      .mockResolvedValueOnce(null);                                          // B not assigned
    db.transportBoardingEvent.create
      .mockResolvedValueOnce({ id: 'e-a', learnerId: learnerA, eventType: 'BOARDED', recordedAt: new Date() });
    db.transportTrip.update.mockResolvedValue({ ...MOCK_TRIP, status: 'IN_PROGRESS' });

    const results = await service.bulkRecordBoarding(TRIP_ID, [learnerA, learnerB], 'BOARDED');
    expect(results).toHaveLength(2);
    expect(results.find(r => r.learnerId === learnerA)?.status).toBe('ok');
    expect(results.find(r => r.learnerId === learnerB)?.status).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// Driver-scoped operations
//
// These guard the driver app's privacy boundary. The admin trip routes are
// permission-gated, so a driver holding RECORD_BOARDING_EVENTS could otherwise
// read or mutate any trip in the school. These tests pin the identity scoping.
// ---------------------------------------------------------------------------

describe('TripService.getDriverVehicle()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  it('returns null when the driver has no vehicle assigned', async () => {
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);

    const result = await service.getDriverVehicle('driver-1');

    expect(result).toBeNull();
    expect(db.transportRoute.findMany).not.toHaveBeenCalled();
  });

  it('returns the assigned vehicle with its active routes', async () => {
    db.transportVehicle.findFirst.mockResolvedValueOnce({
      id: 'v1', registrationNumber: 'KBX 123A', capacity: 40, status: 'ACTIVE',
    });
    db.transportRoute.findMany.mockResolvedValueOnce([
      { id: 'route-1', name: 'Ngong', description: null },
    ]);

    const result = await service.getDriverVehicle('driver-1');

    expect(result).toMatchObject({ registrationNumber: 'KBX 123A', capacity: 40 });
    expect(result?.routes).toHaveLength(1);
  });
});

describe('TripService.assertDriverOwnsTrip()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  const tripOwnedBy = (driverUserId: string | null, vehicleDriverId: string | null) => ({
    id: TRIP_ID, archived: false, driverUserId,
    route: { vehicleId: 'v1', vehicle: { driverId: vehicleDriverId } },
  });

  it('allows the driver explicitly assigned to the trip', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(tripOwnedBy('driver-1', null));

    await expect(service.assertDriverOwnsTrip('driver-1', TRIP_ID)).resolves.toBeDefined();
  });

  it('allows the driver who owns the trip vehicle', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(tripOwnedBy(null, 'driver-1'));

    await expect(service.assertDriverOwnsTrip('driver-1', TRIP_ID)).resolves.toBeDefined();
  });

  it('throws 403 when the trip belongs to another driver', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(tripOwnedBy('driver-2', 'driver-2'));

    await expect(service.assertDriverOwnsTrip('driver-1', TRIP_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 404 when the trip does not exist', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(null);

    await expect(service.assertDriverOwnsTrip('driver-1', 'nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('TripService.getDriverDay()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  it('scopes the trip query to this driver and their vehicle', async () => {
    db.transportVehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    db.transportTrip.findMany.mockResolvedValueOnce([]);
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);

    await service.getDriverDay('driver-1', new Date('2026-08-04'));

    const args = db.transportTrip.findMany.mock.calls[0][0];
    expect(args.where.date).toEqual(new Date(Date.UTC(2026, 7, 4)));
    expect(args.where.OR).toEqual(
      expect.arrayContaining([{ driverUserId: 'driver-1' }, { route: { vehicleId: 'v1' } }]),
    );
  });

  it('omits the vehicle clause when the driver has no vehicle', async () => {
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);
    db.transportTrip.findMany.mockResolvedValueOnce([]);
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);

    await service.getDriverDay('driver-1', new Date('2026-08-04'));

    const args = db.transportTrip.findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([{ driverUserId: 'driver-1' }]);
  });

  it('never returns archived trips', async () => {
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);
    db.transportTrip.findMany.mockResolvedValueOnce([]);
    db.transportVehicle.findFirst.mockResolvedValueOnce(null);

    await service.getDriverDay('driver-1', new Date('2026-08-04'));

    expect(db.transportTrip.findMany.mock.calls[0][0].where.archived).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Skip pickup (confirmed not collected)
//
// Safety-critical path: this is the action that tells a parent their child was
// NOT collected. The tests pin the guards that stop us alerting a parent about
// the wrong child, and stop a retry spamming them twice.
// ---------------------------------------------------------------------------

describe('TripService.recordNoShow()', () => {
  let service: TripService;
  beforeEach(() => { service = new TripService(); jest.clearAllMocks(); });

  const SKIP = { tripId: TRIP_ID, learnerId: LEARNER_ID, reportedBy: 'driver-1' };

  /** Mocks the happy path up to the point of creating the row. */
  const seedHappyPath = () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.findFirst.mockResolvedValueOnce(null); // not boarded
    db.transportNoShow.findUnique.mockResolvedValueOnce(null);      // first report
  };

  it('records the skip and alerts the guardian', async () => {
    seedHappyPath();
    db.transportNoShow.create.mockResolvedValueOnce({
      id: 'ns-1', reason: 'NO_ANSWER', reportedBy: 'driver-1', guardianNotifiedAt: null,
    });
    db.transportNoShow.update.mockResolvedValueOnce({
      id: 'ns-1', reason: 'NO_ANSWER', reportedBy: 'driver-1', guardianNotifiedAt: new Date(),
    });

    const result = await service.recordNoShow({ ...SKIP, reason: 'NO_ANSWER' });

    expect(result.guardianNotified).toBe(true);
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ learnerId: LEARNER_ID, type: 'BUS_SKIPPED' }),
    );
    // The notification is stamped so a later report can tell it went out.
    expect(db.transportNoShow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guardianNotifiedAt: expect.any(Date) }) }),
    );
  });

  it('rejects a learner who was already boarded (409)', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.findFirst.mockResolvedValueOnce({ eventType: 'BOARDED' });

    await expect(service.recordNoShow(SKIP)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockNotifications.notify).not.toHaveBeenCalled();
  });

  it('rejects a learner not assigned to this route (422)', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(null);

    await expect(service.recordNoShow(SKIP)).rejects.toMatchObject({ statusCode: 422 });
    expect(mockNotifications.notify).not.toHaveBeenCalled();
  });

  it('rejects a cancelled trip', async () => {
    db.transportTrip.findUnique.mockResolvedValueOnce({ ...MOCK_TRIP, status: 'CANCELLED' });

    await expect(service.recordNoShow(SKIP)).rejects.toMatchObject({ statusCode: 422 });
  });

  it('does NOT re-alert the guardian when the driver retries, but reports the true state', async () => {
    // A row already exists from a previous attempt on a dropped connection.
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.findFirst.mockResolvedValueOnce(null);
    db.transportNoShow.findUnique.mockResolvedValueOnce({
      id: 'ns-1', reason: 'NO_ANSWER', reportedBy: 'driver-1', guardianNotifiedAt: new Date(),
    });
    db.transportNoShow.update.mockResolvedValueOnce({
      id: 'ns-1', reason: 'LATE', reportedBy: 'driver-1', guardianNotifiedAt: new Date(),
    });

    const result = await service.recordNoShow({ ...SKIP, reason: 'LATE' });

    // The guardian WAS told on the first attempt, so the response must say so.
    // Returning false here made the driver app warn "parent not notified"
    // about a parent who had already received the alert.
    expect(result.guardianNotified).toBe(true);
    // Critical: no second SMS to the parent.
    expect(mockNotifications.notify).not.toHaveBeenCalled();
    // But the reason is still corrected.
    expect(db.transportNoShow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: 'LATE' }) }),
    );
  });

  it('still reports guardianNotified=false on a retry whose first alert failed', async () => {
    // First attempt created the row but the notification threw, so
    // guardianNotifiedAt was never stamped. The office can retry that later.
    db.transportTrip.findUnique.mockResolvedValueOnce(MOCK_TRIP);
    db.learner.findUnique.mockResolvedValueOnce(MOCK_LEARNER);
    db.transportAssignment.findFirst.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    db.transportBoardingEvent.findFirst.mockResolvedValueOnce(null);
    db.transportNoShow.findUnique.mockResolvedValueOnce({
      id: 'ns-1', reason: 'NO_ANSWER', reportedBy: 'driver-1', guardianNotifiedAt: null,
    });
    db.transportNoShow.update.mockResolvedValueOnce({
      id: 'ns-1', reason: 'LATE', reportedBy: 'driver-1', guardianNotifiedAt: null,
    });

    const result = await service.recordNoShow({ ...SKIP, reason: 'LATE' });

    expect(result.guardianNotified).toBe(false);
    expect(mockNotifications.notify).not.toHaveBeenCalled();
  });

  it('keeps the record when the guardian alert fails', async () => {
    seedHappyPath();
    db.transportNoShow.create.mockResolvedValueOnce({
      id: 'ns-1', reason: 'NO_ANSWER', reportedBy: 'driver-1', guardianNotifiedAt: null,
    });
    mockNotifications.notify.mockRejectedValueOnce(new Error('SMS gateway down'));

    const result = await service.recordNoShow(SKIP);

    // The skip still exists and is still reportable...
    expect(result.noShow).toBeDefined();
    expect(result.guardianNotified).toBe(false);
    // ...and guardianNotifiedAt stays null so the office can retry the alert.
    const stampCalls = db.transportNoShow.update.mock.calls.filter(
      (c: any[]) => c[0]?.data && 'guardianNotifiedAt' in c[0].data,
    );
    expect(stampCalls).toHaveLength(0);
  });
});
