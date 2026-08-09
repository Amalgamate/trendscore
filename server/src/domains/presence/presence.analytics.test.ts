/**
 * Unit tests for Presence Analytics
 * All DB calls are mocked.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    presenceEvent:        { findMany: jest.fn() },
    learner:              { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    dormRollCall:         { findMany: jest.fn() },
    dormRollCallEntry:    { findMany: jest.fn() },
  },
}));

import prisma from '../../config/database';
import {
  getDailyAttendanceRates,
  getAtRiskLearners,
  getGradeAttendanceSummary,
} from './presence.analytics';

const db = prisma as any;

const TODAY_ISO = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// getDailyAttendanceRates
// ---------------------------------------------------------------------------

describe('getDailyAttendanceRates()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an entry for each of the past N days', async () => {
    db.learner.count.mockResolvedValue(100);
    db.presenceEvent.findMany.mockResolvedValue([]);
    const result = await getDailyAttendanceRates('school-1', 7);
    expect(result).toHaveLength(8); // 7 days back + today
  });

  it('calculates attendance rate correctly from events', async () => {
    db.learner.count.mockResolvedValue(10);
    // 7 PRESENT events today
    const today = new Date(); today.setUTCHours(8, 0, 0, 0);
    const events = Array(7).fill(null).map((_, i) => ({
      personId: `learner-${i}`,
      timestamp: today,
      metadata:  { attendanceStatus: 'PRESENT' },
    }));
    db.presenceEvent.findMany.mockResolvedValue(events);

    const result = await getDailyAttendanceRates('school-1', 0);
    const todayEntry = result.find(r => r.date === TODAY_ISO);
    expect(todayEntry?.presentCount).toBe(7);
    expect(todayEntry?.totalLearners).toBe(10);
    expect(todayEntry?.attendanceRate).toBe(70);
    expect(todayEntry?.unmarkedCount).toBe(3);
  });

  it('counts LATE as present in rate calculation', async () => {
    db.learner.count.mockResolvedValue(10);
    const today = new Date(); today.setUTCHours(8, 0, 0, 0);
    db.presenceEvent.findMany.mockResolvedValue([
      { personId: 'l1', timestamp: today, metadata: { attendanceStatus: 'PRESENT' } },
      { personId: 'l2', timestamp: today, metadata: { attendanceStatus: 'LATE' } },
    ]);
    const result = await getDailyAttendanceRates('school-1', 0);
    const todayEntry = result.find(r => r.date === TODAY_ISO);
    expect(todayEntry?.presentCount).toBe(2); // both PRESENT and LATE are "present"
    expect(todayEntry?.lateCount).toBe(1);
  });

  it('returns zero counts when no events exist', async () => {
    db.learner.count.mockResolvedValue(50);
    db.presenceEvent.findMany.mockResolvedValue([]);
    const result = await getDailyAttendanceRates('school-1', 0);
    const todayEntry = result.find(r => r.date === TODAY_ISO);
    expect(todayEntry?.presentCount).toBe(0);
    expect(todayEntry?.attendanceRate).toBe(0);
    expect(todayEntry?.unmarkedCount).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getAtRiskLearners
// ---------------------------------------------------------------------------

describe('getAtRiskLearners()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when no events', async () => {
    db.presenceEvent.findMany.mockResolvedValue([]);
    const result = await getAtRiskLearners('school-1', 28, 50);
    expect(result).toEqual([]);
  });

  it('flags learner with >20% absence rate and ≥5 marked days', async () => {
    const events = [
      ...Array(14).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'PRESENT' } }),
      ...Array(6).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'ABSENT' } }),
    ];
    db.presenceEvent.findMany.mockResolvedValue(events);
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', firstName: 'Alice', lastName: 'Doe', grade: 'Grade 8', stream: null },
    ]);

    const result = await getAtRiskLearners('school-1', 28, 50);
    expect(result).toHaveLength(1);
    expect(result[0].absenceRate).toBe(30);
    expect(result[0].riskLevel).toBe('HIGH');
  });

  it('does NOT flag learner with <15% absence rate', async () => {
    const events = [
      ...Array(18).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'PRESENT' } }),
      ...Array(2).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'ABSENT' } }),
    ];
    db.presenceEvent.findMany.mockResolvedValue(events);
    db.learner.findMany.mockResolvedValue([]);

    const result = await getAtRiskLearners('school-1', 28, 50);
    expect(result).toHaveLength(0);
  });

  it('does NOT flag learner with fewer than 5 marked days', async () => {
    const events = Array(4).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'ABSENT' } });
    db.presenceEvent.findMany.mockResolvedValue(events);
    db.learner.findMany.mockResolvedValue([]);

    const result = await getAtRiskLearners('school-1', 28, 50);
    expect(result).toHaveLength(0);
  });

  it('assigns CRITICAL level at ≥40% absence rate', async () => {
    const events = [
      ...Array(6).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'PRESENT' } }),
      ...Array(4).fill({ personId: 'l1', timestamp: new Date(), metadata: { attendanceStatus: 'ABSENT' } }),
    ];
    db.presenceEvent.findMany.mockResolvedValue(events);
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', firstName: 'A', lastName: 'B', grade: 'Grade 5', stream: null },
    ]);

    const result = await getAtRiskLearners('school-1', 28, 50);
    expect(result[0].riskLevel).toBe('CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// getGradeAttendanceSummary
// ---------------------------------------------------------------------------

describe('getGradeAttendanceSummary()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns grade breakdown with correct rates', async () => {
    db.learner.groupBy.mockResolvedValue([
      { grade: 'Grade 5', _count: { id: 30 } },
      { grade: 'Grade 6', _count: { id: 25 } },
    ]);
    db.presenceEvent.findMany.mockResolvedValue([
      ...Array(20).fill({ personId: 'l1', metadata: { attendanceStatus: 'PRESENT' } }),
    ]);
    db.learner.findMany.mockResolvedValue(
      Array(20).fill({ grade: 'Grade 5' }),
    );

    const result = await getGradeAttendanceSummary('school-1');
    const grade5 = result.find(r => r.grade === 'Grade 5');
    expect(grade5).toBeDefined();
    expect(grade5!.totalLearners).toBe(30);
    expect(grade5!.attendanceRate).toBe(67); // 20/30
  });
});
