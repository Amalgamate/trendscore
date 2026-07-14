import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';

type AchievementType =
  | 'FIRST_LESSON'
  | 'STREAK_7'
  | 'STREAK_30'
  | 'PERFECT_SCORE'
  | 'FAST_LEARNER'
  | 'TOP_CONTRIBUTOR'
  | 'EARLY_BIRD'
  | 'ASSIGNMENT_ACE'
  | 'RESOURCE_SHARER';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

async function ensureAchievement(args: {
  learnerId: string;
  schoolId: string;
  type: AchievementType;
  title: string;
  description?: string;
  xpEarned: number;
  metadata?: any;
}) {
  const existing = await prisma.learnerAchievement.findFirst({
    where: {
      learnerId: args.learnerId,
      schoolId: args.schoolId,
      type: args.type as any,
      archived: false,
    },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.learnerAchievement.create({
    data: {
      learnerId: args.learnerId,
      schoolId: args.schoolId,
      type: args.type as any,
      title: args.title,
      description: args.description,
      xpEarned: args.xpEarned,
      metadata: args.metadata,
      earnedAt: new Date(),
    },
  });
}

export class LMSAchievementsService {
  /**
   * Resolve the Learner.id for an authenticated STUDENT user.
   * Pattern in this codebase: user.username == learner.admissionNumber.
   */
  static async resolveLearnerIdFromUser(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });
    if (!user || user.role !== 'STUDENT' || !user.username) return null;

    const learner = await prisma.learner.findUnique({
      where: { admissionNumber: user.username },
      select: { id: true },
    });
    return learner?.id ?? null;
  }

  static async onLessonCompleted(args: { learnerId: string; schoolId: string; lessonId: string }) {
    try {
      // FIRST_LESSON: award on first completion event
      const completedCount = await prisma.learningProgress.count({
        where: {
          learnerId: args.learnerId,
          schoolId: args.schoolId,
          completedAt: { not: null },
        },
      });

      if (completedCount === 1) {
        await ensureAchievement({
          learnerId: args.learnerId,
          schoolId: args.schoolId,
          type: 'FIRST_LESSON',
          title: 'First Lesson Completed',
          description: 'You completed your first lesson. Keep going!',
          xpEarned: 25,
          metadata: { lessonId: args.lessonId },
        });
      }
    } catch (err: any) {
      logger.warn(`[LMSAchievements] onLessonCompleted failed: ${err?.message ?? err}`);
    }
  }

  static async onAssignmentSubmitted(args: { learnerId: string; schoolId: string; assignmentId: string }) {
    try {
      const submissionCount = await prisma.learningSubmission.count({
        where: {
          learnerId: args.learnerId,
          assignment: { schoolId: args.schoolId },
        },
      });

      // ASSIGNMENT_ACE: first submission milestone
      if (submissionCount === 1) {
        await ensureAchievement({
          learnerId: args.learnerId,
          schoolId: args.schoolId,
          type: 'ASSIGNMENT_ACE',
          title: 'Assignment Starter',
          description: 'You submitted your first assignment.',
          xpEarned: 20,
          metadata: { assignmentId: args.assignmentId },
        });
      }
    } catch (err: any) {
      logger.warn(`[LMSAchievements] onAssignmentSubmitted failed: ${err?.message ?? err}`);
    }
  }

  static async onPerfectScore(args: { learnerId: string; schoolId: string; submissionId: string; marks: number; totalMarks: number }) {
    try {
      if (args.totalMarks <= 0) return;
      if (args.marks !== args.totalMarks) return;

      await ensureAchievement({
        learnerId: args.learnerId,
        schoolId: args.schoolId,
        type: 'PERFECT_SCORE',
        title: 'Perfect Score',
        description: 'You achieved a perfect score on an assignment.',
        xpEarned: 50,
        metadata: { submissionId: args.submissionId, marks: args.marks, totalMarks: args.totalMarks },
      });
    } catch (err: any) {
      logger.warn(`[LMSAchievements] onPerfectScore failed: ${err?.message ?? err}`);
    }
  }

  static async computeStreakDays(args: { learnerId: string; schoolId: string }): Promise<number> {
    // Use sessions because they represent actual engagement
    const sessions = await prisma.learningSession.findMany({
      where: {
        learnerId: args.learnerId,
        schoolId: args.schoolId,
      },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 200, // enough to compute 30-day streak
    });

    if (!sessions.length) return 0;

    const uniqueDays = new Set<string>();
    for (const s of sessions) {
      uniqueDays.add(startOfDay(s.startedAt).toISOString());
    }

    // Count consecutive days ending today (or yesterday if no activity today).
    const today = startOfDay(new Date());
    const hasToday = uniqueDays.has(today.toISOString());
    let cursor = hasToday ? today : new Date(today.getTime() - 24 * 60 * 60 * 1000);

    let streak = 0;
    while (uniqueDays.has(startOfDay(cursor).toISOString())) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      if (streak > 365) break;
    }
    return streak;
  }

  static async ensureStreakAchievements(args: { learnerId: string; schoolId: string; streakDays: number }) {
    try {
      if (args.streakDays >= 7) {
        await ensureAchievement({
          learnerId: args.learnerId,
          schoolId: args.schoolId,
          type: 'STREAK_7',
          title: '7-Day Streak',
          description: 'You learned for 7 days in a row.',
          xpEarned: 40,
          metadata: { streakDays: args.streakDays },
        });
      }
      if (args.streakDays >= 30) {
        await ensureAchievement({
          learnerId: args.learnerId,
          schoolId: args.schoolId,
          type: 'STREAK_30',
          title: '30-Day Streak',
          description: 'You learned for 30 days in a row. Excellent consistency!',
          xpEarned: 120,
          metadata: { streakDays: args.streakDays },
        });
      }
    } catch (err: any) {
      logger.warn(`[LMSAchievements] ensureStreakAchievements failed: ${err?.message ?? err}`);
    }
  }

  static async getMyAchievements(args: { userId: string; schoolId: string }) {
    const learnerId = await this.resolveLearnerIdFromUser(args.userId);
    if (!learnerId) {
      throw new ApiError(403, 'Achievements are currently available for students only.')
        .withCode('LMS_ACHIEVEMENTS_STUDENT_ONLY');
    }

    // Compute streak and auto-award streak achievements.
    const streakDays = await this.computeStreakDays({ learnerId, schoolId: args.schoolId });
    await this.ensureStreakAchievements({ learnerId, schoolId: args.schoolId, streakDays });

    const achievements = await prisma.learnerAchievement.findMany({
      where: { learnerId, schoolId: args.schoolId, archived: false },
      orderBy: { earnedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        xpEarned: true,
        earnedAt: true,
      },
    });

    const xpTotal = achievements.reduce((sum, a) => sum + (a.xpEarned || 0), 0);
    const level = Math.max(1, Math.floor(xpTotal / 100) + 1);
    const xpThisLevel = xpTotal % 100;
    const xpToNextLevel = 100 - xpThisLevel;

    // Lightweight summary counters
    const [lessonsCompleted, assignmentsSubmitted] = await Promise.all([
      prisma.learningProgress.count({
        where: { learnerId, schoolId: args.schoolId, completedAt: { not: null } },
      }),
      prisma.learningSubmission.count({
        where: { learnerId, assignment: { schoolId: args.schoolId } },
      }),
    ]);

    return {
      learnerId,
      xpTotal,
      level,
      xpThisLevel,
      xpToNextLevel,
      streakDays,
      stats: {
        lessonsCompleted,
        assignmentsSubmitted,
      },
      achievements,
    };
  }

  static async getLeaderboard(args: { schoolId: string; limit?: number }) {
    const limit = Math.min(Math.max(args.limit ?? 10, 3), 50);

    // Sum XP for each learner for this school.
    // Note: LearnerAchievement is school-scoped; this is safe.
    const grouped = await prisma.learnerAchievement.groupBy({
      by: ['learnerId'],
      where: { schoolId: args.schoolId, archived: false },
      _sum: { xpEarned: true },
      orderBy: { _sum: { xpEarned: 'desc' } },
      take: limit,
    });

    if (!grouped.length) return { entries: [] };

    const learnerIds = grouped.map((g) => g.learnerId);
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true, stream: true },
    });
    const learnerMap = new Map(learners.map((l) => [l.id, l]));

    const entries = grouped.map((g, idx) => {
      const l = learnerMap.get(g.learnerId);
      return {
        rank: idx + 1,
        learnerId: g.learnerId,
        name: l ? [l.firstName, l.lastName].filter(Boolean).join(' ') : 'Learner',
        admissionNumber: l?.admissionNumber ?? null,
        grade: l?.grade ?? null,
        stream: l?.stream ?? null,
        xp: g._sum.xpEarned ?? 0,
      };
    });

    return { entries };
  }
}

