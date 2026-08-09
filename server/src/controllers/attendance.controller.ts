/**
 * Attendance Controller
 * Handles attendance marking and reporting.
 *
 * @module controllers/attendance.controller
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { AttendanceStatus } from '@prisma/client';
import { parentAccessService } from '../services/parent-access.service';
import {
  checkAttendanceLock,
  enforceRemarksRule,
  buildLockClosedError,
  SchoolAttendanceLockConfig,
} from '../domains/attendance/attendance.lock';
import { presenceService } from '../domains/presence/presence.service';
import { attendanceNotificationService } from '../services/attendance-notification.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch the attendance lock config for the school. Returns permissive defaults if not found. */
async function getSchoolLockConfig(): Promise<SchoolAttendanceLockConfig> {
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: {
      attendanceLockEnabled: true,
      attendanceLockTime: true,
      attendanceUnlockWindowMinutes: true,
      attendanceAllowLateAfterLock: true,
      attendanceRequireRemarksForLateExcused: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    attendanceLockEnabled: school?.attendanceLockEnabled ?? false,
    attendanceLockTime: school?.attendanceLockTime ?? '09:00',
    attendanceUnlockWindowMinutes: school?.attendanceUnlockWindowMinutes ?? 60,
    attendanceAllowLateAfterLock: school?.attendanceAllowLateAfterLock ?? true,
    attendanceRequireRemarksForLateExcused: school?.attendanceRequireRemarksForLateExcused ?? false,
  };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class AttendanceController {
  private async getTeacherAssignedClassIds(userId: string): Promise<string[]> {
    const assignedClasses = await prisma.class.findMany({
      where: { teacherId: userId, active: true, archived: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return assignedClasses.map((c) => c.id);
  }

  private async ensureTeacherClassScope(userId: string, role: string): Promise<string[]> {
    if (role !== 'TEACHER') return [];
    const assignedClassIds = await this.getTeacherAssignedClassIds(userId);
    if (assignedClassIds.length === 0) {
      throw new ApiError(403, 'You are not assigned as class teacher to any active class');
    }
    return assignedClassIds;
  }

  // ── Single attendance mark ────────────────────────────────────────────────

  /**
   * POST /api/attendance
   * Mark attendance for a single learner.
   * Enforces attendance lock time based on school configuration.
   * Access: SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
   */
  async markAttendance(req: AuthRequest, res: Response) {
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;
    let { learnerId, date, status, classId, remarks } = req.body;

    if (!learnerId || !date || !status) {
      throw new ApiError(400, 'Missing required fields: learnerId, date, status');
    }

    // ── Attendance lock enforcement ──────────────────────────────────────────
    const lockConfig = await getSchoolLockConfig();
    const lockResult = checkAttendanceLock(currentUserRole, lockConfig);

    if (!lockResult.allowed) {
      throw buildLockClosedError(lockResult);
    }

    // If grace window active: force status to LATE regardless of submission
    if (lockResult.forceStatusLate) {
      status = 'LATE';
    }

    // Remarks required for LATE or EXCUSED
    enforceRemarksRule(status, remarks, lockConfig.attendanceRequireRemarksForLateExcused);

    // ── Learner validation ───────────────────────────────────────────────────
    const learner = await prisma.learner.findUnique({ where: { id: learnerId } });
    if (!learner) throw new ApiError(404, 'Learner not found');

    // Normalise date to UTC midnight
    const parsedDate = new Date(date);
    const attendanceDate = new Date(
      Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()),
    );

    // ── Teacher scope check ──────────────────────────────────────────────────
    let resolvedClassId: string | undefined = classId;
    if (currentUserRole === 'TEACHER') {
      const assignedClassIds = await this.ensureTeacherClassScope(currentUserId, currentUserRole);
      if (!resolvedClassId) resolvedClassId = assignedClassIds[0];
      if (!assignedClassIds.includes(resolvedClassId)) {
        throw new ApiError(403, 'You can only mark attendance for your assigned class');
      }
      const classObj = await prisma.class.findUnique({ where: { id: resolvedClassId } });
      const validLearner = await prisma.learner.findFirst({
        where: {
          id: learnerId,
          status: 'ACTIVE',
          OR: [
            { enrollments: { some: { classId: resolvedClassId, active: true } } },
            { grade: classObj!.grade, ...(classObj!.stream ? { stream: classObj!.stream } : {}) },
          ],
        },
        select: { id: true },
      });
      if (!validLearner) {
        throw new ApiError(403, 'You can only mark attendance for learners in your assigned class');
      }
    }

    // ── Upsert ───────────────────────────────────────────────────────────────
    const existing = await prisma.attendance.findUnique({
      where: { learnerId_date: { learnerId, date: attendanceDate } },
    });

    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: status as AttendanceStatus,
          classId: resolvedClassId || existing.classId,
          remarks,
          markedBy: currentUserId,
          markedAt: new Date(),
        },
        include: {
          learner: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        },
      });

      // Emit presence event for updated attendance (fire-and-forget, non-blocking)
      const school = await prisma.school.findFirst({ where: { archived: false, active: true }, select: { id: true } });
      if (school) {
        presenceService.emit({
          schoolId: school.id, personId: learnerId, personType: 'LEARNER',
          eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: attendanceDate,
          recordedBy: currentUserId, status: 'CONFIRMED', sourceModule: 'ATTENDANCE',
          sourceRecordId: updated.id,
          metadata: { classId: resolvedClassId, attendanceStatus: status },
        }).catch(() => {/* failure recorded internally */});

        // Notify parent if student is marked absent
        if (status === 'ABSENT') {
          attendanceNotificationService.notify({
            learnerId, schoolId: school.id,
            type: 'MANUAL_ABSENT', timestamp: attendanceDate,
          }).catch(() => {});
        }
      }

      return res.json({ success: true, data: updated, message: 'Attendance updated successfully' });
    }

    const attendance = await prisma.attendance.create({
      data: {
        learnerId, date: attendanceDate, status: status as AttendanceStatus,
        classId: resolvedClassId, remarks, markedBy: currentUserId, source: 'MANUAL',
      },
      include: {
        learner: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    // Emit presence event for new attendance (fire-and-forget, non-blocking)
    const school = await prisma.school.findFirst({ where: { archived: false, active: true }, select: { id: true } });
    if (school) {
      presenceService.emit({
        schoolId: school.id, personId: learnerId, personType: 'LEARNER',
        eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: attendanceDate,
        recordedBy: currentUserId, status: 'CONFIRMED', sourceModule: 'ATTENDANCE',
        sourceRecordId: attendance.id,
        metadata: { classId: resolvedClassId, attendanceStatus: status },
      }).catch(() => {/* failure recorded internally */});

      // Notify parent if student is marked absent
      if (status === 'ABSENT') {
        attendanceNotificationService.notify({
          learnerId, schoolId: school.id,
          type: 'MANUAL_ABSENT', timestamp: attendanceDate,
        }).catch(() => {});
      }
    }

    return res.status(201).json({ success: true, data: attendance, message: 'Attendance marked successfully' });
  }

  // ── Bulk attendance mark ──────────────────────────────────────────────────

  /**
   * POST /api/attendance/bulk
   * Mark attendance for multiple learners in a single atomic transaction.
   * Access: SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
   */
  async markBulkAttendance(req: AuthRequest, res: Response) {
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;
    const { attendanceRecords, attendance, date, classId } = req.body;
    const records = Array.isArray(attendanceRecords) ? attendanceRecords : attendance;

    if (!records || !Array.isArray(records) || records.length === 0 || !date) {
      throw new ApiError(400, 'Missing required fields: attendanceRecords (array), date');
    }

    // ── Attendance lock enforcement ──────────────────────────────────────────
    const lockConfig = await getSchoolLockConfig();
    const lockResult = checkAttendanceLock(currentUserRole, lockConfig);

    if (!lockResult.allowed) {
      throw buildLockClosedError(lockResult);
    }

    // Normalise date
    const parsedDate = new Date(date);
    const attendanceDate = new Date(
      Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()),
    );

    // ── Teacher scope check ──────────────────────────────────────────────────
    let resolvedClassId: string | undefined = classId;
    if (currentUserRole === 'TEACHER') {
      const teacherClassIds = await this.ensureTeacherClassScope(currentUserId, currentUserRole);
      if (!resolvedClassId) resolvedClassId = teacherClassIds[0];
      if (!teacherClassIds.includes(resolvedClassId)) {
        throw new ApiError(403, 'You can only mark attendance for your assigned class');
      }
      const learnerIds = [...new Set(records.map((r: any) => r?.learnerId).filter(Boolean))];
      if (learnerIds.length === 0) {
        throw new ApiError(400, 'No valid learners provided in attendanceRecords');
      }
      const classObj = await prisma.class.findUnique({ where: { id: resolvedClassId } });
      const validLearners = await prisma.learner.findMany({
        where: {
          id: { in: learnerIds },
          status: 'ACTIVE',
          OR: [
            { enrollments: { some: { classId: resolvedClassId, active: true } } },
            { grade: classObj!.grade, ...(classObj!.stream ? { stream: classObj!.stream } : {}) },
          ],
        },
        select: { id: true },
      });
      const enrolledSet = new Set(validLearners.map((l) => l.id));
      const invalidLearners = learnerIds.filter((id: string) => !enrolledSet.has(id));
      if (invalidLearners.length > 0) {
        throw new ApiError(403, 'Some learners do not belong to your assigned class');
      }
    }

    // ── Validate each record's status/remarks before touching the DB ─────────
    for (const record of records) {
      const effectiveStatus = lockResult.forceStatusLate ? 'LATE' : record.status;
      enforceRemarksRule(effectiveStatus, record.remarks, lockConfig.attendanceRequireRemarksForLateExcused);
    }

    // ── Pre-fetch existing records (prevent N+1) ──────────────────────────────
    const submittedIds = records.map((r: any) => r.learnerId).filter(Boolean);
    const existingRecords = await prisma.attendance.findMany({
      where: { date: attendanceDate, learnerId: { in: submittedIds } },
    });
    const existingMap = new Map(existingRecords.map((r) => [r.learnerId, r]));

    // ── Atomic transaction ────────────────────────────────────────────────────
    let created = 0;
    let updated = 0;
    // Resolve school once before transaction
    const school = await prisma.school.findFirst({ where: { archived: false, active: true }, select: { id: true } });

    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        const { learnerId, remarks } = record;
        const finalStatus = lockResult.forceStatusLate ? 'LATE' : (record.status as AttendanceStatus);
        if (!learnerId || !finalStatus) continue;

        const existing = existingMap.get(learnerId);
        let savedId: string;
        if (existing) {
          const r = await tx.attendance.update({
            where: { id: existing.id },
            data: { status: finalStatus, classId: resolvedClassId || existing.classId, remarks, markedBy: currentUserId, markedAt: new Date() },
          });
          savedId = r.id;
          updated++;
        } else {
          const r = await tx.attendance.create({
            data: {
              learnerId, date: attendanceDate, status: finalStatus,
              classId: resolvedClassId, remarks, markedBy: currentUserId,
              source: lockResult.forceStatusLate ? 'MANUAL' : 'BULK',
            },
          });
          savedId = r.id;
          created++;
        }

        // Emit presence event inside transaction
        if (school) {
          await presenceService.emit({
            schoolId: school.id, personId: learnerId, personType: 'LEARNER',
            eventType: 'CLASS_ATTENDANCE', context: 'CLASS', timestamp: attendanceDate,
            recordedBy: currentUserId, status: 'CONFIRMED', sourceModule: 'ATTENDANCE',
            sourceRecordId: savedId,
            metadata: { classId: resolvedClassId, attendanceStatus: finalStatus },
          }, tx as any);

          // Notify parent on absent — fire-and-forget outside transaction
          if (finalStatus === 'ABSENT') {
            attendanceNotificationService.notify({
              learnerId, schoolId: school.id,
              type: 'MANUAL_ABSENT', timestamp: attendanceDate,
            }).catch(() => {});
          }
        }
      }
    });

    res.json({
      success: true,
      data: { created, updated, total: created + updated },
      message: `Attendance marked: ${created} created, ${updated} updated`,
    });
  }

  // ── Read endpoints (unchanged logic, no lock needed) ─────────────────────

  /**
   * GET /api/attendance
   * Query attendance records.
   */
  async getAttendance(req: AuthRequest, res: Response) {
    const { date, startDate, endDate, learnerId, classId, status } = req.query;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;
    const whereClause: any = {};

    if (currentUserRole === 'TEACHER') {
      const assignedClassIds = await this.ensureTeacherClassScope(currentUserId, currentUserRole);
      const requestedClassId = typeof classId === 'string' ? classId : undefined;
      if (requestedClassId && !assignedClassIds.includes(requestedClassId)) {
        throw new ApiError(403, 'You can only view attendance for your assigned class');
      }
      whereClause.classId = requestedClassId || { in: assignedClassIds };
    }

    if (date) {
      const d = new Date(date as string);
      whereClause.date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    if (startDate && endDate) {
      const s = new Date(startDate as string);
      const e = new Date(endDate as string);
      whereClause.date = {
        gte: new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())),
        lte: new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999)),
      };
    }
    if (learnerId) whereClause.learnerId = learnerId;
    if (classId && currentUserRole !== 'TEACHER') whereClause.classId = classId;
    if (status) whereClause.status = status as AttendanceStatus;

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        learner: { select: { id: true, admissionNumber: true, firstName: true, lastName: true, grade: true, stream: true } },
        class: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ date: 'desc' }, { learner: { lastName: 'asc' } }],
    });

    res.json({ success: true, data: records, count: records.length });
  }

  /**
   * GET /api/attendance/stats
   * Attendance statistics by status.
   */
  async getAttendanceStats(req: AuthRequest, res: Response) {
    const { startDate, endDate, classId, learnerId } = req.query;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;
    const whereClause: any = {};

    if (currentUserRole === 'TEACHER') {
      const assignedClassIds = await this.ensureTeacherClassScope(currentUserId, currentUserRole);
      const requestedClassId = typeof classId === 'string' ? classId : undefined;
      if (requestedClassId && !assignedClassIds.includes(requestedClassId)) {
        throw new ApiError(403, 'You can only view attendance stats for your assigned class');
      }
      whereClause.classId = requestedClassId || { in: assignedClassIds };
    }

    if (startDate && endDate) {
      const s = new Date(startDate as string);
      const e = new Date(endDate as string);
      whereClause.date = {
        gte: new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())),
        lte: new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999)),
      };
    }
    if (classId && currentUserRole !== 'TEACHER') whereClause.classId = classId;
    if (learnerId) whereClause.learnerId = learnerId;

    const statusCounts = await prisma.attendance.groupBy({
      by: ['status'],
      where: whereClause,
      _count: true,
    });
    const uniqueDates = await prisma.attendance.findMany({
      where: whereClause, select: { date: true }, distinct: ['date'],
    });
    const uniqueLearners = await prisma.attendance.findMany({
      where: whereClause, select: { learnerId: true }, distinct: ['learnerId'],
    });

    const presentCount = statusCounts.find((s) => s.status === 'PRESENT')?._count || 0;
    const totalCount = statusCounts.reduce((sum, s) => sum + s._count, 0);

    res.json({
      success: true,
      data: {
        totalRecords: totalCount,
        totalDays: uniqueDates.length,
        totalLearners: uniqueLearners.length,
        byStatus: statusCounts.reduce((acc, s) => { acc[s.status] = s._count; return acc; }, {} as Record<string, number>),
        attendanceRate: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0,
      },
    });
  }

  /**
   * GET /api/attendance/learner/:learnerId
   * Learner attendance summary (parents can access their own children).
   */
  async getLearnerAttendanceSummary(req: AuthRequest, res: Response) {
    const { learnerId } = req.params;
    const { startDate, endDate } = req.query;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    if (currentUserRole === 'PARENT') {
      if (!(await parentAccessService.canAccessLearner(currentUserId, learnerId))) {
        throw new ApiError(403, "You can only access your own children's attendance");
      }
    }

    if (currentUserRole === 'TEACHER') {
      const teacherClasses = await prisma.class.findMany({
        where: { teacherId: currentUserId },
        select: { id: true, grade: true, stream: true },
      });
      const validLearner = await prisma.learner.findFirst({
        where: {
          id: learnerId,
          status: 'ACTIVE',
          OR: teacherClasses.length > 0
            ? teacherClasses.map((c) => ({
                OR: [
                  { enrollments: { some: { classId: c.id, active: true } } },
                  { grade: c.grade, ...(c.stream ? { stream: c.stream } : {}) },
                ],
              }))
            : [{ id: 'none' }],
        },
        select: { id: true },
      });
      if (!validLearner) {
        throw new ApiError(403, 'You can only access attendance for learners in your assigned class');
      }
    }

    const whereClause: any = { learnerId };
    if (startDate && endDate) {
      const s = new Date(startDate as string);
      const e = new Date(endDate as string);
      whereClause.date = {
        gte: new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())),
        lte: new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999)),
      };
    }

    const records = await prisma.attendance.findMany({ where: whereClause, orderBy: { date: 'desc' } });

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      late: records.filter((r) => r.status === 'LATE').length,
      excused: records.filter((r) => r.status === 'EXCUSED').length,
      sick: records.filter((r) => r.status === 'SICK').length,
      attendanceRate: 0,
    };
    summary.attendanceRate = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

    res.json({ success: true, data: { summary, records } });
  }

  /**
   * GET /api/attendance/class/daily
   * Daily attendance register for a class.
   */
  async getDailyClassAttendance(req: AuthRequest, res: Response) {
    const { classId, date } = req.query;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    if (!classId || !date) {
      throw new ApiError(400, 'Missing required parameters: classId, date');
    }

    const classObj = currentUserRole === 'TEACHER'
      ? await prisma.class.findFirst({
          where: { id: classId as string, teacherId: currentUserId, active: true, archived: false },
        })
      : await prisma.class.findFirst({ where: { id: classId as string } });

    if (!classObj) {
      throw currentUserRole === 'TEACHER'
        ? new ApiError(403, 'You can only access your assigned class attendance register')
        : new ApiError(404, 'Class not found');
    }

    const d = new Date(date as string);
    const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    const learners = await prisma.learner.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { enrollments: { some: { classId: classId as string, active: true } } },
          { grade: classObj.grade, ...(classObj.stream ? { stream: classObj.stream } : {}) },
        ],
      },
      select: { id: true, admissionNumber: true, firstName: true, lastName: true, gender: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: { classId: classId as string, date: utcDate },
    });
    const attendanceMap = attendanceRecords.reduce((acc, r) => {
      acc[r.learnerId] = r;
      return acc;
    }, {} as Record<string, any>);

    res.json({
      success: true,
      data: {
        date: utcDate,
        classId,
        totalLearners: learners.length,
        marked: attendanceRecords.length,
        unmarked: learners.length - attendanceRecords.length,
        learners: learners.map((l) => ({ ...l, attendance: attendanceMap[l.id] || null })),
      },
    });
  }
}
