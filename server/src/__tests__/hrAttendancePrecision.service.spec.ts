jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    school: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    staffAttendanceLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    leaveRequest: { findMany: jest.fn() },
    staffAttendanceAttemptLog: { create: jest.fn() },
    staffAttendanceCorrection: { create: jest.fn() },
    payrollRecord: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../services/whatsapp.service', () => ({
  whatsappService: { sendMessage: jest.fn() },
}));

jest.mock('../services/sms.service', () => ({
  SmsService: { sendSms: jest.fn(), isAvailable: jest.fn() },
}));

import prisma from '../config/database';
import { HRService } from '../services/hr.service';

const mockedPrisma = prisma as unknown as {
  school: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  staffAttendanceLog: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
    findMany: jest.Mock;
  };
  leaveRequest: { findMany: jest.Mock };
  staffAttendanceAttemptLog: { create: jest.Mock };
  staffAttendanceCorrection: { create: jest.Mock };
  payrollRecord: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

describe('HRService precise staff attendance', () => {
  let service: HRService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HRService();
    mockedPrisma.school.findFirst.mockResolvedValue({
      id: 'school-1',
      latitude: null,
      longitude: null,
      geofenceRadiusMeters: 30,
      geofenceEnforcementMode: 'OFF',
      allowedClockInIps: null,
    });
    mockedPrisma.staffAttendanceAttemptLog.create.mockResolvedValue({});
  });

  it('keeps the first clock-in and completed clock-out on repeated clock-in attempts', async () => {
    const existing = {
      id: 'attendance-1',
      userId: 'staff-1',
      schoolId: 'school-1',
      date: new Date('2026-07-21T00:00:00.000Z'),
      status: 'PRESENT',
      clockInAt: new Date('2026-07-21T05:30:00.000Z'),
      clockOutAt: new Date('2026-07-21T14:30:00.000Z'),
      source: 'web',
      metadata: null,
    };
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValue(existing);

    const result = await service.clockInStaff('staff-1', {
      timestamp: '2026-07-21T06:00:00.000Z',
      source: 'web',
    });

    expect(result).toMatchObject({ attendance: existing, alreadyClockedIn: true });
    expect(mockedPrisma.staffAttendanceLog.update).not.toHaveBeenCalled();
    expect(mockedPrisma.staffAttendanceLog.create).not.toHaveBeenCalled();
  });

  it('stores an explicit absence and an immutable correction instead of deleting history', async () => {
    const previous = {
      id: 'attendance-1',
      userId: 'staff-1',
      date: new Date('2026-07-21T00:00:00.000Z'),
      status: 'PRESENT',
      clockInAt: new Date('2026-07-21T05:30:00.000Z'),
      clockOutAt: null,
    };
    const absent = { ...previous, status: 'ABSENT', clockInAt: null, clockOutAt: null };
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'staff-1', role: 'DRIVER', archived: false, firstName: 'Test', lastName: 'Driver', staffId: 'D-1',
    });
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValue(previous);
    mockedPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      staffAttendanceLog: { upsert: jest.fn().mockResolvedValue(absent) },
      staffAttendanceCorrection: { create: mockedPrisma.staffAttendanceCorrection.create.mockResolvedValue({}) },
    }));

    const result = await service.markStaffAttendance({
      userId: 'staff-1',
      status: 'ABSENT',
      date: '2026-07-21',
      markedBy: 'admin-1',
      reason: 'Approved manual correction',
    });

    expect(result).toMatchObject({ status: 'ABSENT', clockInAt: null, clockOutAt: null });
    expect(mockedPrisma.staffAttendanceCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousStatus: 'PRESENT',
        newStatus: 'ABSENT',
        reason: 'Approved manual correction',
        correctedBy: 'admin-1',
      }),
    });
  });

  it('reconciles approved leave and derives precise range totals', async () => {
    const staff = { id: 'staff-1', firstName: 'Test', lastName: 'Teacher', email: 't@example.com', staffId: 'T-1', role: 'TEACHER' };
    mockedPrisma.user.findMany.mockResolvedValue([staff]);
    mockedPrisma.staffAttendanceLog.findMany.mockResolvedValue([{
      id: 'attendance-1', userId: 'staff-1', date: new Date('2026-07-20T00:00:00.000Z'), status: 'PRESENT',
      clockInAt: new Date('2026-07-20T05:45:00.000Z'), clockOutAt: new Date('2026-07-20T14:45:00.000Z'),
      user: staff, corrections: [],
    }]);
    mockedPrisma.leaveRequest.findMany.mockResolvedValue([{
      id: 'leave-1', userId: 'staff-1', status: 'APPROVED', startDate: new Date('2026-07-21T00:00:00.000Z'),
      endDate: new Date('2026-07-21T00:00:00.000Z'), leaveType: { name: 'Annual Leave' },
    }]);

    const report = await service.getAttendanceReport({ startDate: '2026-07-20', endDate: '2026-07-21' });

    expect(report.rows.map((row: any) => row.status)).toEqual(expect.arrayContaining(['LATE', 'ON_LEAVE']));
    expect(report.summary[0]).toMatchObject({ expectedDays: 1, attendedDays: 1, leaveDays: 1, absentDays: 0, attendanceRate: 100 });
  });
});

// ─── Errand (multi-session) tests ────────────────────────────────────────────

describe('HRService errand clock-out / same-day return', () => {
  let service: HRService;

  const BASE_DATE = '2026-09-11T00:00:00.000Z';
  const CLOCK_IN_1 = '2026-09-11T06:00:00.000Z';   // 06:00 — first clock-in
  const CLOCK_OUT_1 = '2026-09-11T09:00:00.000Z';  // 09:00 — errand out (180 min worked)
  const CLOCK_IN_2 = '2026-09-11T10:30:00.000Z';   // 10:30 — back from errand
  const CLOCK_OUT_2 = '2026-09-11T14:00:00.000Z';  // 14:00 — end of day   (210 min worked)
  // total worked = 180 + 210 = 390 min; gap 09:00→10:30 is NOT counted

  const SCHOOL = {
    id: 'school-1',
    latitude: null,
    longitude: null,
    geofenceRadiusMeters: 30,
    geofenceEnforcementMode: 'OFF',
    allowedClockInIps: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HRService();
    mockedPrisma.school.findFirst.mockResolvedValue(SCHOOL);
    mockedPrisma.staffAttendanceAttemptLog.create.mockResolvedValue({});
    mockedPrisma.staffAttendanceCorrection.create.mockResolvedValue({});
  });

  // ── Task 3: happy path — in → errand-out → in → end-of-day-out ────────────

  it('full errand cycle: sessions[] has two entries and workedMinutes excludes the gap', async () => {
    // ── Step 1: clock in (no existing row) ──────────────────────────────────
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(null);

    const createdRow = {
      id: 'att-1', userId: 'staff-1', schoolId: 'school-1',
      date: new Date(BASE_DATE), status: 'PRESENT',
      clockInAt: new Date(CLOCK_IN_1), clockOutAt: null,
      source: 'web', metadata: {},
    };
    mockedPrisma.staffAttendanceLog.create.mockResolvedValueOnce(createdRow);

    const clockInResult1 = await service.clockInStaff('staff-1', {
      timestamp: CLOCK_IN_1, source: 'web',
    });
    expect(clockInResult1.attendance.clockInAt).toEqual(new Date(CLOCK_IN_1));
    expect(clockInResult1.alreadyClockedIn).toBeUndefined();

    // ── Step 2: clock out with reason='errand' ───────────────────────────────
    // The existing row has clockInAt but no clockOutAt
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(createdRow);

    const afterErrandOut = {
      ...createdRow,
      clockOutAt: new Date(CLOCK_OUT_1),
      metadata: {
        sessions: [{ clockInAt: CLOCK_IN_1, clockOutAt: CLOCK_OUT_1, reason: 'errand' }],
        lastClockOutReason: 'errand',
      },
    };
    mockedPrisma.staffAttendanceLog.update.mockResolvedValueOnce(afterErrandOut);
    mockedPrisma.payrollRecord.findUnique.mockResolvedValueOnce(null); // no payroll row yet

    const clockOutResult1 = await service.clockOutStaff('staff-1', {
      timestamp: CLOCK_OUT_1, source: 'web', reason: 'errand',
    });
    expect(clockOutResult1.alreadyClockedOut).toBeUndefined();
    expect(clockOutResult1.workedDaysIncremented).toBe(true);  // first session → day credited
    expect(clockOutResult1.workedMinutesDelta).toBe(180);

    // ── Step 3: clock in again (errand return) ───────────────────────────────
    // Existing row now has both clockInAt AND clockOutAt with lastClockOutReason='errand'
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(afterErrandOut);

    const afterReopen = {
      ...afterErrandOut,
      clockOutAt: null,
      metadata: {
        sessions: afterErrandOut.metadata.sessions,
        currentSessionStart: CLOCK_IN_2,
      },
    };
    mockedPrisma.staffAttendanceLog.update.mockResolvedValueOnce(afterReopen);

    const clockInResult2 = await service.clockInStaff('staff-1', {
      timestamp: CLOCK_IN_2, source: 'web',
    });
    // Should NOT be blocked — errand return is allowed
    expect(clockInResult2.alreadyClockedIn).toBeUndefined();
    expect(clockInResult2.alreadyCompleted).toBeUndefined();
    // clockInAt must remain the original first arrival (for lateness purposes)
    const updateCall = mockedPrisma.staffAttendanceLog.update.mock.calls.at(-1)![0] as any;
    expect(updateCall.data.clockInAt).toEqual(new Date(CLOCK_IN_1));
    // currentSessionStart marks the new segment start
    expect(updateCall.data.metadata.currentSessionStart).toBe(CLOCK_IN_2);
    // lastClockOutReason must be dropped from metadata
    expect(updateCall.data.metadata).not.toHaveProperty('lastClockOutReason');

    // ── Step 4: clock out with reason='end_of_day' ───────────────────────────
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(afterReopen);

    const finalRow = {
      ...afterReopen,
      clockOutAt: new Date(CLOCK_OUT_2),
      metadata: {
        sessions: [
          { clockInAt: CLOCK_IN_1, clockOutAt: CLOCK_OUT_1, reason: 'errand' },
          { clockInAt: CLOCK_IN_2, clockOutAt: CLOCK_OUT_2, reason: 'end_of_day' },
        ],
        lastClockOutReason: 'end_of_day',
      },
    };
    mockedPrisma.staffAttendanceLog.update.mockResolvedValueOnce(finalRow);

    const existingPayroll = { id: 'pay-1', workedMinutes: 180, workedDays: 1 };
    mockedPrisma.payrollRecord.findUnique.mockResolvedValueOnce(existingPayroll);
    mockedPrisma.payrollRecord.update.mockResolvedValueOnce({
      ...existingPayroll, workedMinutes: 390,
    });

    const clockOutResult2 = await service.clockOutStaff('staff-1', {
      timestamp: CLOCK_OUT_2, source: 'web', reason: 'end_of_day',
    });

    // 210 min for the second segment only
    expect(clockOutResult2.workedMinutesDelta).toBe(210);

    // Payroll day should NOT increment again — the day was already credited
    expect(clockOutResult2.workedDaysIncremented).toBe(false);

    // Confirm the payroll increment call only touches workedMinutes, not workedDays
    const payrollUpdateCall = mockedPrisma.payrollRecord.update.mock.calls.at(-1)![0] as any;
    expect(payrollUpdateCall.data.workedMinutes).toEqual({ increment: 210 });
    expect(payrollUpdateCall.data.workedDays).toBeUndefined();

    // ── Final state assertions ────────────────────────────────────────────────
    const finalMeta = finalRow.metadata;
    expect(finalMeta.sessions).toHaveLength(2);
    expect(finalMeta.lastClockOutReason).toBe('end_of_day');

    // resolveWorkedMinutesForLog must sum only the two segments (not the gap)
    // We can verify this indirectly: delta1 + delta2 = 180 + 210 = 390
    expect(clockOutResult1.workedMinutesDelta + clockOutResult2.workedMinutesDelta).toBe(390);
  });

  // ── Task 4: "not eligible to reopen" path — normal end-of-day locks the day ─

  it('blocks a same-day clock-in after a normal end_of_day clock-out', async () => {
    const completedRow = {
      id: 'att-2', userId: 'staff-2', schoolId: 'school-1',
      date: new Date(BASE_DATE), status: 'PRESENT',
      clockInAt: new Date(CLOCK_IN_1), clockOutAt: new Date(CLOCK_OUT_1),
      source: 'web',
      // No 'errand' reason — day is fully closed
      metadata: {
        sessions: [{ clockInAt: CLOCK_IN_1, clockOutAt: CLOCK_OUT_1, reason: 'end_of_day' }],
        lastClockOutReason: 'end_of_day',
      },
    };
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(completedRow);

    const result = await service.clockInStaff('staff-2', {
      timestamp: CLOCK_IN_2, source: 'web',
    });

    // Must be rejected — same as the original behaviour
    expect(result.alreadyClockedIn).toBe(true);
    expect(result.alreadyCompleted).toBe(true);

    // Absolutely no DB write must occur
    expect(mockedPrisma.staffAttendanceLog.update).not.toHaveBeenCalled();
    expect(mockedPrisma.staffAttendanceLog.create).not.toHaveBeenCalled();
  });

  it('blocks a same-day clock-in after a clock-out with no reason (legacy client)', async () => {
    const completedLegacyRow = {
      id: 'att-3', userId: 'staff-3', schoolId: 'school-1',
      date: new Date(BASE_DATE), status: 'PRESENT',
      clockInAt: new Date(CLOCK_IN_1), clockOutAt: new Date(CLOCK_OUT_1),
      source: 'web',
      // Legacy row: no sessions array, no lastClockOutReason
      metadata: null,
    };
    mockedPrisma.staffAttendanceLog.findUnique.mockResolvedValueOnce(completedLegacyRow);

    const result = await service.clockInStaff('staff-3', {
      timestamp: CLOCK_IN_2, source: 'web',
    });

    expect(result.alreadyClockedIn).toBe(true);
    expect(result.alreadyCompleted).toBe(true);
    expect(mockedPrisma.staffAttendanceLog.update).not.toHaveBeenCalled();
    expect(mockedPrisma.staffAttendanceLog.create).not.toHaveBeenCalled();
  });
});
