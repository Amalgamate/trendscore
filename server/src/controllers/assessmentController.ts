import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { gradingService } from '../services/grading.service';
import { auditService } from '../services/audit.service';
import { AssessmentStatus, CurriculumType, FormativeAssessmentType, Prisma, Term } from '@prisma/client';
import { getInstitutionType } from '../utils/institutionNormalizer';
import { getSummativeTestTypeVariants, normalizeSummativeTestType } from '../utils/summativeTestType';
import { aiAssistantService } from '../services/ai-assistant.service';
import { detailedToGeneralRating } from '../utils/rubric.util';
import { redisCacheService } from '../services/redis-cache.service';
import { ApiError } from '../utils/error.util';
import {
  assertValidAssessmentEntry,
  getAssessmentStatusDetails,
  getCbeGradeDetails,
} from '../utils/cbe-grading.util';

import logger from '../utils/logger';
// ── Cache TTLs ────────────────────────────────────────────────────────────────
const TESTS_CACHE_TTL   = 300;  // 5 min — published tests change rarely
const RESULTS_CACHE_TTL = 30;   // 30 s  — results are written frequently
const GRADING_CACHE_TTL = 600;  // 10 min — grading scales are essentially static

async function invalidateSummativeResultCache(testId: string): Promise<void> {
  await Promise.all([
    redisCacheService.delete(`results:${testId}`),
    redisCacheService.delete(`results:PRIMARY_CBC:${testId}`),
    redisCacheService.delete(`results:SECONDARY:${testId}`),
    redisCacheService.delete(`results:TERTIARY:${testId}`),
  ]);
}

function isPlaceholderZeroSummativeResult(result: any): boolean {
  return Number(result?.marksObtained) === 0
    && result?.percentage == null
    && !result?.grade
    && !result?.status
    && !result?.cbcGrade
    && result?.rawScore == null
    && !result?.rubricRating
    && !result?.gradeCode
    && result?.achievementLevel == null
    && !result?.competencyBand
    && !result?.gradeDescription
    && !result?.assessmentStatusCode;
}

function normalizeSummativeResultForResponse<T extends Record<string, any>>(result: T): T {
  if (!isPlaceholderZeroSummativeResult(result)) return result;
  return {
    ...result,
    marksObtained: null,
    rawScore: null,
  };
}

type LearningAreaContext = {
  learningAreaId?: string;
  learningArea?: string;
  grade?: string;
  institutionType?: 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';
};

const areaNameCache = new Map<string, { id: string; name: string } | null>();
const SS_GRADES = new Set(['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3']);
const JS_GRADES = new Set(['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9']);
const DEFAULT_SUMMATIVE_TOTAL_MARKS = 100;
const DEFAULT_SUMMATIVE_PASS_MARKS = 40;
const MAX_SUMMATIVE_TOTAL_MARKS = 100;

type SummativeWithTestArea = { learnerId: string; test?: { learningAreaId?: string | null } | null };

function isSummativeTestDuplicateError(error: any): boolean {
  const message = String(error?.message || '');
  const constraint = String(error?.meta?.target || error?.meta?.constraint || '');

  return error?.code === 'P2002'
    || error?.code === '23505'
    || constraint.includes('summative_tests_grade_learningArea_term_academicYear_testTy_key')
    || constraint.includes('summative_tests_series_unique_key')
    || message.includes('summative_tests_grade_learningArea_term_academicYear_testTy_key')
    || message.includes('summative_tests_series_unique_key');
}

async function filterSummativeResultsBySecondarySelection<T extends SummativeWithTestArea>(results: T[]): Promise<T[]> {
  if (!results.length) return results;

  const learnerIds = Array.from(new Set(results.map((r) => String(r.learnerId)).filter(Boolean)));
  if (!learnerIds.length) return results;

  const [learners, selections] = await Promise.all([
    prisma.learner.findMany({
      where: { id: { in: learnerIds } },
      select: { id: true, institutionType: true },
    }),
    prisma.learnerSubjectSelection.findMany({
      where: { learnerId: { in: learnerIds }, active: true },
      select: { learnerId: true, learningAreaId: true },
    }),
  ]);

  const secondaryLearnerIds = new Set(
    learners.filter((l: any) => String(l.institutionType || '').toUpperCase() === 'SECONDARY').map((l: any) => l.id),
  );
  const selectedByLearner = new Map<string, Set<string>>();
  for (const row of selections) {
    const set = selectedByLearner.get(row.learnerId) || new Set<string>();
    set.add(row.learningAreaId);
    selectedByLearner.set(row.learnerId, set);
  }

  return results.filter((result) => {
    const learnerId = String(result.learnerId);
    if (!secondaryLearnerIds.has(learnerId)) return true;
    const selected = selectedByLearner.get(learnerId);
    if (!selected || selected.size === 0) return true; // Fallback for learners without configured selections.
    const learningAreaId = result.test?.learningAreaId;
    return Boolean(learningAreaId && selected.has(learningAreaId));
  });
}

function normalizeGradeCode(grade: string): string {
  return String(grade || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function assertGradeAllowedForInstitution(institutionType: string | undefined, grade: string, contextLabel: string) {
  const inst = String(institutionType || 'PRIMARY_CBC').toUpperCase();
  const g = normalizeGradeCode(grade);
  if (inst === 'SECONDARY') {
    if (!SS_GRADES.has(g)) throw new ApiError(400, `${contextLabel}: grade ${grade} is not allowed for Senior School`);
    return;
  }
  if (inst === 'PRIMARY_CBC') {
    if (!JS_GRADES.has(g)) throw new ApiError(400, `${contextLabel}: grade ${grade} is not allowed for Junior School`);
  }
}

function normalizeSummativeMarks(totalMarksInput: unknown, passMarksInput: unknown): { totalMarks: number; passMarks: number } {
  let totalMarks = Number(totalMarksInput);
  if (!Number.isFinite(totalMarks) || totalMarks <= 0) totalMarks = DEFAULT_SUMMATIVE_TOTAL_MARKS;
  totalMarks = Math.round(Math.min(totalMarks, MAX_SUMMATIVE_TOTAL_MARKS));

  let passMarks = Number(passMarksInput);
  if (!Number.isFinite(passMarks) || passMarks < 0) passMarks = DEFAULT_SUMMATIVE_PASS_MARKS;
  passMarks = Math.round(Math.max(0, Math.min(passMarks, totalMarks)));

  return { totalMarks, passMarks };
}

async function resolveLearningAreaWithContext(input: LearningAreaContext): Promise<{ id: string | null; name: string | null }> {
  const rawName = String(input.learningArea || '').trim();
  const grade = String(input.grade || '').trim();
  const institutionType = (input.institutionType || 'PRIMARY_CBC') as 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

  if (input.learningAreaId) {
    const byId = await prisma.learningArea.findUnique({
      where: { id: String(input.learningAreaId) },
      select: { id: true, name: true },
    });
    if (byId) return { id: byId.id, name: byId.name };
  }

  if (!rawName) return { id: null, name: null };

  const cacheKey = `${institutionType}::${grade}::${rawName.toLowerCase()}`;
  if (areaNameCache.has(cacheKey)) {
    const cached = areaNameCache.get(cacheKey);
    return { id: cached?.id || null, name: cached?.name || rawName };
  }

  const byName = await prisma.learningArea.findFirst({
    where: {
      name: rawName,
      institutionType: institutionType as any,
      ...(grade ? { gradeLevel: grade } : {}),
    },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  });

  areaNameCache.set(cacheKey, byName || null);
  return { id: byName?.id || null, name: byName?.name || rawName };
}

// ============================================
// FORMATIVE ASSESSMENT CONTROLLERS
// ============================================

/**
 * Get Formative Assessments (with filters)
 * GET /api/assessments/formative
 */
export const getFormativeAssessments = async (req: AuthRequest, res: Response) => {
  try {
    const { grade, term, academicYear, learningArea, strand } = req.query;

    const whereClause: any = { archived: false };

    if (grade) whereClause.learner = { grade };
    if (term) whereClause.term = term;
    if (academicYear) whereClause.academicYear = parseInt(academicYear as string);
    if (learningArea) {
      const resolvedArea = await resolveLearningAreaWithContext({
        learningArea: String(learningArea),
        grade: grade ? String(grade) : undefined,
        institutionType: getInstitutionType(req) as any,
      });
      whereClause.OR = resolvedArea.id
        ? [{ learningAreaId: resolvedArea.id }, { learningArea: String(learningArea) }]
        : [{ learningArea: String(learningArea) }];
    }
    if (strand) whereClause.strand = strand;

    const assessments = await prisma.formativeAssessment.findMany({
      where: whereClause,
      include: {
        learner: {
          select: { firstName: true, lastName: true, admissionNumber: true, grade: true }
        },
        teacher: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: assessments,
      count: assessments.length
    });
  } catch (error: any) {
    logger.error('Error fetching formative assessments:', error);
    throw new ApiError(500, 'Failed to fetch assessments: ' + error.message);
  }
};

/**
 * Get Bulk Formative Results for a class/grade/stream
 * GET /api/assessments/formative/bulk?grade=...&stream=...&academicYear=...&term=...
 */
export const getBulkFormativeResults = async (req: AuthRequest, res: Response) => {
  try {
    const { grade, stream, academicYear, term, learningArea } = req.query;

    if (!grade || !academicYear || !term) {
      throw new ApiError(400, 'Missing required filters: grade, academicYear, term');
    }

    const whereClause: any = {
      archived: false,
      learner: {
        grade: grade as string,
        ...(stream ? { stream: stream as string } : {})
      },
      term: String(term).toUpperCase().replace(/\s+/g, '_'),
      academicYear: parseInt(academicYear as string)
    };

    if (learningArea) {
      const resolvedArea = await resolveLearningAreaWithContext({
        learningArea: String(learningArea),
        grade: String(grade),
        institutionType: getInstitutionType(req) as any,
      });
      whereClause.OR = resolvedArea.id
        ? [{ learningAreaId: resolvedArea.id }, { learningArea: String(learningArea) }]
        : [{ learningArea: String(learningArea) }];
    }

    const assessments = await prisma.formativeAssessment.findMany({
      where: whereClause,
      include: {
        learner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            grade: true,
            stream: true
          }
        },
        teacher: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: [
        { learner: { firstName: 'asc' } },
        { learningArea: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: assessments,
      count: assessments.length
    });
  } catch (error: any) {
    logger.error('Error fetching bulk formative results:', error);
    throw new ApiError(500, 'Failed to fetch bulk formative results: ' + error.message);
  }
};

/**
 * Create a new Formative Assessment
 * POST /api/assessments/formative
 */
export const createFormativeAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const {
      learnerId,
      learningAreaId,
      learningArea,
      strand,
      subStrand,
      term,
      academicYear,
      overallRating,
      detailedRating,
      teacherComment,
      nextSteps,
      weight = 0,
      title = '',
      type = 'OTHER'
    } = req.body;

    const teacherId = req.user?.userId;

    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { grade: true, institutionType: true },
    });
    const resolvedArea = await resolveLearningAreaWithContext({
      learningAreaId,
      learningArea,
      grade: learner?.grade || undefined,
      institutionType: (learner?.institutionType as any) || getInstitutionType(req) as any,
    });
    const resolvedLearningArea = resolvedArea.name;
    const resolvedLearningAreaId = resolvedArea.id;

    if (!teacherId || !learnerId || !resolvedLearningArea || !overallRating) {
      throw new ApiError(400, 'Missing required fields: learnerId, learningArea (or learningAreaId), overallRating');
    }

    const assessment = await prisma.formativeAssessment.create({
      data: {
        learnerId,
        teacherId,
        learningArea: resolvedLearningArea,
        learningAreaId: resolvedLearningAreaId || null,
        strand,
        subStrand,
        term,
        academicYear: parseInt(academicYear),
        overallRating,
        detailedRating,
        weight: Number(weight),
        title,
        type
      }
    });

    await auditService.logChange({
      entityType: 'FormativeAssessment',
      entityId: assessment.id,
      action: 'CREATE',
      userId: teacherId,
      reason: 'Formative assessment created via API'
    });

    res.status(201).json({
      success: true,
      data: assessment
    });

  } catch (error: any) {
    logger.error('Error creating formative assessment:', error);
    throw new ApiError(500, 'Failed to create assessment: ' + error.message);
  }
};

/**
 * Record Formative Results Bulk
 * POST /api/assessments/formative/bulk
 */
export const recordFormativeResultsBulk = async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    let assessments: any[];

    if (Array.isArray(req.body.assessments)) {
      assessments = req.body.assessments;
    } else if (Array.isArray(req.body.results)) {
      const {
        results,
        term,
        academicYear,
        learningAreaId,
        learningArea,
        strand,
        subStrand,
        title = '',
        type = 'OTHER',
        weight = 1.0,
        maxScore
      } = req.body;

      assessments = results.map((r: any) => ({
        learnerId: r.learnerId,
        term,
        academicYear,
        learningAreaId,
        learningArea,
        strand,
        subStrand,
        title,
        type,
        weight,
        maxScore,
        detailedRating: r.detailedRating,
        overallRating: r.overallRating ?? (r.detailedRating ? detailedToGeneralRating(r.detailedRating) : undefined),
        percentage: r.percentage,
        points: r.points,
        strengths: r.strengths,
        areasImprovement: r.areasImprovement,
        recommendations: r.recommendations,
        remarks: r.remarks
      }));
    } else {
      throw new ApiError(400, 'Invalid payload: expected assessments[] or results[]');
    }

    if (assessments.length === 0) {
      throw new ApiError(400, 'No assessments provided');
    }

    // Validate each entry and collect any issues.
    // Mirrors the Zod schema applied to POST /formative (single-entry) so bulk
    // submissions can't silently write unnormalized terms, out-of-range years,
    // or invalid rating codes that the single-entry path would reject outright.
    const VALID_TERMS = new Set(['TERM_1', 'TERM_2', 'TERM_3']);
    const VALID_OVERALL_RATINGS = new Set(['EE', 'ME', 'AE', 'BE']);
    const VALID_DETAILED_RATINGS = new Set(['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']);
    const VALID_TYPES = new Set([
      'OPENER', 'WEEKLY', 'MONTHLY', 'CAT', 'MID_TERM',
      'ASSIGNMENT', 'PROJECT', 'PRACTICAL', 'QUIZ',
      'OBSERVATION', 'ORAL', 'EXAM', 'OTHER'
    ]);

    const normalizeTerm = (raw: any): string => {
      const s = String(raw || '').toUpperCase().trim();
      if (s === 'TERM 1' || s === 'TERM1') return 'TERM_1';
      if (s === 'TERM 2' || s === 'TERM2') return 'TERM_2';
      if (s === 'TERM 3' || s === 'TERM3') return 'TERM_3';
      return s;
    };

    const invalid: Array<{ learnerId: string; reason: string }> = [];
    const valid: any[] = [];

    for (const a of assessments) {
      if (!a.learnerId) {
        invalid.push({ learnerId: 'unknown', reason: 'Missing learnerId' });
        continue;
      }
      if (!a.overallRating && !a.detailedRating) {
        invalid.push({ learnerId: a.learnerId, reason: 'Missing rating (overallRating or detailedRating required)' });
        continue;
      }
      if (a.detailedRating && !VALID_DETAILED_RATINGS.has(String(a.detailedRating))) {
        invalid.push({ learnerId: a.learnerId, reason: `Invalid detailedRating: ${a.detailedRating}` });
        continue;
      }
      if (a.overallRating && !VALID_OVERALL_RATINGS.has(String(a.overallRating))) {
        invalid.push({ learnerId: a.learnerId, reason: `Invalid overallRating: ${a.overallRating}` });
        continue;
      }
      const normalizedTerm = normalizeTerm(a.term);
      if (!VALID_TERMS.has(normalizedTerm)) {
        invalid.push({ learnerId: a.learnerId, reason: `Invalid term: ${a.term}` });
        continue;
      }
      a.term = normalizedTerm;
      const yearNum = parseInt(a.academicYear, 10);
      if (!Number.isFinite(yearNum) || yearNum < 2020 || yearNum > 2100) {
        invalid.push({ learnerId: a.learnerId, reason: `Invalid academicYear: ${a.academicYear}` });
        continue;
      }
      if (a.type && !VALID_TYPES.has(String(a.type))) {
        invalid.push({ learnerId: a.learnerId, reason: `Invalid type: ${a.type}` });
        continue;
      }
      if (a.weight != null) {
        const weightNum = Number(a.weight);
        if (!Number.isFinite(weightNum) || weightNum < 0 || weightNum > 100) {
          invalid.push({ learnerId: a.learnerId, reason: `Invalid weight: ${a.weight}` });
          continue;
        }
      }
      valid.push(a);
    }

    // Pre-fetch existing assessments by composite key so we can enforce lock state
    // and preserve the "Edit Own" rule for bulk upserts.
    const bulkKeys = new Map<string, {
      learnerId: string;
      term: Term;
      academicYear: number;
      learningArea: string;
      type: FormativeAssessmentType;
      title: string;
    }>();

    const learnerIds = Array.from(new Set(valid.map((a) => String(a.learnerId))));
    const learnerRows = await prisma.learner.findMany({
      where: { id: { in: learnerIds } },
      select: { id: true, grade: true, institutionType: true },
    });
    const learnerMap = new Map(learnerRows.map((l: any) => [l.id, l]));

    for (const assessment of valid) {
      const learnerCtx: any = learnerMap.get(String(assessment.learnerId));
      const resolvedArea = await resolveLearningAreaWithContext({
        learningAreaId: assessment.learningAreaId,
        learningArea: assessment.learningArea,
        grade: learnerCtx?.grade || undefined,
        institutionType: (learnerCtx?.institutionType as any) || getInstitutionType(req) as any,
      });
      assessment.learningArea = resolvedArea.name || assessment.learningArea;
      assessment.learningAreaId = resolvedArea.id || assessment.learningAreaId || null;
      const key = `${assessment.learnerId}::${assessment.term}::${assessment.academicYear}::${assessment.learningArea}::${assessment.type ?? 'OTHER'}::${assessment.title ?? ''}`;
      bulkKeys.set(key, {
        learnerId: assessment.learnerId,
        term: assessment.term as Term,
        academicYear: parseInt(assessment.academicYear),
        learningArea: assessment.learningArea,
        type: assessment.type ? assessment.type as FormativeAssessmentType : 'OTHER',
        title: assessment.title ?? ''
      });
    }

    const existingAssessments = bulkKeys.size > 0
      ? await prisma.formativeAssessment.findMany({
          where: {
            OR: Array.from(bulkKeys.values()).map(key => ({
              learnerId: key.learnerId,
              term: key.term,
              academicYear: key.academicYear,
              learningArea: key.learningArea,
              type: key.type,
              title: key.title
            }))
          },
          select: {
            id: true,
            learnerId: true,
            term: true,
            academicYear: true,
            learningArea: true,
            type: true,
            title: true,
            teacherId: true,
            locked: true,
            status: true
          }
        })
      : [];

    const ownerMap = new Map(existingAssessments.map((a: any) => [
      `${a.learnerId}::${a.term}::${a.academicYear}::${a.learningArea}::${a.type}::${a.title}`,
      a.teacherId
    ]));

    const lockedExisting = existingAssessments.filter((a: any) => a.locked || a.status === 'LOCKED');
    const lockBypassRoles = ['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER'];

    if (lockedExisting.length > 0 && !lockBypassRoles.includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'One or more existing formative assessments are locked and cannot be modified.'
      });
    }

    const saved = await prisma.$transaction(
      valid.map((a: any) => {
        const ownerKey = `${a.learnerId}::${a.term}::${parseInt(a.academicYear)}::${a.learningArea}::${a.type ?? 'OTHER'}::${a.title ?? ''}`;
        const ownerId = ownerMap.get(ownerKey);
        const canUpdate = !ownerId || ownerId === teacherId;

        return prisma.formativeAssessment.upsert({
          where: {
            learnerId_term_academicYear_learningArea_type_title: {
              learnerId: a.learnerId,
              term: a.term,
              academicYear: parseInt(a.academicYear),
              learningArea: a.learningArea,
              type: a.type ?? 'OTHER',
              title: a.title ?? ''
            }
          },
          update: canUpdate ? {
            overallRating: a.overallRating,
            detailedRating: a.detailedRating,
            percentage: a.percentage,
            points: a.points,
            strengths: a.strengths,
            areasImprovement: a.areasImprovement,
            remarks: a.remarks ?? a.recommendations,
            weight: a.weight != null ? Number(a.weight) : undefined,
            ...(a.learningAreaId ? { learningAreaId: String(a.learningAreaId) } : {}),
          } : {}, // If not owner, do nothing in update
          create: {
            learnerId: a.learnerId,
            teacherId,
            term: a.term,
            academicYear: parseInt(a.academicYear),
            learningArea: a.learningArea,
            learningAreaId: a.learningAreaId ? String(a.learningAreaId) : null,
            strand: a.strand,
            subStrand: a.subStrand,
            title: a.title ?? '',
            type: a.type ?? 'OTHER',
            weight: a.weight != null ? Number(a.weight) : 1.0,
            maxScore: a.maxScore ? Number(a.maxScore) : undefined,
            overallRating: a.overallRating,
            detailedRating: a.detailedRating,
            percentage: a.percentage,
            points: a.points,
            strengths: a.strengths,
            areasImprovement: a.areasImprovement,
            remarks: a.remarks ?? a.recommendations
          }
        });
      })
    );

    const savedMap = saved.map((s: any) => ({
      id: s.id,
      learnerId: s.learnerId,
      status: s.status ?? 'DRAFT'
    }));

    const response: any = {
      success: true,
      message: `Successfully recorded ${saved.length} assessments`,
      data: saved,
      saved: savedMap
    };

    if (invalid.length > 0) {
      response.warnings = `${invalid.length} entries were skipped due to validation errors`;
      response.skipped = invalid;
    }

    res.status(201).json(response);

  } catch (error: any) {
    logger.error('Error bulk recording formative assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record bulk assessments',
      error: error.message
    });
  }
};

/**
 * Get Formative Assessments for a Learner
 * GET /api/assessments/formative/learner/:learnerId
 */
export const getFormativeByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    const whereClause: any = { learnerId, archived: false };

    if (term) whereClause.term = term;
    if (academicYear) whereClause.academicYear = parseInt(academicYear as string);

    const assessments = await prisma.formativeAssessment.findMany({
      where: whereClause,
      include: {
        teacher: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: assessments,
      count: assessments.length
    });
  } catch (error: any) {
    logger.error('Error fetching learner formative assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results',
      error: error.message
    });
  }
};

/**
 * Delete Formative Assessment
 * DELETE /api/assessments/formative/:id
 */
export const deleteFormativeAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const assessment = await prisma.formativeAssessment.findUnique({
      where: { id }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    await prisma.formativeAssessment.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
        archivedBy: req.user?.userId
      }
    });

    res.json({
      success: true,
      message: 'Assessment archived successfully'
    });

  } catch (error: any) {
    logger.error('Error deleting formative assessment:', error);
    throw new ApiError(500, 'Failed to delete assessment: ' + error.message);
  }
};

// ============================================
// SUMMATIVE TEST CONTROLLERS
// ============================================

/**
 * Create a new Summative Test
 * POST /api/assessments/tests
 *
 * FIX 1: Accept `type` as a fallback alias for `testType`.
 *   useSummativeTestForm sends { testType: formData.type, type: formData.type }.
 *   The old code only destructured `testType`, so if the Zod schema or any
 *   intermediate transform dropped it, `testType` would be undefined and the
 *   "Missing required fields" guard would fire.
 *
 * FIX 2: Use redisCacheService.deleteByPrefix('tests:') instead of
 *   redisCacheService.delete('tests:all').
 *   getSummativeTests stores keys as `tests:TERM_1:2026:::` etc., so the old
 *   literal-key delete never hit anything — cached results lived forever and
 *   newly-created tests never appeared until the 5-min TTL expired.
 */
export const createSummativeTest = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      title,
      title: seriesName,
      learningAreaId,
      learningArea,
      // Accept both field names — Zod schema passes both through now.
      testType: rawTestType,
      type: rawType,
      term,
      academicYear,
      testDate,
      maxScore,
      totalMarks = 100,
      passMarks = 40,
      description,
      instructions,
      grade,
      stream,
      curriculum = 'CBC_AND_EXAM',
      scaleId,
      weight = 1.0,
      duration
    } = req.body;

    // Resolve: prefer explicit testType, fall back to `type` alias
    const testType = rawTestType || rawType;

    const teacherId = req.user?.userId;
    const institutionType = getInstitutionType(req);
    assertGradeAllowedForInstitution(institutionType, String(grade || ''), 'Create test');

    const normalizedTerm = String(term || '')
      .toUpperCase()
      .replace(/\s+/g, '_') as 'TERM_1' | 'TERM_2' | 'TERM_3';

    const resolvedArea = await resolveLearningAreaWithContext({
      learningAreaId,
      learningArea,
      grade: grade ? String(grade) : undefined,
      institutionType: getInstitutionType(req) as any,
    });
    const resolvedLearningArea = resolvedArea.name;
    const resolvedLearningAreaId = resolvedArea.id;

    const resolvedTestType = normalizeSummativeTestType(testType);
    const requestedTestDate = testDate ? new Date(testDate) : new Date();

    // A grade may extend an existing assessment cycle with another subject, but
    // must not create a second Opener, Midterm, or End-term cycle for the same
    // term and year. The date is the stable cycle identifier used by reports.
    const existingCycle = await prisma.summativeTest.findFirst({
      where: {
        grade: String(grade),
        term: normalizedTerm,
        academicYear: parseInt(academicYear),
        testType: resolvedTestType,
        archived: false
      },
      select: { testDate: true }
    });
    if (existingCycle?.testDate &&
      existingCycle.testDate.toISOString().slice(0, 10) !== requestedTestDate.toISOString().slice(0, 10)) {
      return res.status(409).json({
        success: false,
        message: `A ${resolvedTestType.replace(/_/g, ' ').toLowerCase()} cycle already exists for this grade, term, and year. Add subjects to the existing cycle instead.`,
        error: 'Assessment cycle already exists'
      });
    }

    // Build title: if the provided title already contains the subject name,
    // use it as-is to avoid doubling up ("Maths End Term" → "Maths End Term - Maths - …")
    const normalizedSeriesName = seriesName || name || `${resolvedTestType} - ${normalizedTerm} ${academicYear}`;
    const resolvedTitle = (resolvedLearningArea && normalizedSeriesName.includes(resolvedLearningArea))
      ? normalizedSeriesName
      : `${normalizedSeriesName} - ${resolvedLearningArea} - ${resolvedTestType} - ${normalizedTerm} ${academicYear}`;

    const normalizedMarks = normalizeSummativeMarks(totalMarks ?? maxScore ?? DEFAULT_SUMMATIVE_TOTAL_MARKS, passMarks);

    if (!teacherId || !resolvedLearningArea || !normalizedTerm || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: learningArea, term, and academicYear are required'
      });
    }

    try {
      const test = await prisma.summativeTest.create({
        data: {
          title: resolvedTitle,
          learningArea: resolvedLearningArea,
          learningAreaId: resolvedLearningAreaId || null,
          testType: resolvedTestType,
          term: normalizedTerm,
          academicYear: parseInt(academicYear),
          testDate: requestedTestDate,
          totalMarks: normalizedMarks.totalMarks,
          passMarks: normalizedMarks.passMarks,
          description,
          instructions,
          grade,
          curriculum,
          scaleId,
          weight: parseFloat(String(weight || 1.0)),
          duration: duration ? parseInt(String(duration)) : undefined,
          createdBy: teacherId,
          status: 'PUBLISHED',
          published: true,
          active: true
        }
      });

      // FIX: deleteByPrefix busts ALL parameterised test list cache keys
      // (e.g. tests:TERM_1:2026:::, tests::::, etc.) not just a phantom 'tests:all'
      await redisCacheService.deleteByPrefix('tests:');

      await auditService.logChange({
        entityType: 'SummativeTest',
        entityId: test.id,
        action: 'CREATE',
        userId: teacherId,
        reason: 'Summative test created via API'
      });

      res.status(201).json({
        success: true,
        data: test
      });

    } catch (error: any) {
      if (isSummativeTestDuplicateError(error)) {
        return res.status(409).json({
          success: false,
          message: `A test already exists for "${resolvedLearningArea}" with this exact series, grade, term, year, and test type.`,
          error: 'Duplicate Test Found'
        });
      }

      logger.error('Error creating summative test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create test',
        error: error.message
      });
    }
  } catch (error: any) {
    logger.error('Error in createSummativeTest:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test',
      error: error.message
    });
  }
};

/**
 * Bulk Generate Tests for multiple learning areas
 * POST /api/assessments/tests/bulk
 *
 * FIX: Use deleteByPrefix('tests:') — same cache key mismatch fixed here.
 */
export const generateTestsBulk = async (req: AuthRequest, res: Response) => {
  try {
    const {
      learningAreas,
      grade,
      term,
      academicYear,
      testType,
      testDate,
      totalMarks = 100,
      passMarks = 40,
      duration,
      stream,
      curriculum = 'CBC_AND_EXAM',
      weight = 1.0,
      scaleGroupId,
      title: seriesName
    } = req.body;

    const teacherId = req.user?.userId;
    const institutionType = getInstitutionType(req);
    assertGradeAllowedForInstitution(institutionType, String(grade || ''), 'Bulk test generation');

    if (!learningAreas || !Array.isArray(learningAreas) || !grade || !term || !academicYear || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required configuration'
      });
    }

    const normalizedTerm = String(term || '')
      .toUpperCase()
      .replace(/\s+/g, '_') as 'TERM_1' | 'TERM_2' | 'TERM_3';

    const resolvedTestType = normalizeSummativeTestType(testType);
    const requestedTestDate = testDate ? new Date(testDate) : new Date();

    // Keep one assessment cycle per grade, term, year and test type. Multiple
    // subjects are created below only when they share this same cycle date.
    const existingCycle = await prisma.summativeTest.findFirst({
      where: {
        grade: String(grade),
        term: normalizedTerm,
        academicYear: parseInt(academicYear),
        testType: resolvedTestType,
        archived: false
      },
      select: { testDate: true }
    });
    if (existingCycle?.testDate &&
      existingCycle.testDate.toISOString().slice(0, 10) !== requestedTestDate.toISOString().slice(0, 10)) {
      return res.status(409).json({
        success: false,
        message: `A ${resolvedTestType.replace(/_/g, ' ').toLowerCase()} cycle already exists for this grade, term, and year. Add subjects to the existing cycle instead.`,
        error: 'Assessment cycle already exists'
      });
    }

    const gradingSystems = await prisma.gradingSystem.findMany({
      where: {
        grade: grade as string,
        type: 'SUMMATIVE',
        active: true,
        archived: false,
        ...(scaleGroupId ? { scaleGroupId } : {})
      },
      select: { id: true, name: true, learningArea: true }
    });

    const scaleByArea = new Map<string, string>();
    for (const sys of gradingSystems) {
      if (sys.learningArea) {
        scaleByArea.set(sys.learningArea.trim().toLowerCase(), sys.id);
      }
    }

    const createdTests = [];
    const normalizedMarks = normalizeSummativeMarks(totalMarks, passMarks);
    const scaleWarnings: string[] = [];
    let duplicateCount = 0;

    const institutionScope = getInstitutionType(req);
    for (const area of learningAreas) {
      const areaKey = String(area).trim().toLowerCase();
      const resolvedArea = await resolveLearningAreaWithContext({
        learningArea: String(area),
        grade: String(grade),
        institutionType: institutionScope,
      });

      const resolvedScaleId: string | undefined =
        scaleByArea.get(areaKey) ??
        gradingSystems.find((s: any) =>
          s.learningArea && (
            s.learningArea.toLowerCase() === areaKey ||
            s.learningArea.toLowerCase().includes(areaKey) ||
            areaKey.includes(s.learningArea.toLowerCase())
          )
        )?.id;

      if (!resolvedScaleId) {
        scaleWarnings.push(`No scale found for "${area}" — test created without a scale`);
      }

      try {
        const test = await prisma.summativeTest.create({
          data: {
            title: `${seriesName || (resolvedTestType + ' - ' + normalizedTerm + ' ' + academicYear)} - ${area} - ${resolvedTestType} - ${normalizedTerm} ${academicYear}`,
            learningArea: resolvedArea.name || String(area),
            learningAreaId: resolvedArea.id || null,
            testType: resolvedTestType,
            term: normalizedTerm,
            academicYear: parseInt(academicYear),
            testDate: requestedTestDate,
            totalMarks: normalizedMarks.totalMarks,
            passMarks: normalizedMarks.passMarks,
            duration: duration ? parseInt(String(duration)) : undefined,
            grade,
            curriculum,
            weight: parseFloat(String(weight || 1.0)),
            scaleId: resolvedScaleId ?? null,
            createdBy: teacherId,
            status: 'PUBLISHED',
            published: true,
            active: true
          }
        });

        createdTests.push(test);
      } catch (err: any) {
        if (isSummativeTestDuplicateError(err)) {
          duplicateCount++;
        } else {
          throw err;
        }
      }
    }

    // FIX: bust all parameterised test list cache keys
    await redisCacheService.deleteByPrefix('tests:');

    let resultMessage = `Successfully generated ${createdTests.length} tests.`;
    if (duplicateCount > 0) {
      resultMessage += ` Skipped ${duplicateCount} exact duplicate tests (same series, grade, subject, term, year, and type).`;
    }

    res.status(201).json({
      success: true,
      message: resultMessage,
      data: createdTests,
      ...(scaleWarnings.length > 0 ? { warnings: scaleWarnings } : {})
    });

  } catch (error: any) {
    logger.error('Error bulk generating tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk generate tests',
      error: error.message
    });
  }
};

/**
 * Get Summative Tests (with filters) — cached
 * GET /api/assessments/tests
 */
export const getSummativeTests = async (req: AuthRequest, res: Response) => {
  try {
    const { term, academicYear, grade, stream, learningArea } = req.query;

    // Parameterised cache key — all write operations bust via deleteByPrefix('tests:')
    const cacheKey = `tests:${term || ''}:${academicYear || ''}:${grade || ''}:${stream || ''}:${learningArea || ''}`;
    const cached = await redisCacheService.get<any[]>(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, count: cached.length, _cached: true });
    }

    const whereClause: any = {
      archived: false,
      status: 'PUBLISHED',
      active: true,
    };

    if (term) whereClause.term = term;
    if (academicYear) whereClause.academicYear = parseInt(academicYear as string);
    const institutionType = getInstitutionType(req).toUpperCase();
    if (grade) {
      assertGradeAllowedForInstitution(institutionType, String(grade), 'List tests');
      whereClause.grade = grade;
    } else if (institutionType === 'SECONDARY') {
      whereClause.grade = { in: ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3'] };
    } else if (institutionType === 'PRIMARY_CBC') {
      whereClause.grade = { in: ['PLAYGROUP', 'PP1', 'PP2', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9'] };
    }
    if (stream) whereClause.stream = stream;
    let resolvedAreaIdForFilter: string | null = null;
    if (learningArea) {
      const resolvedArea = await resolveLearningAreaWithContext({
        learningArea: String(learningArea),
        grade: grade ? String(grade) : undefined,
        institutionType: getInstitutionType(req) as any,
      });
      resolvedAreaIdForFilter = resolvedArea.id;
      whereClause.OR = resolvedArea.id
        ? [{ learningAreaId: resolvedArea.id }, { learningArea: String(learningArea) }]
        : [{ learningArea: String(learningArea) }];
    }

    let tests: any[] = [];
    try {
      tests = await prisma.summativeTest.findMany({
        where: whereClause,
        include: {
          creator: {
            select: { firstName: true, lastName: true }
          },
          _count: {
            select: { results: true }
          }
        },
        orderBy: { testDate: 'desc' }
      });
    } catch (error: any) {
      // Temporary compatibility fallback for partially-migrated production schemas.
      if (error?.code !== 'P2022') {
        throw error;
      }

      logger.warn('[Assessments] Falling back to legacy summative_tests query due to schema drift:', error?.message);
      const rawTests = await prisma.$queryRaw<Array<any>>`
        SELECT
          st.id,
          st.title,
          st."learningArea",
          st."testType"::text AS "testType",
          st.term,
          st."academicYear",
          st."testDate",
          st."totalMarks",
          st."passMarks",
          st.grade,
          st."createdBy"
        FROM summative_tests st
        ORDER BY st."testDate" DESC
      `;

      tests = rawTests
        .filter((t: any) => !term || t.term === term)
        .filter((t: any) => !academicYear || Number(t.academicYear) === parseInt(academicYear as string))
        .filter((t: any) => !grade || t.grade === grade)
        .filter((t: any) => {
          if (grade) return true;
          if (institutionType === 'SECONDARY') return SS_GRADES.has(normalizeGradeCode(t.grade));
          if (institutionType === 'PRIMARY_CBC') return JS_GRADES.has(normalizeGradeCode(t.grade));
          return true;
        })
        .filter((t: any) => !learningArea || t.learningArea === learningArea)
        .map((t: any) => ({
          ...t,
          creator: null,
          _count: { results: 0 }
        }));

      if (learningArea && resolvedAreaIdForFilter) {
        tests = tests.filter((t: any) => (t.learningAreaId ? String(t.learningAreaId) === resolvedAreaIdForFilter : true));
      }
    }

    await redisCacheService.set(cacheKey, tests, TESTS_CACHE_TTL);

    res.json({
      success: true,
      data: tests,
      count: tests.length
    });
  } catch (error: any) {
    logger.error('Error fetching summative tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tests',
      error: error.message
    });
  }
};

/**
 * Get a Specific Summative Test
 * GET /api/assessments/tests/:id
 */
export const getSummativeTest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.summativeTest.findUnique({
      where: { id },
      include: {
        creator: {
          select: { firstName: true, lastName: true }
        },
        results: {
          include: {
            learner: {
              select: { firstName: true, lastName: true, admissionNumber: true }
            }
          }
        },
        _count: {
          select: { results: true }
        }
      }
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    res.json({
      success: true,
      data: test
    });

  } catch (error: any) {
    logger.error('Error fetching summative test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test details',
      error: error.message
    });
  }
};

/**
 * Update Summative Test
 * PUT /api/assessments/tests/:id
 *
 * FIX: Use deleteByPrefix('tests:') instead of delete('tests:all')
 */
export const updateSummativeTest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const test = await prisma.summativeTest.findUnique({
      where: { id }
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const normalizedMarks = normalizeSummativeMarks(
      updateData.totalMarks != null ? updateData.totalMarks : test.totalMarks,
      updateData.passMarks != null ? updateData.passMarks : test.passMarks
    );

    const nextGrade = updateData.grade != null ? String(updateData.grade) : test.grade;
    const nextLearningArea = updateData.learningArea != null ? String(updateData.learningArea) : test.learningArea;
    const institutionType = getInstitutionType(req) as any;
    const resolvedArea = updateData.learningArea != null || updateData.learningAreaId != null
      ? await resolveLearningAreaWithContext({
          learningAreaId: updateData.learningAreaId,
          learningArea: nextLearningArea,
          grade: nextGrade,
          institutionType,
        })
      : null;

    const updatePayload: Prisma.SummativeTestUpdateInput = {
      title: updateData.title ?? undefined,
      learningArea: resolvedArea ? (resolvedArea.name || nextLearningArea) : updateData.learningArea,
      learningAreaRef: resolvedArea?.id
        ? { connect: { id: resolvedArea.id } }
        : updateData.learningAreaId === null
          ? { disconnect: true }
          : undefined,
      term: updateData.term ?? undefined,
      academicYear: updateData.academicYear ? parseInt(updateData.academicYear) : undefined,
      grade: updateData.grade ?? undefined,
      testDate: updateData.testDate ? new Date(updateData.testDate) : undefined,
      totalMarks: normalizedMarks.totalMarks,
      passMarks: normalizedMarks.passMarks,
      duration: updateData.duration != null ? parseInt(String(updateData.duration)) : undefined,
      description: updateData.description ?? undefined,
      instructions: updateData.instructions ?? undefined,
      curriculum: updateData.curriculum ?? undefined,
      weight: updateData.weight != null ? parseFloat(String(updateData.weight)) : undefined,
      scale: updateData.scaleId ? { connect: { id: updateData.scaleId } } : updateData.scaleId === null ? { disconnect: true } : undefined,
      testType: updateData.testType != null || updateData.type != null
        ? normalizeSummativeTestType(updateData.testType || updateData.type)
        : undefined,
      published: updateData.published ?? undefined,
      active: updateData.active ?? undefined,
      status: updateData.status ?? undefined,
    };

    const updatedTest = await prisma.summativeTest.update({
      where: { id },
      data: updatePayload
    });

    // FIX: bust all parameterised list keys + this specific test's individual key
    await redisCacheService.deleteByPrefix('tests:');
    await redisCacheService.delete(`test:${id}`);

    await auditService.logChange({
      entityType: 'SummativeTest',
      entityId: id,
      action: 'UPDATE',
      userId: req.user?.userId || 'SYSTEM',
      reason: 'Summative test updated via API'
    });

    res.json({
      success: true,
      data: updatedTest
    });

  } catch (error: any) {
    logger.error('Error updating summative test:', error);
    throw new ApiError(500, 'Failed to update test: ' + error.message);
  }
};

/**
 * Delete Summative Test
 * DELETE /api/assessments/tests/:id
 *
 * FIX: Use deleteByPrefix('tests:') instead of delete('tests:all')
 */
export const deleteSummativeTest = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const test = await prisma.summativeTest.findUnique({
      where: { id }
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const hasResults = await prisma.summativeResult.count({
      where: { testId: id }
    });

    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      await prisma.$transaction(async (tx) => {
        await tx.summativeResultHistory.deleteMany({
          where: { result: { testId: id } }
        });
        await tx.summativeResult.deleteMany({ where: { testId: id } });
        await tx.summativeTest.delete({ where: { id } });
      });

      await redisCacheService.deleteByPrefix('tests:');
      await redisCacheService.delete(`test:${id}`);

      res.json({
        success: true,
        message: 'Test and associated results permanently deleted by Super Admin'
      });
    } else {
      if (hasResults > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete test with recorded results. Archive it instead.'
        });
      }

      await prisma.summativeTest.update({
        where: { id },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: req.user?.userId
        }
      });

      await redisCacheService.deleteByPrefix('tests:');
      await redisCacheService.delete(`test:${id}`);

      res.json({
        success: true,
        message: 'Test archived successfully'
      });
    }

  } catch (error: any) {
    logger.error('Error deleting summative test:', error);
    throw new ApiError(500, 'Failed to delete test: ' + error.message);
  }
};

/**
 * Bulk Delete Summative Tests
 * DELETE /api/assessments/tests/bulk
 *
 * FIX: Use deleteByPrefix('tests:') instead of delete('tests:all')
 */
export const deleteSummativeTestsBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Invalid assessment IDs');
    }

    const tests = await prisma.summativeTest.findMany({
      where: { id: { in: ids } }
    });

    if (tests.length === 0) {
      return res.status(404).json({ success: false, message: 'No tests found' });
    }

    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      await prisma.$transaction(async (tx) => {
        await tx.summativeResultHistory.deleteMany({
          where: { result: { testId: { in: ids } } }
        });
        await tx.summativeResult.deleteMany({ where: { testId: { in: ids } } });
        await tx.summativeTest.deleteMany({ where: { id: { in: ids } } });
      });
      res.json({ success: true, message: 'Tests permanently deleted' });
    } else {
      await prisma.summativeTest.updateMany({
        where: { id: { in: ids } },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: req.user?.userId
        }
      });
      res.json({ success: true, message: 'Tests archived successfully' });
    }

    // FIX: bust after response (bulk ops don't return early so this always runs)
    await redisCacheService.deleteByPrefix('tests:');

  } catch (error: any) {
    logger.error('Error bulk deleting assessments:', error);
    throw new ApiError(500, 'Failed to bulk delete assessments: ' + error.message);
  }
};

// ============================================
// SUMMATIVE RESULTS CONTROLLERS
// ============================================

/**
 * Record Summative Result (Single)
 * POST /api/assessments/summative/results
 */
export const recordSummativeResult = async (req: AuthRequest, res: Response) => {
  try {
    const { testId, learnerId, marksObtained, rawScore, assessmentStatusCode, remarks, teacherComment, moderationComment } = req.body;
    const recordedBy = req.user?.userId;

    if (!recordedBy) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!testId || !learnerId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const test = await prisma.summativeTest.findUnique({
      where: { id: testId },
      select: { id: true, totalMarks: true, passMarks: true, scaleId: true, learningAreaId: true, learningArea: true }
    });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { id: true, institutionType: true },
    });
    if (!learner) return res.status(404).json({ success: false, message: 'Learner not found' });

    if (learner.institutionType === 'SECONDARY') {
      const testAreaId = test.learningAreaId || (
        test.learningArea
          ? (await prisma.learningArea.findFirst({
              where: { name: test.learningArea, institutionType: 'SECONDARY' },
              select: { id: true },
            }))?.id
          : null
      );

      if (testAreaId) {
        const hasSelection = await prisma.learnerSubjectSelection.findFirst({
          where: { learnerId, learningAreaId: testAreaId, active: true },
          select: { learnerId: true },
        });
        if (!hasSelection) {
          return res.status(400).json({
            success: false,
            message: 'This learner is not enrolled for the selected subject in their pathway profile.',
          });
        }
      }
    }

    const entry = assertValidAssessmentEntry({
      marksObtained,
      rawScore,
      assessmentStatusCode,
      teacherComment,
      totalMarks: test.totalMarks,
    });

    if (!entry.ok) {
      return res.status(400).json({ success: false, message: entry.reason });
    }

    let gradingSystem;
    if (test.scaleId) {
      gradingSystem = await gradingService.getGradingSystemById(test.scaleId);
    }
    
    const institutionType = getInstitutionType(req);
    
    if (!gradingSystem) {
      const systemType = institutionType === 'SECONDARY' ? 'SECONDARY' : 'SUMMATIVE';
      gradingSystem = await gradingService.getGradingSystem(systemType);
    }
    const ranges = gradingSystem?.ranges;

    const cbcSystem = await gradingService.getGradingSystem('CBC');
    const cbcRanges = cbcSystem?.ranges || [];

    const performance = entry.kind === 'score'
      ? (() => {
          const percentage = (entry.score / test.totalMarks) * 100;
          const gradeCode = cbcRanges.length > 0 ? gradingService.calculateRatingSync(percentage, cbcRanges) : 'BE2';
          const details = getCbeGradeDetails(gradeCode)!;
          const matchedRange = cbcRanges.find((r: any) => percentage >= r.minPercentage && percentage <= r.maxPercentage)
            || ranges?.find((r: any) => percentage >= r.minPercentage && percentage <= r.maxPercentage);
          return {
            marks: entry.score,
            percentage,
            gradeCode,
            details,
            status: percentage >= test.passMarks ? 'PASS' as const : 'FAIL' as const,
            remarks: remarks || matchedRange?.description || matchedRange?.label || details.gradeDescription,
          };
        })()
      : null;

    const adminStatus = entry.kind === 'status' ? getAssessmentStatusDetails(entry.statusCode) : null;

    const existingResult = await prisma.summativeResult.findUnique({
      where: { testId_learnerId: { testId, learnerId } }
    });

    const actionType = existingResult ? 'UPDATE' : 'CREATE';
    const oldValues = existingResult ? { marksObtained: existingResult.marksObtained, assessmentStatusCode: existingResult.assessmentStatusCode } : {};

    const result = await prisma.summativeResult.upsert({
      where: { testId_learnerId: { testId, learnerId } },
      update: {
        marksObtained: performance ? Math.round(performance.marks) : null,
        rawScore: performance?.marks ?? null,
        percentage: performance?.percentage ?? null,
        grade: performance?.gradeCode ?? null,
        cbcGrade: performance?.gradeCode ?? null,
        rubricRating: performance?.gradeCode ?? null,
        gradeCode: performance?.gradeCode ?? null,
        achievementLevel: performance?.details.achievementLevel ?? null,
        competencyBand: performance?.details.competencyBand ?? null,
        gradeDescription: performance?.details.gradeDescription ?? null,
        assessmentStatusCode: adminStatus?.code ?? null,
        status: performance?.status ?? null,
        recordedBy,
        remarks: performance?.remarks ?? adminStatus?.label ?? remarks ?? null,
        teacherComment,
        moderationComment
      },
      create: {
        testId,
        learnerId,
        marksObtained: performance ? Math.round(performance.marks) : null,
        rawScore: performance?.marks ?? null,
        percentage: performance?.percentage ?? null,
        grade: performance?.gradeCode ?? null,
        cbcGrade: performance?.gradeCode ?? null,
        rubricRating: performance?.gradeCode ?? null,
        gradeCode: performance?.gradeCode ?? null,
        achievementLevel: performance?.details.achievementLevel ?? null,
        competencyBand: performance?.details.competencyBand ?? null,
        gradeDescription: performance?.details.gradeDescription ?? null,
        assessmentStatusCode: adminStatus?.code ?? null,
        status: performance?.status ?? null,
        recordedBy,
        remarks: performance?.remarks ?? adminStatus?.label ?? remarks ?? null,
        teacherComment,
        moderationComment
      }
    });

    await prisma.summativeResultHistory.create({
      data: {
        resultId: result.id,
        action: actionType,
        field: 'marksObtained',
        oldValue: oldValues.assessmentStatusCode || (oldValues.marksObtained != null ? String(oldValues.marksObtained) : null),
        newValue: adminStatus?.code || (performance ? String(performance.marks) : null),
        changedBy: recordedBy,
        reason: `Summative result ${actionType.toLowerCase()} via API`
      }
    });

    // Bust result cache for this test
    await invalidateSummativeResultCache(testId);

    res.status(existingResult ? 200 : 201).json({
      success: true,
      message: existingResult ? 'Result updated successfully' : 'Result recorded successfully',
      data: result
    });

  } catch (error: any) {
    logger.error('Error recording summative result:', error);
    throw new ApiError(500, 'Failed to record result: ' + error.message);
  }
};

/**
 * Get Summative Results for a Learner
 * GET /api/assessments/summative/results/learner/:learnerId
 */
export const getSummativeByLearner = async (req: AuthRequest, res: Response) => {
  try {
    const { learnerId } = req.params;
    const { term, academicYear } = req.query;

    const whereClause: any = { learnerId };

    if (term || academicYear) {
      whereClause.test = {};
      if (term) whereClause.test.term = term;
      if (academicYear) whereClause.test.academicYear = parseInt(academicYear as string);
    }

    const [results, communicationLogs] = await Promise.all([
      prisma.summativeResult.findMany({
        where: whereClause,
        include: {
          test: {
            select: {
              title: true,
              learningArea: true,
              learningAreaId: true,
              testType: true,
              term: true,
              academicYear: true,
              totalMarks: true,
              passMarks: true,
              testDate: true,
              status: true,
              curriculum: true,
              scaleId: true
            }
          },
          recorder: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: [
          { test: { academicYear: 'desc' } },
          { test: { testDate: 'desc' } }
        ]
      }),
      prisma.assessmentSmsAudit.findMany({
        where: {
          learnerId,
          term: term as string || undefined,
          academicYear: academicYear ? parseInt(academicYear as string) : undefined,
          assessmentType: 'SUMMATIVE',
          smsStatus: 'SENT'
        },
        select: { channel: true, sentAt: true },
        orderBy: { sentAt: 'desc' }
      }),
    ]);

    const filteredResults = await filterSummativeResultsBySecondarySelection(results as any[]);

    // Surface paperSnapshotUrl from orphanFields for the frontend
    const enrichedResults = filteredResults.map((r: any) => ({
      ...r,
      paperSnapshotUrl: (r.orphanFields as any)?.paperSnapshotUrl || null,
    }));

    res.json({
      success: true,
      data: enrichedResults,
      count: enrichedResults.length,
      communication: {
        hasSentSms: communicationLogs.some((log: { channel: string }) => log.channel === 'SMS'),
        hasSentWhatsApp: communicationLogs.some((log: { channel: string }) => log.channel === 'WHATSAPP'),
        lastSmsAt: communicationLogs.find((log: { channel: string; sentAt: Date }) => log.channel === 'SMS')?.sentAt,
        lastWhatsAppAt: communicationLogs.find((log: { channel: string; sentAt: Date }) => log.channel === 'WHATSAPP')?.sentAt
      }
    });

  } catch (error: any) {
    logger.error('Error fetching summative results for learner:', error);
    throw new ApiError(500, 'Failed to fetch results for learner: ' + error.message);
  }
};

/**
 * Get Results for a Specific Test — cached
 * GET /api/assessments/summative/results/test/:testId
 */
export const getTestResults = async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const institutionScope = getInstitutionType(req).toUpperCase();

    const test = await prisma.summativeTest.findUnique({
      where: { id: testId },
      select: { id: true, grade: true }
    });
    if (!test) throw new ApiError(404, 'Test not found');
    assertGradeAllowedForInstitution(institutionScope, String(test.grade || ''), 'Get test results');

    const cacheKey = `results:${institutionScope}:${testId}`;
    const cached = await redisCacheService.get<any[]>(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, count: cached.length, _cached: true });
    }

    let results: any[] = [];
    try {
      results = await prisma.summativeResult.findMany({
        where: { testId },
        include: {
          learner: {
            select: { firstName: true, lastName: true, admissionNumber: true, grade: true }
          }
        },
        orderBy: { marksObtained: 'desc' }
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      const enumDrift =
        message.includes('not found in enum') ||
        message.includes('expected_type: String') ||
        message.includes('modelName: \'SummativeResult\'') ||
        message.includes('field: \'grade\'');

      if (!enumDrift) {
        throw error;
      }

      logger.warn('[Assessments] Falling back to raw test-results query due to legacy grade decode drift:', error?.message);
      const rawRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
        SELECT
          sr.id,
          sr."testId",
          sr."learnerId",
          sr."marksObtained",
          sr.percentage,
          sr.grade::text AS grade,
          sr."cbcGrade"::text AS "cbcGrade",
          sr.status,
          sr.remarks,
          sr."teacherComment",
          sr."recordedBy",
          sr."createdAt",
          sr."updatedAt",
          l."firstName" AS learner_first_name,
          l."lastName" AS learner_last_name,
          l."admissionNumber" AS learner_admission_number,
          l.grade AS learner_grade
        FROM summative_results sr
        INNER JOIN learners l ON l.id = sr."learnerId"
        WHERE sr."testId" = ${testId}
        ORDER BY sr."marksObtained" DESC
      `);

      results = rawRows.map((row: any) => ({
        id: row.id,
        testId: row.testId,
        learnerId: row.learnerId,
        marksObtained: row.marksObtained,
        percentage: row.percentage,
        grade: row.grade,
        cbcGrade: row.cbcGrade,
        status: row.status,
        remarks: row.remarks,
        teacherComment: row.teacherComment,
        recordedBy: row.recordedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        learner: {
          firstName: row.learner_first_name,
          lastName: row.learner_last_name,
          admissionNumber: row.learner_admission_number,
          grade: row.learner_grade
        }
      }));
    }

    results = results.map(normalizeSummativeResultForResponse);
    await redisCacheService.set(cacheKey, results, RESULTS_CACHE_TTL);

    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error: any) {
    logger.error('Error fetching test results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results',
      error: error.message
    });
  }
};

/**
 * Get Bulk Summative Results for a class/grade/stream
 * GET /api/assessments/summative/results/bulk?grade=...&stream=...&academicYear=...&term=...&testType=...
 */
export const getBulkSummativeResults = async (req: AuthRequest, res: Response) => {
  try {
    const { grade, stream, academicYear, term, testType, testId, testDate } = req.query;

    logger.info('━━━ 📊 [ASSESSMENT] getBulkSummativeResults STARTED', {
      grade, stream, academicYear, term, testType, testId, testDate,
      timestamp: new Date().toISOString()
    });

    if (!grade || !academicYear || !term) {
      return res.status(400).json({ success: false, message: 'Missing required filters: grade, academicYear, term' });
    }

    logger.info('[getBulkSummativeResults] Filters:', { grade, stream, academicYear, term, testType, testId, testDate });

    const parsedTestDate = testDate ? new Date(String(testDate)) : null;

    const normalizedTerm = String(term || '')
      .toUpperCase()
      .replace(/\s+/g, '_');

    const testTypeFilter = testType ? getSummativeTestTypeVariants(String(testType)) : null;

    const whereClause: any = {
      learner: {
        grade: grade as string,
        ...(stream ? { stream: stream as string } : {})
      },
      test: {
        grade: grade as string,          // FIX: scope results to the requested grade only
        academicYear: parseInt(academicYear as string),
        term: normalizedTerm,
        archived: false,
        ...(testId ? { id: String(testId) } : {}),
        ...(parsedTestDate && !Number.isNaN(parsedTestDate.getTime()) ? { testDate: parsedTestDate } : {}),
        ...(testTypeFilter ? { testType: { in: testTypeFilter } } : {})
      }
    };

    logger.info('📋 [ASSESSMENT] Prisma whereClause:', JSON.stringify(whereClause, null, 2));

    let results: any[] = [];
    try {
      results = await prisma.summativeResult.findMany({
        where: whereClause,
        include: {
          learner: {
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, stream: true }
          },
          test: {
            // Avoid selecting enum fields here so legacy enum drift in production data
            // does not crash matrix generation while migrations roll forward.
            select: { id: true, title: true, learningArea: true, learningAreaId: true, totalMarks: true, testType: true }
          }
        },
        orderBy: [
          { learner: { firstName: 'asc' } },
          { test: { learningAreaId: 'asc' } },
          { test: { learningArea: 'asc' } },
          { test: { testDate: 'asc' } }
        ]
      });

      // Legacy-data safety net: some environments stored term as TERM 1 / TERM1.
      // If strict Prisma filtering returns no rows, retry through raw SQL with tolerant term matching.
      if (results.length === 0) {
        const termVariants = Array.from(new Set([
          normalizedTerm,
          normalizedTerm.replace(/_/g, ' '),
          normalizedTerm.replace(/_/g, '')
        ])).filter(Boolean);

        const conditions: Prisma.Sql[] = [
          Prisma.sql`sr.archived = false`,
          Prisma.sql`st.archived = false`,
          Prisma.sql`l.grade = ${String(grade)}`,
          Prisma.sql`st.grade = ${String(grade)}`,
          Prisma.sql`st."academicYear" = ${parseInt(academicYear as string)}`,
          Prisma.sql`st.term::text = ANY(${termVariants})`,
        ];

        if (stream) conditions.push(Prisma.sql`l.stream = ${String(stream)}`);
        if (testId) conditions.push(Prisma.sql`st.id = ${String(testId)}`);
        if (parsedTestDate && !Number.isNaN(parsedTestDate.getTime())) {
          conditions.push(Prisma.sql`st."testDate" = ${parsedTestDate}`);
        }
        if (testTypeFilter) {
          const dbVariants: string[] = [];
          if (testTypeFilter.includes('MID_TERM')) {
            dbVariants.push('MID_TERM', 'MIDTERM');
          } else if (testTypeFilter.includes('END_TERM')) {
            dbVariants.push('END_TERM', 'END_OF_TERM');
          } else {
            dbVariants.push(...testTypeFilter);
          }
          conditions.push(Prisma.sql`st."testType"::text = ANY(${dbVariants})`);
        }

        const rawRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
          SELECT
            sr.id,
            sr."testId",
            sr."learnerId",
            sr."marksObtained",
            sr.percentage,
            sr.grade::text AS grade,
            sr."cbcGrade"::text AS "cbcGrade",
            sr.status,
            sr.remarks,
            sr."teacherComment",
            sr."recordedBy",
            sr."createdAt",
            sr."updatedAt",
            l.id AS learner_id,
            l."firstName" AS learner_first_name,
            l."lastName" AS learner_last_name,
            l."admissionNumber" AS learner_admission_number,
            l.stream AS learner_stream,
            st.id AS test_id,
            st.title AS test_title,
            st."learningArea" AS test_learning_area,
            st."learningAreaId" AS test_learning_area_id,
            st."totalMarks" AS test_total_marks,
            st."testType"::text AS test_test_type
          FROM summative_results sr
          INNER JOIN learners l ON l.id = sr."learnerId"
          INNER JOIN summative_tests st ON st.id = sr."testId"
          WHERE ${Prisma.join(conditions, ' AND ')}
          ORDER BY l."firstName" ASC, st."learningArea" ASC, st."testDate" ASC
        `);

        if (rawRows.length > 0) {
          results = rawRows.map((row: any) => ({
            id: row.id,
            testId: row.testId,
            learnerId: row.learnerId,
            marksObtained: row.marksObtained,
            percentage: row.percentage,
            grade: row.grade,
            cbcGrade: row.cbcGrade,
            status: row.status,
            remarks: row.remarks,
            teacherComment: row.teacherComment,
            recordedBy: row.recordedBy,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            learner: {
              id: row.learner_id,
              firstName: row.learner_first_name,
              lastName: row.learner_last_name,
              admissionNumber: row.learner_admission_number,
              stream: row.learner_stream
            },
            test: {
              id: row.test_id,
              title: row.test_title,
              learningArea: row.test_learning_area,
              learningAreaId: row.test_learning_area_id,
              totalMarks: row.test_total_marks,
              testType: row.test_test_type
            }
          })).map(normalizeSummativeResultForResponse);
        }
      }
    } catch (error: any) {
      const message = String(error?.message || '');
      const enumDrift =
        message.includes('not found in enum') ||
        message.includes('SummativeTestType') ||
        message.includes('expected_type: String') ||
        message.includes('modelName: \'SummativeResult\'') ||
        message.includes('field: \'grade\'');

      if (!enumDrift) {
        throw error;
      }

      logger.warn('[Assessments] Falling back to raw bulk results query due to enum drift:', error?.message);

      const conditions: Prisma.Sql[] = [
        Prisma.sql`sr.archived = false`,
        Prisma.sql`st.archived = false`,
        Prisma.sql`l.grade = ${String(grade)}`,
        Prisma.sql`st.grade = ${String(grade)}`,  // FIX: match grade on test too
        Prisma.sql`st."academicYear" = ${parseInt(academicYear as string)}`,
        Prisma.sql`st.term = ${normalizedTerm}`,
      ];

      if (stream) conditions.push(Prisma.sql`l.stream = ${String(stream)}`);
      if (testId) conditions.push(Prisma.sql`st.id = ${String(testId)}`);
      if (parsedTestDate && !Number.isNaN(parsedTestDate.getTime())) {
        conditions.push(Prisma.sql`st."testDate" = ${parsedTestDate}`);
      }
      if (testTypeFilter) {
        // Map the normalized filter back to what might actually be in the database
        const dbVariants: string[] = [];
        if (testTypeFilter.includes('MID_TERM')) {
          dbVariants.push('MID_TERM', 'MIDTERM');
        } else if (testTypeFilter.includes('END_TERM')) {
          dbVariants.push('END_TERM', 'END_OF_TERM');
        } else {
          dbVariants.push(...testTypeFilter);
        }
        conditions.push(Prisma.sql`st."testType"::text = ANY(${dbVariants})`);
      }

      const rawRows = await prisma.$queryRaw<Array<any>>(Prisma.sql`
        SELECT
          sr.id,
          sr."testId",
          sr."learnerId",
          sr."marksObtained",
          sr.percentage,
          sr.grade::text AS grade,
          sr."cbcGrade"::text AS "cbcGrade",
          sr.status,
          sr.remarks,
          sr."teacherComment",
          sr."recordedBy",
          sr."createdAt",
          sr."updatedAt",
          l.id AS learner_id,
          l."firstName" AS learner_first_name,
          l."lastName" AS learner_last_name,
          l."admissionNumber" AS learner_admission_number,
          l.stream AS learner_stream,
          st.id AS test_id,
          st.title AS test_title,
          st."learningArea" AS test_learning_area,
          st."learningAreaId" AS test_learning_area_id,
          st."totalMarks" AS test_total_marks,
          st."testType"::text AS test_test_type
        FROM summative_results sr
        INNER JOIN learners l ON l.id = sr."learnerId"
        INNER JOIN summative_tests st ON st.id = sr."testId"
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY l."firstName" ASC, st."learningArea" ASC, st."testDate" ASC
      `);

      results = rawRows.map((row: any) => ({
        id: row.id,
        testId: row.testId,
        learnerId: row.learnerId,
        marksObtained: row.marksObtained,
        percentage: row.percentage,
        grade: row.grade,
        cbcGrade: row.cbcGrade,
        status: row.status,
        remarks: row.remarks,
        teacherComment: row.teacherComment,
        recordedBy: row.recordedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        learner: {
          id: row.learner_id,
          firstName: row.learner_first_name,
          lastName: row.learner_last_name,
          admissionNumber: row.learner_admission_number,
          stream: row.learner_stream
        },
        test: {
          id: row.test_id,
          title: row.test_title,
          learningArea: row.test_learning_area,
          learningAreaId: row.test_learning_area_id,
          totalMarks: row.test_total_marks,
          testType: row.test_test_type
        }
      })).map(normalizeSummativeResultForResponse);
    }

    results = results.map(normalizeSummativeResultForResponse);

    results = await filterSummativeResultsBySecondarySelection(results as any[]);

    logger.info('📦 [ASSESSMENT] Results fetched:', {
      resultsCount: results.length,
      filters: { grade, stream, academicYear, term, testType, testId, testDate },
      uniqueLearnerStreams: Array.from(new Set(results.map(r => r.learner?.stream))),
      uniqueTestTypes: Array.from(new Set(results.map(r => r.test?.testType))),
      firstResult: results[0] ? {
        learnerId: results[0].learnerId,
        learnerStream: results[0].learner?.stream,
        testArea: results[0].test?.learningArea,
        marks: results[0].marksObtained
      } : 'NO RESULTS'
    });

    const learnerIds = Array.from(new Set(results.map(r => r.learnerId)));

    const communicationLogs = await prisma.assessmentSmsAudit.findMany({
      where: {
        learnerId: { in: learnerIds },
        term: term as string || undefined,
        academicYear: parseInt(academicYear as string) || undefined,
        assessmentType: 'SUMMATIVE',
        smsStatus: 'SENT'
      },
      select: { learnerId: true, channel: true, sentAt: true },
      orderBy: { sentAt: 'desc' }
    });

    const communications = learnerIds.map((id: string) => {
      const logs = communicationLogs.filter((l: { learnerId: string; channel: string; sentAt: Date }) => l.learnerId === id);
      return {
        learnerId: id,
        hasSentSms: logs.some((log: any) => log.channel === 'SMS'),
        hasSentWhatsApp: logs.some((log: any) => log.channel === 'WHATSAPP'),
        lastSmsAt: logs.find((log: any) => log.channel === 'SMS')?.sentAt,
        lastWhatsAppAt: logs.find((log: any) => log.channel === 'WHATSAPP')?.sentAt
      };
    });

    const isCandidateGrade = ['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(grade as string);
    const predictions: Record<string, any> = {};

    if (isCandidateGrade && learnerIds.length > 0 && req.query.includePredictions === 'true') {
      const CAP = 100;
      if (learnerIds.length > CAP) {
        (predictions as any).__tooLarge = true;
        (predictions as any).__count = learnerIds.length;
      } else {
        await Promise.all(learnerIds.slice(0, CAP).map(async (id: string) => {
          try {
            predictions[id] = await aiAssistantService.generatePathwayPrediction(
              id,
              normalizedTerm,
              parseInt(academicYear as string)
            );
          } catch (e) {
            logger.warn(`Failed to predict pathway for learner ${id}:`, e);
          }
        }));
      }
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      communications,
      predictions
    });

  } catch (error: any) {
    logger.error('Error fetching bulk summative results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bulk results',
      error: error.message
    });
  }
};

/**
 * Record Summative Results (Bulk) — OPTIMISED
 *
 * Key improvements over original:
 * 1. Pre-fetches ALL existing results for the test in ONE query
 * 2. Uses a Map for O(1) existence lookups
 * 3. Re-rank uses raw SQL window function instead of N individual updates
 * 4. Busts the result cache after save
 *
 * POST /api/assessments/summative/results/bulk
 */
export const recordSummativeResultsBulk = async (req: AuthRequest, res: Response) => {
  try {
    const { testId, results } = req.body;
    const recordedBy = req.user?.userId;

    if (!recordedBy) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!testId || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    // ── 1. Fetch test + grading scale ─────────────────────────────────────────
    const test = await prisma.summativeTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        totalMarks: true,
        passMarks: true,
        scaleId: true,
        grade: true,
        learningAreaId: true,
        learningArea: true,
        status: true,
        locked: true,
      }
    });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });

    if (test.status === 'LOCKED' || test.locked === true) {
      return res.status(423).json({
        success: false,
        message: 'This assessment is locked. Request a score unlock before making corrections.'
      });
    }

    const userRoles = new Set([
      req.user?.role,
      ...((req.user?.roles || []) as string[]),
    ].filter(Boolean));
    const canManageAnyResult = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']
      .some(role => userRoles.has(role));

    let gradingSystem;
    if (test.scaleId) {
      gradingSystem = await gradingService.getGradingSystemById(test.scaleId);
    }
    
    const institutionType = getInstitutionType(req);
    
    if (!gradingSystem) {
      const systemType = institutionType === 'SECONDARY' ? 'SECONDARY' : 'SUMMATIVE';
      gradingSystem = await gradingService.getGradingSystem(systemType);
    }
    const ranges = gradingSystem?.ranges;

    // ── 1.5 Fetch CBC grading scale for rating calculation ──────────────────
    const cbcSystem = await gradingService.getGradingSystem('CBC');
    const cbcRanges = cbcSystem?.ranges || [];

    // ── 2. Pre-fetch ALL existing results in ONE query ────────────────────────
    const existingResults = await prisma.summativeResult.findMany({
      where: { testId },
      select: { id: true, learnerId: true, marksObtained: true, assessmentStatusCode: true, recordedBy: true }
    });
    const existingMap = new Map<string, any>(existingResults.map((r: any) => [r.learnerId, r]));

    // ── 2.5 Pre-fetch ALL learner grades for validation ──────────────────────
    const learnerIds = results.map(r => r.learnerId);
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds } },
      select: { id: true, grade: true, admissionNumber: true, institutionType: true }
    });
    const learnerGradeMap = new Map(learners.map((l: { id: string; grade: string; admissionNumber: string }) => [l.id, l]));

    // ── 3. Validate and build upsert payloads ─────────────────────────────────
    const skipped: Array<{ learnerId: string; reason: string }> = [];
    const upsertOps: any[] = [];
    const historyRows: any[] = [];

    let allowedLearnerIds = new Set<string>();
    if (test.learningAreaId) {
      const selections = await prisma.learnerSubjectSelection.findMany({
        where: {
          learnerId: { in: learnerIds },
          learningAreaId: test.learningAreaId,
          active: true,
        },
        select: { learnerId: true },
      });
      allowedLearnerIds = new Set(selections.map((s: { learnerId: string }) => s.learnerId));
    }

    for (const item of results) {
      const learnerData = learnerGradeMap.get(item.learnerId) as { id: string; grade: string; admissionNumber: string; institutionType: string } | undefined;
      
      // Grade Match Guard: Ensure learner grade matches test grade
      if (learnerData && learnerData.grade !== test.grade) {
        skipped.push({ 
          learnerId: item.learnerId, 
          reason: `Grade mismatch: Learner is ${learnerData.grade}, Test is ${test.grade}` 
        });
        continue;
      }

      if (learnerData?.institutionType === 'SECONDARY' && test.learningAreaId && !allowedLearnerIds.has(item.learnerId)) {
        skipped.push({
          learnerId: item.learnerId,
          reason: 'Learner is not enrolled for this subject in pathway profile',
        });
        continue;
      }

      const entry = assertValidAssessmentEntry({
        marksObtained: item.marksObtained,
        rawScore: item.rawScore,
        assessmentStatusCode: item.assessmentStatusCode,
        teacherComment: item.teacherComment,
        totalMarks: test.totalMarks,
      });

      if (!entry.ok) {
        skipped.push({ learnerId: item.learnerId ?? 'unknown', reason: entry.reason });
        continue;
      }

      const performance = entry.kind === 'score'
        ? (() => {
            const percentage = (entry.score / test.totalMarks) * 100;
            const gradeCode = cbcRanges.length > 0 ? gradingService.calculateRatingSync(percentage, cbcRanges) : 'BE2';
            const details = getCbeGradeDetails(gradeCode)!;
            const matchedRange = cbcRanges.find((r: any) => percentage >= r.minPercentage && percentage <= r.maxPercentage)
              || ranges?.find((r: any) => percentage >= r.minPercentage && percentage <= r.maxPercentage);
            return {
              marks: entry.score,
              percentage,
              gradeCode,
              details,
              status: percentage >= test.passMarks ? 'PASS' as const : 'FAIL' as const,
              remarks: item.remarks || matchedRange?.description || matchedRange?.label || details.gradeDescription,
            };
          })()
        : null;

      const adminStatus = entry.kind === 'status' ? getAssessmentStatusDetails(entry.statusCode) : null;

      const existing = existingMap.get(item.learnerId);
      const canUpdate = !existing || canManageAnyResult || existing.recordedBy === recordedBy || userRoles.has('TEACHER');

      if (existing && !canUpdate) {
        skipped.push({ learnerId: item.learnerId, reason: 'Record owned by another teacher. Request a score unlock or ask an academic lead to correct it.' });
        continue;
      }

      upsertOps.push(
        prisma.summativeResult.upsert({
          where: { testId_learnerId: { testId, learnerId: item.learnerId } },
          update: { 
            marksObtained: performance ? Math.round(performance.marks) : null,
            rawScore: performance?.marks ?? null,
            percentage: performance?.percentage ?? null,
            grade: performance?.gradeCode ?? null,
            cbcGrade: performance?.gradeCode ?? null,
            rubricRating: performance?.gradeCode ?? null,
            gradeCode: performance?.gradeCode ?? null,
            achievementLevel: performance?.details.achievementLevel ?? null,
            competencyBand: performance?.details.competencyBand ?? null,
            gradeDescription: performance?.details.gradeDescription ?? null,
            assessmentStatusCode: adminStatus?.code ?? null,
            status: performance?.status ?? null,
            remarks: performance?.remarks ?? adminStatus?.label ?? item.remarks ?? null,
            teacherComment: item.teacherComment,
            moderationComment: item.moderationComment,
            recordedBy
          },
          create: {
            testId,
            learnerId: item.learnerId,
            marksObtained: performance ? Math.round(performance.marks) : null,
            rawScore: performance?.marks ?? null,
            percentage: performance?.percentage ?? null,
            grade: performance?.gradeCode ?? null,
            cbcGrade: performance?.gradeCode ?? null,
            rubricRating: performance?.gradeCode ?? null,
            gradeCode: performance?.gradeCode ?? null,
            achievementLevel: performance?.details.achievementLevel ?? null,
            competencyBand: performance?.details.competencyBand ?? null,
            gradeDescription: performance?.details.gradeDescription ?? null,
            assessmentStatusCode: adminStatus?.code ?? null,
            status: performance?.status ?? null,
            recordedBy,
            remarks: performance?.remarks ?? adminStatus?.label ?? item.remarks ?? null,
            teacherComment: item.teacherComment,
            moderationComment: item.moderationComment,
          },
          select: { id: true, learnerId: true }
        })
      );

      historyRows.push({
        learnerId: item.learnerId,
        action: existing ? 'UPDATE' : 'CREATE',
        oldValue: existing ? (existing.assessmentStatusCode || (existing.marksObtained != null ? String(existing.marksObtained) : null)) : null,
        newValue: adminStatus?.code || (performance ? String(performance.marks) : null),
      });
    }

    if (upsertOps.length === 0) {
      return res.json({
        success: true,
        message: `0 of ${results.length} results saved`,
        ...(skipped.length ? { warnings: `${skipped.length} entries skipped`, skipped } : {})
      });
    }

    // ── 4. Run all upserts in a single transaction ────────────────────────────
    const savedResults = await prisma.$transaction(upsertOps);

    // ── 5. Write history rows (non-blocking, best-effort) ─────────────────────
    const resultIdMap = new Map(savedResults.map((r: any) => [r.learnerId, r.id]));
    const historyData = historyRows
      .map(h => ({
        resultId: resultIdMap.get(h.learnerId),
        action: h.action,
        field: 'marksObtained',
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: recordedBy,
        reason: 'Summative result recorded via bulk API',
        changeTimestamp: new Date(),
      }))
      .filter(h => h.resultId);

    if (historyData.length > 0) {
      prisma.summativeResultHistory.createMany({ data: historyData as any }).catch((e: any) =>
        logger.warn('[BulkSave] History write failed (non-critical):', e.message)
      );
    }

    // ── 6. Re-rank via raw SQL window function (fire-and-forget) ─────────────
    _rerankTestResultsAsync(testId);

    // ── 7. Bust result cache ──────────────────────────────────────────────────
    await invalidateSummativeResultCache(testId);

    const response: any = {
      success: true,
      message: `Successfully recorded ${savedResults.length} of ${results.length} results`
    };
    if (skipped.length > 0) {
      response.warnings = `${skipped.length} entries were skipped`;
      response.skipped = skipped;
    }

    res.json(response);

  } catch (error: any) {
    logger.error('Error bulk recording summative results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record results',
      error: error.message
    });
  }
};

/**
 * Re-rank results asynchronously (fire-and-forget).
 * Runs AFTER the response is sent so it never adds latency.
 */
function _rerankTestResultsAsync(testId: string) {
  setImmediate(async () => {
    try {
      await prisma.$executeRaw`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "achievementLevel" DESC, "marksObtained" DESC) AS pos,
                 COUNT(*) OVER () AS total
          FROM summative_results
          WHERE "testId" = ${testId}
            AND "assessmentStatusCode" IS NULL
            AND "achievementLevel" IS NOT NULL
        )
        UPDATE summative_results sr
        SET position = r.pos, "outOf" = r.total
        FROM ranked r
        WHERE sr.id = r.id
      `;
      await prisma.summativeResult.updateMany({
        where: { testId, OR: [{ assessmentStatusCode: { not: null } }, { achievementLevel: null }] },
        data: { position: null, outOf: null },
      });
    } catch (e: any) {
      logger.warn('[Rerank] Background re-rank failed (non-critical):', e.message);
    }
  });
}


/**
 * PATCH /api/assessments/summative/results/:id/snapshot
 * Saves a base64 paper snapshot as proof for a summative result.
 * Only the recorder or admin roles may attach/replace a snapshot.
 */
export const uploadResultSnapshot = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { snapshotUrl } = req.body;
    const userId = req.user!.userId;

    if (!snapshotUrl) {
      throw new ApiError(400, 'snapshotUrl is required (base64 data URL)');
    }

    // Verify the result exists and the caller can update it.
    const result = await prisma.summativeResult.findUnique({
      where: { id },
      select: { id: true, recordedBy: true },
    });
    if (!result) throw new ApiError(404, 'Result not found');

    const canManageSnapshot = result.recordedBy === userId || ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(req.user?.role || '');
    if (!canManageSnapshot) {
      throw new ApiError(403, 'Only the result recorder or an administrator can save a snapshot');
    }

    // Store the snapshot URL in the orphanFields JSON column.
    const existing = await prisma.summativeResult.findUnique({
      where: { id },
      select: { orphanFields: true },
    });

    const orphanFields: Record<string, any> = (existing?.orphanFields as Record<string, any>) || {};
    orphanFields.paperSnapshotUrl = snapshotUrl;
    orphanFields.paperSnapshotUploadedBy = userId;
    orphanFields.paperSnapshotUploadedAt = new Date().toISOString();

    const updated = await prisma.summativeResult.update({
      where: { id },
      data: { orphanFields },
      select: { id: true, orphanFields: true },
    });

    res.json({
      success: true,
      message: 'Paper snapshot saved successfully',
      data: {
        id: updated.id,
        paperSnapshotUrl: snapshotUrl,
      },
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    logger.error('Error saving paper snapshot:', error);
    throw new ApiError(500, 'Failed to save snapshot: ' + error.message);
  }
};
