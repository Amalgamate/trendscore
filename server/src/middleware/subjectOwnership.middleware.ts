/**
 * subjectOwnership.middleware.ts
 *
 * Enforces that a TEACHER can only enter/modify scores for subjects they are
 * assigned to via timetable schedules or the SubjectAssignment table.
 *
 * Rules:
 *   1. Privileged roles (ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM)
 *      pass through without restriction.
 *   2. A TEACHER who IS the class teacher of the target learner's class may
 *      enter scores for any subject in that class — but the response will carry
 *      a `x-class-teacher-override: true` header so the frontend can surface a
 *      warning toast ("You are not the subject teacher for this subject").
 *   3. A TEACHER who is a subject teacher for the relevant subject+grade passes
 *      through cleanly.
 *   4. A TEACHER with no assignment at all receives 403.
 *
 * The middleware attaches `req.subjectOwnership` for downstream use:
 *   { allowed: true, isClassTeacherOverride: boolean, subjectName: string }
 *
 * Audit logging is delegated to the `auditLog` middleware already in the chain.
 * This middleware only resolves ownership and sets flags.
 */

import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './permissions.middleware';
import { hasAnyRole } from '../utils/roleNormalizer';
import logger from '../utils/logger';

const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'];

/** Extends AuthRequest with the resolved ownership context */
declare global {
  namespace Express {
    interface Request {
      subjectOwnership?: {
        allowed: boolean;
        isClassTeacherOverride: boolean;
        subjectName: string | null;
        learnerId: string | null;
        grade: string | null;
      };
    }
  }
}

/**
 * Factory — call with `{ required: false }` for bulk routes where you want a
 * warning header but no hard 403 (the controller will read the override flag).
 */
export const checkSubjectOwnership = (opts: { required?: boolean } = { required: true }) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      // Privileged roles: no restriction
      if (hasAnyRole(req.user, PRIVILEGED_ROLES)) {
        req.subjectOwnership = {
          allowed: true,
          isClassTeacherOverride: false,
          subjectName: null,
          learnerId: null,
          grade: null,
        };
        return next();
      }

      // Only enforce for TEACHER role
      if (!hasAnyRole(req.user, ['TEACHER'])) {
        return next();
      }

      const userId = req.user?.userId;
      if (!userId) {
        return next();
      }

      // Extract learnerId + learningArea from body (single or bulk entry).
      // Bulk assessment routes provide testId/results instead, so resolve the
      // subject and class scope from the referenced test before validating.
      const body = req.body || {};
      let learnerId: string | null = body.learnerId ?? body.results?.[0]?.learnerId ?? null;
      let learningAreaRaw: string | null = body.learningArea ?? body.subject ?? null;
      if (body.testId) {
        const test = await prisma.summativeTest.findUnique({
          where: { id: String(body.testId) },
          select: { grade: true, learningArea: true, learningAreaId: true },
        });
        if (!test) return _res.status(404).json({ success: false, message: 'Assessment not found' });
        learningAreaRaw = learningAreaRaw || test.learningArea;
        if (Array.isArray(body.results)) {
          const learnerIds: string[] = Array.from(
            new Set<string>(
              body.results
                .map((item: any) => String(item?.learnerId || ''))
                .filter((id: string) => id.length > 0),
            ),
          );
          if (!learnerIds.length) return _res.status(400).json({ success: false, message: 'Assessment results require learners' });
          for (const submittedLearnerId of learnerIds) {
            const learner = await prisma.learner.findUnique({
              where: { id: submittedLearnerId },
              select: { grade: true, enrollments: { where: { active: true, archived: false }, select: { classId: true } } },
            });
            if (!learner || learner.grade !== test.grade) return _res.status(403).json({ success: false, code: 'ASSESSMENT_CLASS_SCOPE', message: 'You can only assess learners in your assigned class.' });
            const classIds = learner.enrollments.map((item) => item.classId);
            const [subjectAssignment, schedule, classTeacher] = await Promise.all([
              prisma.subjectAssignment.findFirst({ where: { teacherId: userId, grade: learner.grade, active: true, OR: [{ classId: { in: classIds } }, { classId: null }], learningArea: { OR: [{ name: { equals: test.learningArea, mode: 'insensitive' } }, { shortName: { equals: test.learningArea, mode: 'insensitive' } }] } }, select: { id: true } }),
              prisma.classSchedule.findFirst({ where: { teacherId: userId, active: true, subject: { equals: test.learningArea, mode: 'insensitive' }, classId: { in: classIds } }, select: { id: true } }),
              prisma.class.findFirst({ where: { OR: [{ teacherId: userId }, { teacherAssignments: { some: { teacherId: userId } } }], id: { in: classIds }, archived: false, active: true }, select: { id: true } }),
            ]);
            if (!subjectAssignment && !schedule && !classTeacher) return _res.status(403).json({ success: false, code: 'SUBJECT_NOT_ASSIGNED', message: 'You are not assigned to this subject or class.' });
          }
          req.subjectOwnership = { allowed: true, isClassTeacherOverride: false, subjectName: test.learningArea, learnerId: null, grade: test.grade };
          return next();
        }
      }

      // Creating an assessment uses grade + subject rather than a learner ID.
      // Require a matching teacher assignment (or the selected class-teacher
      // assignment) before creating a grade-level assessment.
      if (!learnerId && body.grade && learningAreaRaw) {
        const area = body.learningAreaId
          ? await prisma.learningArea.findUnique({ where: { id: String(body.learningAreaId) }, select: { name: true, shortName: true } })
          : null;
        const areaNames = [learningAreaRaw, area?.name, area?.shortName].filter(Boolean) as string[];
        const grade = String(body.grade);
        const classId = body.classId ? String(body.classId) : null;
        const [subjectAssignment, schedule, classTeacher] = await Promise.all([
          prisma.subjectAssignment.findFirst({ where: { teacherId: userId, grade, active: true, ...(classId ? { classId } : {}), learningArea: { OR: areaNames.flatMap((name) => [{ name: { equals: name, mode: 'insensitive' as const } }, { shortName: { equals: name, mode: 'insensitive' as const } }]) } }, select: { id: true } }),
          prisma.classSchedule.findFirst({ where: { teacherId: userId, active: true, subject: { in: areaNames, mode: 'insensitive' }, ...(classId ? { classId } : {}) }, select: { id: true } }),
          classId ? prisma.class.findFirst({ where: { id: classId, grade, teacherId: userId, archived: false, active: true }, select: { id: true } }) : Promise.resolve(null),
        ]);
        if (!subjectAssignment && !schedule && !classTeacher) return _res.status(403).json({ success: false, code: 'SUBJECT_NOT_ASSIGNED', message: 'You are not assigned to this subject or class.' });
        req.subjectOwnership = { allowed: true, isClassTeacherOverride: !!classTeacher && !subjectAssignment && !schedule, subjectName: learningAreaRaw, learnerId: null, grade };
        return next();
      }

      // If we can't determine subject context, allow through (let controller validate)
      if (!learnerId && !learningAreaRaw) {
        req.subjectOwnership = {
          allowed: true,
          isClassTeacherOverride: false,
          subjectName: learningAreaRaw,
          learnerId: null,
          grade: null,
        };
        return next();
      }

      // Resolve the learner's grade and current classes. Ownership must be
      // tied to the actual class, not merely another class in the same grade.
      let grade: string | null = null;
      let learnerClassIds: string[] = [];
      if (learnerId) {
        const learner = await prisma.learner.findUnique({
          where: { id: learnerId },
          select: {
            grade: true,
            enrollments: {
              where: { active: true, archived: false },
              select: { classId: true },
            },
          },
        });
        grade = learner?.grade ?? null;
        learnerClassIds = learner?.enrollments.map((enrollment) => enrollment.classId) ?? [];
      }

      // 1. Check if teacher is explicitly assigned as subject teacher for this learning area + grade
      let isSubjectTeacher = false;
      if (grade && learningAreaRaw) {
        const assignment = await prisma.subjectAssignment.findFirst({
          where: {
            teacherId: userId,
            grade,
            active: true,
            classId: { in: learnerClassIds },
            learningArea: {
              OR: [
                { name: { equals: learningAreaRaw, mode: 'insensitive' } },
                { shortName: { equals: learningAreaRaw, mode: 'insensitive' } },
              ],
            },
          },
        });

        if (!assignment) {
          // Also check via timetable schedule
          const schedule = await prisma.classSchedule.findFirst({
            where: {
              teacherId: userId,
              active: true,
              subject: { equals: learningAreaRaw, mode: 'insensitive' },
              classId: { in: learnerClassIds },
            },
          });
          isSubjectTeacher = !!schedule;
        } else {
          isSubjectTeacher = true;
        }
      }

      if (isSubjectTeacher) {
        req.subjectOwnership = {
          allowed: true,
          isClassTeacherOverride: false,
          subjectName: learningAreaRaw,
          learnerId,
          grade,
        };
        return next();
      }

      // 2. Check if teacher is the class teacher for this learner's class
      let isClassTeacher = false;
      if (learnerClassIds.length) {
        const classRecord = await prisma.class.findFirst({
          where: {
            teacherId: userId,
            id: { in: learnerClassIds },
            archived: false,
            active: true,
          },
          select: { id: true },
        });
        isClassTeacher = !!classRecord;
      }

      if (isClassTeacher) {
        // Allowed but flagged — frontend will show a warning
        logger.warn(
          {
            teacherId: userId,
            learnerId,
            grade,
            subject: learningAreaRaw,
            override: 'CLASS_TEACHER_OVERRIDE',
          },
          '[SubjectOwnership] Class teacher entering marks for a subject they are not assigned to'
        );

        req.subjectOwnership = {
          allowed: true,
          isClassTeacherOverride: true,
          subjectName: learningAreaRaw,
          learnerId,
          grade,
        };
        return next();
      }

      // 3. No assignment found
      logger.warn(
        {
          teacherId: userId,
          learnerId,
          grade,
          subject: learningAreaRaw,
        },
        '[SubjectOwnership] TEACHER attempted marks entry with no subject or class assignment'
      );

      if (opts.required !== false) {
        return _res.status(403).json({
          success: false,
          code: 'SUBJECT_NOT_ASSIGNED',
          message:
            'You are not assigned to this subject. Only the subject teacher or class teacher may enter scores.',
        });
      }

      // Soft mode: attach flag, let controller decide
      req.subjectOwnership = {
        allowed: false,
        isClassTeacherOverride: false,
        subjectName: learningAreaRaw,
        learnerId,
        grade,
      };
      return next();
    } catch (error: any) {
      logger.error({ err: error }, '[SubjectOwnership] Middleware error');
      next(error);
    }
  };
};
