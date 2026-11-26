/**
 * Learner Access Scope for AI tools
 *
 * The deterministic guard that stands between an AI tool and learner data.
 *
 * The model cannot widen this: it is applied inside the tool, before any query,
 * exactly like the permission layer. A TEACHER may only reach learners in a
 * class they are the class teacher of, or where they teach a subject — the same
 * rule `subjectOwnership.middleware.ts` enforces for the UI.
 *
 * Why this exists: the pathway tools granted every staff role unrestricted
 * learner access (`if (PATHWAY_STAFF_ROLES.has(role)) return;`). That is
 * acceptable for pathway review but not for a general agent that can be asked
 * "what does this learner owe?".
 */

import prisma from '../../config/database';
import { ApiError } from '../../utils/error.util';
import type { AIContext, UserRole } from '../types';

/** Roles that may read any learner in their own school. */
const SCHOOL_WIDE_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'ACCOUNTANT',
  'RECEPTIONIST',
];

/** Roles that read learner data but are limited to their own teaching. */
const CLASS_SCOPED_ROLES: UserRole[] = ['TEACHER'];

export interface LearnerScope {
  /** Learner id, confirmed to exist in the caller's school. */
  learnerId: string;
  /** True when the caller may only see learners in their own classes. */
  classScoped: boolean;
}

/**
 * Resolve the class ids a teacher is attached to — as class teacher or by
 * teaching a subject in that class.
 */
async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  const classes = await prisma.class.findMany({
    where: {
      archived: false,
      OR: [{ teacherId }, { teacherAssignments: { some: { teacherId } } }],
    },
    select: { id: true },
  });

  const scheduled = await prisma.classSchedule.findMany({
    where: { teacherId, active: true },
    select: { classId: true },
  });

  return Array.from(
    new Set([
      ...classes.map((item) => item.id),
      ...scheduled.map((item) => item.classId).filter((id): id is string => Boolean(id)),
    ])
  );
}

/**
 * Assert the caller may read this learner, returning the resolved scope.
 * Throws ApiError(403) with a message safe to show the user.
 */
export async function assertLearnerReadAccess(
  learnerId: string,
  context: AIContext
): Promise<LearnerScope> {
  const role = context.user.role;
  const normalizedId = String(learnerId || '').trim();
  if (!normalizedId) throw new ApiError(400, 'learnerId is required');

  const learner = await prisma.learner.findUnique({
    where: { id: normalizedId },
    select: {
      id: true,
      archived: true,
      enrollments: {
        where: { active: true, archived: false },
        select: { classId: true },
      },
    },
  });

  if (!learner || learner.archived) {
    throw new ApiError(404, 'Learner not found');
  }

  // Tenant isolation is structural here: each school runs its own database, so
  // a learner row can only belong to the caller's school. Nothing to check.

  if (SCHOOL_WIDE_ROLES.includes(role)) {
    return { learnerId: learner.id, classScoped: false };
  }

  if (CLASS_SCOPED_ROLES.includes(role)) {
    const teacherClassIds = await getTeacherClassIds(context.user.id);
    const learnerClassIds = learner.enrollments.map((item) => item.classId);
    const shared = learnerClassIds.filter((id) => teacherClassIds.includes(id));

    if (shared.length === 0) {
      throw new ApiError(
        403,
        'You can only see learners in classes you teach. Ask a head teacher for school-wide figures.'
      );
    }

    return { learnerId: learner.id, classScoped: true };
  }

  throw new ApiError(
    403,
    `Your role (${role.replace(/_/g, ' ').toLowerCase()}) cannot read learner records through the assistant.`
  );
}

/**
 * Restrict a learner query to the caller's classes.
 * Returns `null` when unrestricted.
 */
export async function getRestrictedClassIds(context: AIContext): Promise<string[] | null> {
  if (!CLASS_SCOPED_ROLES.includes(context.user.role)) return null;
  return getTeacherClassIds(context.user.id);
}
