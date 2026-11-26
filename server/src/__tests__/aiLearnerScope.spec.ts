/**
 * Learner access scoping for AI tools.
 *
 * This is the security boundary for the assistant: a teacher asking "what does
 * Brian owe?" must not be able to reach learners outside their own classes by
 * naming an id. The model cannot widen the scope, because the check runs inside
 * the tool before any row is read.
 *
 * The gap this closes: the pre-existing pathway tools let *any* staff role read
 * *any* learner (`if (PATHWAY_STAFF_ROLES.has(role)) return;`). That was fine
 * for pathway review, but not for an agent that can surface fee balances.
 */

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    learner: { findUnique: jest.fn() },
    class: { findMany: jest.fn() },
    classSchedule: { findMany: jest.fn() },
  },
}));

import prisma from '../config/database';
import { assertLearnerReadAccess, getRestrictedClassIds } from '../ai/permissions/learnerScope';
import type { AIContext, UserRole } from '../ai/types';

const makeContext = (role: UserRole, userId = 'user-1'): AIContext => ({
  user: { id: userId, role, name: 'Test User', schoolId: 'school-1' },
  school: { id: 'school-1', name: 'Test School' },
  currentModule: 'fees',
});

const learnerInClasses = (classIds: string[]) => ({
  id: 'learner-1',
  archived: false,
  enrollments: classIds.map((classId) => ({ classId })),
});

describe('assertLearnerReadAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('school-wide roles', () => {
    const roles: UserRole[] = [
      'SUPER_ADMIN',
      'ADMIN',
      'HEAD_TEACHER',
      'DEPUTY_HEAD_TEACHER',
      'HEAD_OF_CURRICULUM',
      'ACCOUNTANT',
      'RECEPTIONIST',
    ];

    it.each(roles)('lets %s read any learner without a class lookup', async (role) => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-other']));

      const scope = await assertLearnerReadAccess('learner-1', makeContext(role));

      expect(scope).toEqual({ learnerId: 'learner-1', classScoped: false });
      // No teacher-class resolution should run for a school-wide role.
      expect(prisma.class.findMany).not.toHaveBeenCalled();
    });
  });

  describe('teachers', () => {
    it('allows a learner in a class the teacher owns', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-7a']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([{ id: 'class-7a' }]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([]);

      const scope = await assertLearnerReadAccess('learner-1', makeContext('TEACHER'));

      expect(scope).toEqual({ learnerId: 'learner-1', classScoped: true });
    });

    it('allows a learner in a class where the teacher only teaches a subject', async () => {
      // Assigned via teacherAssignments, not the class teacher of record.
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-9b']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([{ id: 'class-9b' }]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('TEACHER'))
      ).resolves.toEqual({ learnerId: 'learner-1', classScoped: true });
    });

    it('allows a learner reachable only through the timetable', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-8c']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([{ classId: 'class-8c' }]);

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('TEACHER'))
      ).resolves.toEqual({ learnerId: 'learner-1', classScoped: true });
    });

    it('refuses a learner outside the teacher’s classes', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-2x']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([{ id: 'class-7a' }]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('TEACHER'))
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses when the teacher has no classes at all', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-7a']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('TEACHER'))
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('does not leak whether the learner exists via the error message', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-2x']));
      (prisma.class.findMany as jest.Mock).mockResolvedValue([{ id: 'class-7a' }]);
      (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('TEACHER'))
      ).rejects.toThrow(/classes you teach/i);
    });
  });

  describe('roles outside the learner data boundary', () => {
    it.each<UserRole>(['CLEANER', 'GROUNDSKEEPER', 'IT_SUPPORT'])(
      'refuses %s outright',
      async (role) => {
        (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses(['class-7a']));

        await expect(
          assertLearnerReadAccess('learner-1', makeContext(role))
        ).rejects.toMatchObject({ statusCode: 403 });
      }
    );
  });

  describe('input and existence', () => {
    it('rejects a blank learner id before touching the database', async () => {
      await expect(
        assertLearnerReadAccess('   ', makeContext('ADMIN'))
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.learner.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown learner', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        assertLearnerReadAccess('missing', makeContext('ADMIN'))
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns 404 for an archived learner', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue({
        id: 'learner-1',
        archived: true,
        enrollments: [],
      });

      await expect(
        assertLearnerReadAccess('learner-1', makeContext('ADMIN'))
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('trims the supplied id', async () => {
      (prisma.learner.findUnique as jest.Mock).mockResolvedValue(learnerInClasses([]));

      await assertLearnerReadAccess('  learner-1  ', makeContext('ADMIN'));

      expect(prisma.learner.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'learner-1' } })
      );
    });
  });
});

describe('getRestrictedClassIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null for school-wide roles so queries stay unrestricted', async () => {
    await expect(getRestrictedClassIds(makeContext('HEAD_TEACHER'))).resolves.toBeNull();
    expect(prisma.class.findMany).not.toHaveBeenCalled();
  });

  it('returns the teacher’s class ids, deduplicated across assignments and timetable', async () => {
    (prisma.class.findMany as jest.Mock).mockResolvedValue([{ id: 'class-7a' }, { id: 'class-8b' }]);
    (prisma.classSchedule.findMany as jest.Mock).mockResolvedValue([
      { classId: 'class-8b' },
      { classId: 'class-9c' },
      { classId: null },
    ]);

    const ids = await getRestrictedClassIds(makeContext('TEACHER'));

    expect(ids).toEqual(['class-7a', 'class-8b', 'class-9c']);
  });
});
