import { Term } from '@prisma/client';
import prisma from '../config/database';
import { aiAssistantService } from './ai-assistant.service';
import { aiBridgeService } from './ai-bridge.service';
import { performanceService } from './performance.service';
import { ApiError } from '../utils/error.util';

const REPORT_COMMENT_SYSTEM_PROMPT = `
You are a professional Kenyan teacher writing CBC-aligned report card comments.
Write in third person. Be encouraging, specific, and professional.
Comments must be 2-3 sentences. Do not invent facts not in the data provided.
Align to CBC competency language (e.g., "demonstrates mastery of", "is developing").
`.trim();

type AchievementLevel = 'EE' | 'ME' | 'AE' | 'BE';

interface LearnerProfile {
  name: string;
  grade: string;
}

interface LearnerMetrics {
  name: string;
  grade: string;
  percentage: number;
  trend: 'improving' | 'declining' | 'stable';
  attendanceRate: number;
  weakestSubject: string | null;
  strongestSubject: string | null;
  achievementLevel: AchievementLevel;
}

export interface ReportCommentInput {
  learnerId: string;
  schoolId?: string;
  term: Term | string;
  academicYear: number;
  createdBy?: string;
}

export interface ReportCommentOutput {
  comment: string;
  provider: string;
  tokensUsed?: number;
}

interface AIGeneratedContentCreateDelegate {
  create(args: {
    data: {
      schoolId: string;
      type: 'REPORT_COMMENT';
      entityId: string;
      entityType: 'learner';
      content: string;
      prompt: string;
      provider: string;
      tokensUsed?: number;
      createdBy: string;
    };
  }): Promise<unknown>;
}

const toAchievementLevel = (percentage: number): AchievementLevel => {
  if (percentage >= 80) return 'EE';
  if (percentage >= 60) return 'ME';
  if (percentage >= 40) return 'AE';
  return 'BE';
};

const toTrendLabel = (status?: string): 'improving' | 'declining' | 'stable' => {
  if (status === 'IMPROVING') return 'improving';
  if (status === 'DECLINING') return 'declining';
  return 'stable';
};

const normalizeComment = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/^"+|"+$/g, '').trim();

export class ReportCommentsService {
  async generateComment(input: ReportCommentInput): Promise<ReportCommentOutput> {
    const term = this.validateTerm(input.term);
    const schoolId = await this.resolveSchoolId(input.schoolId);
    const createdBy = input.createdBy || 'system';

    const [learner, performanceTrend, termConfig, results] = await Promise.all([
      prisma.learner.findUnique({
        where: { id: input.learnerId },
        select: {
          firstName: true,
          lastName: true,
          grade: true,
        },
      }),
      performanceService.getLearnerPerformanceTrend(input.learnerId),
      prisma.termConfig.findFirst({
        where: {
          academicYear: input.academicYear,
          term,
          archived: false,
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
      prisma.summativeResult.findMany({
        where: {
          learnerId: input.learnerId,
          archived: false,
          percentage: { not: null },
          assessmentStatusCode: null,
          test: {
            term,
            academicYear: input.academicYear,
            archived: false,
          },
        },
        select: {
          percentage: true,
          test: {
            select: {
              learningArea: true,
            },
          },
        },
      }),
    ]);

    if (!learner) {
      throw new ApiError(404, 'Learner not found');
    }

    const learnerProfile: LearnerProfile = {
      name: `${learner.firstName} ${learner.lastName}`.trim(),
      grade: learner.grade,
    };

    const attendanceWhere: Record<string, unknown> = {
      learnerId: input.learnerId,
      archived: false,
    };

    if (termConfig?.startDate && termConfig?.endDate) {
      attendanceWhere.date = {
        gte: termConfig.startDate,
        lte: termConfig.endDate,
      };
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: {
        status: true,
      },
    });

    const metrics = this.buildLearnerMetrics(learnerProfile, results, attendanceRecords, performanceTrend);

    const prompt = this.buildPrompt(learnerProfile, metrics, term, input.academicYear);

    let comment: string;
    let provider = 'deterministic';
    let tokensUsed: number | undefined;

    try {
      if (results.length === 0) {
        throw new Error('No term assessment data available for LLM comment generation');
      }

      const response = await aiBridgeService.generateCompletion(prompt, {
        systemPrompt: REPORT_COMMENT_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 220,
      });

      comment = normalizeComment(response.content);
      provider = response.provider;
      tokensUsed = response.usage?.totalTokens;
    } catch {
      comment = await this.buildFallbackComment(input.learnerId, term, input.academicYear);
      provider = 'deterministic';
      tokensUsed = undefined;
    }

    const aiGeneratedContent = (prisma as unknown as { aIGeneratedContent?: AIGeneratedContentCreateDelegate }).aIGeneratedContent;
    if (!aiGeneratedContent?.create) {
      throw new Error('Prisma client does not expose AIGeneratedContent yet. Run `npx prisma generate` after stopping backend Node processes.');
    }

    await aiGeneratedContent.create({
      data: {
        schoolId,
        type: 'REPORT_COMMENT',
        entityId: input.learnerId,
        entityType: 'learner',
        content: comment,
        prompt,
        provider,
        tokensUsed,
        createdBy,
      },
    });

    return {
      comment,
      provider,
      tokensUsed,
    };
  }

  buildPrompt(profile: LearnerProfile, metrics: LearnerMetrics, term: Term, academicYear: number): string {
    return [
      `Learner name: ${profile.name}`,
      `Grade: ${profile.grade}`,
      `Academic year: ${academicYear}`,
      `Term: ${term}`,
      `Term average: ${metrics.percentage}%`,
      `Achievement level: ${metrics.achievementLevel}`,
      `Attendance rate: ${metrics.attendanceRate}%`,
      `Strongest subject: ${metrics.strongestSubject ?? 'Not available'}`,
      `Weakest subject: ${metrics.weakestSubject ?? 'Not available'}`,
      `Performance trend: ${metrics.trend}`,
      'Write a CBC-aligned report card comment using only the data above.',
    ].join('\n');
  }

  async buildFallbackComment(learnerId: string, term: Term, academicYear: number): Promise<string> {
    return aiAssistantService.generateTeacherFeedback(learnerId, term, academicYear);
  }

  private buildLearnerMetrics(
    profile: LearnerProfile,
    results: Array<{ percentage: number | null; test: { learningArea: string } }>,
    attendanceRecords: Array<{ status: string }>,
    performanceTrend: { status?: string } | null
  ): LearnerMetrics {
    const validResults = results.filter(
      (result): result is { percentage: number; test: { learningArea: string } } =>
        typeof result.percentage === 'number'
    );

    const percentage = validResults.length > 0
      ? Math.round(validResults.reduce((sum, result) => sum + result.percentage, 0) / validResults.length)
      : 0;

    const subjectAverages = new Map<string, { total: number; count: number }>();

    for (const result of validResults) {
      const subject = result.test.learningArea;
      const current = subjectAverages.get(subject) || { total: 0, count: 0 };
      current.total += result.percentage;
      current.count += 1;
      subjectAverages.set(subject, current);
    }

    const rankedSubjects = Array.from(subjectAverages.entries())
      .map(([subject, stats]) => ({
        subject,
        average: stats.total / stats.count,
      }))
      .sort((a, b) => b.average - a.average);

    const totalAttendance = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(({ status }) => status !== 'ABSENT').length;
    const attendanceRate = totalAttendance > 0
      ? Math.round((presentCount / totalAttendance) * 100)
      : 0;

    return {
      name: profile.name,
      grade: profile.grade,
      percentage,
      trend: toTrendLabel(performanceTrend?.status),
      attendanceRate,
      strongestSubject: rankedSubjects[0]?.subject || null,
      weakestSubject: rankedSubjects[rankedSubjects.length - 1]?.subject || null,
      achievementLevel: toAchievementLevel(percentage),
    };
  }

  private validateTerm(term: ReportCommentInput['term']): Term {
    if (typeof term !== 'string' || !Object.values(Term).includes(term as Term)) {
      throw new ApiError(400, 'Invalid term');
    }

    return term as Term;
  }

  private async resolveSchoolId(inputSchoolId?: string): Promise<string> {
    if (inputSchoolId) {
      return inputSchoolId;
    }

    const school = await prisma.school.findFirst({
      where: {
        active: true,
        archived: false,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    if (!school?.id) {
      throw new ApiError(400, 'School context is required');
    }

    return school.id;
  }
}

export const reportCommentsService = new ReportCommentsService();
