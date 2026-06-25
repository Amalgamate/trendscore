/**
 * teacherContext.controller.ts
 *
 * Provides an authenticated teacher's scoped context:
 *   - Whether they are a class teacher (homeroom)
 *   - Which class they are the class teacher of
 *   - Which subjects they are assigned to per grade/class
 *
 * Non-teacher privileged roles (ADMIN, HEAD_TEACHER, etc.) receive
 * { restricted: false } which tells the frontend to apply no restrictions.
 *
 * Caching:
 *   - In-memory per-user, 2-minute TTL (same as teacher dashboard).
 *   - Invalidated by cache service on class/assignment changes.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';
import { redisCacheService } from '../services/redis-cache.service';
import { hasAnyRole } from '../utils/roleNormalizer';
import logger from '../utils/logger';

/** Roles that bypass all teacher-scoping restrictions */
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'] as const;

const CONTEXT_CACHE_TTL = 120; // 2 minutes

export class TeacherContextController {
  /**
   * GET /api/teacher/context
   *
   * Returns:
   * ```json
   * {
   *   "restricted": true,          // false for admins/head teachers
   *   "isClassTeacher": true,      // true if assigned as homeroom/class teacher
   *   "classTeacherOf": {          // populated when isClassTeacher is true
   *     "id": "...",
   *     "name": "Grade 4A",
   *     "grade": "GRADE_4",
   *     "stream": "A"
   *   },
   *   "subjectAssignments": [      // subjects the teacher is assigned to enter marks for
   *     { "grade": "GRADE_4", "learningAreaId": "...", "learningAreaName": "Mathematics", "classId": "..." }
   *   ],
   *   "assignedClassIds": ["..."], // union of all class IDs (class teacher + subject teacher)
   *   "assignedGrades": ["GRADE_4"]
   * }
   * ```
   */
  async getMyContext(req: AuthRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Privileged roles get unrestricted context — no DB lookups needed
    if (hasAnyRole(req.user, PRIVILEGED_ROLES as unknown as string[])) {
      return res.json({
        success: true,
        data: {
          restricted: false,
          isClassTeacher: false,
          classTeacherOf: null,
          subjectAssignments: [],
          assignedClassIds: [],
          assignedGrades: [],
        },
      });
    }

    const cacheKey = `teacher:context:v1:${userId}`;
    const cached = await redisCacheService.get<any>(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, _cached: true });
    }

    try {
      // 1. Find the class where this teacher is the homeroom (class) teacher
      const classTeacherOf = await prisma.class.findFirst({
        where: { teacherId: userId, archived: false, active: true },
        select: {
          id: true,
          name: true,
          grade: true,
          stream: true,
          _count: { select: { enrollments: { where: { active: true } } } },
        },
      });

      // 2. Find all classes where this teacher has any timetable slot (subject teacher)
      const scheduleClasses = await prisma.classSchedule.findMany({
        where: { teacherId: userId, active: true, archived: false },
        select: {
          subject: true,
          class: {
            select: { id: true, grade: true, stream: true, name: true },
          },
          learningArea: {
            select: { id: true, name: true, shortName: true },
          },
        },
        distinct: ['classId'],
      });

      // 3. Subject assignments table (admin-managed)
      const subjectAssignments = await prisma.subjectAssignment.findMany({
        where: { teacherId: userId, active: true },
        select: {
          grade: true,
          learningArea: { select: { id: true, name: true, shortName: true } },
        },
      });

      // Build the subject assignment list — merge schedule-based and explicit assignments
      const subjectMap = new Map<string, {
        grade: string;
        learningAreaId: string;
        learningAreaName: string;
        classId: string | null;
      }>();

      // From timetable schedules
      for (const s of scheduleClasses) {
        if (!s.class) continue;
        const key = `${s.class.grade}::${s.learningArea?.id ?? s.subject ?? ''}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            grade: s.class.grade,
            learningAreaId: s.learningArea?.id ?? '',
            learningAreaName: s.learningArea?.name ?? s.subject ?? '',
            classId: s.class.id,
          });
        }
      }

      // From explicit subject-assignment table
      for (const a of subjectAssignments) {
        const key = `${a.grade}::${a.learningArea.id}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            grade: a.grade,
            learningAreaId: a.learningArea.id,
            learningAreaName: a.learningArea.name,
            classId: null,
          });
        }
      }

      // Collect unique class IDs and grades
      const assignedClassIds = new Set<string>();
      if (classTeacherOf) assignedClassIds.add(classTeacherOf.id);
      for (const s of scheduleClasses) {
        if (s.class?.id) assignedClassIds.add(s.class.id);
      }

      const assignedGrades = Array.from(
        new Set([
          ...(classTeacherOf ? [classTeacherOf.grade] : []),
          ...Array.from(subjectMap.values()).map((v) => v.grade),
        ])
      );

      const payload = {
        restricted: true,
        isClassTeacher: classTeacherOf !== null,
        classTeacherOf: classTeacherOf
          ? {
              id: classTeacherOf.id,
              name:
                classTeacherOf.name ||
                [classTeacherOf.grade, classTeacherOf.stream].filter(Boolean).join(' '),
              grade: classTeacherOf.grade,
              stream: classTeacherOf.stream ?? null,
              learnerCount: classTeacherOf._count.enrollments,
            }
          : null,
        subjectAssignments: Array.from(subjectMap.values()),
        assignedClassIds: Array.from(assignedClassIds),
        assignedGrades,
      };

      await redisCacheService.set(cacheKey, payload, CONTEXT_CACHE_TTL);

      logger.info(
        {
          teacherId: userId,
          isClassTeacher: payload.isClassTeacher,
          classId: classTeacherOf?.id,
          subjectCount: payload.subjectAssignments.length,
          classCount: payload.assignedClassIds.length,
        },
        '[TeacherContext] Context resolved'
      );

      return res.json({ success: true, data: payload });
    } catch (error: any) {
      logger.error({ err: error, teacherId: userId }, '[TeacherContext] Failed to resolve context');
      return res.status(500).json({
        success: false,
        message: 'Failed to load teacher context',
      });
    }
  }
}

export const teacherContextController = new TeacherContextController();
