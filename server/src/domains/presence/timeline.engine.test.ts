/**
 * Unit tests for TimelineEngine
 * Prisma is mocked — no DB required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    presenceEvent: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../config/database';
import { TimelineEngine } from './timeline.engine';

const mockPrisma = prisma as any;
const engine = new TimelineEngine();
const TEST_DATE = new Date('2026-08-04T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<any> = {}): any {
  return {
    id:            'evt-1',
    personId:      'learner-1',
    eventType:     'CLASS_ATTENDANCE',
    context:       'CLASS',
    timestamp:     new Date('2026-08-04T05:00:00.000Z'),
    sourceModule:  'ATTENDANCE',
    deviceId:      null,
    location:      null,
    metadata:      { attendanceStatus: 'PRESENT', classId: 'class-1' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimelineEngine.buildTimeline()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when no events exist', async () => {
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([]);
    const result = await engine.buildTimeline('learner-1', TEST_DATE);
    expect(result).toEqual([]);
  });

  it('queries with correct date range (UTC midnight to 23:59:59.999)', async () => {
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([]);
    await engine.buildTimeline('learner-1', TEST_DATE);

    const call = mockPrisma.presenceEvent.findMany.mock.calls[0][0];
    expect(call.where.personId).toBe('learner-1');
    expect(call.where.timestamp.gte.toISOString()).toBe('2026-08-04T00:00:00.000Z');
    expect(call.where.timestamp.lte.toISOString()).toBe('2026-08-04T23:59:59.999Z');
    expect(call.orderBy).toEqual({ timestamp: 'asc' });
  });

  it('returns events sorted chronologically (earliest first)', async () => {
    const events = [
      makeEvent({ id: 'e1', timestamp: new Date('2026-08-04T05:00:00Z'), eventType: 'CLASS_ATTENDANCE' }),
      makeEvent({ id: 'e2', timestamp: new Date('2026-08-04T04:15:00Z'), eventType: 'GATE_ENTRY', context: 'GATE', metadata: null }),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // DB would order them

    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce(events);
    const result = await engine.buildTimeline('learner-1', TEST_DATE);

    expect(result[0].eventType).toBe('GATE_ENTRY');
    expect(result[1].eventType).toBe('CLASS_ATTENDANCE');
  });

  // ── Description tests ────────────────────────────────────────────────────

  describe('description generation', () => {
    it('CLASS_ATTENDANCE PRESENT → "Marked Present"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ metadata: { attendanceStatus: 'PRESENT' } }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toContain('Marked Present');
    });

    it('CLASS_ATTENDANCE LATE → "Marked Late"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ metadata: { attendanceStatus: 'LATE' } }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toContain('Marked Late');
    });

    it('CLASS_ATTENDANCE ABSENT → "Marked Absent"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ metadata: { attendanceStatus: 'ABSENT' } }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toContain('Marked Absent');
    });

    it('GATE_ENTRY with location → "Arrived at {location}"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'GATE_ENTRY', context: 'GATE', location: 'Main Gate', metadata: null }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toBe('Arrived at Main Gate');
    });

    it('GATE_ENTRY without location → "Arrived at School Gate"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'GATE_ENTRY', context: 'GATE', location: null, metadata: null }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toBe('Arrived at School Gate');
    });

    it('BUS_BOARDED with route name → includes route name', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'BUS_BOARDED', context: 'BUS', location: null, metadata: { routeName: 'Route 3 Ngong', direction: 'OUTBOUND' } }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toContain('Route 3 Ngong');
      expect(entry.description).toContain('to school');
    });

    it('BUS_ALIGHTED without route → "Alighted from School Bus"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'BUS_ALIGHTED', context: 'BUS', metadata: {} }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toBe('Alighted from School Bus');
    });

    it('DORM_ROLL_CALL night session → includes "Night Roll Call"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'DORM_ROLL_CALL', context: 'DORMITORY', location: 'Block A', metadata: { session: 'NIGHT' } }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toContain('Night Roll Call');
      expect(entry.description).toContain('Block A');
    });

    it('CLOCK_IN → "Clocked In"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'CLOCK_IN', context: 'SCHOOL', metadata: {} }),
      ]);
      const [entry] = await engine.buildTimeline('s1', TEST_DATE);
      expect(entry.description).toBe('Clocked In');
    });

    it('LIBRARY_VISITED → "Library Visit"', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ eventType: 'LIBRARY_VISITED', context: 'LIBRARY', metadata: {} }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.description).toBe('Library Visit');
    });
  });

  // ── Source resolution ─────────────────────────────────────────────────────

  describe('source field', () => {
    it('source = BIOMETRIC when deviceId present', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ deviceId: 'device-1', sourceModule: 'BIOMETRIC' }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.source).toBe('BIOMETRIC');
    });

    it('source = DRIVER when sourceModule = TRANSPORT and no deviceId', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ sourceModule: 'TRANSPORT', deviceId: null }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.source).toBe('DRIVER');
    });

    it('source = MANUAL for standard attendance', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ sourceModule: 'ATTENDANCE', deviceId: null }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.source).toBe('MANUAL');
    });

    it('source = SYSTEM when sourceModule = SYSTEM', async () => {
      mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
        makeEvent({ sourceModule: 'SYSTEM', deviceId: null }),
      ]);
      const [entry] = await engine.buildTimeline('l1', TEST_DATE);
      expect(entry.source).toBe('SYSTEM');
    });
  });
});

// ---------------------------------------------------------------------------
// buildSummary
// ---------------------------------------------------------------------------

describe('TimelineEngine.buildSummary()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns eventCount = 0 and nulls for empty day', async () => {
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([]);
    const summary = await engine.buildSummary('l1', TEST_DATE);
    expect(summary.eventCount).toBe(0);
    expect(summary.firstEvent).toBeNull();
    expect(summary.lastEvent).toBeNull();
    expect(summary.hasClassAttendance).toBe(false);
    expect(summary.attendanceStatus).toBeNull();
  });

  it('sets hasClassAttendance=true when CLASS_ATTENDANCE present', async () => {
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([
      makeEvent({ metadata: { attendanceStatus: 'LATE' } }),
    ]);
    const summary = await engine.buildSummary('l1', TEST_DATE);
    expect(summary.hasClassAttendance).toBe(true);
    expect(summary.attendanceStatus).toBe('LATE');
  });

  it('returns date in YYYY-MM-DD format', async () => {
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce([]);
    const summary = await engine.buildSummary('l1', new Date('2026-08-04T00:00:00Z'));
    expect(summary.date).toBe('2026-08-04');
  });

  it('sets firstEvent and lastEvent correctly', async () => {
    const events = [
      makeEvent({ id: 'e1', timestamp: new Date('2026-08-04T04:15:00Z'), eventType: 'GATE_ENTRY', metadata: null }),
      makeEvent({ id: 'e2', timestamp: new Date('2026-08-04T05:00:00Z'), eventType: 'CLASS_ATTENDANCE' }),
      makeEvent({ id: 'e3', timestamp: new Date('2026-08-04T14:30:00Z'), eventType: 'GATE_EXIT', metadata: null }),
    ];
    mockPrisma.presenceEvent.findMany.mockResolvedValueOnce(events);
    const summary = await engine.buildSummary('l1', TEST_DATE);
    expect(summary.eventCount).toBe(3);
    expect(summary.firstEvent?.toISOString()).toBe('2026-08-04T04:15:00.000Z');
    expect(summary.lastEvent?.toISOString()).toBe('2026-08-04T14:30:00.000Z');
  });
});
