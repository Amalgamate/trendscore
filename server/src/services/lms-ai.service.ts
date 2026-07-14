import prisma from '../config/database';
import { aiBridgeService } from './ai-bridge.service';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const askSchema = z.object({
  question: z.string().min(3, 'question is required'),
  context: z.string().optional(),
});

const simplifySchema = z.object({
  text: z.string().min(10, 'text is required'),
  level: z.enum(['EASY', 'STANDARD', 'ADVANCED']).optional(),
});

const flashcardsSchema = z.object({
  text: z.string().min(10, 'text is required'),
  count: z.number().int().min(3).max(30).optional(),
});

const practiceSchema = z.object({
  text: z.string().min(10, 'text is required'),
  count: z.number().int().min(3).max(30).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

const explainMistakeSchema = z.object({
  question: z.string().min(3, 'question is required'),
  studentAnswer: z.string().min(1, 'studentAnswer is required'),
  correctAnswer: z.string().min(1, 'correctAnswer is required'),
});

const generateAssignmentSchema = z.object({
  topic: z.string().min(3, 'topic is required'),
  grade: z.string().optional(),
  learningArea: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  totalMarks: z.number().int().min(1).max(200).optional(),
});

const generateLessonPlanSchema = z.object({
  topic: z.string().min(3, 'topic is required'),
  grade: z.string().optional(),
  learningArea: z.string().optional(),
  durationMins: z.number().int().min(10).max(240).optional(),
});

const generateRubricSchema = z.object({
  assignmentTitle: z.string().min(3, 'assignmentTitle is required'),
  criteriaCount: z.number().int().min(3).max(15).optional(),
  totalMarks: z.number().int().min(1).max(200).optional(),
});

const questionBankSchema = z.object({
  topic: z.string().min(3, 'topic is required'),
  count: z.number().int().min(5).max(50).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  format: z.enum(['MCQ', 'SHORT_ANSWER', 'MIXED']).optional(),
});

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function persistAIResult(args: {
  schoolId: string;
  createdBy: string;
  type:
    | 'LEARNING_ASSISTANT'
    | 'ASSIGNMENT_GENERATOR'
    | 'LESSON_PLAN'
    | 'RUBRIC_GENERATOR'
    | 'PRACTICE_QUESTIONS'
    | 'FLASHCARD_SET'
    | 'QUESTION_BANK';
  content: string;
  prompt?: string;
  provider?: string;
  tokensUsed?: number;
}) {
  try {
    await prisma.aIGeneratedContent.create({
      data: {
        schoolId: args.schoolId,
        createdBy: args.createdBy,
        type: args.type,
        entityType: 'LMS',
        entityId: args.schoolId, // coarse grouping for now
        content: args.content,
        prompt: args.prompt,
        provider: args.provider,
        tokensUsed: args.tokensUsed,
      },
    });
  } catch (err: any) {
    // Never fail the endpoint if auditing storage fails.
    logger.warn(`[LMSAI] Failed to persist AI content: ${err?.message ?? err}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class LMSAIService {
  static async ask(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const { question, context } = askSchema.parse(payload);

    const prompt = [
      'Answer the learner question clearly and concisely.',
      'If you are not sure, say what you need to know rather than guessing.',
      '',
      context ? `Context:\n${context}\n` : '',
      `Question:\n${question}`,
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt:
        'You are a helpful learning assistant for Kenyan schools. Keep answers clear, step-by-step, and age-appropriate.',
      temperature: 0.4,
      maxTokens: 800,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'LEARNING_ASSISTANT',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    return { answer: resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async simplify(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const { text, level } = simplifySchema.parse(payload);
    const target = level || 'STANDARD';

    const prompt = [
      `Simplify the text for a learner at level: ${target}.`,
      'Return plain text only.',
      '',
      text,
    ].join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You simplify academic content without changing meaning.',
      temperature: 0.3,
      maxTokens: 900,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'LEARNING_ASSISTANT',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    return { simplified: resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async flashcards(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const { text, count } = flashcardsSchema.parse(payload);
    const n = count ?? 10;

    const prompt = [
      `Create ${n} flashcards from the study notes.`,
      'Return ONLY valid JSON with shape: {"flashcards":[{"front":"...","back":"..."}]}.',
      '',
      text,
    ].join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You create high-quality revision flashcards for students.',
      temperature: 0.4,
      maxTokens: 1200,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'FLASHCARD_SET',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<{ flashcards: Array<{ front: string; back: string }> }>(resp.content);
    return { data: parsed ?? { flashcards: [] }, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async practice(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const { text, count, difficulty } = practiceSchema.parse(payload);
    const n = count ?? 10;
    const diff = difficulty ?? 'MEDIUM';

    const prompt = [
      `Create ${n} practice questions at difficulty ${diff}.`,
      'Return ONLY valid JSON with shape:',
      '{"questions":[{"question":"...","options":["A","B","C","D"],"answer":"A","explanation":"..."}]}',
      'If a question is not MCQ, set options=[] and answer as short text.',
      '',
      text,
    ].join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You generate practice questions aligned to the provided notes.',
      temperature: 0.5,
      maxTokens: 1600,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'PRACTICE_QUESTIONS',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<{ questions: any[] }>(resp.content);
    return { data: parsed ?? { questions: [] }, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async explainMistake(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const { question, studentAnswer, correctAnswer } = explainMistakeSchema.parse(payload);

    const prompt = [
      'Explain the mistake in the student answer.',
      'Be kind, clear, and show the correct reasoning step-by-step.',
      '',
      `Question: ${question}`,
      `Student answer: ${studentAnswer}`,
      `Correct answer: ${correctAnswer}`,
    ].join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You are a patient teacher helping a student learn from mistakes.',
      temperature: 0.4,
      maxTokens: 900,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'LEARNING_ASSISTANT',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    return { explanation: resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async generateAssignment(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const data = generateAssignmentSchema.parse(payload);

    const prompt = [
      'Generate an assignment for a teacher.',
      'Return ONLY valid JSON with shape:',
      '{"title":"...","instructions":"...","totalMarks":20,"questions":[{"question":"...","marks":5,"answerKey":"..."}]}',
      '',
      `Topic: ${data.topic}`,
      data.learningArea ? `Learning Area: ${data.learningArea}` : '',
      data.grade ? `Grade: ${data.grade}` : '',
      data.totalMarks ? `Total Marks: ${data.totalMarks}` : '',
      data.objectives?.length ? `Objectives:\n- ${data.objectives.join('\n- ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You are an expert teacher. Generate practical, fair assignments.',
      temperature: 0.6,
      maxTokens: 1800,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'ASSIGNMENT_GENERATOR',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<any>(resp.content);
    return { data: parsed ?? null, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async generateLessonPlan(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const data = generateLessonPlanSchema.parse(payload);

    const prompt = [
      'Generate a lesson plan for a teacher.',
      'Return ONLY valid JSON with shape:',
      '{"title":"...","objectives":["..."],"materials":["..."],"activities":[{"stage":"Introduction","mins":5,"details":"..."}],"assessment":"...","homework":"..."}',
      '',
      `Topic: ${data.topic}`,
      data.learningArea ? `Learning Area: ${data.learningArea}` : '',
      data.grade ? `Grade: ${data.grade}` : '',
      data.durationMins ? `Duration (mins): ${data.durationMins}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You write structured lesson plans aligned to learning objectives.',
      temperature: 0.6,
      maxTokens: 1800,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'LESSON_PLAN',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<any>(resp.content);
    return { data: parsed ?? null, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async generateRubric(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const data = generateRubricSchema.parse(payload);
    const criteriaCount = data.criteriaCount ?? 6;

    const prompt = [
      'Generate a marking rubric for an assignment.',
      'Return ONLY valid JSON with shape:',
      '{"rubric":[{"criterion":"...","marks":5,"levels":[{"label":"Excellent","description":"..."},{"label":"Good","description":"..."},{"label":"Needs improvement","description":"..."}]}]}',
      '',
      `Assignment title: ${data.assignmentTitle}`,
      `Criteria count: ${criteriaCount}`,
      data.totalMarks ? `Total marks: ${data.totalMarks}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You design fair rubrics aligned to learning outcomes.',
      temperature: 0.5,
      maxTokens: 1600,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'RUBRIC_GENERATOR',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<any>(resp.content);
    return { data: parsed ?? null, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }

  static async questionBank(payload: unknown, ctx: { schoolId: string; userId: string }) {
    const data = questionBankSchema.parse(payload);
    const n = data.count ?? 20;
    const difficulty = data.difficulty ?? 'MEDIUM';
    const format = data.format ?? 'MIXED';

    const prompt = [
      `Create a question bank of ${n} questions.`,
      `Difficulty: ${difficulty}. Format: ${format}.`,
      'Return ONLY valid JSON with shape:',
      '{"questions":[{"question":"...","type":"MCQ|SHORT","options":["A","B","C","D"],"answer":"...","explanation":"...","marks":1}]}',
      '',
      `Topic: ${data.topic}`,
    ].join('\n');

    const resp = await aiBridgeService.generateCompletion(prompt, {
      systemPrompt: 'You generate accurate, curriculum-aligned question banks.',
      temperature: 0.6,
      maxTokens: 2200,
      jsonMode: true,
    });

    await persistAIResult({
      schoolId: ctx.schoolId,
      createdBy: ctx.userId,
      type: 'QUESTION_BANK',
      content: resp.content,
      prompt,
      provider: resp.provider,
      tokensUsed: resp.usage?.totalTokens,
    });

    const parsed = safeJsonParse<any>(resp.content);
    return { data: parsed ?? null, raw: parsed ? undefined : resp.content, usage: resp.usage, provider: resp.provider };
  }
}

