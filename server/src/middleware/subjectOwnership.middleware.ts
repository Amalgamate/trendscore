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

      // Extract learnerId + learningArea from body (single or bulk entry)
      const body = req.body || {};
      const learnerId: string | null = body.learnerId ?? null;
      const learningAreaRaw: string | null =
        body.learningArea ?? body.subject ?? null;

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

      // Resolve learner's grade
      let grade: string | null = null;
      if (learnerId) {
        const learner = await prisma.learner.findUnique({
          where: { id: learnerId },
          select: { grade: true },
        });
        grade = learner?.grade ?? null;
      }

      // 1. Check if teacher is explicitly assigned as subject teacher for this learning area + grade
      let isSubjectTeacher = false;
      if (grade && learningAreaRaw) {
        const assignment = await prisma.subjectAssignment.findFirst({
          where: {
            teacherId: userId,
            grade,
            active: true,
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
              class: { grade: grade ?? undefined, archived: false },
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
      if (grade) {
        const classRecord = await prisma.class.findFirst({
          where: {
            teacherId: userId,
            grade,
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
