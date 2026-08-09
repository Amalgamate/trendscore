/**
 * Unit tests for ChronicAbsentWorker pure logic.
 * DB mocked — no connection required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    school:               { findFirst: jest.fn() },
    presenceRule:         { findUnique: jest.fn(), create: jest.fn() },
    presenceRuleViolation:{ findMany: jest.fn(), create: jest.fn() },
    learner:              { findMany: jest.fn() },
    attendance:           { findMany: jest.fn() },
    class:                { findFirst: jest.fn() },
    user:                 { findMany: jest.fn() },
  },
}));

jest.mock('../../services/notification.service', () => ({
  NotificationService: { createNotification: jest.fn().mockResolvedValue({}) },
  NotificationType: { INFO: 'INFO', WARNING: 'WARNING' },
}));

import prisma from '../../config/database';
import { runChronicAbsentWorker } from './chronic-absent.worker';

const db = prisma as any;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHOOL  = { id: 'school-1', name: 'Test Primary', staffWorkingDays: [1,2,3,4,5] };
const RULE    = { id: 'rule-1', schoolId: 'school-1', ruleCode: 'CHRONIC_ABSENT', enabled: true, config: {} };
const LEARNER_A = { id: 'l-a', firstName: 'Alice', lastName: 'Doe', grade: 'Grade 5', stream: null };
const LEARNER_B = { id: 'l-b', firstName: 'Bob',   lastName: 'Smith', grade: 'Grade 5', stream: null };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runChronicAbsentWorker()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips when no active school', async () => {
    db.school.findFirst.mockResolvedValue(null);
    const result = await runChronicAbsentWorker();
    expect(result.schoolId).toBeNull();
    expect(result.learnersScanned).toBe(0);
  });

  it('skips when rule is disabled', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue({ ...RULE, enabled: false });
    const result = await runChronicAbsentWorker();
    expect(result.learnersScanned).toBe(0);
  });

  it('creates the rule when it does not exist', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(null);
    db.presenceRule.create.mockResolvedValue(RULE);
    db.learner.findMany.mockResolvedValue([]);
    db.attendance.findMany.mockResolvedValue([]);
    db.presenceRuleViolation.findMany.mockResolvedValue([]);

    await runChronicAbsentWorker();
    expect(db.presenceRule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ruleCode: 'CHRONIC_ABSENT' }),
    }));
  });

  it('does NOT flag a learner below the threshold', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(RULE);
    db.presenceRuleViolation.findMany.mockResolvedValue([]);
    db.learner.findMany.mockResolvedValue([LEARNER_A]);
    // 2 absent out of 20 marked = 10% — below 20% default
    const attendanceRecords = [
      ...Array(18).fill({ learnerId: 'l-a', status: 'PRESENT' }),
      ...Array(2).fill({ learnerId: 'l-a', status: 'ABSENT' }),
    ];
    db.attendance.findMany.mockResolvedValue(attendanceRecords);

    const result = await runChronicAbsentWorker();
    expect(result.atRiskCount).toBe(0);
    expect(db.presenceRuleViolation.create).not.toHaveBeenCalled();
  });

  it('flags a learner above the threshold and creates a violation', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(RULE);
    db.presenceRuleViolation.findMany.mockResolvedValue([]);
    db.learner.findMany.mockResolvedValue([LEARNER_A]);
    // 6 absent out of 20 marked = 30% — above 20% default
    const attendanceRecords = [
      ...Array(14).fill({ learnerId: 'l-a', status: 'PRESENT' }),
      ...Array(6).fill({ learnerId: 'l-a', status: 'ABSENT' }),
    ];
    db.attendance.findMany.mockResolvedValue(attendanceRecords);
    db.class.findFirst.mockResolvedValue({ teacherId: 'teacher-1' });
    db.user.findMany.mockResolvedValue([]);
    db.presenceRuleViolation.create.mockResolvedValue({ id: 'viol-1' });

    const result = await runChronicAbsentWorker();
    expect(result.atRiskCount).toBe(1);
    expect(result.notified).toBe(1);
    expect(db.presenceRuleViolation.create).toHaveBeenCalledTimes(1);
    const violData = db.presenceRuleViolation.create.mock.calls[0][0].data;
    expect(violData.personId).toBe('l-a');
    expect(violData.ruleId).toBe('rule-1');
    expect((violData.metadata as any).absenceRate).toBe(30);
  });

  it('skips learner with fewer than 3 records (insufficient data)', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(RULE);
    db.presenceRuleViolation.findMany.mockResolvedValue([]);
    db.learner.findMany.mockResolvedValue([LEARNER_A]);
    // Only 2 records — skipped regardless of rate
    db.attendance.findMany.mockResolvedValue([
      { learnerId: 'l-a', status: 'ABSENT' },
      { learnerId: 'l-a', status: 'ABSENT' },
    ]);

    const result = await runChronicAbsentWorker();
    expect(result.atRiskCount).toBe(0);
  });

  it('does not create duplicate violation when one already exists', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(RULE);
    // Already flagged
    db.presenceRuleViolation.findMany.mockResolvedValue([{ personId: 'l-a' }]);
    db.learner.findMany.mockResolvedValue([LEARNER_A]);
    db.attendance.findMany.mockResolvedValue([
      ...Array(14).fill({ learnerId: 'l-a', status: 'PRESENT' }),
      ...Array(6).fill({ learnerId: 'l-a', status: 'ABSENT' }),
    ]);

    const result = await runChronicAbsentWorker();
    expect(result.atRiskCount).toBe(1);
    expect(result.alreadyFlagged).toBe(1);
    expect(result.notified).toBe(0);
    expect(db.presenceRuleViolation.create).not.toHaveBeenCalled();
  });

  it('processes multiple learners independently', async () => {
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.presenceRule.findUnique.mockResolvedValue(RULE);
    db.presenceRuleViolation.findMany.mockResolvedValue([]);
    db.learner.findMany.mockResolvedValue([LEARNER_A, LEARNER_B]);
    // A: 30% absent (at-risk), B: 10% absent (safe)
    db.attendance.findMany.mockResolvedValue([
      ...Array(14).fill({ learnerId: 'l-a', status: 'PRESENT' }),
      ...Array(6).fill({ learnerId: 'l-a', status: 'ABSENT' }),
      ...Array(18).fill({ learnerId: 'l-b', status: 'PRESENT' }),
      ...Array(2).fill({ learnerId: 'l-b', status: 'ABSENT' }),
    ]);
    db.class.findFirst.mockResolvedValue({ teacherId: 'teacher-1' });
    db.user.findMany.mockResolvedValue([]);
    db.presenceRuleViolation.create.mockResolvedValue({ id: 'viol-1' });

    const result = await runChronicAbsentWorker();
    expect(result.learnersScanned).toBe(2);
    expect(result.atRiskCount).toBe(1);   // only A
    expect(result.notified).toBe(1);
  });
});
