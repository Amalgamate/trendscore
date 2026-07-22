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
