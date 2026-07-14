import { NextFunction, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { ApiError } from '../utils/error.util';

export type PathwayStage = 'JUNIOR_TRANSITION' | 'SENIOR_EXECUTION';

export function normalizePathwayGrade(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase().replace(/[\s_-]+/g, '');
}

export function pathwayStageForGrade(value?: string | null): PathwayStage | null {
  const grade = normalizePathwayGrade(value);
  if (['GRADE7', 'GRADE8', 'GRADE9'].includes(grade)) return 'JUNIOR_TRANSITION';
  if (['GRADE10', 'GRADE11', 'GRADE12', 'FORM1', 'FORM2', 'FORM3', 'FORM4'].includes(grade)) return 'SENIOR_EXECUTION';
  return null;
}

export async function assertLearnerPathwayStage(learnerId: string, allowed: PathwayStage[]) {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { id: true, grade: true, institutionType: true },
  });
  if (!learner) throw new ApiError(404, 'Learner not found');
  const stage = pathwayStageForGrade(learner.grade);
  if (!stage || !allowed.includes(stage)) {
    const expected = allowed.includes('JUNIOR_TRANSITION')
      ? 'Grades 7–9 transition planning'
      : 'Grades 10–12 senior pathway execution';
    throw new ApiError(403, `This operation is only available for ${expected}.`).withCode('PATHWAY_STAGE_FORBIDDEN');
  }
  return { ...learner, pathwayStage: stage };
}

export const requireLearnerPathwayStage = (allowed: PathwayStage[]) => async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    await assertLearnerPathwayStage(req.params.learnerId, allowed);
    next();
  } catch (error) { next(error); }
};

export const requireBodyLearnerPathwayStage = (allowed: PathwayStage[]) => async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const learnerId = String(req.body?.learnerId ?? '');
    if (!learnerId) throw new ApiError(400, 'learnerId is required');
    await assertLearnerPathwayStage(learnerId, allowed);
    next();
  } catch (error) { next(error); }
};

export const requireSelectionPathwayStage = (allowed: PathwayStage[]) => async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const selection = await prisma.learnerPathwaySelection.findUnique({ where: { id: req.params.id }, select: { learnerId: true } });
    if (!selection) throw new ApiError(404, 'Pathway selection not found');
    await assertLearnerPathwayStage(selection.learnerId, allowed);
    next();
  } catch (error) { next(error); }
};
