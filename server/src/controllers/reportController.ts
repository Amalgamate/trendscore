/**
 * Report Controller
 * Handles comprehensive assessment reporting
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Term } from '@prisma/client';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { gradingService } from '../services/grading.service';
import { parentAccessService } from '../services/parent-access.service';
import { getInstitutionType } from '../utils/institutionNormalizer';
import * as reportService from '../services/report.service';

import logger from '../utils/logger';
const CATEGORY_BUCKETS = ['STEM', 'SOCIAL', 'ARTS'] as const;

/**
 * Canonical grading vocabulary for this module (Batch 1, Assessment UX Overhaul):
 * `cbcGrade` (the school-configured CBC band, e.g. EE/ME/AE/BE) is the PRIMARY
 * grade shown to parents/students. `percentage` is supporting detail only.
 * Legacy 8-4-4-style letter grades must not be computed or displayed for CBC
 * learners — use `cbcGrade`/`gradeCode` wherever a grade badge is needed.
 */

/**
 * Verify the requester is allowed to view this learner's assessment data.
 * STUDENT → self only. PARENT → own children only (via parentAccessService,
 * which also covers linked family accounts). All other roles (TEACHER,
 * HEAD_TEACHER, ADMIN, SUPER_ADMIN, HEAD_OF_CURRICULUM) are unrestricted.
 * Throws ApiError(401/403) if access is not permitted.
 */
async function assertLearnerAccess(req: AuthRequest, learnerId: string): Promise<void> {
  const role = req.user?.role ?? '';
  const userId = req.user?.userId;

  if (role === 'STUDENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    const selfLearner = user?.username
      ? await prisma.learner.findUnique({ where: { admissionNumber: user.username }, select: { id: true } })
      : null;
    if (!selfLearner || selfLearner.id !== learnerId) {
      throw new ApiError(403, 'Access denied: not your own record');
    }
    return;
  }

  if (role === 'PARENT') {
    if (!userId) throw new ApiError(401, 'Authentication required');
    const accessibleLearnerIds = await parentAccessService.getAccessibleLearnerIds(userId);
    if (!accessibleLearnerIds.includes(learnerId)) {
      throw new ApiError(403, 'Access denied: not your child');
    }
    return;
  }

  // TEACHER / HEAD_TEACHER / ADMIN / SUPER_ADMIN / HEAD_OF_CURRICULUM: unrestricted
}

type SummativeWithTestArea = { learnerId: string; test?: { learningAreaId?: string | null } | null };

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
    if (!selected || selected.size === 0) return true;
    const learningAreaId = result.test?.learningAreaId;
    return Boolean(learningAreaId && selected.has(learningAreaId));
  });
}

function normalizeCategoryBucket(input?: string | null): 'STEM' | 'SOCIAL' | 'ARTS' | null {
  const value = String(input || '').trim().toUpperCase();
  if (!value) return null;
  if (value.includes('STEM')) return 'STEM';
  if (value.includes('SOCIAL')) return 'SOCIAL';
  if (value.includes('ART')) return 'ARTS';
  return null;
}

export const reportController = {
  /**
   * Get Comprehensive Formative Report for a Learner
   */
  getFormativeReport: async (req: AuthRequest, res: Response) => {
    try {
      const { learnerId } = req.params;
      const { term, academicYear } = req.query;

      if (!term || !academicYear) {
        throw new ApiError(400, 'Term and academic year are required');
      }

      await assertLearnerAccess(req, learnerId);

      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          admissionNumber: true,
          grade: true,
          stream: true,
          dateOfBirth: true,
          gender: true
        }
      });

      if (!learner) {
        throw new ApiError(404, 'Learner not found');
      }

      const assessments = await prisma.formativeAssessment.findMany({
        where: {
          learnerId,
          term: term as Term,
          academicYear: parseInt(academicYear as string)
        },
        include: {
          learningAreaRef: {
            select: { id: true, name: true, pathway: true, category: true, isCore: true }
          },
          teacher: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: [{ learningAreaId: 'asc' }, { learningArea: 'asc' }]
      });

      const summary = calculateFormativeSummary(assessments);

      const teacherComment = await prisma.termlyReportComment.findFirst({
        where: {
          learnerId,
          term: term as Term,
          academicYear: parseInt(academicYear as string)
        }
      });

      res.json({
        success: true,
        data: {
          learner,
          term,
          academicYear: parseInt(academicYear as string),
          assessments,
          summary,
          teacherComment,
          generatedDate: new Date(),
          totalAssessments: assessments.length
        }
      });

    } catch (error: any) {
      logger.error('Error generating formative report:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate formative report'
      });
    }
  },

  /**
   * Get Comprehensive Summative Report for a Learner
   */
  getSummativeReport: async (req: AuthRequest, res: Response) => {
    try {
      const { learnerId } = req.params;
      const { term, academicYear } = req.query;

      if (!term || !academicYear) {
        throw new ApiError(400, 'Term and academic year are required');
      }

      await assertLearnerAccess(req, learnerId);

      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        include: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            }
          }
        }
      });

      if (!learner) {
        throw new ApiError(404, 'Learner not found');
      }

      const institutionType = getInstitutionType(req);
      const systemType = institutionType === 'SECONDARY' ? 'SECONDARY' : 'SUMMATIVE';
      const gradingSystem = await gradingService.getGradingSystem(systemType);
      const ranges = gradingSystem?.ranges || [];

      const results = await prisma.summativeResult.findMany({
        where: {
          learnerId,
          test: {
            term: term as Term,
            academicYear: parseInt(academicYear as string)
          }
        },
        include: {
          test: {
            select: {
              title: true,
              learningArea: true,
              learningAreaId: true,
              learningAreaRef: { select: { id: true, name: true, pathway: true, category: true, isCore: true } },
              testDate: true,
              totalMarks: true,
              passMarks: true
            }
          },
          recorder: {
            select: { firstName: true, lastName: true }
          }
        },
        orderBy: [
          { test: { learningAreaId: 'asc' } },
          { test: { learningArea: 'asc' } },
          { test: { testDate: 'asc' } }
        ]
      });

      const filteredResults = await filterSummativeResultsBySecondarySelection(results as any[]);
      const subjectSummary = calculateSubjectSummary(filteredResults, ranges);

      res.json({
        success: true,
        data: {
          learner,
          term,
          academicYear: parseInt(academicYear as string),
          results: filteredResults,
          subjectSummary,
          generatedDate: new Date()
        }
      });

    } catch (error: any) {
      logger.error('Error generating summative report:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate summative report'
      });
    }
  },

  /**
   * Get Complete Termly Report for a Learner
   */
  getTermlyReport: async (req: AuthRequest, res: Response) => {
    try {
      const { learnerId } = req.params;
      const { term, academicYear } = req.query;

      if (!term || !academicYear) {
        throw new ApiError(400, 'Term and academic year are required');
      }

      await assertLearnerAccess(req, learnerId);

      const report = await reportService.generateTermlyReport(
        learnerId,
        term as Term,
        parseInt(academicYear as string)
      );

      res.json({
        success: true,
        data: report
      });

    } catch (error: any) {
      logger.error('Error generating termly report:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate termly report'
      });
    }
  },

  /**
   * Get Class Performance Analytics
   */
  getClassAnalytics: async (req: AuthRequest, res: Response) => {
    try {
      const { classId } = req.params;
      const { term, academicYear } = req.query;

      if (!term || !academicYear) {
        throw new ApiError(400, 'Term and academic year are required');
      }

      const yearValue = parseInt(academicYear as string);

      const classInfo = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          enrollments: { where: { active: true } }
        }
      });

      if (!classInfo) {
        throw new ApiError(404, 'Class not found');
      }

      const learnerIds = classInfo.enrollments.map((e: any) => e.learnerId);

      const [formative, summativeRaw] = await Promise.all([
        prisma.formativeAssessment.findMany({
          where: { learnerId: { in: learnerIds }, term: term as Term, academicYear: yearValue },
          include: { learningAreaRef: { select: { id: true, pathway: true, category: true, isCore: true } } }
        }),
        prisma.summativeResult.findMany({
          where: { learnerId: { in: learnerIds }, test: { term: term as Term, academicYear: yearValue } },
          include: { test: { select: { learningArea: true, learningAreaId: true, totalMarks: true, learningAreaRef: { select: { id: true, pathway: true, category: true, isCore: true } } } } }
        })
      ]);
      const summative = await filterSummativeResultsBySecondarySelection(summativeRaw as any[]);

      res.json({
        success: true,
        data: {
          class: classInfo,
          learnerCount: learnerIds.length,
          formative: analyzeFormativePerformance(formative),
          summative: analyzeSummativePerformance(summative)
        }
      });

    } catch (error: any) {
      logger.error('Error generating class analytics:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to generate class analytics'
      });
    }
  },

  /**
   * Get Individual Learner Analytics (cross-term trends)
   */
  getLearnerAnalytics: async (req: AuthRequest, res: Response) => {
    try {
      const { learnerId } = req.params;
      const { academicYear } = req.query;

      if (!academicYear) {
        throw new ApiError(400, 'Academic year is required');
      }

      await assertLearnerAccess(req, learnerId);

      const yearValue = parseInt(academicYear as string);

      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: {
          id: true, firstName: true, lastName: true,
          admissionNumber: true, grade: true, stream: true
        }
      });

      if (!learner) throw new ApiError(404, 'Learner not found');

      // Fetch all summative results for the year across all 3 terms
      const summativeResultsRaw = await prisma.summativeResult.findMany({
        where: {
          learnerId,
          test: { academicYear: yearValue, archived: false }
        },
        include: {
          test: {
            select: {
              learningArea: true,
              learningAreaId: true,
              learningAreaRef: { select: { id: true, name: true, pathway: true, category: true, isCore: true } },
              term: true,
              totalMarks: true,
              testType: true
            }
          }
        },
        orderBy: { test: { term: 'asc' } }
      });
      const summativeResults = await filterSummativeResultsBySecondarySelection(summativeResultsRaw as any[]);

      // Fetch all formative results for the year
      const formativeResults = await prisma.formativeAssessment.findMany({
        where: { learnerId, academicYear: yearValue, archived: false },
        orderBy: { term: 'asc' }
      });

      // Cross-term trend per learning area
      const subjectTrends: Record<string, any> = {};
      for (const r of summativeResults) {
        const key = r.test.learningAreaId ? `id:${r.test.learningAreaId}` : `name:${r.test.learningArea}`;
        const display = r.test.learningAreaRef?.name || r.test.learningArea;
        if (!subjectTrends[key]) {
          subjectTrends[key] = {
            learningArea: display,
            learningAreaId: r.test.learningAreaId ?? null,
            learningAreaMeta: r.test.learningAreaRef
              ? {
                  pathway: r.test.learningAreaRef.pathway ?? null,
                  category: r.test.learningAreaRef.category ?? null,
                  isCore: Boolean(r.test.learningAreaRef.isCore)
                }
              : null,
            termResults: []
          };
        }
        subjectTrends[key].termResults.push({
          term: r.test.term,
          testType: r.test.testType,
          marksObtained: r.marksObtained,
          totalMarks: r.test.totalMarks,
          percentage: r.percentage,
          grade: r.grade,
          cbcGrade: (r as any).cbcGrade ?? null,
          teacherComment: (r as any).teacherComment ?? null,
          remarks: (r as any).remarks ?? null,
          status: r.status
        });
      }

      // Overall term averages
      const termAverages: Record<string, { totalPercentage: number; count: number; average?: number }> = {};
      for (const r of summativeResults) {
        const term = r.test.term;
        if (!termAverages[term]) termAverages[term] = { totalPercentage: 0, count: 0 };
        termAverages[term].totalPercentage += r.percentage;
        termAverages[term].count++;
      }
      for (const term of Object.keys(termAverages)) {
        const t = termAverages[term];
        t.average = t.count > 0 ? Math.round((t.totalPercentage / t.count) * 100) / 100 : 0;
      }

      // Formative summary per term
      const formativeSummary: Record<string, any> = {};
      for (const f of formativeResults) {
        const term = f.term;
        if (!formativeSummary[term]) {
          formativeSummary[term] = { EE: 0, ME: 0, AE: 0, BE: 0, total: 0 };
        }
        if (f.overallRating) {
          formativeSummary[term][f.overallRating] = (formativeSummary[term][f.overallRating] || 0) + 1;
        }
        formativeSummary[term].total++;
      }

      res.json({
        success: true,
        data: {
          learner,
          academicYear: yearValue,
          subjectTrends: Object.values(subjectTrends),
          termAverages,
          formativeSummary,
          totalSummativeResults: summativeResults.length,
          totalFormativeResults: formativeResults.length
        }
      });

    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get learner analytics'
      });
    }
  },

};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateFormativeSummary(assessments: any[]) {
  const distribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  let totalPoints = 0;
  const byLearningArea: Record<string, { learningArea: string; learningAreaId: string | null; learningAreaMeta: any; EE: number; ME: number; AE: number; BE: number; count: number }> = {};

  for (const a of assessments) {
    if (a.overallRating) {
      distribution[a.overallRating] = (distribution[a.overallRating] || 0) + 1;
    }
    if (a.points) totalPoints += a.points;

    const key = a.learningAreaId ? `id:${a.learningAreaId}` : `name:${a.learningArea}`;
    const display = a.learningAreaRef?.name || a.learningArea;
    if (!byLearningArea[key]) {
      byLearningArea[key] = {
        learningArea: display,
        learningAreaId: a.learningAreaId ?? null,
        learningAreaMeta: a.learningAreaRef
          ? {
              pathway: a.learningAreaRef.pathway ?? null,
              category: a.learningAreaRef.category ?? null,
              isCore: Boolean(a.learningAreaRef.isCore)
            }
          : null,
        EE: 0, ME: 0, AE: 0, BE: 0, count: 0
      };
    }
    if (a.overallRating) {
      byLearningArea[key][a.overallRating as keyof typeof byLearningArea[string]]++;
    }
    byLearningArea[key].count++;
  }

  // Determine predominant rating per area
  const dominantRatingByArea: Record<string, string> = {};
  for (const [area, counts] of Object.entries(byLearningArea)) {
    const { count, ...ratings } = counts;
    dominantRatingByArea[area] = Object.entries(ratings).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ME';
  }

  return {
    distribution,
    averagePoints: assessments.length > 0 ? Math.round((totalPoints / assessments.length) * 100) / 100 : 0,
    byLearningArea,
    dominantRatingByArea
  };
}

function calculateSubjectSummary(results: any[], ranges: any[]) {
  const summary: Record<string, any> = {};
  const performanceResults = results.filter((r) => !r.assessmentStatusCode && r.percentage !== null && r.percentage !== undefined);

  for (const r of performanceResults) {
    const key = r.test.learningAreaId ? `id:${r.test.learningAreaId}` : `name:${r.test.learningArea}`;
    const display = r.test.learningAreaRef?.name || r.test.learningArea;
    if (!summary[key]) {
      summary[key] = {
        learningArea: display,
        learningAreaId: r.test.learningAreaId ?? null,
        learningAreaMeta: r.test.learningAreaRef
          ? {
              pathway: r.test.learningAreaRef.pathway ?? null,
              category: r.test.learningAreaRef.category ?? null,
              isCore: Boolean(r.test.learningAreaRef.isCore)
            }
          : null,
        tests: [],
        averagePercentage: 0,
        grade: 'BE2',
        passCount: 0,
        failCount: 0
      };
    }
    summary[key].tests.push(r);
    if (r.status === 'PASS') summary[key].passCount++;
    else summary[key].failCount++;
  }

  for (const key of Object.keys(summary)) {
    const tests = summary[key].tests as any[];
    const avg = tests.reduce((sum: number, t: any) => sum + t.percentage, 0) / tests.length;
    summary[key].averagePercentage = Math.round(avg * 100) / 100;
    summary[key].grade = gradingService.calculateGradeSync(avg, ranges);
    summary[key].passRate = tests.length > 0 ? Math.round((summary[key].passCount / tests.length) * 100) : 0;
  }

  const byCategory: Record<string, { total: number; count: number }> = {};
  Object.values(summary).forEach((row: any) => {
    const bucket =
      normalizeCategoryBucket(row?.learningAreaMeta?.category) ||
      normalizeCategoryBucket(row?.learningAreaMeta?.pathway);
    if (!bucket) return;
    if (!byCategory[bucket]) byCategory[bucket] = { total: 0, count: 0 };
    byCategory[bucket].total += Number(row.averagePercentage || 0);
    byCategory[bucket].count += 1;
  });

  const byCategoryAverages = CATEGORY_BUCKETS
    .filter((bucket) => byCategory[bucket]?.count > 0)
    .map((bucket) => {
      const data = byCategory[bucket];
      const averagePercentage = Math.round(data.total / data.count);
      return {
        category: bucket,
        averagePercentage,
        grade: gradingService.calculateGradeSync(averagePercentage, ranges),
        subjectCount: data.count,
      };
    });

  return { ...summary, byCategoryAverages };
}

function analyzeFormativePerformance(assessments: any[]) {
  const distribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  const byLearningArea: Record<string, Record<string, number>> = {};

  for (const a of assessments) {
    if (a.overallRating) {
      distribution[a.overallRating] = (distribution[a.overallRating] || 0) + 1;
    }

    const key = a.learningAreaId ? `id:${a.learningAreaId}` : `name:${a.learningArea}`;
    const display = a.learningAreaRef?.name || a.learningArea;
    if (!byLearningArea[key]) {
      byLearningArea[key] = {
        learningArea: display,
        learningAreaId: a.learningAreaId ?? null,
        pathway: a.learningAreaRef?.pathway ?? null,
        category: a.learningAreaRef?.category ?? null,
        isCore: a.learningAreaRef ? Number(Boolean(a.learningAreaRef.isCore)) : 0,
        EE: 0, ME: 0, AE: 0, BE: 0, total: 0
      } as any;
    }
    if (a.overallRating) {
      byLearningArea[key][a.overallRating] = (byLearningArea[key][a.overallRating] || 0) + 1;
    }
    byLearningArea[key].total = (byLearningArea[key].total || 0) + 1;
  }

  const eeRate = assessments.length > 0
    ? Math.round(((distribution.EE + distribution.ME) / assessments.length) * 100)
    : 0;

  return {
    count: assessments.length,
    distribution,
    byLearningArea,
    meetingOrExceedingRate: eeRate   // % learners rated EE or ME
  };
}

function analyzeSummativePerformance(results: any[]) {
  const performanceResults = results.filter((r) => !r.assessmentStatusCode && r.percentage !== null && r.percentage !== undefined);
  const statusCounts = results.reduce((acc: Record<string, number>, r: any) => {
    if (r.assessmentStatusCode) acc[r.assessmentStatusCode] = (acc[r.assessmentStatusCode] || 0) + 1;
    return acc;
  }, {});

  if (performanceResults.length === 0) {
    return {
      count: 0,
      averagePercentage: 0,
      passRate: 0,
      byLearningArea: {},
      gradeDistribution: {},
      statusCounts,
      exclusionNote: 'Administrative status codes are excluded from learner performance calculations.'
    };
  }

  const byLearningArea: Record<string, any> = {};
  const gradeDistribution: Record<string, number> = {};

  let totalPercentage = 0;
  let passCount = 0;

  for (const r of performanceResults) {
    totalPercentage += r.percentage ?? 0;
    if (r.status === 'PASS') passCount++;

    const gradeCode = r.gradeCode || r.cbcGrade || r.grade;
    if (gradeCode) {
      gradeDistribution[gradeCode] = (gradeDistribution[gradeCode] || 0) + 1;
    }

    const area = (r.test?.learningAreaId ? `id:${r.test.learningAreaId}` : (r.test?.learningArea ?? 'Unknown'));
    const displayName = r.test?.learningArea ?? 'Unknown';
    const meta = r.test?.learningAreaRef ? { pathway: r.test.learningAreaRef.pathway ?? null, category: r.test.learningAreaRef.category ?? null, isCore: Boolean(r.test.learningAreaRef.isCore) } : null;
    if (!byLearningArea[area]) {
      byLearningArea[area] = { learningArea: displayName, learningAreaId: r.test?.learningAreaId ?? null, meta, totalPercentage: 0, count: 0, passCount: 0, average: 0, passRate: 0 };
    }
    byLearningArea[area].totalPercentage += r.percentage ?? 0;
    byLearningArea[area].count++;
    if (r.status === 'PASS') byLearningArea[area].passCount++;
  }

  for (const area of Object.keys(byLearningArea)) {
    const a = byLearningArea[area];
    a.average = Math.round((a.totalPercentage / a.count) * 100) / 100;
    a.passRate = Math.round((a.passCount / a.count) * 100);
    delete a.totalPercentage;
  }

  return {
    count: performanceResults.length,
    averagePercentage: Math.round((totalPercentage / performanceResults.length) * 100) / 100,
    passRate: Math.round((passCount / performanceResults.length) * 100),
    byLearningArea,
    gradeDistribution,
    statusCounts,
    exclusionNote: 'Administrative status codes are excluded from learner performance calculations.'
  };
}
