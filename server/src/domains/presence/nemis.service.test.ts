/**
 * Unit tests for NEMISService
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    school:     { findFirst: jest.fn() },
    learner:    { findMany: jest.fn() },
    attendance: { findMany: jest.fn() },
  },
}));

import prisma from '../../config/database';
import { NEMISService } from './nemis.service';

const db   = prisma as any;
const svc  = new NEMISService();
const SCHOOL = { name: 'Test Primary School' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NEMISService.generateTermAttendanceReport()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.school.findFirst.mockResolvedValue(SCHOOL);
  });

  it('generates a report with correct summary', async () => {
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', upiNumber: 'UPI001', admissionNumber: 'ADM-001', firstName: 'Alice', lastName: 'Mwangi', grade: 'Grade 8', gender: 'FEMALE' },
      { id: 'l2', upiNumber: null, admissionNumber: 'ADM-002', firstName: 'Bob', lastName: 'Otieno', grade: 'Grade 8', gender: 'MALE' },
    ]);
    db.attendance.findMany.mockResolvedValue([
      ...Array(18).fill({ learnerId: 'l1', status: 'PRESENT' }),
      ...Array(2).fill({ learnerId: 'l1', status: 'ABSENT' }),
      ...Array(15).fill({ learnerId: 'l2', status: 'PRESENT' }),
      ...Array(5).fill({ learnerId: 'l2', status: 'ABSENT' }),
    ]);

    const report = await svc.generateTermAttendanceReport('TERM_1', 2026);

    expect(report.schoolName).toBe('Test Primary School');
    expect(report.term).toBe('TERM_1');
    expect(report.academicYear).toBe(2026);
    expect(report.records).toHaveLength(2);
    expect(report.summary.learnersWithUpi).toBe(1);
    expect(report.summary.learnersWithoutUpi).toBe(1);
    expect(report.summary.learnersWithNoRecords).toBe(0);
  });

  it('calculates attendance rates correctly', async () => {
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', upiNumber: 'UPI001', admissionNumber: 'ADM-001', firstName: 'Alice', lastName: 'Mwangi', grade: 'Grade 5', gender: 'FEMALE' },
    ]);
    // 18 PRESENT + 2 ABSENT = 20 total, 90% rate
    db.attendance.findMany.mockResolvedValue([
      ...Array(18).fill({ learnerId: 'l1', status: 'PRESENT' }),
      ...Array(2).fill({ learnerId: 'l1', status: 'ABSENT' }),
    ]);

    const report = await svc.generateTermAttendanceReport('TERM_2', 2026);
    const rec    = report.records[0];
    expect(rec.daysPresent).toBe(18);
    expect(rec.daysAbsent).toBe(2);
    expect(rec.attendanceRate).toBe(90);
  });

  it('counts LATE as present in daysPresent', async () => {
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', upiNumber: 'UPI001', admissionNumber: 'ADM-001', firstName: 'A', lastName: 'B', grade: 'Grade 4', gender: 'MALE' },
    ]);
    db.attendance.findMany.mockResolvedValue([
      ...Array(15).fill({ learnerId: 'l1', status: 'PRESENT' }),
      ...Array(3).fill({ learnerId: 'l1', status: 'LATE' }),
      ...Array(2).fill({ learnerId: 'l1', status: 'ABSENT' }),
    ]);

    const report = await svc.generateTermAttendanceReport('TERM_1', 2026);
    const rec    = report.records[0];
    expect(rec.daysPresent).toBe(18); // 15 + 3 late
    expect(rec.daysLate).toBe(3);
    expect(rec.daysAbsent).toBe(2);
    expect(rec.totalDaysMarked).toBe(20);
  });

  it('excludes learners with no attendance records', async () => {
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', upiNumber: 'UPI001', admissionNumber: 'ADM-001', firstName: 'Alice', lastName: 'Mwangi', grade: 'Grade 8', gender: 'FEMALE' },
      { id: 'l2', upiNumber: 'UPI002', admissionNumber: 'ADM-002', firstName: 'Bob', lastName: 'Smith', grade: 'Grade 8', gender: 'MALE' },
    ]);
    // Only l1 has records
    db.attendance.findMany.mockResolvedValue([
      ...Array(10).fill({ learnerId: 'l1', status: 'PRESENT' }),
    ]);

    const report = await svc.generateTermAttendanceReport('TERM_1', 2026);
    expect(report.records).toHaveLength(1);
    expect(report.records[0].admissionNumber).toBe('ADM-001');
    expect(report.summary.learnersWithNoRecords).toBe(1);
  });

  it('marks NOT_ASSIGNED when upiNumber is null', async () => {
    db.learner.findMany.mockResolvedValue([
      { id: 'l1', upiNumber: null, admissionNumber: 'ADM-001', firstName: 'No', lastName: 'UPI', grade: 'PP1', gender: 'MALE' },
    ]);
    db.attendance.findMany.mockResolvedValue([
      ...Array(10).fill({ learnerId: 'l1', status: 'PRESENT' }),
    ]);

    const report = await svc.generateTermAttendanceReport('TERM_1', 2026);
    expect(report.records[0].upiNumber).toBe('NOT_ASSIGNED');
  });

  it('throws 500 when no school found', async () => {
    db.school.findFirst.mockResolvedValue(null);
    await expect(svc.generateTermAttendanceReport('TERM_1', 2026)).rejects.toMatchObject({ statusCode: 500 });
  });
});
