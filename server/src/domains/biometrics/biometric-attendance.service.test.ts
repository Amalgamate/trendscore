/**
 * Unit tests for BiometricAttendanceService
 * DB fully mocked — no connection required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    learner:     { findFirst: jest.fn() },
    attendance:  { findUnique: jest.fn(), create: jest.fn() },
    school:      { findUnique: jest.fn(), findFirst: jest.fn() },
    user:        { findFirst: jest.fn() },
  },
}));

import prisma from '../../config/database';
import {
  resolveAttendanceStatus,
  handleBiometricLearnerScan,
} from './biometric-attendance.service';
import { AttendanceStatus } from '@prisma/client';

const db = prisma as any;

// ── resolveAttendanceStatus (pure function — no mocks needed) ─────────────────

describe('resolveAttendanceStatus()', () => {
  // Lock time = 07:30 EAT = 04:30 UTC
  // Scan at 07:00 EAT = 04:00 UTC → before lock → PRESENT
  // Scan at 07:45 EAT = 04:45 UTC → after lock → LATE

  function eatToUtc(hh: number, mm: number): Date {
    // Create a UTC timestamp that represents HH:MM in EAT (UTC+3)
    return new Date(Date.UTC(2026, 7, 4, hh - 3, mm, 0));
  }

  it('returns PRESENT when lock is disabled', () => {
    const ts = eatToUtc(10, 0); // 10:00 EAT — well past lock
    expect(resolveAttendanceStatus(ts, false, '07:30')).toBe(AttendanceStatus.PRESENT);
  });

  it('returns PRESENT when scan is before lock time', () => {
    const ts = eatToUtc(7, 0); // 07:00 EAT
    expect(resolveAttendanceStatus(ts, true, '07:30')).toBe(AttendanceStatus.PRESENT);
  });

  it('returns PRESENT when scan is exactly at lock time', () => {
    const ts = eatToUtc(7, 30); // 07:30 EAT exactly
    expect(resolveAttendanceStatus(ts, true, '07:30')).toBe(AttendanceStatus.PRESENT);
  });

  it('returns LATE when scan is 1 minute past lock time', () => {
    const ts = eatToUtc(7, 31); // 07:31 EAT
    expect(resolveAttendanceStatus(ts, true, '07:30')).toBe(AttendanceStatus.LATE);
  });

  it('returns LATE when scan is well past lock time', () => {
    const ts = eatToUtc(10, 0); // 10:00 EAT
    expect(resolveAttendanceStatus(ts, true, '07:30')).toBe(AttendanceStatus.LATE);
  });

  it('works for a 09:00 lock time', () => {
    const beforeLock = eatToUtc(8, 59);
    const afterLock  = eatToUtc(9, 1);
    expect(resolveAttendanceStatus(beforeLock, true, '09:00')).toBe(AttendanceStatus.PRESENT);
    expect(resolveAttendanceStatus(afterLock,  true, '09:00')).toBe(AttendanceStatus.LATE);
  });
});

// ── handleBiometricLearnerScan ────────────────────────────────────────────────

describe('handleBiometricLearnerScan()', () => {
  const LEARNER   = { id: 'learner-1', grade: 'Grade 5' };
  const SCHOOL    = { attendanceLockEnabled: true, attendanceLockTime: '07:30' };
  const ADMIN     = { id: 'admin-1' };
  const TIMESTAMP = new Date('2026-08-04T04:15:00.000Z'); // 07:15 EAT — before lock

  beforeEach(() => {
    jest.clearAllMocks();
    db.learner.findFirst.mockResolvedValue(LEARNER);
    db.attendance.findUnique.mockResolvedValue(null); // no existing record
    db.school.findUnique.mockResolvedValue(SCHOOL);
    db.school.findFirst.mockResolvedValue(SCHOOL);
    db.user.findFirst.mockResolvedValue(ADMIN);
    db.attendance.create.mockResolvedValue({ id: 'att-1', status: 'PRESENT' });
  });

  it('creates a PRESENT record for a scan before lock time', async () => {
    const result = await handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'IN',
      timestamp: TIMESTAMP, deviceId: 'dev-1', schoolId: 'school-1',
    });
    expect(result.action).toBe('created');
    expect(result.status).toBe(AttendanceStatus.PRESENT);
    expect(db.attendance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: AttendanceStatus.PRESENT, source: 'BIOMETRIC' }),
    }));
  });

  it('creates a LATE record for a scan after lock time', async () => {
    const lateTimestamp = new Date('2026-08-04T04:45:00.000Z'); // 07:45 EAT — after 07:30 lock
    db.attendance.create.mockResolvedValue({ id: 'att-2', status: 'LATE' });

    const result = await handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'IN',
      timestamp: lateTimestamp, deviceId: 'dev-1', schoolId: 'school-1',
    });
    expect(result.status).toBe(AttendanceStatus.LATE);
  });

  it('skips attendance creation for OUT direction', async () => {
    const result = await handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'OUT',
      timestamp: TIMESTAMP, deviceId: 'dev-1', schoolId: 'school-1',
    });
    expect(result.action).toBe('skipped_out');
    expect(db.attendance.create).not.toHaveBeenCalled();
  });

  it('skips when attendance already exists for today', async () => {
    db.attendance.findUnique.mockResolvedValue({ id: 'existing', status: 'PRESENT' });

    const result = await handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'IN',
      timestamp: TIMESTAMP, deviceId: 'dev-1', schoolId: 'school-1',
    });
    expect(result.action).toBe('skipped_existing');
    expect(db.attendance.create).not.toHaveBeenCalled();
  });

  it('throws when learner not found', async () => {
    db.learner.findFirst.mockResolvedValue(null);
    await expect(handleBiometricLearnerScan({
      admissionNumber: 'UNKNOWN', direction: 'IN',
      timestamp: TIMESTAMP, deviceId: 'dev-1', schoolId: 'school-1',
    })).rejects.toThrow('Learner not found');
  });

  it('throws when no admin user found for markedBy', async () => {
    db.user.findFirst.mockResolvedValue(null);
    await expect(handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'IN',
      timestamp: TIMESTAMP, deviceId: 'dev-1', schoolId: 'school-1',
    })).rejects.toThrow('No admin user found');
  });

  it('uses PRESENT when school lock is disabled', async () => {
    db.school.findFirst.mockResolvedValue({ attendanceLockEnabled: false, attendanceLockTime: '07:30' });
    const lateTimestamp = new Date('2026-08-04T10:00:00.000Z'); // 13:00 EAT — but lock is OFF
    db.attendance.create.mockResolvedValue({ id: 'att-3', status: 'PRESENT' });

    const result = await handleBiometricLearnerScan({
      admissionNumber: 'ADM-001', direction: 'IN',
      timestamp: lateTimestamp, deviceId: 'dev-1', schoolId: null, // will use findFirst
    });
    expect(result.status).toBe(AttendanceStatus.PRESENT);
  });
});
