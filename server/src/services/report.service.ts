import { Term, DetailedRubricRating } from '@prisma/client';
import prisma from '../config/database';
import * as rubricUtil from '../utils/rubric.util';
import { gradingService } from './grading.service';
import { calculationService } from './calculation.service';
import { aiAssistantService } from './ai-assistant.service';

const LEGACY_SUMMATIVE_CBC_GRADES: string[] = ['A', 'B', 'C', 'D', 'E'];
const CATEGORY_BUCKETS = ['STEM', 'SOCIAL', 'ARTS'] as const;

function isValidCbcGrade(value: string | null | undefined, cbcRanges?: any[]): boolean {
  if (!value) return false;
  if (cbcRanges) {
    return cbcRanges.some((range: any) => range.rubricRating === value);
  }
  return !LEGACY_SUMMATIVE_CBC_GRADES.includes(value);
}

function normalizeCategoryBucket(input?: string | null): 'STEM' | 'SOCIAL' | 'ARTS' | null {
  const value = String(input || '').trim().toUpperCase();
  if (!value) return null;
  if (value.includes('STEM')) return 'STEM';
  if (value.includes('SOCIAL')) return 'SOCIAL';
  if (value.includes('ART')) return 'ARTS';
  return null;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface LearnerInfo {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  admissionNumber: string;
  grade: string;
  stream: string | null;
  dateOfBirth: Date | null;
  gender: string;
  parent?: {
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  } | null;
  institutionType?: string;
}

export interface FormativeAssessmentData {
  id: string;
  learningArea: string;
  learningAreaId?: string | null;
  learningAreaMeta?: {
    pathway?: string | null;
    category?: string | null;
    isCore?: boolean;
  } | null;
  strand: string | null;
  subStrand: string | null;
  detailedRating: DetailedRubricRating | null;
  percentage: number | null;
  points: number | null;
  strengths: string | null;
  areasImprovement: string | null;
  remarks: string | null;
  teacher: {
    firstName: string;
    lastName: string;
  };
  type?: string;
}

export interface SummativeResultData {
  id: string;
  marksObtained: number | null;
  percentage: number | null;
  grade: string | null;
  cbcGrade?: string | null;
  gradeCode?: string | null;
  achievementLevel?: number | null;
  assessmentStatusCode?: string | null;
  status: string | null;
  position: number | null;
  outOf: number | null;
  teacherComment: string | null;
  test: {
    title: string;
    learningArea: string;
    learningAreaId?: string | null;
    learningAreaMeta?: {
      pathway?: string | null;
      category?: string | null;
      isCore?: boolean;
    } | null;
    totalMarks: number;
    passMarks: number;
    testDate: Date;
  };
}

export interface CoreCompetencyData {
  communication: DetailedRubricRating;
  communicationComment: string | null;
  criticalThinking: DetailedRubricRating;
  criticalThinkingComment: string | null;
  creativity: DetailedRubricRating;
  creativityComment: string | null;
  collaboration: DetailedRubricRating;
  collaborationComment: string | null;
  citizenship: DetailedRubricRating;
  citizenshipComment: string | null;
  learningToLearn: DetailedRubricRating;
  learningToLearnComment: string | null;
  assessor?: {
    firstName: string;
    lastName: string;
  };
}

export interface ValuesData {
  love: DetailedRubricRating;
  responsibility: DetailedRubricRating;
  respect: DetailedRubricRating;
  unity: DetailedRubricRating;
  peace: DetailedRubricRating;
  patriotism: DetailedRubricRating;
  integrity: DetailedRubricRating;
  comment: string | null;
}

export interface CoCurricularData {
  id: string;
  activityName: string;
  activityType: string;
  performance: DetailedRubricRating;
  achievements: string | null;
  remarks: string | null;
}

export interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  sick: number;
  attendancePercentage: number;
}

export interface TermlyReportData {
  learner: LearnerInfo;
  term: Term;
  academicYear: number;
  formative: {
    assessments: FormativeAssessmentData[];
    summary: any;
  };
  summative: {
    results: SummativeResultData[];
    summary: any;
  };
  attendance: AttendanceSummary;
  coreCompetencies: CoreCompetencyData | null;
  values: ValuesData | null;
  coCurricular: CoCurricularData[];
  comments: any;
  overallPerformance: any;
  learnerPathway?: any;
  subjectSelection?: any;
  strengthsWeaknesses?: any;
  pathwayPrediction?: any;
  generatedDate: Date;
}

// ============================================
// GRADES ELIGIBLE FOR PATHWAY PREDICTION
// Client requirement: strictly Grade 7, 8, 9 only.
// ============================================
const PATHWAY_ELIGIBLE_GRADES = ['GRADE_7', 'GRADE_8', 'GRADE_9'] as const;

// ============================================
// TERM → APPROXIMATE DATE RANGES
// Used to filter attendance when no TermConfig row exists.
// Term 1 = Jan–Apr, Term 2 = May–Aug, Term 3 = Sep–Dec.
// ============================================
function termDateRange(term: Term, academicYear: number): { gte: Date; lte: Date } {
  const ranges: Record<Term, [number, number, number, number]> = {
    TERM_1: [1, 1, 4, 30],
    TERM_2: [5, 1, 8, 31],
    TERM_3: [9, 1, 12, 31],
  };
  const [startMonth, startDay, endMonth, endDay] = ranges[term];
  return {
    gte: new Date(academicYear, startMonth - 1, startDay),
    lte: new Date(academicYear, endMonth - 1, endDay, 23, 59, 59),
  };
}

// ============================================
// MAIN SERVICE FUNCTION
// ============================================

export async function generateTermlyReport(
  learnerId: string,
  term: Term,
  academicYear: number
): Promise<TermlyReportData> {
  const learner = await fetchLearnerInfo(learnerId);

  const systemType = learner.institutionType === 'SECONDARY' ? 'SECONDARY' : 'SUMMATIVE';
  const summativeSystem = await gradingService.getGradingSystem(systemType);
  const cbcSystem = await gradingService.getGradingSystem('CBC');

  const enrollment = await prisma.classEnrollment.findFirst({
    where: { learnerId, active: true },
    orderBy: { enrolledAt: 'desc' }
  });
  const classId = enrollment?.classId || '';

  const [
    formativeAssessments,
    summativeResults,
    attendanceRecords,
    coreCompetencies,
    valuesAssessment,
    coCurricularActivities,
    reportComments
  ] = await Promise.all([
    fetchFormativeAssessments(learnerId, term, academicYear),
    fetchSummativeResults(learnerId, term, academicYear),
    fetchAttendanceRecords(learnerId, term, academicYear),
    fetchCoreCompetencies(learnerId, term, academicYear),
    fetchValuesAssessment(learnerId, term, academicYear),
    fetchCoCurricularActivities(learnerId, term, academicYear),
    fetchReportComments(learnerId, term, academicYear)
  ]);

  if (!cbcSystem || !summativeSystem) {
    throw new Error('Grading systems not initialized');
  }

  const formativeSummary = await calculateFormativeSummaryWithService(
    learnerId,
    classId,
    term,
    academicYear,
    formativeAssessments,
    cbcSystem.ranges
  );

  const summativeSummary = calculateSummativeSummary(summativeResults, summativeSystem.ranges, cbcSystem.ranges);
  const attendanceSummary = calculateAttendanceSummary(attendanceRecords);

  const strengthsWeaknesses = (() => {
    const subjects = (summativeSummary?.bySubject || []) as Array<{ subject: string; averagePercentage: number; cbcGrade?: string }>;
    const sorted = [...subjects].sort((a, b) => (b.averagePercentage || 0) - (a.averagePercentage || 0));
    const strengths = sorted.slice(0, 3);
    const weaknesses = [...sorted].reverse().slice(0, 3);
    return { strengths, weaknesses };
  })();

  // If learner is Senior Secondary, include selected pathway and subject selections.
  const learnerRecord = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: {
      institutionType: true,
      pathway: { select: { id: true, code: true, name: true } },
      subjectSelections: {
        where: { active: true },
        select: { learningArea: { select: { id: true, name: true, shortName: true, isCore: true, pathway: true, category: true } } },
        orderBy: { createdAt: 'asc' },
      },
    }
  });

  const overallPerformance = await calculateOverallPerformanceWithWeights(
    learnerId,
    classId,
    term,
    academicYear,
    formativeSummary,
    summativeSummary,
    coreCompetencies,
    valuesAssessment,
    attendanceSummary
  );

  // ── Pathway prediction — Grade 7, 8, 9 only (client requirement) ──────────
  let pathwayPrediction: any = null;

  if (PATHWAY_ELIGIBLE_GRADES.includes(learner.grade as any)) {
    try {
      pathwayPrediction = await aiAssistantService.generatePathwayPrediction(
        learnerId,
        term as string,
        academicYear
      );
    } catch (e: any) {
      console.warn('[PathwayPrediction] Failed:', e?.message || e);
      // Deterministic service — this only fires on unexpected DB errors.
      // Return a neutral pending state rather than crashing the whole report.
      pathwayPrediction = {
        predictedPathway: 'Analysis Pending',
        confidence: 0,
        justification:
          'Could not compute pathway analysis. Please ensure all subject results are recorded for this term.',
        careerRecommendations: ['Contact the class teacher for guidance'],
        growthAreas: ['Ensure all subject scores are entered for this term'],
        clusterBreakdown: { STEM: 0, Social: 0, Arts: 0 },
      };
    }
  }

  return {
    learner,
    term,
    academicYear,
    formative: {
      assessments: formativeAssessments,
      summary: formativeSummary
    },
    summative: {
      results: summativeResults,
      summary: summativeSummary
    },
    attendance: attendanceSummary,
    coreCompetencies,
    values: valuesAssessment,
    coCurricular: coCurricularActivities,
    comments: reportComments
      ? {
          classTeacher: reportComments.classTeacherComment,
          classTeacherName: reportComments.classTeacherName,
          classTeacherDate: reportComments.classTeacherDate,
          headTeacher: reportComments.headTeacherComment,
          headTeacherName: reportComments.headTeacherName,
          headTeacherDate: reportComments.headTeacherDate,
          nextTermOpens: reportComments.nextTermOpens,
        }
      : null,
    overallPerformance,
    learnerPathway: learnerRecord?.institutionType === 'SECONDARY' ? (learnerRecord?.pathway || null) : null,
    subjectSelection: learnerRecord?.institutionType === 'SECONDARY' ? (learnerRecord?.subjectSelections || []) : [],
    strengthsWeaknesses,
    pathwayPrediction,
    generatedDate: new Date(),
  };
}

// ============================================
// DATA FETCHING FUNCTIONS
// ============================================

async function fetchLearnerInfo(learnerId: string): Promise<LearnerInfo> {
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
      gender: true,
      institutionType: true,
      parent: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      }
    }
  });

  if (!learner) throw new Error(`Learner not found`);
  return learner as LearnerInfo;
}

async function fetchFormativeAssessments(learnerId: string, term: Term, academicYear: number) {
  return await prisma.formativeAssessment.findMany({
    where: { learnerId, term, academicYear },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      learningAreaRef: { select: { id: true, pathway: true, category: true, isCore: true } },
    },
    orderBy: [{ learningAreaId: 'asc' }, { learningArea: 'asc' }]
  });
}

async function fetchSummativeResults(learnerId: string, term: Term, academicYear: number) {
  const results = await prisma.summativeResult.findMany({
    where: { learnerId, test: { term, academicYear } },
    include: {
      test: {
        select: {
          title: true,
          learningArea: true,
          learningAreaId: true,
          totalMarks: true,
          passMarks: true,
          testDate: true,
          learningAreaRef: { select: { id: true, pathway: true, category: true, isCore: true } },
        }
      },
      recorder: { select: { firstName: true, lastName: true } }
    },
    orderBy: [
      { test: { learningAreaId: 'asc' } },
      { test: { learningArea: 'asc' } },
      { test: { testDate: 'asc' } }
    ]
  });

  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: { institutionType: true },
  });

  if (String(learner?.institutionType || '').toUpperCase() !== 'SECONDARY') {
    return results;
  }

  const selections = await prisma.learnerSubjectSelection.findMany({
    where: { learnerId, active: true },
    select: { learningAreaId: true },
  });

  if (!selections.length) return results;
  const selectedAreaIds = new Set(selections.map((s) => s.learningAreaId));

  return results.filter((r: any) => {
    const learningAreaId = r.test?.learningAreaId;
    return Boolean(learningAreaId && selectedAreaIds.has(learningAreaId));
  });
}

/**
 * Fetch attendance records scoped to a specific term.
 *
 * Strategy (in priority order):
 * 1. Look up the TermConfig for the exact term/year — if it has startDate/endDate,
 *    use them for a precise date filter.
 * 2. Fall back to the hard-coded approximate ranges (Jan–Apr / May–Aug / Sep–Dec)
 *    when no TermConfig row exists yet.
 *
 * This ensures the attendance count on a Term 1 report never includes
 * Term 2 or Term 3 records.
 */
async function fetchAttendanceRecords(learnerId: string, term: Term, academicYear: number) {
  // 1. Try to use configured term dates
  const termConfig = await prisma.termConfig.findFirst({
    where: { term, academicYear },
    select: { startDate: true, endDate: true },
  });

  const dateFilter = termConfig
    ? { gte: termConfig.startDate, lte: termConfig.endDate }
    : termDateRange(term, academicYear);

  return await prisma.attendance.findMany({
    where: {
      learnerId,
      date: dateFilter,
    },
    orderBy: { date: 'asc' },
  });
}

async function fetchCoreCompetencies(learnerId: string, term: Term, academicYear: number) {
  return await prisma.coreCompetency.findFirst({
    where: { learnerId, term, academicYear, archived: false },
    include: { assessor: { select: { firstName: true, lastName: true } } }
  });
}

async function fetchValuesAssessment(learnerId: string, term: Term, academicYear: number) {
  return await prisma.valuesAssessment.findFirst({
    where: { learnerId, term, academicYear, archived: false }
  });
}

async function fetchCoCurricularActivities(learnerId: string, term: Term, academicYear: number) {
  return await prisma.coCurricularActivity.findMany({
    where: { learnerId, term, academicYear },
    orderBy: { activityName: 'asc' }
  });
}

async function fetchReportComments(learnerId: string, term: Term, academicYear: number) {
  return await prisma.termlyReportComment.findFirst({
    where: { learnerId, term, academicYear }
  });
}

// ============================================
// CALCULATION HELPERS
// ============================================

async function calculateFormativeSummaryWithService(
  learnerId: string,
  classId: string,
  term: Term,
  academicYear: number,
  assessments: any[],
  ranges?: any[]
) {
  if (assessments.length === 0) return { averagePercentage: 0, byLearningArea: [] };

  const result = await calculationService.calculateOverallFormativeScore({ learnerId, classId, term, academicYear });
  const averagePercentage = Math.round(result.averagePercentage);

  const areaMap = new Map<string, { learningArea: string; learningAreaId: string | null; meta: any; percentages: number[] }>();
  assessments.forEach(a => {
    if (a.percentage !== null) {
      const key = a.learningAreaId ? `id:${a.learningAreaId}` : `name:${a.learningArea}`;
      if (!areaMap.has(key)) {
        areaMap.set(key, {
          learningArea: a.learningAreaRef?.name || a.learningArea,
          learningAreaId: a.learningAreaId ?? null,
          meta: a.learningAreaRef ? {
            pathway: a.learningAreaRef.pathway ?? null,
            category: a.learningAreaRef.category ?? null,
            isCore: Boolean(a.learningAreaRef.isCore),
          } : null,
          percentages: []
        });
      }
      areaMap.get(key)!.percentages.push(a.percentage);
    }
  });

  const byLearningArea = Array.from(areaMap.values()).map((row) => {
    const avg = Math.round(row.percentages.reduce((sum, p) => sum + p, 0) / row.percentages.length);
    return {
      learningArea: row.learningArea,
      learningAreaId: row.learningAreaId,
      learningAreaMeta: row.meta,
      percentage: avg,
      rating: ranges ? gradingService.calculateRatingSync(avg, ranges) : rubricUtil.percentageToDetailedRating(avg)
    };
  });

  return { averagePercentage, byLearningArea };
}

function calculateSummativeSummary(results: any[], summativeRanges?: any[], cbcRanges?: any[]) {
  const performanceResults = results.filter((r) => !r.assessmentStatusCode && r.percentage !== null && r.percentage !== undefined);
  const statusCounts = results.reduce((acc: Record<string, number>, r) => {
    if (r.assessmentStatusCode) acc[r.assessmentStatusCode] = (acc[r.assessmentStatusCode] || 0) + 1;
    return acc;
  }, {});

  if (performanceResults.length === 0) {
    return {
      overallPercentage: 0,
      meanAchievementLevel: null,
      bySubject: [],
      byCategoryAverages: [],
      statusCounts,
      exclusionNote: 'Administrative status codes are excluded from learner performance calculations.',
    };
  }

  const overallPercentage = Math.round(performanceResults.reduce((sum, r) => sum + r.percentage, 0) / performanceResults.length);
  const achievementRows = performanceResults.map((r) => Number(r.achievementLevel)).filter(Number.isFinite);
  const meanAchievementLevel = achievementRows.length
    ? Math.round((achievementRows.reduce((sum, value) => sum + value, 0) / achievementRows.length) * 100) / 100
    : null;

  const subjectMap = new Map<string, { subject: string; learningAreaId: string | null; meta: any; percentages: number[]; cbcGrades: string[]; achievementLevels: number[] }>();
  performanceResults.forEach(r => {
    const canonicalId = r.test.learningAreaId || null;
    const subject = r.test.learningArea;
    const key = canonicalId ? `id:${canonicalId}` : `name:${subject}`;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        subject,
        learningAreaId: canonicalId,
        meta: r.test.learningAreaRef ? {
          pathway: r.test.learningAreaRef.pathway ?? null,
          category: r.test.learningAreaRef.category ?? null,
          isCore: Boolean(r.test.learningAreaRef.isCore),
        } : null,
        percentages: [],
        cbcGrades: [],
        achievementLevels: [],
      });
    }
    const data = subjectMap.get(key)!;
    data.percentages.push(r.percentage);
    if (r.gradeCode || r.cbcGrade) data.cbcGrades.push(r.gradeCode || r.cbcGrade);
    if (Number.isFinite(Number(r.achievementLevel))) data.achievementLevels.push(Number(r.achievementLevel));
  });

  const bySubject = Array.from(subjectMap.values()).map((data) => {
    const avg = Math.round(data.percentages.reduce((sum, p) => sum + p, 0) / data.percentages.length);
    const validCbcGrades = data.cbcGrades.filter((grade) => isValidCbcGrade(grade, cbcRanges));

    let cbcGrade: string;
    if (validCbcGrades.length === data.percentages.length && validCbcGrades.length > 0) {
      const firstGrade = validCbcGrades[0];
      const allSame = validCbcGrades.every((grade) => grade === firstGrade);
      cbcGrade = allSame ? firstGrade : (cbcRanges ? gradingService.calculateRatingSync(avg, cbcRanges) : firstGrade);
    } else if (cbcRanges) {
      cbcGrade = gradingService.calculateRatingSync(avg, cbcRanges);
    } else {
      cbcGrade = 'ME';
    }

    return {
      subject: data.subject,
      learningAreaId: data.learningAreaId,
      learningAreaMeta: data.meta,
      averagePercentage: avg,
      grade: summativeRanges ? gradingService.calculateGradeSync(avg, summativeRanges) : 'E',
      cbcGrade,
      achievementLevel: data.achievementLevels.length
        ? Math.round((data.achievementLevels.reduce((sum, value) => sum + value, 0) / data.achievementLevels.length) * 100) / 100
        : null
    };
  });

  const categoryMap = new Map<'STEM' | 'SOCIAL' | 'ARTS', number[]>();
  bySubject.forEach((subject: any) => {
    const bucket =
      normalizeCategoryBucket(subject?.learningAreaMeta?.category) ||
      normalizeCategoryBucket(subject?.learningAreaMeta?.pathway);
    if (!bucket) return;
    const rows = categoryMap.get(bucket) || [];
    rows.push(Number(subject.averagePercentage || 0));
    categoryMap.set(bucket, rows);
  });

  const byCategoryAverages = CATEGORY_BUCKETS
    .filter((bucket) => categoryMap.has(bucket))
    .map((bucket) => {
      const scores = categoryMap.get(bucket)!;
      const averagePercentage = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
      return {
        category: bucket,
        averagePercentage,
        grade: summativeRanges ? gradingService.calculateGradeSync(averagePercentage, summativeRanges) : 'E',
        cbcGrade: cbcRanges ? gradingService.calculateRatingSync(averagePercentage, cbcRanges) : 'ME',
        subjectCount: scores.length,
      };
    });

  return {
    overallPercentage,
    meanAchievementLevel,
    bySubject,
    byCategoryAverages,
    statusCounts,
    exclusionNote: 'Administrative status codes are excluded from learner performance calculations.',
  };
}

function calculateAttendanceSummary(records: any[]): AttendanceSummary {
  const totalDays = records.length;
  if (totalDays === 0) {
    return {
      totalDays: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      sick: 0,
      attendancePercentage: 0
    };
  }

  const present  = records.filter(r => r.status === 'PRESENT').length;
  const absent   = records.filter(r => r.status === 'ABSENT').length;
  const late     = records.filter(r => r.status === 'LATE').length;
  const excused  = records.filter(r => r.status === 'EXCUSED').length;
  const sick     = records.filter(r => r.status === 'SICK').length;

  return {
    totalDays,
    present,
    absent,
    late,
    excused,
    sick,
    attendancePercentage: Math.round((present / totalDays) * 100)
  };
}

async function calculateOverallPerformanceWithWeights(
  learnerId: string,
  classId: string,
  term: Term,
  academicYear: number,
  formative: any,
  summative: any,
  competencies: any,
  values: any,
  attendance: any
) {
  let academicAverage = 0;
  if (formative.averagePercentage && summative.overallPercentage) {
    const result = await calculationService.calculateFinalScore({
      learnerId, classId, term, academicYear,
      formativeScore: formative.averagePercentage,
      summativeScore: summative.overallPercentage
    });
    academicAverage = Math.round(result.finalScore);
  } else {
    academicAverage = formative.averagePercentage || summative.overallPercentage || 0;
  }

  return { academicAverage };
}
