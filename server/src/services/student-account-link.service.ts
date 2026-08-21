import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

const usernameCandidatesForUser = (user: { username?: string | null; email?: string | null }) => [
  user.username,
  user.username?.replace(/-/g, '/'),
  user.email?.split('@')[0],
  user.email?.split('@')[0]?.replace(/-/g, '/'),
].filter(Boolean) as string[];

/** Resolve the learner owned by an authenticated student account. */
export async function resolveStudentLearnerForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, role: true },
  });

  if (!user || user.role !== 'STUDENT') {
    throw new ApiError(403, 'Unauthorized student access');
  }

  const learner = await prisma.learner.findFirst({
    where: {
      archived: false,
      OR: [
        { studentUserId: user.id },
        { admissionNumber: { in: usernameCandidatesForUser(user) } },
      ],
    },
  });

  if (!learner) {
    throw new ApiError(404, 'Learner record not found for this student')
      .withCode('LMS_STUDENT_LEARNER_NOT_LINKED');
  }

  return learner;
}

/** Resolve active student users for learners, preferring the explicit account link. */
export async function resolveStudentUserIdsForLearners(learnerIds: string[]): Promise<string[]> {
  if (learnerIds.length === 0) return [];

  const learners = await prisma.learner.findMany({
    where: { id: { in: learnerIds }, archived: false },
    select: { studentUserId: true, admissionNumber: true },
  });
  if (learners.length === 0) return [];

  const linkedIds = learners.map((learner) => learner.studentUserId).filter(Boolean) as string[];
  const usernameCandidates = learners.flatMap((learner) => [
    learner.admissionNumber,
    learner.admissionNumber.replace(/\//g, '-'),
  ]);

  const users = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      archived: false,
      status: 'ACTIVE',
      OR: [
        ...(linkedIds.length ? [{ id: { in: linkedIds } }] : []),
        ...(usernameCandidates.length ? [{ username: { in: usernameCandidates } }] : []),
      ],
    },
    select: { id: true },
  });

  return [...new Set(users.map((user) => user.id))];
}
