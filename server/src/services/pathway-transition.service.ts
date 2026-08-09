import prisma from '../config/database';
import { DetailedRubricRating, Term } from '@prisma/client';
import { ApiError } from '../utils/error.util';
import { resolveSubjectClusters } from './subject-cluster-resolver.service';

type PathwayCode = 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';

type TransitionInput = {
  learnerInterest?: PathwayCode | '';
  teacherRecommendation?: PathwayCode | '';
  parentPreference?: PathwayCode | '';
  nationalExam?: Record<string, number>;
  term?: Term | null;
  academicYear?: number | null;
};

const CANONICAL_RECOMMENDATION_ENGINE = 'GRADE9_READINESS_V1';
const CONFIDENCE_DEFINITION = '60 + (top pathway score - runner-up score), clamped to 0-99';

// Map the resolver's 3-way cluster code to the transition service's PathwayCode.
const CLUSTER_TO_PATHWAY: Record<string, PathwayCode> = {
  STEM:   'STEM',
  SOCIAL: 'SOCIAL_SCIENCES',
  ARTS:   'ARTS_SPORTS',
};

const DETAILED_RATING_POINTS: Record<DetailedRubricRating, number> = {
  EE1: 8, EE2: 7, ME1: 6, ME2: 5, AE1: 4, AE2: 3, BE1: 2, BE2: 1,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function normalizeTo100(scores: number[]): number {
  if (scores.length === 0) return 0;
  return clamp(scores.reduce((sum, v) => sum + v, 0) / scores.length, 0, 100);
}

export async function buildGrade9TransitionReadiness(learnerId: string, input: TransitionInput = {}) {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { id: true, firstName: true, lastName: true, grade: true, institutionType: true },
  });
  if (!learner) throw new ApiError(404, 'Learner not found');

  const grade = String(learner.grade || '');
  const isJuniorContext = ['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(grade);
  const targetLearnerId = learner.id;

  const summative = await prisma.summativeResult.findMany({
    where: { learnerId: targetLearnerId, archived: false },
    select: {
      percentage: true,
      test: { select: { learningArea: true, term: true, academicYear: true } },
    },
    orderBy: [{ test: { academicYear: 'asc' } }, { test: { term: 'asc' } }],
  });

  // Batch-resolve all subject names using the shared resolver (static map + DB aliases).
  const allSubjectNames = [
    ...new Set([
      ...summative.map((r) => r.test?.learningArea || '').filter(Boolean),
      ...Object.keys(input.nationalExam || {}),
    ]),
  ];
  const clusterBySubject = await resolveSubjectClusters(allSubjectNames);

  const pathwayAcademicBuckets: Record<PathwayCode, number[]> = {
    STEM: [],
    SOCIAL_SCIENCES: [],
    ARTS_SPORTS: [],
  };

  for (const row of summative) {
    const areaName = row.test?.learningArea || '';
    const cluster = clusterBySubject.get(areaName);
    if (!cluster) continue;
    const pathway = CLUSTER_TO_PATHWAY[cluster];
    if (pathway) pathwayAcademicBuckets[pathway].push(Number(row.percentage || 0));
  }

  if (input.nationalExam) {
    for (const [subject, score] of Object.entries(input.nationalExam)) {
      const cluster = clusterBySubject.get(subject);
      if (!cluster) continue;
      const pathway = CLUSTER_TO_PATHWAY[cluster];
      if (pathway) pathwayAcademicBuckets[pathway].push(Number(score || 0));
    }
  }

  const academicByPathway: Record<PathwayCode, number> = {
    STEM: normalizeTo100(pathwayAcademicBuckets.STEM),
    SOCIAL_SCIENCES: normalizeTo100(pathwayAcademicBuckets.SOCIAL_SCIENCES),
    ARTS_SPORTS: normalizeTo100(pathwayAcademicBuckets.ARTS_SPORTS),
  };

  const latestCompetency = await prisma.coreCompetency.findFirst({
    where: { learnerId: targetLearnerId, archived: false },
    orderBy: [{ academicYear: 'desc' }, { term: 'desc' }],
  });

  const competencyByPathway: Record<PathwayCode, number> = { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 };
  if (latestCompetency) {
    const stemRaw = (
      DETAILED_RATING_POINTS[latestCompetency.criticalThinking] +
      DETAILED_RATING_POINTS[latestCompetency.learningToLearn]
    ) / 2;
    const socialRaw = (
      DETAILED_RATING_POINTS[latestCompetency.communication] +
      DETAILED_RATING_POINTS[latestCompetency.collaboration]
    ) / 2;
    const artsRaw = (
      DETAILED_RATING_POINTS[latestCompetency.creativity] +
      DETAILED_RATING_POINTS[latestCompetency.collaboration]
    ) / 2;
    competencyByPathway.STEM = clamp((stemRaw / 8) * 100, 0, 100);
    competencyByPathway.SOCIAL_SCIENCES = clamp((socialRaw / 8) * 100, 0, 100);
    competencyByPathway.ARTS_SPORTS = clamp((artsRaw / 8) * 100, 0, 100);
  }

  const interestByPathway: Record<PathwayCode, number> = { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 };
  const teacherByPathway: Record<PathwayCode, number> = { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 };
  const parentByPathway: Record<PathwayCode, number> = { STEM: 0, SOCIAL_SCIENCES: 0, ARTS_SPORTS: 0 };

  if (input.learnerInterest && interestByPathway[input.learnerInterest as PathwayCode] !== undefined) {
    interestByPathway[input.learnerInterest as PathwayCode] = 100;
  }
  if (input.teacherRecommendation && teacherByPathway[input.teacherRecommendation as PathwayCode] !== undefined) {
    teacherByPathway[input.teacherRecommendation as PathwayCode] = 100;
  }
  if (input.parentPreference && parentByPathway[input.parentPreference as PathwayCode] !== undefined) {
    parentByPathway[input.parentPreference as PathwayCode] = 100;
  }

  const weights = { academic: 0.5, competency: 0.2, interest: 0.15, teacher: 0.1, parent: 0.05 };

  const totals: Record<PathwayCode, number> = {
    STEM: 0,
    SOCIAL_SCIENCES: 0,
    ARTS_SPORTS: 0,
  };

  (Object.keys(totals) as PathwayCode[]).forEach((p) => {
    totals[p] =
      academicByPathway[p] * weights.academic +
      competencyByPathway[p] * weights.competency +
      interestByPathway[p] * weights.interest +
      teacherByPathway[p] * weights.teacher +
      parentByPathway[p] * weights.parent;
  });

  const ranked = (Object.keys(totals) as PathwayCode[])
    .map((p) => ({ pathway: p, score: Number(totals[p].toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  const recommended = ranked[0];
  const runnerUp = ranked[1];
  const confidence = clamp(Number((recommended.score - (runnerUp?.score || 0) + 60).toFixed(2)), 0, 99);
  const parentMismatchWarning = input.parentPreference && input.parentPreference !== recommended.pathway
    ? `Selected parent preference (${input.parentPreference}) differs from strongest evidence-based fit (${recommended.pathway}).`
    : null;

  const generatedAt = new Date().toISOString();
  const recommendationMeta = {
    recommendedPathway: recommended.pathway,
    confidence,
    confidenceDefinition: CONFIDENCE_DEFINITION,
    version: CANONICAL_RECOMMENDATION_ENGINE,
    generatedAt,
    mismatchWarning: parentMismatchWarning,
  };

  const analysisPayload = {
    engineVersion: CANONICAL_RECOMMENDATION_ENGINE,
    generatedAt,
    confidenceDefinition: CONFIDENCE_DEFINITION,
    weights,
    inputs: {
      learnerInterest: input.learnerInterest || null,
      teacherRecommendation: input.teacherRecommendation || null,
      parentPreference: input.parentPreference || null,
      nationalExam: input.nationalExam || null,
      term: input.term || null,
      academicYear: input.academicYear || null,
    },
    componentScores: {
      academic: academicByPathway,
      competency: competencyByPathway,
      interest: interestByPathway,
      teacher: teacherByPathway,
      parent: parentByPathway,
    },
    ranking: ranked,
    recommendation: recommendationMeta,
  };

  return {
    success: true,
    data: {
      learner,
      context: {
        isJuniorContext,
        sourceWindow: 'Grade 7-9 historical performance + latest competencies + optional national exam',
      },
      weights,
      inputs: {
        learnerInterest: input.learnerInterest || null,
        teacherRecommendation: input.teacherRecommendation || null,
        parentPreference: input.parentPreference || null,
        nationalExam: input.nationalExam || null,
        term: input.term || null,
        academicYear: input.academicYear || null,
      },
      componentScores: {
        academic: academicByPathway,
        competency: competencyByPathway,
        interest: interestByPathway,
        teacher: teacherByPathway,
        parent: parentByPathway,
      },
      ranking: ranked,
      recommendation: recommendationMeta,
      analysisPayload,
    },
  };
}

