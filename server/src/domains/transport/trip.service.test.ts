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
    },
    transportAssignment: {
      findFirst: jest.fn(),
      findMany:  jest.fn(),
    },
    transportBoardingEvent: {
      create:  jest.fn(),
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

const db = prisma as any;
const mockPresence = presenceService as any;

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
