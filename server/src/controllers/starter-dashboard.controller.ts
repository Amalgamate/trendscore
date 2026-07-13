import { Response } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';

const TEACHING_ROLES: UserRole[] = [
  UserRole.TEACHER,
  UserRole.HEAD_TEACHER,
  UserRole.HEAD_OF_CURRICULUM,
];

export const getStarterDashboardMetrics = async (_req: AuthRequest, res: Response) => {
  const learnerScope = { archived: false, status: 'ACTIVE' as const };

  const [students, staff, gradeGroups, streamGroups] = await Promise.all([
    prisma.learner.count({ where: learnerScope }),
    prisma.user.count({
      where: {
        archived: false,
        status: 'ACTIVE',
        OR: [
          { role: { in: TEACHING_ROLES } },
          { roles: { hasSome: TEACHING_ROLES } },
        ],
      },
    }),
    prisma.learner.groupBy({
      by: ['grade'],
      where: learnerScope,
      _count: true,
    }),
    prisma.learner.groupBy({
      by: ['stream'],
      where: learnerScope,
      _count: true,
    }),
  ]);

  const grades = new Set(gradeGroups.map((row) => String(row.grade || '').trim()).filter(Boolean)).size;
  const streams = new Set(streamGroups.map((row) => String(row.stream || '').trim()).filter(Boolean)).size;

  res.json({
    success: true,
    data: {
      students,
      staff,
      grades,
      streams,
    },
  });
};
