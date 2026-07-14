/**
 * pathway-transition-decision.service.ts
 *
 * Persists and retrieves learner pathway transition decisions using
 * the Prisma-managed LearnerPathwayRecommendation model.
 *
 * Previously used a raw-SQL auto-created table (ensureDecisionTable).
 * Now fully type-safe and migration-tracked via Prisma.
 *
 * Phase 0, Pathway Planner.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import type { Prisma } from '@prisma/client';

type SaveDecisionInput = {
  learnerId: string;
  recommendedPathway: string;
  confidenceScore: number;
  learnerInterest?: string | null;
  teacherRecommendation?: string | null;
  parentPreference?: string | null;
  finalApprovedPathway?: string | null;
  mismatchWarning?: string | null;
  analysisPayload?: Prisma.InputJsonValue | null;
  updatedBy?: string | null;
};

export async function saveTransitionDecision(input: SaveDecisionInput) {
  const learner = await prisma.learner.findUnique({
    where: { id: input.learnerId },
    select: { id: true },
  });
  if (!learner) throw new ApiError(404, 'Learner not found');

  return prisma.learnerPathwayRecommendation.create({
    data: {
      learnerId:             input.learnerId,
      recommendedPathway:    input.recommendedPathway,
      confidenceScore:       input.confidenceScore,
      learnerInterest:       input.learnerInterest   ?? null,
      teacherRecommendation: input.teacherRecommendation ?? null,
      parentPreference:      input.parentPreference  ?? null,
      finalApprovedPathway:  input.finalApprovedPathway ?? null,
      mismatchWarning:       input.mismatchWarning   ?? null,
      analysisPayload:       input.analysisPayload   ?? undefined,
      updatedBy:             input.updatedBy         ?? null,
    },
  });
}

export async function getTransitionDecisionHistory(learnerId: string) {
  return prisma.learnerPathwayRecommendation.findMany({
    where:   { learnerId },
    orderBy: { createdAt: 'desc' },
    take:    30,
  });
}

export async function hasFinalizedTransitionDecision(learnerId: string): Promise<boolean> {
  const row = await prisma.learnerPathwayRecommendation.findFirst({
    where: {
      learnerId,
      finalApprovedPathway: { not: null },
      // Also exclude empty strings that may have been written by the old raw-SQL path
      NOT: { finalApprovedPathway: '' },
    },
    orderBy: { createdAt: 'desc' },
    select:  { id: true },
  });
  return row !== null;
}
