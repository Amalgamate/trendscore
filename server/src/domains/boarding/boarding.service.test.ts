/**
 * Unit tests for BoardingService
 * Prisma and presence service fully mocked — no DB required.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    school:                 { findFirst: jest.fn() },
    dormitory:              { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    dormitoryBed:           { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    dormitoryAssignment:    { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    houseMasterAssignment:  { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    exeatRequest:           { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    dormRollCall:           { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    dormRollCallEntry:      { upsert: jest.fn() },
    diningAttendance:       { upsert: jest.fn() },
    prepAttendance:         { upsert: jest.fn() },
    learner:                { findUnique: jest.fn() },
    user:                   { findMany: jest.fn() },
  },
}));

jest.mock('../presence/presence.service', () => ({
  presenceService: { emit: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../../services/notification.service', () => ({
  NotificationService: { createNotification: jest.fn().mockResolvedValue({}) },
  NotificationType: { INFO: 'INFO', WARNING: 'WARNING' },
}));
jest.mock('../../services/sms.service', () => ({
  SmsService: { sendSms: jest.fn().mockResolvedValue({ success: true }) },
}));

import prisma from '../../config/database';
import { presenceService } from '../presence/presence.service';
import * as boarding from './boarding.service';

const db = prisma as any;
const mockPresence = presenceService as any;

const SCHOOL   = { id: 'school-1', name: 'Test Primary' };
const DORMITORY = { id: 'dorm-1', schoolId: 'school-1', name: 'Block A', archived: false };
const LEARNER   = { id: 'learner-1', firstName: 'Alice', lastName: 'Mwangi', grade: 'Grade 8' };
const ROLL_CALL = {
  id: 'rc-1', schoolId: 'school-1', dormitoryId: 'dorm-1',
  session: 'NIGHT', conductedBy: 'teacher-1',
  startedAt: new Date(), status: 'IN_PROGRESS',
  dormitory: { name: 'Block A' },
  entries: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  db.school.findFirst.mockResolvedValue(SCHOOL);
});

// ---------------------------------------------------------------------------
// Dormitory CRUD
// ---------------------------------------------------------------------------

describe('createDormitory()', () => {
  it('creates a dormitory with schoolId', async () => {
    db.dormitory.create.mockResolvedValueOnce({ ...DORMITORY });
    const result = await boarding.createDormitory({ name: 'Block A', gender: 'BOYS' });
    expect(db.dormitory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: 'school-1', name: 'Block A' }),
    }));
    expect(result.id).toBe('dorm-1');
  });
});

describe('updateDormitory()', () => {
  it('updates an existing dormitory', async () => {
    db.dormitory.findUnique.mockResolvedValueOnce(DORMITORY);
    db.dormitory.update.mockResolvedValueOnce({ ...DORMITORY, name: 'Block B' });
    const result = await boarding.updateDormitory('dorm-1', { name: 'Block B' });
    expect(result.name).toBe('Block B');
  });

  it('throws 404 for unknown dormitory', async () => {
    db.dormitory.findUnique.mockResolvedValueOnce(null);
    await expect(boarding.updateDormitory('bad-id', {})).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// Learner Assignment
// ---------------------------------------------------------------------------

describe('assignLearnerToDorm()', () => {
  beforeEach(() => {
    db.dormitory.findUnique.mockResolvedValue(DORMITORY);
    db.learner.findUnique.mockResolvedValue(LEARNER);
    db.dormitoryAssignment.updateMany.mockResolvedValue({ count: 0 });
    db.dormitoryAssignment.create.mockResolvedValue({ id: 'asgn-1', learnerId: 'learner-1' });
  });

  it('creates a new assignment', async () => {
    db.dormitoryAssignment.findFirst.mockResolvedValue(null);
    const result = await boarding.assignLearnerToDorm({
      dormitoryId: 'dorm-1', learnerId: 'learner-1',
      academicYear: 2026, fromDate: new Date(),
    });
    expect(result.learnerId).toBe('learner-1');
    expect(db.dormitoryAssignment.updateMany).toHaveBeenCalled(); // deactivates old
  });

  it('rejects if specified bed is occupied', async () => {
    db.dormitoryAssignment.findFirst.mockResolvedValue({ id: 'existing' }); // bed occupied
    await expect(boarding.assignLearnerToDorm({
      dormitoryId: 'dorm-1', bedId: 'bed-1', learnerId: 'learner-1',
      academicYear: 2026, fromDate: new Date(),
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 404 when learner not found', async () => {
    db.learner.findUnique.mockResolvedValue(null);
    await expect(boarding.assignLearnerToDorm({
      dormitoryId: 'dorm-1', learnerId: 'ghost', academicYear: 2026, fromDate: new Date(),
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// Exeat lifecycle
// ---------------------------------------------------------------------------

describe('requestExeat()', () => {
  beforeEach(() => {
    db.learner.findUnique.mockResolvedValue(LEARNER);
    db.dormitoryAssignment.findFirst.mockResolvedValue({ id: 'asgn-1' }); // is a boarder
    db.exeatRequest.findFirst.mockResolvedValue(null); // no overlap
    db.exeatRequest.create.mockResolvedValue({ id: 'exeat-1', status: 'PENDING' });
  });

  it('creates an exeat request for a boarder', async () => {
    const result = await boarding.requestExeat({
      learnerId: 'learner-1', requestedBy: 'parent-1',
      exeatType: 'WEEKEND',
      departureDate: new Date('2026-08-08'), returnDate: new Date('2026-08-10'),
      reason: 'Family event',
    });
    expect(result.status).toBe('PENDING');
  });

  it('throws 422 when learner is not a boarder', async () => {
    db.dormitoryAssignment.findFirst.mockResolvedValue(null);
    await expect(boarding.requestExeat({
      learnerId: 'learner-1', requestedBy: 'parent-1', exeatType: 'WEEKEND',
      departureDate: new Date(), returnDate: new Date(), reason: 'test',
    })).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 409 on overlapping approved exeat', async () => {
    db.exeatRequest.findFirst.mockResolvedValue({ id: 'overlap' });
    await expect(boarding.requestExeat({
      learnerId: 'learner-1', requestedBy: 'parent-1', exeatType: 'WEEKEND',
      departureDate: new Date(), returnDate: new Date(), reason: 'test',
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('approveExeat()', () => {
  const EXEAT = {
    id: 'exeat-1', status: 'PENDING', learnerId: 'learner-1',
    schoolId: 'school-1', parentPhone: '+254712345678',
    exeatType: 'WEEKEND', archived: false,
    departureDate: new Date(), returnDate: new Date(),
  };

  beforeEach(() => {
    db.exeatRequest.findUnique.mockResolvedValue(EXEAT);
    db.exeatRequest.update.mockResolvedValue({ ...EXEAT, status: 'APPROVED' });
    db.learner.findUnique.mockResolvedValue(LEARNER);
  });

  it('approves exeat and updates status', async () => {
    const result = await boarding.approveExeat('exeat-1', 'admin-1', true);
    expect(db.exeatRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED', approvedBy: 'admin-1' }),
    }));
  });

  it('denies exeat with reason', async () => {
    db.exeatRequest.update.mockResolvedValue({ ...EXEAT, status: 'DENIED' });
    await boarding.approveExeat('exeat-1', 'admin-1', false, 'Exams next week');
    expect(db.exeatRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'DENIED', denialReason: 'Exams next week' }),
    }));
  });

  it('throws 422 when exeat is not PENDING', async () => {
    db.exeatRequest.findUnique.mockResolvedValue({ ...EXEAT, status: 'APPROVED' });
    await expect(boarding.approveExeat('exeat-1', 'admin-1', true)).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('recordExeatDeparture()', () => {
  it('records departure and emits EXEAT_DEPARTED presence event', async () => {
    db.exeatRequest.findUnique.mockResolvedValue({
      id: 'exeat-1', status: 'APPROVED', learnerId: 'learner-1',
      schoolId: 'school-1', departedAt: null, archived: false,
      exeatType: 'WEEKEND', returnDate: new Date(),
    });
    db.exeatRequest.update.mockResolvedValue({ id: 'exeat-1', departedAt: new Date() });

    await boarding.recordExeatDeparture('exeat-1');

    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'EXEAT_DEPARTED',
      personId: 'learner-1',
      sourceModule: 'BOARDING',
    }));
  });

  it('throws 422 when exeat is not approved', async () => {
    db.exeatRequest.findUnique.mockResolvedValue({
      id: 'exeat-1', status: 'PENDING', archived: false,
    });
    await expect(boarding.recordExeatDeparture('exeat-1')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws 409 when departure already recorded', async () => {
    db.exeatRequest.findUnique.mockResolvedValue({
      id: 'exeat-1', status: 'APPROVED', departedAt: new Date(), archived: false,
    });
    await expect(boarding.recordExeatDeparture('exeat-1')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('recordExeatReturn()', () => {
  it('records return and emits EXEAT_RETURNED presence event', async () => {
    db.exeatRequest.findUnique.mockResolvedValue({
      id: 'exeat-1', status: 'APPROVED', learnerId: 'learner-1',
      schoolId: 'school-1', departedAt: new Date(), returnedAt: null, archived: false,
      exeatType: 'WEEKEND',
    });
    db.exeatRequest.update.mockResolvedValue({ id: 'exeat-1', returnedAt: new Date() });

    await boarding.recordExeatReturn('exeat-1');
    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'EXEAT_RETURNED' }));
  });
});

// ---------------------------------------------------------------------------
// Roll Call
// ---------------------------------------------------------------------------

describe('markRollCallEntry()', () => {
  it('creates PRESENT entry and emits DORM_ROLL_CALL presence event', async () => {
    db.dormRollCall.findUnique.mockResolvedValue(ROLL_CALL);
    db.dormRollCallEntry.upsert.mockResolvedValue({ id: 'entry-1', learnerId: 'learner-1', status: 'PRESENT' });

    await boarding.markRollCallEntry({ rollCallId: 'rc-1', learnerId: 'learner-1', status: 'PRESENT' });

    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'DORM_ROLL_CALL',
      personId: 'learner-1',
      context: 'DORMITORY',
      sourceModule: 'BOARDING',
    }));
  });

  it('does NOT emit presence event for ABSENT entries', async () => {
    db.dormRollCall.findUnique.mockResolvedValue(ROLL_CALL);
    db.dormRollCallEntry.upsert.mockResolvedValue({ id: 'entry-2', learnerId: 'learner-1', status: 'ABSENT' });

    await boarding.markRollCallEntry({ rollCallId: 'rc-1', learnerId: 'learner-1', status: 'ABSENT' });
    expect(mockPresence.emit).not.toHaveBeenCalled();
  });

  it('throws 409 when roll call is already COMPLETED', async () => {
    db.dormRollCall.findUnique.mockResolvedValue({ ...ROLL_CALL, status: 'COMPLETED' });
    await expect(boarding.markRollCallEntry({
      rollCallId: 'rc-1', learnerId: 'learner-1', status: 'PRESENT',
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('startRollCall()', () => {
  it('is idempotent — returns existing roll call if already started', async () => {
    db.dormRollCall.findUnique.mockResolvedValue(ROLL_CALL);
    const result = await boarding.startRollCall({
      dormitoryId: 'dorm-1', date: new Date(), session: 'NIGHT', conductedBy: 'teacher-1',
    });
    expect(result.id).toBe('rc-1');
    expect(db.dormRollCall.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Dining and Prep
// ---------------------------------------------------------------------------

describe('markDiningAttendance()', () => {
  it('upserts and emits DINING_ATTENDED for present=true', async () => {
    db.diningAttendance.upsert.mockResolvedValue({ id: 'din-1' });
    await boarding.markDiningAttendance({
      learnerId: 'learner-1', date: new Date(), session: 'LUNCH',
      present: true, recordedBy: 'staff-1',
    });
    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'DINING_ATTENDED' }));
  });

  it('does NOT emit presence event when present=false', async () => {
    db.diningAttendance.upsert.mockResolvedValue({ id: 'din-2' });
    await boarding.markDiningAttendance({
      learnerId: 'learner-1', date: new Date(), session: 'LUNCH',
      present: false, recordedBy: 'staff-1',
    });
    expect(mockPresence.emit).not.toHaveBeenCalled();
  });
});

describe('markPrepAttendance()', () => {
  it('upserts and emits PREP_ATTENDED for present=true', async () => {
    db.prepAttendance.upsert.mockResolvedValue({ id: 'prep-1' });
    await boarding.markPrepAttendance({
      learnerId: 'learner-1', date: new Date(), session: 'EVENING',
      present: true, recordedBy: 'staff-1',
    });
    expect(mockPresence.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'PREP_ATTENDED' }));
  });
});
