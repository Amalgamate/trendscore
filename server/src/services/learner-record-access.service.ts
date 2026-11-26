import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { parentAccessService } from './parent-access.service';
import { hasAnyRole } from '../utils/roleNormalizer';

export interface LearnerRecordActor {
  userId: string;
  role: string;
  roles?: string[];
  username?: string | null;
  email?: string | null;
}

export async function getTeacherLearnerScope(teacherId: string): Promise<Prisma.LearnerWhereInput> {
  const assignedClasses = await prisma.class.findMany({
    where: {
      active: true,
      archived: false,
      OR: [
        { teacherId },
        { teacherAssignments: { some: { teacherId } } },
      ],
    },
    select: { id: true, grade: true, stream: true },
  });
  const scopes: Prisma.LearnerWhereInput[] = assignedClasses.flatMap((assignedClass) => [
    { enrollments: { some: { classId: assignedClass.id, active: true, archived: false } } },
    { grade: assignedClass.grade, ...(assignedClass.stream ? { stream: assignedClass.stream } : {}) },
  ]);
  return scopes.length ? { OR: scopes } : { id: { in: [] } };
}

export async function getStudentLearnerIds(studentUserId: string): Promise<string[]> {
  const account = await prisma.user.findUnique({
    where: { id: studentUserId },
    select: { username: true, email: true },
  });
  const admissionCandidates = [
    account?.username,
    account?.username?.replace(/-/g, '/'),
    account?.email?.split('@')[0],
    account?.email?.split('@')[0]?.replace(/-/g, '/'),
  ].filter(Boolean) as string[];
  const learners = await prisma.learner.findMany({
    where: {
      archived: false,
      OR: [
        { studentUserId },
        ...(admissionCandidates.length ? [{ admissionNumber: { in: admissionCandidates } }] : []),
      ],
    },
    select: { id: true },
  });
  return learners.map(({ id }) => id);
}

/**
 * Enforce object-level access before returning one learner's records.
 * Admin scope is granted only to roles explicitly allowed by the caller;
 * parent, student and teacher access is always checked against the learner.
 */
export async function assertLearnerRecordAccess(
  actor: LearnerRecordActor | undefined,
  learnerId: string,
  allowedRoles: string[],
): Promise<void> {
  if (!actor?.userId) throw new ApiError(401, 'Authentication required');
  if (!learnerId) throw new ApiError(400, 'A learner is required');
  if (!hasAnyRole(actor, allowedRoles)) throw new ApiError(403, 'You cannot access learner records');

  if (hasAnyRole(actor, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM'])) return;

  if (hasAnyRole(actor, ['PARENT']) && await parentAccessService.canAccessLearner(actor.userId, learnerId)) return;

  if (hasAnyRole(actor, ['STUDENT'])) {
    const ownLearnerIds = await getStudentLearnerIds(actor.userId);
    if (ownLearnerIds.includes(learnerId)) return;
  }

  if (hasAnyRole(actor, ['TEACHER'])) {
    const teacherScope = await getTeacherLearnerScope(actor.userId);
    const assignedLearner = await prisma.learner.findFirst({
      where: { id: learnerId, archived: false, status: 'ACTIVE', AND: [teacherScope] },
      select: { id: true },
    });
    if (assignedLearner) return;
  }

  throw new ApiError(403, 'You can only access records for learners assigned to your account or class');
}

export async function assertTeacherClassAccess(
  actor: LearnerRecordActor | undefined,
  classId: string,
): Promise<void> {
  if (!actor?.userId) throw new ApiError(401, 'Authentication required');
  if (!classId) throw new ApiError(400, 'A class is required');
  if (hasAnyRole(actor, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'DEPUTY_HEAD_TEACHER', 'HEAD_OF_CURRICULUM'])) return;
  if (!hasAnyRole(actor, ['TEACHER'])) throw new ApiError(403, 'You cannot access class records');

  const assignedClass = await prisma.class.findFirst({
    where: {
      id: classId,
      active: true,
      archived: false,
      OR: [
        { teacherId: actor.userId },
        { teacherAssignments: { some: { teacherId: actor.userId } } },
      ],
    },
    select: { id: true },
  });
  if (!assignedClass) throw new ApiError(403, 'You can only access classes assigned to your account');
}
