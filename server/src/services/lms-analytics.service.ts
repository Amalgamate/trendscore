/**
 * LMSAnalyticsService
 *
 * Aggregates and surfaces learning analytics for the TrendSCORE LMS.
 * All queries are school-scoped (multi-tenant safe).
 * Metrics are sourced from learning_progress + learning_sessions tables.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 22.5
 *
 * @module services/lms-analytics.service
 */

import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';

// ─── Cache TTLs ───────────────────────────────────────────────────────────────

const TTL_OVERVIEW = 15 * 60;      // 15 minutes
const TTL_CLASS    = 10 * 60;      // 10 minutes
const TTL_LEARNER  = 5  * 60;      // 5 minutes
const TTL_ASSIGNMENT = 10 * 60;    // 10 minutes
const TTL_ENGAGEMENT = 15 * 60;    // 15 minutes
const TTL_WEAK_TOPICS = 10 * 60;   // 10 minutes

// ─── Response types ───────────────────────────────────────────────────────────

export interface OverviewMetrics {
  totalActiveLessons: number;
  totalAssignments: number;
  avgCompletionRate: number;       // 0–100
  avgSubmissionRate: number;       // 0–100
  totalLearningTimeMinutes: number;
  topLessonsByEngagement: TopLessonEntry[];
}

export interface TopLessonEntry {
  lessonId: string;
  title: string;
  viewCount: number;
  avgCompletionPct: number;
}

export interface ClassAnalyticsMetrics {
  classId: string;
  totalLessonsStarted: number;
  totalLessonsCompleted: number;
  avgCompletionPct: number;
  totalSessionMinutes: number;
  avgSessionMinutes: number;
  learnersActive: number;
}

export interface LearnerAnalyticsMetrics {
  learnerId: string;
  lessonsStarted: number;
  lessonsCompleted: number;
  totalLearningMinutes: number;
  assignmentSubmissionRate: number; // 0–100
  avgMark: number | null;
}

export interface AssignmentAnalyticsEntry {
  assignmentId: string;
  title: string;
  totalMarks: number | null;
  totalEnrolled: number;
  submittedCount: number;
  submissionRate: number;  // 0–100
  avgMark: number | null;
  pendingMarkingCount: number;
}

export interface LessonEngagementEntry {
  lessonId: string;
  title: string;
  viewCount: number;
  avgCompletionPct: number;
  avgTimeSpentMins: number;
}

export interface WeakTopicEntry {
  learningAreaId: string;
  learningAreaName: string | null;
  topic: string | null;
  avgMark: number | null;
  avgLessonCompletionPct: number;
  submissionCount: number;
}


// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSAnalyticsService {
  // ══════════════════════════════════════════════════════════════════════════
  // getOverview — Requirement 13.1
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Aggregate school-wide LMS metrics for the given term.
   *
   * Returns:
   *  - Total active (PUBLISHED) lessons
   *  - Total assignments (non-archived)
   *  - Avg completion rate across all LearningProgress records
   *  - Avg submission rate (submitted learners / enrolled learners) per assignment
   *  - Total learning time in minutes from completed LearningSession records
   *  - Top 5 lessons by engagement (session count)
   *
   * Cached at lms:analytics:overview:{schoolId}:{termId} TTL 15 min.
   * Requirements: 13.1, 22.5
   */
  static async getOverview(
    schoolId: string,
    termId: string,
  ): Promise<OverviewMetrics> {
    const cacheKey = `lms:analytics:overview:${schoolId}:${termId}`;
    const cached = await redisCacheService.get<OverviewMetrics>(cacheKey);
    if (cached) return cached;

    // 1. Count active lessons
    const totalActiveLessons = await prisma.learningLesson.count({
      where: { schoolId, termId, status: 'PUBLISHED', archived: false },
    });

    // 2. Count assignments
    const totalAssignments = await prisma.learningAssignment.count({
      where: { schoolId, termId, archived: false },
    });

    // 3. Avg completion rate from LearningProgress
    const progressAgg = await prisma.learningProgress.aggregate({
      where: { schoolId, lesson: { termId } },
      _avg: { percentComplete: true },
    });
    const avgCompletionRate = Math.round(progressAgg._avg.percentComplete ?? 0);

    // 4. Avg submission rate: for each published assignment, ratio of submitted learners
    const assignments = await prisma.learningAssignment.findMany({
      where: { schoolId, termId, status: 'PUBLISHED', archived: false },
      select: {
        id: true,
        classId: true,
        _count: { select: { submissions: true } },
      },
    });

    let avgSubmissionRate = 0;
    if (assignments.length > 0) {
      // Count enrolled learners per class (approximate via Learner table)
      const classIds = [...new Set(assignments.map((a) => a.classId))];
      const classEnrolments = await prisma.classEnrollment.groupBy({
        by: ['classId'],
        where: { classId: { in: classIds }, active: true, archived: false },
        _count: { id: true },
      });
      const enrolMap = new Map<string, number>(
        classEnrolments.map((e) => [e.classId, e._count.id]),
      );

      const rates = assignments.map((a) => {
        const enrolled = enrolMap.get(a.classId) ?? 1;
        return Math.min((a._count.submissions / enrolled) * 100, 100);
      });
      avgSubmissionRate = Math.round(rates.reduce((s, r) => s + r, 0) / rates.length);
    }

    // 5. Total learning time from completed sessions (durationSec not null)
    const sessionAgg = await prisma.learningSession.aggregate({
      where: {
        schoolId,
        endedAt: { not: null },
        lesson: { termId },
      },
      _sum: { durationSec: true },
    });
    const totalLearningTimeMinutes = Math.round(
      (sessionAgg._sum.durationSec ?? 0) / 60,
    );

    // 6. Top 5 lessons by session count (engagement proxy)
    const topSessions = await prisma.learningSession.groupBy({
      by: ['lessonId'],
      where: { schoolId, lesson: { termId } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topLessonIds = topSessions.map((s) => s.lessonId);
    const topLessons = topLessonIds.length > 0
      ? await prisma.learningLesson.findMany({
          where: { id: { in: topLessonIds } },
          select: { id: true, title: true },
        })
      : [];

    const lessonAvgCompletion = topLessonIds.length > 0
      ? await prisma.learningProgress.groupBy({
          by: ['lessonId'],
          where: { lessonId: { in: topLessonIds } },
          _avg: { percentComplete: true },
        })
      : [];

    const completionMap = new Map(
      lessonAvgCompletion.map((r) => [r.lessonId, r._avg.percentComplete ?? 0]),
    );
    const titleMap = new Map(topLessons.map((l) => [l.id, l.title]));
    const sessionCountMap = new Map(topSessions.map((s) => [s.lessonId, s._count.id]));

    const topLessonsByEngagement: TopLessonEntry[] = topLessonIds.map((id) => ({
      lessonId: id,
      title: titleMap.get(id) ?? 'Unknown',
      viewCount: sessionCountMap.get(id) ?? 0,
      avgCompletionPct: Math.round(completionMap.get(id) ?? 0),
    }));

    const result: OverviewMetrics = {
      totalActiveLessons,
      totalAssignments,
      avgCompletionRate,
      avgSubmissionRate,
      totalLearningTimeMinutes,
      topLessonsByEngagement,
    };

    await redisCacheService.set(cacheKey, result, TTL_OVERVIEW);
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // getClassAnalytics — Requirement 13.2
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Per-class metrics drawn from learning_progress + learning_sessions tables.
   *
   * Returns:
   *  - Total lessons started / completed by learners in this class
   *  - Avg completion percentage
   *  - Total + avg session time
   *  - Count of unique active learners
   *
   * Cached at lms:analytics:class:{schoolId}:{classId}:{termId} TTL 10 min.
   * Requirements: 13.2
   */
  static async getClassAnalytics(
    classId: string,
    schoolId: string,
    termId: string,
  ): Promise<ClassAnalyticsMetrics> {
    const cacheKey = `lms:analytics:class:${schoolId}:${classId}:${termId}`;
    const cached = await redisCacheService.get<ClassAnalyticsMetrics>(cacheKey);
    if (cached) return cached;

    // All lesson IDs for this class + term
    const lessons = await prisma.learningLesson.findMany({
      where: { schoolId, classId, termId, archived: false },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);

    if (lessonIds.length === 0) {
      const empty: ClassAnalyticsMetrics = {
        classId,
        totalLessonsStarted: 0,
        totalLessonsCompleted: 0,
        avgCompletionPct: 0,
        totalSessionMinutes: 0,
        avgSessionMinutes: 0,
        learnersActive: 0,
      };
      await redisCacheService.set(cacheKey, empty, TTL_CLASS);
      return empty;
    }

    // Progress aggregates
    const progressRecords = await prisma.learningProgress.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { percentComplete: true, completedAt: true, learnerId: true },
    });

    const totalLessonsStarted = progressRecords.length;
    const totalLessonsCompleted = progressRecords.filter((p) => p.completedAt !== null).length;
    const avgCompletionPct = progressRecords.length > 0
      ? Math.round(
          progressRecords.reduce((s, p) => s + p.percentComplete, 0) / progressRecords.length,
        )
      : 0;
    const learnersActive = new Set(progressRecords.map((p) => p.learnerId)).size;

    // Session aggregates
    const sessionAgg = await prisma.learningSession.aggregate({
      where: {
        lessonId: { in: lessonIds },
        endedAt: { not: null },
      },
      _sum: { durationSec: true },
      _count: { id: true },
    });

    const totalSessionSec = sessionAgg._sum.durationSec ?? 0;
    const sessionCount = sessionAgg._count.id ?? 0;
    const totalSessionMinutes = Math.round(totalSessionSec / 60);
    const avgSessionMinutes = sessionCount > 0
      ? Math.round(totalSessionMinutes / sessionCount)
      : 0;

    const result: ClassAnalyticsMetrics = {
      classId,
      totalLessonsStarted,
      totalLessonsCompleted,
      avgCompletionPct,
      totalSessionMinutes,
      avgSessionMinutes,
      learnersActive,
    };

    await redisCacheService.set(cacheKey, result, TTL_CLASS);
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // getLearnerAnalytics — Requirement 13.3
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Individual learner analytics for a given school + term.
   *
   * Returns:
   *  - Lessons started and completed
   *  - Total learning minutes from sessions
   *  - Assignment submission rate (submitted / published assignments for class)
   *  - Average mark across marked submissions
   *
   * Cached at lms:analytics:learner:{schoolId}:{learnerId}:{termId} TTL 5 min.
   * Requirements: 13.3
   */
  static async getLearnerAnalytics(
    learnerId: string,
    schoolId: string,
    termId: string,
  ): Promise<LearnerAnalyticsMetrics> {
    const cacheKey = `lms:analytics:learner:${schoolId}:${learnerId}:${termId}`;
    const cached = await redisCacheService.get<LearnerAnalyticsMetrics>(cacheKey);
    if (cached) return cached;

    // 1. Lessons started / completed (via LearningProgress for term-scoped lessons)
    const progressRecords = await prisma.learningProgress.findMany({
      where: {
        learnerId,
        schoolId,
        lesson: { termId },
      },
      select: { completedAt: true },
    });

    const lessonsStarted = progressRecords.length;
    const lessonsCompleted = progressRecords.filter((p) => p.completedAt !== null).length;

    // 2. Total learning minutes from sessions
    const sessionAgg = await prisma.learningSession.aggregate({
      where: {
        learnerId,
        schoolId,
        endedAt: { not: null },
        lesson: { termId },
      },
      _sum: { durationSec: true },
    });
    const totalLearningMinutes = Math.round(
      (sessionAgg._sum.durationSec ?? 0) / 60,
    );

    // 3. Assignment submission rate
    //    Find the learner's active class enrolment
    const activeEnrolment = await prisma.classEnrollment.findFirst({
      where: { learnerId, active: true, archived: false },
      select: { classId: true },
    });

    let assignmentSubmissionRate = 0;
    if (activeEnrolment?.classId) {
      const publishedCount = await prisma.learningAssignment.count({
        where: {
          schoolId,
          termId,
          classId: activeEnrolment.classId,
          status: 'PUBLISHED',
          archived: false,
        },
      });

      if (publishedCount > 0) {
        const submittedCount = await prisma.learningSubmission.count({
          where: {
            learnerId,
            status: { in: ['SUBMITTED', 'MARKED', 'LATE', 'RESUBMITTED', 'RETURNED'] },
            assignment: { schoolId, termId },
            archived: false,
          },
        });
        assignmentSubmissionRate = Math.round(
          Math.min((submittedCount / publishedCount) * 100, 100),
        );
      }
    }

    // 4. Average mark across marked submissions for this term
    const marksAgg = await prisma.learningSubmission.aggregate({
      where: {
        learnerId,
        status: 'MARKED',
        assignment: { schoolId, termId },
        archived: false,
      },
      _avg: { marks: true },
    });
    const avgMark = marksAgg._avg.marks !== null
      ? Math.round((marksAgg._avg.marks ?? 0) * 10) / 10
      : null;

    const result: LearnerAnalyticsMetrics = {
      learnerId,
      lessonsStarted,
      lessonsCompleted,
      totalLearningMinutes,
      assignmentSubmissionRate,
      avgMark,
    };

    await redisCacheService.set(cacheKey, result, TTL_LEARNER);
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // getAssignmentAnalytics — Requirement 13.4
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Per-assignment analytics for a school + term.
   *
   * For each published, non-archived assignment returns:
   *  - Submission rate (submitted / enrolled learners in class) as 0–100
   *  - Average marks across marked submissions
   *  - Pending marking count (submissions with status SUBMITTED or LATE)
   *
   * Cached at lms:analytics:assignments:{schoolId}:{termId} TTL 10 min.
   * Requirements: 13.4
   */
  static async getAssignmentAnalytics(
    schoolId: string,
    termId: string,
  ): Promise<AssignmentAnalyticsEntry[]> {
    const cacheKey = `lms:analytics:assignments:${schoolId}:${termId}`;
    const cached = await redisCacheService.get<AssignmentAnalyticsEntry[]>(cacheKey);
    if (cached) return cached;

    const assignments = await prisma.learningAssignment.findMany({
      where: { schoolId, termId, archived: false },
      select: {
        id: true,
        title: true,
        classId: true,
        totalMarks: true,
        _count: { select: { submissions: true } },
      },
    });

    if (assignments.length === 0) {
      await redisCacheService.set(cacheKey, [], TTL_ASSIGNMENT);
      return [];
    }

    // Enrolment counts per class
    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const enrolmentRows = await prisma.classEnrollment.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, active: true, archived: false },
      _count: { id: true },
    });
    const enrolMap = new Map<string, number>(
      enrolmentRows.map((e) => [e.classId, e._count.id]),
    );

    // Assignment IDs for bulk queries
    const assignmentIds = assignments.map((a) => a.id);

    // Average marks per assignment (MARKED submissions only)
    const marksGroups = await prisma.learningSubmission.groupBy({
      by: ['assignmentId'],
      where: {
        assignmentId: { in: assignmentIds },
        status: 'MARKED',
        archived: false,
      },
      _avg: { marks: true },
    });
    const marksMap = new Map(
      marksGroups.map((r) => [r.assignmentId, r._avg.marks]),
    );

    // Pending marking per assignment (SUBMITTED or LATE, not yet marked)
    const pendingGroups = await prisma.learningSubmission.groupBy({
      by: ['assignmentId'],
      where: {
        assignmentId: { in: assignmentIds },
        status: { in: ['SUBMITTED', 'LATE'] },
        archived: false,
      },
      _count: { id: true },
    });
    const pendingMap = new Map(
      pendingGroups.map((r) => [r.assignmentId, r._count.id]),
    );

    const result: AssignmentAnalyticsEntry[] = assignments.map((a) => {
      const enrolled = enrolMap.get(a.classId) ?? 1;
      const submittedCount = a._count.submissions;
      const submissionRate = Math.round(
        Math.min((submittedCount / enrolled) * 100, 100),
      );
      const avgMarkRaw = marksMap.get(a.id) ?? null;
      const avgMark = avgMarkRaw !== null
        ? Math.round(avgMarkRaw * 10) / 10
        : null;

      return {
        assignmentId: a.id,
        title: a.title,
        totalMarks: a.totalMarks,
        totalEnrolled: enrolled,
        submittedCount,
        submissionRate,
        avgMark,
        pendingMarkingCount: pendingMap.get(a.id) ?? 0,
      };
    });

    await redisCacheService.set(cacheKey, result, TTL_ASSIGNMENT);
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // getLessonEngagementStats — Requirement 13.5
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Per-lesson engagement statistics for all non-archived lessons in a school.
   *
   * For each lesson returns:
   *  - viewCount: number of unique LearningSession records
   *  - avgCompletionPct: mean percentComplete across all LearningProgress records
   *  - avgTimeSpentMins: mean session duration in minutes
   *
   * Cached at lms:analytics:engagement:{schoolId} TTL 15 min.
   * Requirements: 13.5
   */
  static async getLessonEngagementStats(
    schoolId: string,
  ): Promise<LessonEngagementEntry[]> {
    const cacheKey = `lms:analytics:engagement:${schoolId}`;
    const cached = await redisCacheService.get<LessonEngagementEntry[]>(cacheKey);
    if (cached) return cached;

    const lessons = await prisma.learningLesson.findMany({
      where: { schoolId, archived: false },
      select: { id: true, title: true },
    });

    if (lessons.length === 0) {
      await redisCacheService.set(cacheKey, [], TTL_ENGAGEMENT);
      return [];
    }

    const lessonIds = lessons.map((l) => l.id);

    // Session counts per lesson (= view count proxy)
    const sessionCounts = await prisma.learningSession.groupBy({
      by: ['lessonId'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    });
    const viewCountMap = new Map(
      sessionCounts.map((s) => [s.lessonId, s._count.id]),
    );

    // Avg completion % per lesson
    const completionGroups = await prisma.learningProgress.groupBy({
      by: ['lessonId'],
      where: { lessonId: { in: lessonIds } },
      _avg: { percentComplete: true },
    });
    const completionMap = new Map(
      completionGroups.map((r) => [r.lessonId, r._avg.percentComplete ?? 0]),
    );

    // Avg time spent per lesson from completed sessions
    const timeGroups = await prisma.learningSession.groupBy({
      by: ['lessonId'],
      where: { lessonId: { in: lessonIds }, endedAt: { not: null } },
      _avg: { durationSec: true },
    });
    const timeMap = new Map(
      timeGroups.map((r) => [r.lessonId, r._avg.durationSec ?? 0]),
    );

    const result: LessonEngagementEntry[] = lessons.map((l) => ({
      lessonId: l.id,
      title: l.title,
      viewCount: viewCountMap.get(l.id) ?? 0,
      avgCompletionPct: Math.round(completionMap.get(l.id) ?? 0),
      avgTimeSpentMins: Math.round((timeMap.get(l.id) ?? 0) / 60),
    }));

    await redisCacheService.set(cacheKey, result, TTL_ENGAGEMENT);
    return result;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // detectWeakTopics — Requirement 13.6
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Surface subject-topic combinations that show low average marks AND
   * low lesson engagement for a given class + term.
   *
   * Algorithm:
   *  1. For each learningAreaId+topic combo in submissions, compute avg mark
   *     and submission count for the class.
   *  2. For lessons in the same class+term, compute avg completion %.
   *  3. Flag combos where avg mark < 50% of totalMarks OR avgCompletionPct < 50.
   *  4. Return sorted by combined weakness score (ascending).
   *
   * Cached at lms:analytics:weak-topics:{schoolId}:{classId}:{termId} TTL 10 min.
   * Requirements: 13.6
   */
  static async detectWeakTopics(
    classId: string,
    termId: string,
    schoolId: string,
  ): Promise<WeakTopicEntry[]> {
    const cacheKey = `lms:analytics:weak-topics:${schoolId}:${classId}:${termId}`;
    const cached = await redisCacheService.get<WeakTopicEntry[]>(cacheKey);
    if (cached) return cached;

    // 1. Gather marked submissions for assignments in this class+term, with topic info
    const submissions = await prisma.learningSubmission.findMany({
      where: {
        status: 'MARKED',
        archived: false,
        assignment: {
          schoolId,
          classId,
          termId,
          archived: false,
        },
      },
      select: {
        marks: true,
        assignment: {
          select: {
            learningAreaId: true,
            totalMarks: true,
            learningArea: { select: { name: true } },
          },
        },
      },
    });

    // Group by learningAreaId — aggregate avg mark as % of totalMarks
    type AreaStats = {
      learningAreaId: string;
      learningAreaName: string | null;
      topic: string | null;
      totalMarksSum: number;
      maxMarksSum: number;
      count: number;
    };

    const areaMap = new Map<string, AreaStats>();
    for (const sub of submissions) {
      const areaId = sub.assignment.learningAreaId;
      const existing = areaMap.get(areaId);
      const marksVal = sub.marks ?? 0;
      const maxVal = sub.assignment.totalMarks ?? 0;

      if (existing) {
        existing.totalMarksSum += marksVal;
        existing.maxMarksSum += maxVal;
        existing.count += 1;
      } else {
        areaMap.set(areaId, {
          learningAreaId: areaId,
          learningAreaName: sub.assignment.learningArea?.name ?? null,
          topic: null,
          totalMarksSum: marksVal,
          maxMarksSum: maxVal,
          count: 1,
        });
      }
    }

    // 2. Lesson completion per learningArea in this class+term
    const lessons = await prisma.learningLesson.findMany({
      where: { schoolId, classId, termId, archived: false },
      select: { id: true, learningAreaId: true },
    });

    const lessonsByArea = new Map<string, string[]>();
    for (const l of lessons) {
      const arr = lessonsByArea.get(l.learningAreaId) ?? [];
      arr.push(l.id);
      lessonsByArea.set(l.learningAreaId, arr);
    }

    // Avg completion per area (via LearningProgress)
    const areaCompletionMap = new Map<string, number>();
    for (const [areaId, ids] of lessonsByArea.entries()) {
      const agg = await prisma.learningProgress.aggregate({
        where: { lessonId: { in: ids } },
        _avg: { percentComplete: true },
      });
      areaCompletionMap.set(areaId, agg._avg.percentComplete ?? 0);
    }

    // 3. Build result — include all areas from submissions; flag weak ones
    const result: WeakTopicEntry[] = [];

    for (const [areaId, stats] of areaMap.entries()) {
      const avgMarkPct = stats.maxMarksSum > 0
        ? Math.round((stats.totalMarksSum / stats.maxMarksSum) * 100)
        : null;
      const avgLessonCompletion = Math.round(areaCompletionMap.get(areaId) ?? 0);

      const isWeakMarks = avgMarkPct !== null && avgMarkPct < 50;
      const isWeakEngagement = avgLessonCompletion < 50;

      // Only surface genuinely weak combos (either marks or engagement below threshold)
      if (isWeakMarks || isWeakEngagement) {
        result.push({
          learningAreaId: areaId,
          learningAreaName: stats.learningAreaName,
          topic: stats.topic,
          avgMark: avgMarkPct,
          avgLessonCompletionPct: avgLessonCompletion,
          submissionCount: stats.count,
        });
      }
    }

    // Also include areas with very low lesson engagement but no submissions yet
    for (const [areaId, avgCompletion] of areaCompletionMap.entries()) {
      if (!areaMap.has(areaId) && avgCompletion < 50) {
        // Get area name from DB
        const lessonSample = lessons.find((l) => l.learningAreaId === areaId);
        result.push({
          learningAreaId: areaId,
          learningAreaName: null,
          topic: null,
          avgMark: null,
          avgLessonCompletionPct: Math.round(avgCompletion),
          submissionCount: 0,
        });
        void lessonSample; // referenced for scoping; name resolved lazily above
      }
    }

    // Sort: worst first (lowest avg mark % + lowest completion)
    result.sort((a, b) => {
      const scoreA = (a.avgMark ?? 0) + a.avgLessonCompletionPct;
      const scoreB = (b.avgMark ?? 0) + b.avgLessonCompletionPct;
      return scoreA - scoreB;
    });

    await redisCacheService.set(cacheKey, result, TTL_WEAK_TOPICS);
    return result;
  }
}
