/**
 * Presence Controller
 *
 * Exposes the presence timeline and school snapshot.
 * All endpoints are under /api/v1/presence/
 *
 * Access control:
 *   - PARENT: their linked children only
 *   - TEACHER: learners in their assigned classes only
 *   - ADMIN / HEAD_TEACHER / SUPER_ADMIN: any learner, school snapshot
 */

import { Response } from 'express';
import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import { AuthRequest } from '../../middleware/permissions.middleware';
import { parentAccessService } from '../../services/parent-access.service';
import { timelineEngine } from './timeline.engine';
import { SchoolPresenceSnapshot } from './presence.types';

// Roles that can see any learner's timeline or the school snapshot
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(raw: string | undefined): Date {
  if (!raw) {
    // Today in UTC
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) throw new ApiError(400, 'Invalid date format — use YYYY-MM-DD');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDateString(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

async function getActiveSchoolId(): Promise<string> {
  const school = await prisma.school.findFirst({
    where: { active: true, archived: false },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!school) throw new ApiError(404, 'No active school found');
  return school.id;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class PresenceController {

  /**
   * GET /api/v1/presence/learner/:learnerId/today
   * GET /api/v1/presence/learner/:learnerId/timeline?date=YYYY-MM-DD
   *
   * Returns the presence timeline for a learner on a given date.
   * Permission: VIEW_PRESENCE_TIMELINE
   */
  async getLearnerTimeline(req: AuthRequest, res: Response) {
    const { learnerId } = req.params;
    const currentUserId = req.user!.userId;
    const currentUserRole = req.user!.role;

    // Resolve date — "today" endpoint vs "timeline?date=..." endpoint
    const date = parseDate(req.query.date as string | undefined);

    // ── Access control ──────────────────────────────────────────────────────
    if (!ADMIN_ROLES.has(currentUserRole)) {
      if (currentUserRole === 'PARENT') {
        const canAccess = await parentAccessService.canAccessLearner(currentUserId, learnerId);
        if (!canAccess) {
          throw new ApiError(403, "You can only view your own children's timeline");
        }
      } else if (currentUserRole === 'TEACHER') {
        await this.enforceTeacherLearnerScope(currentUserId, learnerId);
      } else {
        throw new ApiError(403, 'Insufficient permissions to view presence timeline');
      }
    }

    // ── Verify learner exists ────────────────────────────────────────────────
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { id: true, firstName: true, lastName: true, grade: true },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');

    // ── Build timeline ───────────────────────────────────────────────────────
    const schoolId = await getActiveSchoolId();
    const events = await timelineEngine.buildTimeline(learnerId, date, schoolId);

    res.json({
      success: true,
      data: {
        learnerId,
        learnerName: `${learner.firstName} ${learner.lastName}`,
        grade: learner.grade,
        date: utcDateString(date),
        eventCount: events.length,
        events,
      },
    });
  }

  /**
   * GET /api/v1/presence/school/snapshot
   *
   * Returns the current-day presence snapshot for the whole school.
   * Permission: VIEW_ALL_PRESENCE
   */
  async getSchoolSnapshot(req: AuthRequest, res: Response) {
    const schoolId = await getActiveSchoolId();
    const today = parseDate(undefined);
    const startOfDay = today;
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    // ── Total active learners ────────────────────────────────────────────────
    const totalLearners = await prisma.learner.count({
      where: { status: 'ACTIVE', archived: false },
    });

    // ── Learners with CLASS_ATTENDANCE today by status ───────────────────────
    const classAttendanceEvents = await prisma.presenceEvent.findMany({
      where: {
        schoolId,
        eventType: 'CLASS_ATTENDANCE',
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
      select: { personId: true, metadata: true },
    });

    // One event per learner (take the most informative one)
    const learnerStatusMap = new Map<string, string>();
    for (const ev of classAttendanceEvents) {
      const meta = ev.metadata as Record<string, unknown> | null;
      const status = String(meta?.attendanceStatus ?? 'PRESENT');
      if (!learnerStatusMap.has(ev.personId)) {
        learnerStatusMap.set(ev.personId, status);
      }
    }

    let presentCount = 0;
    let absentCount  = 0;
    let lateCount    = 0;
    let excusedCount = 0;

    for (const status of learnerStatusMap.values()) {
      if (status === 'PRESENT') presentCount++;
      else if (status === 'ABSENT') absentCount++;
      else if (status === 'LATE') { lateCount++; presentCount++; } // late = physically present
      else if (status === 'EXCUSED' || status === 'SICK') excusedCount++;
    }

    const markedCount   = learnerStatusMap.size;
    const unmarkedCount = Math.max(0, totalLearners - markedCount);

    // ── Staff presence ───────────────────────────────────────────────────────
    const staffClockEvents = await prisma.presenceEvent.findMany({
      where: {
        schoolId,
        personType: 'STAFF',
        eventType:  'CLOCK_IN',
        timestamp:  { gte: startOfDay, lte: endOfDay },
      },
      select: { personId: true },
    });
    const staffPresent = new Set(staffClockEvents.map((e) => e.personId)).size;

    const totalStaff = await prisma.user.count({
      where: { archived: false, status: 'ACTIVE' },
    });
    const staffAbsent = Math.max(0, totalStaff - staffPresent);

    const attendanceRate = totalLearners > 0
      ? Math.round(((presentCount) / totalLearners) * 100)
      : 0;

    const snapshot: SchoolPresenceSnapshot = {
      date:           utcDateString(today),
      totalLearners,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      unmarkedCount,
      staffPresent,
      staffAbsent,
      attendanceRate,
    };

    res.json({ success: true, data: snapshot });
  }

  /**
   * GET /api/v1/presence/school/absent-today
   *
   * Returns a list of learners with no CLASS_ATTENDANCE event today.
   * Permission: VIEW_ALL_PRESENCE
   */
  async getAbsentToday(req: AuthRequest, res: Response) {
    const schoolId = await getActiveSchoolId();
    const today = parseDate(undefined);
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

    // Learners who have any presence event today
    const markedEvents = await prisma.presenceEvent.findMany({
      where: {
        schoolId,
        eventType: 'CLASS_ATTENDANCE',
        timestamp: { gte: today, lte: endOfDay },
      },
      select: { personId: true, metadata: true },
    });

    const presentIds = new Set(
      markedEvents
        .filter((e) => {
          const meta = e.metadata as Record<string, unknown> | null;
          const status = String(meta?.attendanceStatus ?? 'PRESENT');
          return status !== 'ABSENT';
        })
        .map((e) => e.personId),
    );

    const absentLearners = await prisma.learner.findMany({
      where: {
        status: 'ACTIVE',
        archived: false,
        id: { notIn: [...presentIds] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        grade: true,
        stream: true,
      },
      orderBy: [{ grade: 'asc' }, { lastName: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        date: utcDateString(today),
        count: absentLearners.length,
        learners: absentLearners,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async enforceTeacherLearnerScope(teacherId: string, learnerId: string): Promise<void> {
    const teacherClasses = await prisma.class.findMany({
      where: { teacherId, active: true, archived: false },
      select: { id: true, grade: true, stream: true },
    });

    if (teacherClasses.length === 0) {
      throw new ApiError(403, 'You are not assigned as class teacher to any active class');
    }

    const validLearner = await prisma.learner.findFirst({
      where: {
        id: learnerId,
        status: 'ACTIVE',
        OR: teacherClasses.map((c) => ({
          OR: [
            { enrollments: { some: { classId: c.id, active: true } } },
            { grade: c.grade, ...(c.stream ? { stream: c.stream } : {}) },
          ],
        })),
      },
      select: { id: true },
    });

    if (!validLearner) {
      throw new ApiError(403, 'You can only view presence data for learners in your assigned class');
    }
  }
}

export const presenceController = new PresenceController();
