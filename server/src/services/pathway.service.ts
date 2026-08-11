/**
 * pathway.service.ts
 *
 * Consolidated PathwayService facade.
 *
 * Previously: 3 separate service files
 * - pathway-transition.service (readiness analysis)
 * - pathway-recommendation.service (senior pathway)
 * - pathway-transition-decision.service (persistence)
 *
 * Now: Single facade with clear, orchestrated methods.
 * Easier to wrap with AI tools and add context.
 */

import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { buildGrade9TransitionReadiness } from './pathway-transition.service';
import {
  saveTransitionDecision,
  getTransitionDecisionHistory,
  hasFinalizedTransitionDecision
} from './pathway-transition-decision.service';
import { recommendSeniorPathwayAndSubjects } from './pathway-recommendation.service';
import { Term } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export type PathwayCode = 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';

/**
 * AI Context: Pathway readiness result (safe to pass to model)
 */
export interface PathwayReadinessContext {
  learnerId: string;
  learnerName: string;
  grade: string;
  recommendedPathway: PathwayCode;
  confidence: number;
  justification: string;
  componentScores: {
    STEM: number;
    SOCIAL_SCIENCES: number;
    ARTS_SPORTS: number;
  };
  mismatchWarning: string | null;
}

/**
 * AI Context: Pathway decision (safe to pass to model)
 */
export interface PathwayDecisionContext {
  learnerId: string;
  recommendedPathway: string | null;
  parentPreference: string | null;
  finalApprovedPathway: string | null;
  confidenceScore: number;
  hasFinalized: boolean;
  mismatchExists: boolean;
}

/**
 * PathwayService facade
 */
export class PathwayService {
  private static async assertDecisionIsEditable(learnerId: string): Promise<void> {
    if (await hasFinalizedTransitionDecision(learnerId)) {
      throw new ApiError(409, 'This learner pathway is finalized and cannot be changed without an explicit admin override');
    }
  }

  /**
   * Materialise the canonical Grade 7–9 recommendation when assessment data is
   * available.  Other pathway features (career fit, school matching and the
   * counsellor workbench) read LearnerPathwayRecommendation, so leaving the
   * calculation only in the learner-facing response makes those views disagree.
   *
   * The decision table is append-only.  A new automatic row is therefore added
   * only when the calculated evidence changes; finalised decisions are never
   * altered by this background refresh.
   */
  static async ensureAutomaticRecommendation(
    learnerId: string,
    opts?: { term?: Term; academicYear?: number },
  ) {
    const latest = await prisma.learnerPathwayRecommendation.findFirst({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest?.finalApprovedPathway) return latest;

    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { grade: true },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');
    if (!['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(String(learner.grade))) return latest;

    const resultCount = await prisma.summativeResult.count({
      where: { learnerId, archived: false },
    });
    // A pathway must be evidence-based; do not manufacture a default pathway
    // for a learner before their first scored assessment.
    if (resultCount === 0) return latest;

    const readiness = await buildGrade9TransitionReadiness(learnerId, {
      term: opts?.term,
      academicYear: opts?.academicYear,
      learnerInterest: latest?.learnerInterest as any,
      teacherRecommendation: latest?.teacherRecommendation as any,
      parentPreference: latest?.parentPreference as any,
    });
    const recommendation = readiness.data.recommendation;
    if (!recommendation?.recommendedPathway) return latest;

    const evidence = {
      engineVersion: readiness.data.analysisPayload.engineVersion,
      weights: readiness.data.weights,
      // term/year identify the request context, not the evidence window (the
      // engine evaluates the learner's Grade 7–9 history). Excluding them
      // prevents identical results from producing duplicate rows when the
      // same learner is viewed from different screens.
      inputs: {
        learnerInterest: readiness.data.inputs.learnerInterest,
        teacherRecommendation: readiness.data.inputs.teacherRecommendation,
        parentPreference: readiness.data.inputs.parentPreference,
        nationalExam: readiness.data.inputs.nationalExam,
      },
      componentScores: readiness.data.componentScores,
      ranking: readiness.data.ranking,
    };
    const signature = JSON.stringify(evidence);
    const existingSignature = (latest?.analysisPayload as any)?.automaticRecommendation?.signature;
    if (existingSignature === signature) return latest;

    return saveTransitionDecision({
      learnerId,
      recommendedPathway: recommendation.recommendedPathway,
      confidenceScore: recommendation.confidence,
      learnerInterest: latest?.learnerInterest ?? null,
      teacherRecommendation: latest?.teacherRecommendation ?? null,
      parentPreference: latest?.parentPreference ?? null,
      finalApprovedPathway: null,
      mismatchWarning: recommendation.mismatchWarning,
      analysisPayload: {
        ...(readiness.data.analysisPayload as Record<string, unknown>),
        automaticRecommendation: {
          generated: true,
          signature,
          resultCount,
        },
      } as Prisma.InputJsonValue,
      updatedBy: null,
    });
  }

  /**
   * Analyze a learner's Grade 9 readiness for pathway transition.
   * Returns AI-safe context object.
   */
  static async analyzeReadiness(
    learnerId: string,
    opts?: {
      term?: Term;
      academicYear?: number;
      learnerInterest?: string;
      teacherRecommendation?: string;
      parentPreference?: string;
    }
  ): Promise<PathwayReadinessContext> {
    const result = await buildGrade9TransitionReadiness(learnerId, {
      term: opts?.term,
      academicYear: opts?.academicYear,
      learnerInterest: opts?.learnerInterest as any,
      teacherRecommendation: opts?.teacherRecommendation as any,
      parentPreference: opts?.parentPreference as any,
    });

    if (!result?.data?.recommendation?.recommendedPathway) {
      throw new ApiError(400, 'Insufficient data to generate readiness analysis');
    }

    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true, grade: true },
    });
    if (!learner) throw new ApiError(404, 'Learner not found');

    const rec = result.data.recommendation;
    const [topRank, runnerUp] = result.data.ranking;
    return {
      learnerId,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      grade: String(learner.grade),
      recommendedPathway: rec.recommendedPathway,
      confidence: rec.confidence,
      justification: runnerUp
        ? `${topRank.pathway} ranked first with a weighted score of ${topRank.score}, ahead of ${runnerUp.pathway} at ${runnerUp.score}.`
        : `${topRank.pathway} is the strongest evidence-based fit.`,
      componentScores: {
        STEM: result.data.componentScores?.academic?.STEM ?? 0,
        SOCIAL_SCIENCES: result.data.componentScores?.academic?.SOCIAL_SCIENCES ?? 0,
        ARTS_SPORTS: result.data.componentScores?.academic?.ARTS_SPORTS ?? 0,
      },
      mismatchWarning: rec.mismatchWarning || null,
    };
  }

  /**
   * Submit a pathway recommendation (staff/counsellor).
   */
  static async submitRecommendation(
    learnerId: string,
    opts: {
      recommendedPathway: PathwayCode;
      confidenceScore: number;
      learnerInterest?: string | null;
      teacherRecommendation?: string | null;
      mismatchWarning?: string | null;
      analysisPayload?: Prisma.InputJsonValue;
      updatedBy?: string;
    }
  ) {
    await this.assertDecisionIsEditable(learnerId);
    return saveTransitionDecision({
      learnerId,
      recommendedPathway: opts.recommendedPathway,
      confidenceScore: opts.confidenceScore,
      learnerInterest: opts.learnerInterest || null,
      teacherRecommendation: opts.teacherRecommendation || null,
      parentPreference: null,
      finalApprovedPathway: null,
      mismatchWarning: opts.mismatchWarning || null,
      analysisPayload: opts.analysisPayload,
      updatedBy: opts.updatedBy,
    });
  }

  /**
   * Submit parent preference (parent endpoint).
   * Preserves all staff fields; updates only parentPreference.
   */
  static async submitParentPreference(
    learnerId: string,
    opts: {
      parentPreference: PathwayCode | null;
      updatedBy?: string;
    }
  ) {
    await this.assertDecisionIsEditable(learnerId);
    const existing = await prisma.learnerPathwayRecommendation.findFirst({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      // No staff recommendation yet — create minimal row
      return saveTransitionDecision({
        learnerId,
        recommendedPathway: null,
        confidenceScore: 0,
        learnerInterest: null,
        teacherRecommendation: null,
        parentPreference: opts.parentPreference,
        finalApprovedPathway: null,
        mismatchWarning: null,
        analysisPayload: null,
        updatedBy: opts.updatedBy,
      });
    }

    // Preserve staff fields, update only parent preference
    return saveTransitionDecision({
      learnerId,
      recommendedPathway: existing.recommendedPathway,
      confidenceScore: existing.confidenceScore || 0,
      learnerInterest: existing.learnerInterest,
      teacherRecommendation: existing.teacherRecommendation,
      parentPreference: opts.parentPreference,
      finalApprovedPathway: existing.finalApprovedPathway,
      mismatchWarning: existing.mismatchWarning,
      analysisPayload: existing.analysisPayload,
      updatedBy: opts.updatedBy,
    });
  }

  /**
   * Finalize pathway (admin only).
   * Locks pathway; prevents further changes.
   */
  static async finalizePathway(
    learnerId: string,
    opts: {
      finalApprovedPathway: PathwayCode;
      updatedBy?: string;
    }
  ) {
    const finalized = await prisma.learnerPathwayRecommendation.findFirst({
      where: {
        learnerId,
        finalApprovedPathway: { not: null },
        NOT: { finalApprovedPathway: '' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (finalized) {
      if (finalized.finalApprovedPathway === opts.finalApprovedPathway) return finalized;
      throw new ApiError(409, 'This learner pathway is already finalized and requires an explicit admin override to change');
    }

    const existing = await prisma.learnerPathwayRecommendation.findFirst({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new ApiError(400, 'No pathway recommendation found for learner');
    }

    return saveTransitionDecision({
      learnerId,
      recommendedPathway: existing.recommendedPathway || null,
      confidenceScore: existing.confidenceScore || 0,
      learnerInterest: existing.learnerInterest,
      teacherRecommendation: existing.teacherRecommendation,
      parentPreference: existing.parentPreference,
      finalApprovedPathway: opts.finalApprovedPathway,
      mismatchWarning: existing.mismatchWarning,
      analysisPayload: existing.analysisPayload,
      updatedBy: opts.updatedBy,
    });
  }

  /**
   * Explicit administrative override for an already-finalized transition.
   * This remains separate from normal recommendation/preference writes so a
   * finalized record cannot be changed accidentally or through AI tools.
   */
  static async overrideFinalizedPathway(
    learnerId: string,
    opts: {
      finalApprovedPathway: PathwayCode;
      reason: string;
      updatedBy: string;
    },
  ) {
    const existing = await prisma.learnerPathwayRecommendation.findFirst({
      where: {
        learnerId,
        finalApprovedPathway: { not: null },
        NOT: { finalApprovedPathway: '' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) throw new ApiError(409, 'No finalized pathway exists to override');
    if (existing.finalApprovedPathway === opts.finalApprovedPathway) {
      throw new ApiError(409, 'The override pathway must differ from the current finalized pathway');
    }

    const existingPayload = existing.analysisPayload
      && typeof existing.analysisPayload === 'object'
      && !Array.isArray(existing.analysisPayload)
      ? existing.analysisPayload as Record<string, unknown>
      : {};

    return saveTransitionDecision({
      learnerId,
      recommendedPathway: existing.recommendedPathway,
      confidenceScore: existing.confidenceScore || 0,
      learnerInterest: existing.learnerInterest,
      teacherRecommendation: existing.teacherRecommendation,
      parentPreference: existing.parentPreference,
      finalApprovedPathway: opts.finalApprovedPathway,
      mismatchWarning: existing.mismatchWarning,
      analysisPayload: {
        ...existingPayload,
        override: {
          previousPathway: existing.finalApprovedPathway,
          reason: opts.reason,
          overriddenAt: new Date().toISOString(),
          overriddenBy: opts.updatedBy,
        },
      } as Prisma.InputJsonValue,
      updatedBy: opts.updatedBy,
    });
  }

  /**
   * Get decision history (audit trail).
   */
  static async getDecisionHistory(learnerId: string) {
    return getTransitionDecisionHistory(learnerId);
  }

  /**
   * Check if pathway is finalized.
   */
  static async isFinalized(learnerId: string): Promise<boolean> {
    return hasFinalizedTransitionDecision(learnerId);
  }

  /**
   * Get current pathway decision context (AI-safe).
   */
  static async getDecisionContext(learnerId: string): Promise<PathwayDecisionContext> {
    const current = await prisma.learnerPathwayRecommendation.findFirst({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!current) {
      return {
        learnerId,
        recommendedPathway: null,
        parentPreference: null,
        finalApprovedPathway: null,
        confidenceScore: 0,
        hasFinalized: false,
        mismatchExists: false,
      };
    }

    return {
      learnerId,
      recommendedPathway: current.recommendedPathway,
      parentPreference: current.parentPreference,
      finalApprovedPathway: current.finalApprovedPathway,
      confidenceScore: current.confidenceScore || 0,
      hasFinalized: current.finalApprovedPathway !== null && current.finalApprovedPathway !== '',
      mismatchExists: Boolean(
        current.recommendedPathway &&
        current.parentPreference &&
        current.recommendedPathway !== current.parentPreference,
      ),
    };
  }

  /**
   * Get senior pathway recommendations (senior school selection).
   */
  static async recommendSeniorPathway(
    learnerId: string,
    opts?: {
      term?: Term;
      academicYear?: number;
      targetGradeLevel?: 'GRADE10' | 'GRADE11' | 'GRADE12';
    }
  ) {
    const persisted = await this.ensureAutomaticRecommendation(learnerId, opts);
    return recommendSeniorPathwayAndSubjects({
      learnerId,
      term: opts?.term || 'TERM_3',
      academicYear: opts?.academicYear || new Date().getFullYear(),
      targetGradeLevel: opts?.targetGradeLevel,
      learnerInterest: persisted?.learnerInterest ?? undefined,
      teacherRecommendation: persisted?.teacherRecommendation ?? undefined,
      parentPreference: persisted?.parentPreference ?? undefined,
    });
  }

  /**
   * Search schools matching a pathway.
   */
  static async searchSchools(
    pathway: PathwayCode,
    opts?: {
      county?: string;
      classification?: string;
      gender?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Prisma.SeniorSchoolWhereInput = {
      pathwayCodes: {
        has: pathway,
      },
    };

    if (opts?.county) {
      where.county = opts.county;
    }

    if (opts?.classification) {
      where.classification = opts.classification;
    }

    if (opts?.gender) {
      where.gender = opts.gender;
    }

    const [schools, total] = await Promise.all([
      prisma.seniorSchool.findMany({
        where,
        take: opts?.limit || 10,
        skip: opts?.offset || 0,
      }),
      prisma.seniorSchool.count({ where }),
    ]);

    return {
      schools,
      pagination: {
        total,
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
      },
    };
  }

  /**
   * Get pathway distribution for a class.
   * Returns counts by pathway + finalization status.
   */
  static async getClassDistribution(classId: string) {
    const learners = await prisma.learner.findMany({
      where: { enrollments: { some: { classId, active: true, archived: false } } },
      select: { id: true },
    });

    const learnerIds = learners.map((l) => l.id);

    if (learnerIds.length === 0) {
      return {
        classId,
        totalLearners: 0,
        recommendations: { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 },
        status: { FINALIZED: 0, PENDING: 0, NONE: 0 },
      };
    }

    const decisions = await prisma.learnerPathwayRecommendation.findMany({
      where: { learnerId: { in: learnerIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['learnerId'],
    });

    const recommendations = { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 };
    const status = { FINALIZED: 0, PENDING: 0, NONE: 0 };

    for (const decision of decisions) {
      if (decision.recommendedPathway && decision.recommendedPathway in recommendations) {
        recommendations[decision.recommendedPathway as PathwayCode]++;
      }

      if (decision.finalApprovedPathway) {
        status.FINALIZED++;
      } else if (decision.recommendedPathway) {
        status.PENDING++;
      }
    }

    // Count learners with no decisions
    const withDecisions = new Set(decisions.map((d) => d.learnerId));
    status.NONE = learnerIds.filter((id) => !withDecisions.has(id)).length;

    return {
      classId,
      totalLearners: learnerIds.length,
      recommendations,
      status,
    };
  }
}
