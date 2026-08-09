/**
 * BoardingService
 *
 * Owns all boarding operational data:
 *   - Dormitory and bed management
 *   - Learner dormitory assignments
 *   - House master assignments
 *   - Exeat request lifecycle (request → approve/deny → depart → return)
 *   - Dorm roll call (morning + night)
 *   - Dining attendance
 *   - Prep attendance
 *
 * Every operation that changes a learner's presence state emits a presence event.
 * The boarding module never queries the attendances table directly.
 */

import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import { presenceService } from '../presence/presence.service';
import { NotificationService, NotificationType } from '../../services/notification.service';
import { SmsService } from '../../services/sms.service';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExeatStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
export type RollCallSession = 'MORNING' | 'NIGHT';
export type DiningSession = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export type PrepSession = 'AFTERNOON' | 'EVENING';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveSchoolId(): Promise<string> {
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!school) throw new ApiError(500, 'No active school found');
  return school.id;
}

async function resolveSchool() {
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!school) throw new ApiError(500, 'No active school found');
  return school;
}

function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ---------------------------------------------------------------------------
// Dormitory CRUD
// ---------------------------------------------------------------------------

export async function createDormitory(data: {
  name: string; gender: string; capacity?: number;
  block?: string; notes?: string;
}) {
  const schoolId = await resolveSchoolId();
  return prisma.dormitory.create({
    data: { schoolId, name: data.name.trim(), gender: data.gender, capacity: data.capacity ?? 0, block: data.block ?? null, notes: data.notes ?? null },
  });
}

export async function getDormitories(includeArchived = false) {
  const schoolId = await resolveSchoolId();
  return prisma.dormitory.findMany({
    where: { schoolId, ...(includeArchived ? {} : { archived: false }) },
    include: {
      _count: { select: { beds: true, assignments: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function updateDormitory(id: string, data: Partial<{
  name: string; gender: string; capacity: number; block: string; notes: string; active: boolean;
}>) {
  const existing = await prisma.dormitory.findUnique({ where: { id } });
  if (!existing || existing.archived) throw new ApiError(404, 'Dormitory not found');
  return prisma.dormitory.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Bed Management
// ---------------------------------------------------------------------------

export async function createBed(dormitoryId: string, bedNumber: string, notes?: string) {
  const dorm = await prisma.dormitory.findUnique({ where: { id: dormitoryId } });
  if (!dorm || dorm.archived) throw new ApiError(404, 'Dormitory not found');
  return prisma.dormitoryBed.create({ data: { dormitoryId, bedNumber: bedNumber.trim(), notes: notes ?? null } });
}

export async function getBeds(dormitoryId: string) {
  return prisma.dormitoryBed.findMany({
    where: { dormitoryId },
    include: {
      assignments: {
        where: { active: true },
        select: { learnerId: true, academicYear: true },
        take: 1,
      },
    },
    orderBy: { bedNumber: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Dormitory Assignments
// ---------------------------------------------------------------------------

export async function assignLearnerToDorm(data: {
  dormitoryId: string; bedId?: string; learnerId: string;
  academicYear: number; fromDate: Date;
}) {
  const dorm = await prisma.dormitory.findUnique({ where: { id: data.dormitoryId } });
  if (!dorm || dorm.archived) throw new ApiError(404, 'Dormitory not found');

  const learner = await prisma.learner.findUnique({ where: { id: data.learnerId } });
  if (!learner) throw new ApiError(404, 'Learner not found');

  // Deactivate any existing assignment for this learner in this academic year
  await prisma.dormitoryAssignment.updateMany({
    where: { learnerId: data.learnerId, academicYear: data.academicYear, active: true },
    data: { active: false, toDate: utcDate(new Date()) },
  });

  // If bed specified, check it's vacant
  if (data.bedId) {
    const existing = await prisma.dormitoryAssignment.findFirst({
      where: { bedId: data.bedId, active: true, archived: false },
    });
    if (existing) throw new ApiError(409, 'Bed is already occupied');
    await prisma.dormitoryBed.update({ where: { id: data.bedId }, data: { status: 'OCCUPIED' } });
  }

  return prisma.dormitoryAssignment.create({
    data: {
      dormitoryId: data.dormitoryId,
      bedId:       data.bedId ?? null,
      learnerId:   data.learnerId,
      academicYear: data.academicYear,
      fromDate:    utcDate(data.fromDate),
      active:      true,
    },
  });
}

export async function getLearnerDormAssignment(learnerId: string) {
  return prisma.dormitoryAssignment.findFirst({
    where: { learnerId, active: true, archived: false },
    include: {
      dormitory: true,
      bed:       true,
    },
  });
}

// ---------------------------------------------------------------------------
// House Master Assignments
// ---------------------------------------------------------------------------

export async function assignHouseMaster(dormitoryId: string, userId: string, role: string) {
  const dorm = await prisma.dormitory.findUnique({ where: { id: dormitoryId } });
  if (!dorm) throw new ApiError(404, 'Dormitory not found');

  // If PRIMARY role, deactivate any existing PRIMARY
  if (role === 'PRIMARY') {
    await prisma.houseMasterAssignment.updateMany({
      where: { dormitoryId, role: 'PRIMARY', active: true },
      data: { active: false },
    });
  }

  return prisma.houseMasterAssignment.create({
    data: { dormitoryId, userId, role, active: true },
  });
}

export async function getHouseMasters(dormitoryId: string) {
  return prisma.houseMasterAssignment.findMany({
    where: { dormitoryId, active: true },
    orderBy: { role: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Exeat Requests
// ---------------------------------------------------------------------------

export async function requestExeat(data: {
  learnerId: string; requestedBy: string; exeatType: string;
  departureDate: Date; returnDate: Date; reason: string; parentPhone?: string;
}) {
  const schoolId = await resolveSchoolId();
  const learner  = await prisma.learner.findUnique({ where: { id: data.learnerId } });
  if (!learner) throw new ApiError(404, 'Learner not found');

  // Check learner is a boarder
  const assignment = await getLearnerDormAssignment(data.learnerId);
  if (!assignment) throw new ApiError(422, 'Learner is not assigned to a dormitory');

  // Check for overlapping approved exeat
  const overlap = await prisma.exeatRequest.findFirst({
    where: {
      learnerId:     data.learnerId,
      status:        'APPROVED',
      archived:      false,
      departureDate: { lte: utcDate(data.returnDate) },
      returnDate:    { gte: utcDate(data.departureDate) },
    },
  });
  if (overlap) throw new ApiError(409, 'An approved exeat already exists for these dates');

  return prisma.exeatRequest.create({
    data: {
      schoolId,
      learnerId:     data.learnerId,
      requestedBy:   data.requestedBy,
      exeatType:     data.exeatType,
      departureDate: utcDate(data.departureDate),
      returnDate:    utcDate(data.returnDate),
      reason:        data.reason.trim(),
      parentPhone:   data.parentPhone ?? null,
      status:        'PENDING',
    },
  });
}

export async function approveExeat(exeatId: string, approvedBy: string, approved: boolean, denialReason?: string) {
  const exeat = await prisma.exeatRequest.findUnique({ where: { id: exeatId } });
  if (!exeat || exeat.archived) throw new ApiError(404, 'Exeat request not found');
  if (exeat.status !== 'PENDING') throw new ApiError(422, `Cannot ${approved ? 'approve' : 'deny'} — exeat is already ${exeat.status}`);

  const updated = await prisma.exeatRequest.update({
    where: { id: exeatId },
    data: {
      status:       approved ? 'APPROVED' : 'DENIED',
      approvedBy:   approved ? approvedBy : null,
      approvedAt:   approved ? new Date() : null,
      denialReason: approved ? null : (denialReason ?? null),
    },
  });

  // Notify parent via SMS
  if (exeat.parentPhone) {
    const learner = await prisma.learner.findUnique({
      where: { id: exeat.learnerId },
      select: { firstName: true, lastName: true },
    });
    const school = await resolveSchool();
    const depDate = exeat.departureDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const retDate = exeat.returnDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const msg = approved
      ? `Dear Parent, ${learner?.firstName} ${learner?.lastName}'s exeat from ${depDate} to ${retDate} has been APPROVED. – ${school.name}`
      : `Dear Parent, ${learner?.firstName} ${learner?.lastName}'s exeat request has been DENIED. ${denialReason ? `Reason: ${denialReason}` : ''} – ${school.name}`;
    SmsService.sendSms(exeat.parentPhone, msg).catch(() => {});
  }

  return updated;
}

export async function recordExeatDeparture(exeatId: string) {
  const exeat = await prisma.exeatRequest.findUnique({ where: { id: exeatId } });
  if (!exeat || exeat.archived) throw new ApiError(404, 'Exeat not found');
  if (exeat.status !== 'APPROVED') throw new ApiError(422, 'Exeat must be approved before departure');
  if (exeat.departedAt) throw new ApiError(409, 'Departure already recorded');

  const now = new Date();
  const updated = await prisma.exeatRequest.update({
    where: { id: exeatId },
    data: { departedAt: now },
  });

  presenceService.emit({
    schoolId:      exeat.schoolId,
    personId:      exeat.learnerId,
    personType:    'LEARNER',
    eventType:     'EXEAT_DEPARTED',
    context:       'EXEAT',
    timestamp:     now,
    status:        'CONFIRMED',
    sourceModule:  'BOARDING',
    sourceRecordId: exeatId,
    metadata:      { exeatType: exeat.exeatType, returnDate: exeat.returnDate.toISOString() },
  }).catch(() => {});

  return updated;
}

export async function recordExeatReturn(exeatId: string) {
  const exeat = await prisma.exeatRequest.findUnique({ where: { id: exeatId } });
  if (!exeat || exeat.archived) throw new ApiError(404, 'Exeat not found');
  if (!exeat.departedAt) throw new ApiError(422, 'Departure not yet recorded');
  if (exeat.returnedAt) throw new ApiError(409, 'Return already recorded');

  const now = new Date();
  const updated = await prisma.exeatRequest.update({
    where: { id: exeatId },
    data: { returnedAt: now },
  });

  presenceService.emit({
    schoolId:      exeat.schoolId,
    personId:      exeat.learnerId,
    personType:    'LEARNER',
    eventType:     'EXEAT_RETURNED',
    context:       'EXEAT',
    timestamp:     now,
    status:        'CONFIRMED',
    sourceModule:  'BOARDING',
    sourceRecordId: exeatId,
    metadata:      { exeatType: exeat.exeatType },
  }).catch(() => {});

  return updated;
}

export async function getExeatRequests(filters: {
  learnerId?: string; schoolId?: string;
  status?: ExeatStatus | ExeatStatus[]; upcoming?: boolean;
}) {
  const schoolId = filters.schoolId ?? await resolveSchoolId();
  const where: any = { schoolId, archived: false };
  if (filters.learnerId) where.learnerId = filters.learnerId;
  if (filters.status) {
    where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
  }
  if (filters.upcoming) {
    where.departureDate = { gte: utcDate(new Date()) };
  }
  return prisma.exeatRequest.findMany({
    where,
    orderBy: { departureDate: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Dorm Roll Call
// ---------------------------------------------------------------------------

export async function startRollCall(data: {
  dormitoryId: string; date: Date; session: RollCallSession; conductedBy: string;
}) {
  const schoolId = await resolveSchoolId();
  const dorm = await prisma.dormitory.findUnique({ where: { id: data.dormitoryId } });
  if (!dorm) throw new ApiError(404, 'Dormitory not found');

  const dateUtc = utcDate(data.date);

  // Idempotent — return existing if already started
  const existing = await prisma.dormRollCall.findUnique({
    where: { dormitoryId_date_session: { dormitoryId: data.dormitoryId, date: dateUtc, session: data.session } },
  });
  if (existing) return existing;

  return prisma.dormRollCall.create({
    data: {
      schoolId,
      dormitoryId:  data.dormitoryId,
      date:         dateUtc,
      session:      data.session,
      conductedBy:  data.conductedBy,
      status:       'IN_PROGRESS',
    },
  });
}

export async function markRollCallEntry(data: {
  rollCallId: string; learnerId: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'EXEAT'; remarks?: string;
}) {
  const rollCall = await prisma.dormRollCall.findUnique({
    where: { id: data.rollCallId },
    include: { dormitory: true },
  });
  if (!rollCall) throw new ApiError(404, 'Roll call not found');
  if (rollCall.status === 'COMPLETED') throw new ApiError(409, 'Roll call is already completed');

  // Upsert entry
  const entry = await prisma.dormRollCallEntry.upsert({
    where: { rollCallId_learnerId: { rollCallId: data.rollCallId, learnerId: data.learnerId } },
    update: { status: data.status, remarks: data.remarks ?? null },
    create: { rollCallId: data.rollCallId, learnerId: data.learnerId, status: data.status, remarks: data.remarks ?? null },
  });

  // Emit presence event for PRESENT entries
  if (data.status === 'PRESENT') {
    presenceService.emit({
      schoolId:      rollCall.schoolId,
      personId:      data.learnerId,
      personType:    'LEARNER',
      eventType:     'DORM_ROLL_CALL',
      context:       'DORMITORY',
      timestamp:     rollCall.startedAt,
      recordedBy:    rollCall.conductedBy,
      location:      rollCall.dormitory.name,
      status:        'CONFIRMED',
      sourceModule:  'BOARDING',
      sourceRecordId: entry.id,
      metadata:      { session: rollCall.session, dormName: rollCall.dormitory.name, rollCallStatus: data.status },
    }).catch(() => {});
  }

  return entry;
}

export async function bulkMarkRollCall(
  rollCallId: string,
  entries: Array<{ learnerId: string; status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'EXEAT'; remarks?: string }>,
) {
  const results = await Promise.all(
    entries.map(e => markRollCallEntry({ rollCallId, ...e }).catch(err => ({ error: err.message, learnerId: e.learnerId }))),
  );
  return results;
}

export async function completeRollCall(rollCallId: string) {
  const rollCall = await prisma.dormRollCall.findUnique({
    where: { id: rollCallId },
    include: { entries: true },
  });
  if (!rollCall) throw new ApiError(404, 'Roll call not found');

  const updated = await prisma.dormRollCall.update({
    where: { id: rollCallId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  // Alert house master about absent learners (not EXEAT, not EXCUSED)
  const absentEntries = rollCall.entries.filter(e => e.status === 'ABSENT');
  if (absentEntries.length > 0 && rollCall.session === 'NIGHT') {
    const hms = await prisma.houseMasterAssignment.findMany({
      where: { dormitoryId: rollCall.dormitoryId, active: true },
      select: { userId: true },
    });
    const admins = await prisma.user.findMany({
      where: { OR: [{ role: 'ADMIN' }, { role: 'HEAD_TEACHER' }], archived: false, status: 'ACTIVE' },
      select: { id: true },
    });
    const recipients = [...new Set([...hms.map(h => h.userId), ...admins.map(a => a.id)])];

    await Promise.all(recipients.map(userId =>
      NotificationService.createNotification({
        userId,
        title:   'Night Roll Call — Absent Learners',
        message: `${absentEntries.length} learner(s) absent from night roll call in ${rollCall.dormitoryId}. Immediate follow-up required.`,
        type:    NotificationType.WARNING,
        link:    `/app/boarding/roll-call/${rollCallId}`,
      }).catch(() => {}),
    ));
  }

  return updated;
}

export async function getRollCall(rollCallId: string) {
  const rc = await prisma.dormRollCall.findUnique({
    where: { id: rollCallId },
    include: {
      entries: { orderBy: { learnerId: 'asc' } },
      dormitory: { select: { name: true } },
    },
  });
  if (!rc) throw new ApiError(404, 'Roll call not found');
  return rc;
}

// ---------------------------------------------------------------------------
// Dining Attendance
// ---------------------------------------------------------------------------

export async function markDiningAttendance(data: {
  learnerId: string; date: Date; session: DiningSession;
  present: boolean; recordedBy: string;
}) {
  const schoolId = await resolveSchoolId();
  const dateUtc  = utcDate(data.date);

  const record = await prisma.diningAttendance.upsert({
    where: { learnerId_date_session: { learnerId: data.learnerId, date: dateUtc, session: data.session } },
    update: { present: data.present, recordedBy: data.recordedBy },
    create: { schoolId, learnerId: data.learnerId, date: dateUtc, session: data.session, present: data.present, recordedBy: data.recordedBy },
  });

  if (data.present) {
    presenceService.emit({
      schoolId, personId: data.learnerId, personType: 'LEARNER',
      eventType: 'DINING_ATTENDED', context: 'DINING_HALL',
      timestamp: new Date(), recordedBy: data.recordedBy,
      status: 'CONFIRMED', sourceModule: 'BOARDING', sourceRecordId: record.id,
      metadata: { session: data.session },
    }).catch(() => {});
  }

  return record;
}

export async function bulkMarkDining(
  records: Array<{ learnerId: string; present: boolean }>,
  date: Date, session: DiningSession, recordedBy: string,
) {
  return Promise.all(records.map(r => markDiningAttendance({ ...r, date, session, recordedBy })));
}

// ---------------------------------------------------------------------------
// Prep Attendance
// ---------------------------------------------------------------------------

export async function markPrepAttendance(data: {
  learnerId: string; date: Date; session: PrepSession;
  present: boolean; remarks?: string; recordedBy: string;
}) {
  const schoolId = await resolveSchoolId();
  const dateUtc  = utcDate(data.date);

  const record = await prisma.prepAttendance.upsert({
    where: { learnerId_date_session: { learnerId: data.learnerId, date: dateUtc, session: data.session } },
    update: { present: data.present, remarks: data.remarks ?? null, recordedBy: data.recordedBy },
    create: { schoolId, learnerId: data.learnerId, date: dateUtc, session: data.session, present: data.present, remarks: data.remarks ?? null, recordedBy: data.recordedBy },
  });

  if (data.present) {
    presenceService.emit({
      schoolId, personId: data.learnerId, personType: 'LEARNER',
      eventType: 'PREP_ATTENDED', context: 'PREP_HALL',
      timestamp: new Date(), recordedBy: data.recordedBy,
      status: 'CONFIRMED', sourceModule: 'BOARDING', sourceRecordId: record.id,
      metadata: { session: data.session },
    }).catch(() => {});
  }

  return record;
}

// ---------------------------------------------------------------------------
// Boarding Reports
// ---------------------------------------------------------------------------

export async function getBoardingDashboard() {
  const schoolId = await resolveSchoolId();
  const today    = utcDate(new Date());

  const [
    totalDorms, totalBoarders,
    todayRollCalls, pendingExeats, currentExeats,
  ] = await Promise.all([
    prisma.dormitory.count({ where: { schoolId, archived: false, active: true } }),
    prisma.dormitoryAssignment.count({ where: { active: true, archived: false } }),
    prisma.dormRollCall.findMany({
      where: { schoolId, date: today },
      select: { session: true, status: true, dormitoryId: true },
    }),
    prisma.exeatRequest.count({ where: { schoolId, status: 'PENDING', archived: false } }),
    prisma.exeatRequest.count({
      where: {
        schoolId, status: 'APPROVED', archived: false,
        departedAt: { not: null }, returnedAt: null,
      },
    }),
  ]);

  return {
    totalDorms,
    totalBoarders,
    todayRollCalls: {
      morning: todayRollCalls.filter(r => r.session === 'MORNING').length,
      night:   todayRollCalls.filter(r => r.session === 'NIGHT').length,
      completed: todayRollCalls.filter(r => r.status === 'COMPLETED').length,
    },
    pendingExeats,
    currentlyOnExeat: currentExeats,
  };
}
