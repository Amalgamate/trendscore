import { NextFunction, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { parentAccessService } from '../services/parent-access.service';
import { ApiError } from '../utils/error.util';
import { hasAnyRole } from '../utils/roleNormalizer';

const PATHWAY_STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'TEACHER',
];

export async function assertLearnerPathwayAccess(
  req: AuthRequest,
  learnerId: string,
): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');

  if (hasAnyRole(req.user, PATHWAY_STAFF_ROLES)) return;

  if (hasAnyRole(req.user, ['STUDENT'])) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const self = user?.username
      ? await prisma.learner.findUnique({
          where: { admissionNumber: user.username },
          select: { id: true },
        })
      : null;
    if (self?.id === learnerId) return;
    throw new ApiError(403, 'Access denied: not your own record');
  }

  if (hasAnyRole(req.user, ['PARENT'])) {
    if (await parentAccessService.canAccessLearner(userId, learnerId)) return;
    throw new ApiError(403, 'Access denied: not your child');
  }

  throw new ApiError(403, 'Access denied: pathway records are restricted');
}

export const requireLearnerPathwayAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    await assertLearnerPathwayAccess(req, req.params.learnerId);
    next();
  } catch (error) {
    next(error);
  }
};

export const requirePathwaySelectionAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const selection = await prisma.learnerPathwaySelection.findUnique({
      where: { id: req.params.id },
      select: { learnerId: true },
    });
    if (!selection) throw new ApiError(404, 'Pathway selection not found');
    await assertLearnerPathwayAccess(req, selection.learnerId);
    next();
  } catch (error) {
    next(error);
  }
};
