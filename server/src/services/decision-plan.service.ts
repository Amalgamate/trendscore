import { DecisionPlanStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

export type ParentDecisionOutcome = 'APPROVE' | 'REQUEST_REVISION' | 'NEEDS_COUNSELLING';
export type CounsellorDecisionOutcome = 'APPROVE' | 'REQUEST_REVISION';

export interface RevisionInput {
  reasonCategory?: string;
  explanation?: string;
  affectedSection?: string;
  requiredAction?: string;
  dueDate?: string | Date | null;
}

const decisionPlanInclude = {
  submissions: { orderBy: { version: 'desc' as const } },
  revisions: { orderBy: { createdAt: 'desc' as const } },
  comments: { orderBy: { createdAt: 'desc' as const } },
  actionPlan: { include: { items: { orderBy: { createdAt: 'asc' as const } } } },
} satisfies Prisma.DecisionPlanInclude;

export function assertDecisionPlanState(
  current: DecisionPlanStatus,
  allowed: DecisionPlanStatus[],
  action: string,
): void {
  if (!allowed.includes(current)) {
    throw new ApiError(
      409,
      `Cannot ${action} a decision plan while it is ${current}`,
    );
  }
}

function requiredText(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new ApiError(422, `${label} is required`);
  return normalized;
}

function normalizeRevision(input: RevisionInput, actorId: string, actorRole: string) {
  let dueDate: Date | null = null;
  if (input.dueDate) {
    dueDate = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw new ApiError(422, 'Revision due date is invalid');
  }

  return {
    reasonCategory: requiredText(input.reasonCategory, 'Revision reason category'),
    explanation: requiredText(input.explanation, 'Revision explanation'),
    affectedSection: requiredText(input.affectedSection, 'Affected section'),
    requiredAction: requiredText(input.requiredAction, 'Required action'),
    dueDate,
    requestedById: actorId,
    requestedByRole: actorRole,
  };
}

async function requestRevision(
  tx: Prisma.TransactionClient,
  planId: string,
  revision: RevisionInput,
  actorId: string,
  actorRole: string,
) {
  const normalized = normalizeRevision(revision, actorId, actorRole);
  await tx.decisionPlanRevision.create({
    data: { decisionPlanId: planId, ...normalized },
  });
  return tx.decisionPlan.update({
    where: { id: planId },
    data: { status: DecisionPlanStatus.REVISION_REQUIRED },
    include: decisionPlanInclude,
  });
}

export async function getDecisionPlan(
  learnerId: string,
  viewer: { actorId: string; role: string },
) {
  const role = viewer.role.trim().toUpperCase();
  const isPathwayStaff = [
    'SUPER_ADMIN',
    'ADMIN',
    'HEAD_TEACHER',
    'HEAD_OF_CURRICULUM',
  ].includes(role);
  const commentWhere = isPathwayStaff
    ? undefined
    : role === 'PARENT'
      ? { OR: [{ authorId: viewer.actorId }, { visibility: 'SHARED_WITH_STUDENT' }] }
      : { visibility: 'SHARED_WITH_STUDENT' };

  return prisma.decisionPlan.findUnique({
    where: { learnerId },
    include: {
      ...decisionPlanInclude,
      comments: {
        where: commentWhere,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function submitDecisionPlan(params: {
  learnerId: string;
  actorId: string;
  learnerStatement?: string;
}) {
  const learnerStatement = requiredText(params.learnerStatement, 'Learner statement');

  return prisma.$transaction(async tx => {
    const [selection, careers, schools, recommendation, searchCriteria, existingPlan] =
      await Promise.all([
        tx.learnerPathwaySelection.findFirst({
          where: { learnerId: params.learnerId },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            pathway: { select: { id: true, code: true, name: true } },
            track: { select: { id: true, code: true, name: true } },
            combinationRule: { select: { id: true, code: true, name: true } },
            items: {
              select: {
                subjectType: true,
                officialLearningArea: {
                  select: { id: true, officialCode: true, officialName: true },
                },
              },
            },
          },
        }),
        tx.learnerCareerSave.findMany({
          where: { learnerId: params.learnerId },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          select: {
            priority: true,
            supportStatus: true,
            note: true,
            career: { select: { id: true, code: true, title: true } },
          },
        }),
        tx.learnerSchoolPreference.findMany({
          where: { learnerId: params.learnerId },
          orderBy: { rank: 'asc' },
          select: {
            rank: true,
            source: true,
            notes: true,
            school: { select: { id: true, name: true, knecCode: true, county: true } },
          },
        }),
        tx.learnerPathwayRecommendation.findFirst({
          where: { learnerId: params.learnerId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            recommendedPathway: true,
            confidenceScore: true,
            mismatchWarning: true,
            analysisPayload: true,
            createdAt: true,
          },
        }),
        tx.learnerSchoolSearchCriteria.findUnique({
          where: { learnerId: params.learnerId },
          select: {
            budgetBand: true,
            boardingPreference: true,
            preferredCounties: true,
            faithPreference: true,
            notes: true,
          },
        }),
        tx.decisionPlan.findUnique({ where: { learnerId: params.learnerId } }),
      ]);

    if (!selection) throw new ApiError(422, 'Choose a pathway before submitting the decision plan');
    if (!selection.combinationRule || selection.items.length === 0) {
      throw new ApiError(422, 'Choose a complete subject combination before submitting the decision plan');
    }

    if (existingPlan) {
      assertDecisionPlanState(
        existingPlan.status,
        [DecisionPlanStatus.DRAFT, DecisionPlanStatus.REVISION_REQUIRED],
        'submit',
      );
    }

    const plan = existingPlan ?? await tx.decisionPlan.create({
      data: { learnerId: params.learnerId },
    });
    const version = plan.version + 1;
    const snapshot: Prisma.InputJsonObject = {
      learnerStatement,
      selection,
      careers,
      schools,
      searchCriteria: searchCriteria ?? null,
      recommendation: recommendation
        ? { ...recommendation, createdAt: recommendation.createdAt.toISOString() }
        : null,
      capturedAt: new Date().toISOString(),
    };

    await tx.decisionPlanSubmission.create({
      data: {
        decisionPlanId: plan.id,
        version,
        snapshot,
        submittedById: params.actorId,
      },
    });
    await tx.decisionPlanRevision.updateMany({
      where: { decisionPlanId: plan.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    return tx.decisionPlan.update({
      where: { id: plan.id },
      data: {
        status: DecisionPlanStatus.SUBMITTED,
        version,
        submittedAt: new Date(),
        submittedById: params.actorId,
        parentReviewedAt: null,
        parentReviewedById: null,
        counsellorReviewedAt: null,
        counsellorReviewedById: null,
        approvedAt: null,
        approvedById: null,
        lockedAt: null,
        lockedById: null,
      },
      include: decisionPlanInclude,
    });
  });
}

export async function reviewDecisionPlanAsParent(params: {
  learnerId: string;
  actorId: string;
  outcome: ParentDecisionOutcome;
  comment?: string;
  visibility?: 'COUNSELLOR_ONLY' | 'SHARED_WITH_STUDENT';
  revision?: RevisionInput;
}) {
  return prisma.$transaction(async tx => {
    const plan = await tx.decisionPlan.findUnique({ where: { learnerId: params.learnerId } });
    if (!plan) throw new ApiError(404, 'Decision plan not found');
    assertDecisionPlanState(plan.status, [DecisionPlanStatus.SUBMITTED], 'review as parent');

    const comment = params.comment?.trim();
    if (comment) {
      await tx.parentComment.create({
        data: {
          learnerId: params.learnerId,
          decisionPlanId: plan.id,
          authorId: params.actorId,
          body: comment,
          visibility: params.visibility ?? 'COUNSELLOR_ONLY',
        },
      });
    }

    if (params.outcome === 'APPROVE') {
      return tx.decisionPlan.update({
        where: { id: plan.id },
        data: {
          status: DecisionPlanStatus.PARENT_REVIEWED,
          parentReviewedAt: new Date(),
          parentReviewedById: params.actorId,
        },
        include: decisionPlanInclude,
      });
    }

    return requestRevision(
      tx,
      plan.id,
      params.revision ?? {},
      params.actorId,
      'PARENT',
    );
  });
}

export async function reviewDecisionPlanAsCounsellor(params: {
  learnerId: string;
  actorId: string;
  actorRole: string;
  outcome: CounsellorDecisionOutcome;
  revision?: RevisionInput;
}) {
  return prisma.$transaction(async tx => {
    const plan = await tx.decisionPlan.findUnique({ where: { learnerId: params.learnerId } });
    if (!plan) throw new ApiError(404, 'Decision plan not found');
    assertDecisionPlanState(
      plan.status,
      [DecisionPlanStatus.PARENT_REVIEWED],
      'review as counsellor',
    );

    if (params.outcome === 'APPROVE') {
      return tx.decisionPlan.update({
        where: { id: plan.id },
        data: {
          status: DecisionPlanStatus.COUNSELLOR_REVIEWED,
          counsellorReviewedAt: new Date(),
          counsellorReviewedById: params.actorId,
        },
        include: decisionPlanInclude,
      });
    }

    return requestRevision(
      tx,
      plan.id,
      params.revision ?? {},
      params.actorId,
      params.actorRole,
    );
  });
}

export async function approveDecisionPlan(learnerId: string, actorId: string) {
  const plan = await prisma.decisionPlan.findUnique({ where: { learnerId } });
  if (!plan) throw new ApiError(404, 'Decision plan not found');
  assertDecisionPlanState(
    plan.status,
    [DecisionPlanStatus.COUNSELLOR_REVIEWED],
    'approve',
  );
  return prisma.decisionPlan.update({
    where: { id: plan.id },
    data: { status: DecisionPlanStatus.APPROVED, approvedAt: new Date(), approvedById: actorId },
    include: decisionPlanInclude,
  });
}

export async function lockDecisionPlan(learnerId: string, actorId: string) {
  const plan = await prisma.decisionPlan.findUnique({ where: { learnerId } });
  if (!plan) throw new ApiError(404, 'Decision plan not found');
  assertDecisionPlanState(plan.status, [DecisionPlanStatus.APPROVED], 'lock');
  return prisma.decisionPlan.update({
    where: { id: plan.id },
    data: { status: DecisionPlanStatus.LOCKED, lockedAt: new Date(), lockedById: actorId },
    include: decisionPlanInclude,
  });
}
