/**
 * LMSLessonService
 *
 * Manages the full lesson lifecycle: CRUD, publishing, block management,
 * and student progress tracking. All operations are school-scoped
 * (multi-tenant safe).
 *
 * Requirements: 6.1, 6.3, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10,
 *               7.2, 7.3, 7.4, 7.5, 14.4, 22.2, 22.5
 *
 * @module services/lms-lesson.service
 */

import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';
import { LMSNotificationService } from './lms-notification.service';
import { auditService } from './audit.service';
import { LMSAchievementsService } from './lms-achievements.service';
import { documentService } from './document.service';
import { ApiError } from '../utils/error.util';
import type {
  LearningLesson,
  LessonBlock,
  LessonBlockType,
  LearningProgress,
  LearningSession,
  LessonStatus,
  Prisma,
} from '@prisma/client';

// ─── Block content schema shapes ─────────────────────────────────────────────
// Each LessonBlockType has a required set of JSON fields.
// validateBlockContent enforces these at write time.

const BLOCK_REQUIRED_FIELDS: Record<LessonBlockType, string[]> = {
  HEADING:            ['text'],
  PARAGRAPH:          ['text'],
  IMAGE:              ['url'],
  GALLERY:            ['images'],
  VIDEO:              ['url'],
  AUDIO:              ['url'],
  QUIZ:               ['questions'],
  FLASHCARDS:         ['cards'],
  TIMELINE:           ['events'],
  ACCORDION:          ['items'],
  TABLE:              ['rows'],
  DIAGRAM:            ['url'],
  CODE:               ['code'],
  FORMULA:            ['latex'],
  PDF:                ['url'],
  ASSIGNMENT:         ['assignmentId'],
  DISCUSSION:         ['prompt'],
  REFLECTION:         ['prompt'],
  TEACHER_NOTES:      ['text'],
  PRACTICE_QUESTIONS: ['questions'],
};

// ─── Cache helpers ────────────────────────────────────────────────────────────

function lessonListCacheKey(schoolId: string, classId: string, termId: string): string {
  return `lms:lessons:${schoolId}:${classId}:${termId}`;
}

async function invalidateLessonCache(schoolId: string): Promise<void> {
  await redisCacheService.deleteByPrefix(`lms:lessons:${schoolId}:`);
}

async function invalidateAnalyticsCache(schoolId: string): Promise<void> {
  await redisCacheService.deleteByPrefix(`lms:analytics:overview:${schoolId}:`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateLessonInput {
  title: string;
  classId: string;
  learningAreaId: string;
  termId: string;
  schoolId: string;
  streamId?: string;
  description?: string;
  coverImageUrl?: string;
  estimatedMins?: number;
  dueDate?: Date;
  allowComments?: boolean;
  allowQuestions?: boolean;
  allowDownload?: boolean;
}

export type UpdateLessonInput = Partial<Omit<CreateLessonInput, 'schoolId'>>;

export interface LessonFilters {
  classId?: string;
  learningAreaId?: string;
  termId?: string;
  status?: LessonStatus;
  page?: number;
  limit?: number;
}

/** A single block as submitted by the client. */
export interface BlockInput {
  /** Existing block ID (omit for new blocks). */
  id?: string;
  type: LessonBlockType;
  /** 1-based sequential position. */
  order: number;
  /** Type-specific JSON payload. */
  content: Record<string, unknown>;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validate that order values are sequential starting at 1 with no duplicates.
 * Throws ApiError 422 on any violation.
 */
function validateBlockOrder(blocks: BlockInput[]): void {
  if (blocks.length === 0) return;

  const orders = blocks.map((b) => b.order);

  // Check for duplicates
  const orderSet = new Set(orders);
  if (orderSet.size !== orders.length) {
    throw new ApiError(422, 'Block order values must be unique').withCode(
      'LMS_BLOCK_ORDER_DUPLICATE',
    );
  }

  // Check sequential starting at 1 with no gaps
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new ApiError(
        422,
        `Block order must be sequential starting at 1. Got order ${sorted[i]} at position ${i + 1}`,
      ).withCode('LMS_BLOCK_ORDER_NOT_SEQUENTIAL');
    }
  }
}

/**
 * Validate that each block's JSON content contains the required fields
 * for its LessonBlockType.
 * Throws ApiError 422 on the first violation found.
 */
function validateBlockContent(blocks: BlockInput[]): void {
  for (const block of blocks) {
    const required = BLOCK_REQUIRED_FIELDS[block.type];
    if (!required) {
      // Unknown type — Prisma/DB will reject it; no additional check needed here.
      continue;
    }
    for (const field of required) {
      if (!(field in block.content) || block.content[field] === undefined) {
        throw new ApiError(
          422,
          `Block of type ${block.type} is missing required content field: "${field}"`,
        ).withCode('LMS_BLOCK_CONTENT_INVALID');
      }
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LMSLessonService {
  // ══════════════════════════════════════════════════════════════════════════
  // TASK 13.1 — CRUD and Publishing
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new lesson in DRAFT status.
   * Validates required fields: title, classId, learningAreaId, termId.
   * Requirements: 6.1
   */
  static async createLesson(
    data: CreateLessonInput,
    createdById: string,
  ): Promise<LearningLesson> {
    const { title, classId, learningAreaId, termId, schoolId } = data;

    if (!title || !classId || !learningAreaId || !termId) {
      throw new ApiError(
        422,
        'Missing required fields: title, classId, learningAreaId, termId',
      );
    }

    // Browser number inputs arrive as strings. Treat an empty optional field
    // as unset and reject invalid values with a client error instead of letting
    // Prisma return a generic 500.
    const estimatedMinsInput: any = data.estimatedMins;
    let estimatedMins: number | undefined;
    if (estimatedMinsInput !== undefined && estimatedMinsInput !== null && estimatedMinsInput !== '') {
      const parsed = typeof estimatedMinsInput === 'number'
        ? estimatedMinsInput
        : Number(estimatedMinsInput);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new ApiError(422, 'Estimated minutes must be a non-negative whole number');
      }
      estimatedMins = parsed;
    }

    const dueDate = LMSLessonService.parseOptionalDueDate(data.dueDate);

    const lesson = await prisma.learningLesson.create({
      data: {
        title,
        classId,
        learningAreaId,
        termId,
        schoolId,
        createdById,
        status: 'DRAFT',
        streamId: data.streamId,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        estimatedMins,
        dueDate,
        allowComments: data.allowComments ?? false,
        allowQuestions: data.allowQuestions ?? false,
        allowDownload: data.allowDownload ?? false,
      },
    });

    await invalidateLessonCache(schoolId);
    return lesson;
  }

  /**
   * Partially update a lesson.
   * Always enforces schoolId for tenant isolation.
   * Requirements: 6.1
   */
  static async updateLesson(
    id: string,
    schoolId: string,
    data: UpdateLessonInput,
  ): Promise<LearningLesson> {
    const dueDate = data.dueDate === undefined
      ? undefined
      : LMSLessonService.parseOptionalDueDate(data.dueDate);

    return prisma.learningLesson.update({
      where: { id, schoolId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.learningAreaId !== undefined && { learningAreaId: data.learningAreaId }),
        ...(data.termId !== undefined && { termId: data.termId }),
        ...(data.streamId !== undefined && { streamId: data.streamId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
        ...(data.estimatedMins !== undefined && { estimatedMins: data.estimatedMins }),
        ...(dueDate !== undefined && { dueDate }),
        ...(data.allowComments !== undefined && { allowComments: data.allowComments }),
        ...(data.allowQuestions !== undefined && { allowQuestions: data.allowQuestions }),
        ...(data.allowDownload !== undefined && { allowDownload: data.allowDownload }),
      },
    });
  }

  /**
   * Get a paginated list of lessons for a school.
   * Results are cached per school+class+term combination (TTL 5 min).
   * Requirements: 6.9
   */
  static async getLessons(
    filters: LessonFilters,
    schoolId: string,
  ): Promise<{ lessons: any[]; pagination: object }> {
    const { classId, learningAreaId, termId, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.LearningLessonWhereInput = {
      schoolId,
      archived: false,
      ...(classId && { classId }),
      ...(learningAreaId && { learningAreaId }),
      ...(termId && { termId }),
      ...(status && { status }),
    };

    // Attempt cache hit for common list views (only when all three dimensions present)
    if (classId && termId && !learningAreaId && !status && page === 1 && limit === 20) {
      const cacheKey = lessonListCacheKey(schoolId, classId, termId);
      const cached = await redisCacheService.get<any[]>(cacheKey);
      if (cached) {
        return {
          lessons: cached,
          pagination: { page: 1, limit: 20, total: cached.length, pages: 1 },
        };
      }
    }

    const [items, total] = await Promise.all([
      prisma.learningLesson.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { blocks: true } },
        },
      }),
      prisma.learningLesson.count({ where }),
    ]);

    // Populate cache for narrow list view
    if (classId && termId && !learningAreaId && !status && page === 1 && limit === 20) {
      const cacheKey = lessonListCacheKey(schoolId, classId, termId);
      await redisCacheService.set(cacheKey, items, 300); // 5 min
    }

    return {
      lessons: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Return a lesson with all its LessonBlocks ordered by `order` ASC.
   * The full block `content` JSON is projected only here, not in the list view.
   * Requirements: 6.10
   */
  static async getLessonWithBlocks(
    id: string,
    schoolId: string,
  ): Promise<LearningLesson & { blocks: LessonBlock[] }> {
    const lesson = await prisma.learningLesson.findUnique({
      where: { id },
      include: {
        blocks: {
          where: { archived: false },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    return lesson as LearningLesson & { blocks: LessonBlock[] };
  }

  /**
   * Publish a lesson.
   * Validates title, classId, learningAreaId, and termId are present.
   * Sets status=PUBLISHED, publishedAt; fires notification and audit log;
   * invalidates lesson cache and analytics cache.
   * Requirements: 6.5, 6.6, 6.7
   */
  static async publishLesson(
    id: string,
    schoolId: string,
    teacherId: string,
  ): Promise<LearningLesson> {
    const lesson = await prisma.learningLesson.findUnique({ where: { id } });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    if (!lesson.title || !lesson.classId || !lesson.learningAreaId || !lesson.termId || !lesson.dueDate) {
      throw new ApiError(
        422,
        'Lesson must have title, classId, learningAreaId, termId, and due date before publishing',
      );
    }

    const published = await prisma.learningLesson.update({
      where: { id, schoolId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    void LMSNotificationService.onLessonPublished(published).catch((err: any) =>
      console.error('[LMSLessonService] publishLesson notification error:', err?.message),
    );

    void auditService
      .logChange({
        entityType: 'LearningLesson',
        entityId: id,
        action: 'UPDATE',
        userId: teacherId,
        field: 'status',
        oldValue: lesson.status,
        newValue: 'PUBLISHED',
        reason: 'LESSON_PUBLISHED',
      })
      .catch(() => undefined);

    await Promise.all([
      invalidateLessonCache(schoolId),
      invalidateAnalyticsCache(schoolId),
    ]);

    return published;
  }

  private static parseOptionalDueDate(value: unknown): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const dueDate = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(dueDate.getTime())) {
      throw new ApiError(422, 'Due date is invalid');
    }
    return dueDate;
  }

  /**
   * Archive a lesson (sets archived=true).
   * Does NOT delete LessonBlocks, LearningProgress, or LearningSession records.
   * Requirements: 6.8
   */
  static async archiveLesson(id: string, schoolId: string): Promise<LearningLesson> {
    const lesson = await prisma.learningLesson.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    const archived = await prisma.learningLesson.update({
      where: { id, schoolId },
      data: { archived: true },
    });

    await invalidateLessonCache(schoolId);
    return archived;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK MEDIA UPLOAD
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upload a single media file (image/video/audio/pdf/diagram) for use inside
   * a lesson content block, and return the hosted Cloudinary URL plus basic
   * file metadata.
   *
   * This does NOT persist anything to a LessonBlock — the caller (frontend
   * block editor) is responsible for taking the returned `url` and setting it
   * on the relevant block's `content.url` before saving via upsertBlocks().
   */
  static async uploadBlockMedia(
    file: Express.Multer.File,
    schoolId: string,
  ): Promise<{ url: string; fileName: string; fileSize: number; fileType: string }> {
    if (!file) {
      throw new ApiError(422, 'No file provided').withCode('LMS_BLOCK_MEDIA_MISSING_FILE');
    }

    const folder = `lms/lessons/${schoolId}/blocks`;
    const result = await documentService.uploadFile(file, { folder, resourceType: 'auto' });

    return {
      url: result.url,
      fileName: file.originalname,
      fileSize: result.size,
      fileType: result.format,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 13.2 — Block Management
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upsert the full block list for a lesson.
   *
   * Business rules:
   *  - `order` values must be sequential starting at 1 with no duplicates
   *  - Each block's `content` JSON must contain the required fields for its type
   *  - Uses a Prisma transaction:
   *      1. Delete blocks that are NOT in the submitted list
   *      2. Upsert (create or update) each submitted block
   *
   * Returns the final saved block list ordered by `order` ASC.
   * Requirements: 6.3
   */
  static async upsertBlocks(
    lessonId: string,
    schoolId: string,
    blocks: BlockInput[],
  ): Promise<LessonBlock[]> {
    // 1. Verify the lesson belongs to this school
    const lesson = await prisma.learningLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    // 2. Validate order sequence
    validateBlockOrder(blocks);

    // 3. Validate each block's content shape
    validateBlockContent(blocks);

    // 4. Derive the set of submitted IDs (existing blocks being kept/updated)
    const submittedIds = blocks
      .filter((b) => Boolean(b.id))
      .map((b) => b.id as string);

    // 5. Execute in a transaction: delete stale blocks, then upsert survivors
    const saved = await prisma.$transaction(async (tx) => {
      // Delete blocks that are no longer in the submitted list
      await tx.lessonBlock.deleteMany({
        where: {
          lessonId,
          ...(submittedIds.length > 0
            ? { id: { notIn: submittedIds } }
            : {}),
        },
      });

      // Upsert each block
      const upsertOps = blocks.map((block) => {
        const data: Prisma.LessonBlockUncheckedCreateInput = {
          lessonId,
          type: block.type,
          order: block.order,
          content: block.content as Prisma.InputJsonValue,
        };

        if (block.id) {
          // Update existing block
          return tx.lessonBlock.update({
            where: { id: block.id },
            data: {
              type: block.type,
              order: block.order,
              content: block.content as Prisma.InputJsonValue,
            },
          });
        }

        // Create new block
        return tx.lessonBlock.create({ data });
      });

      return Promise.all(upsertOps);
    });

    // Return blocks in order ASC (the transaction results are already in submission order;
    // re-sort to guarantee order consistency for the caller)
    return saved.sort((a, b) => a.order - b.order);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 13.4 — Student Progress Tracking
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Mark a single block as complete for a learner.
   *
   * - Upserts the LearningProgress record
   * - TEACHER_NOTES blocks are excluded from `totalBlocks` and `percentComplete`
   * - Recalculates percentComplete = round(blocksCompleted / countableBlocks * 100)
   * - Sets completedAt when percentComplete reaches 100
   * - Tracks the most recently completed block in `lastBlockId`
   * - Invalidates the learner's progress cache
   *
   * Requirements: 7.2, 7.3, 14.4
   */
  static async markBlockComplete(
    learnerId: string,
    lessonId: string,
    blockId: string,
    schoolId: string,
  ): Promise<LearningProgress> {
    // Verify lesson + fetch all blocks (to count totals and validate blockId)
    const lesson = await prisma.learningLesson.findUnique({
      where: { id: lessonId },
      include: {
        blocks: {
          where: { archived: false },
          select: { id: true, type: true, order: true },
        },
      },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    // Verify the block belongs to this lesson
    const blockExists = lesson.blocks.some((b) => b.id === blockId);
    if (!blockExists) {
      throw new ApiError(404, 'Block not found in this lesson').withCode(
        'LMS_BLOCK_NOT_FOUND',
      );
    }

    // Count countable blocks (exclude TEACHER_NOTES)
    const countableBlocks = lesson.blocks.filter((b) => b.type !== 'TEACHER_NOTES').length;

    // Load existing progress record to determine current completion count
    const existing = await prisma.learningProgress.findFirst({
      where: { learnerId, lessonId },
    });

    // Increment blocksCompleted only if this is a fresh advance (cap at countableBlocks)
    const prevCompleted = existing?.blocksCompleted ?? 0;
    const blocksCompleted = Math.min(prevCompleted + 1, countableBlocks);

    const percentComplete =
      countableBlocks > 0 ? Math.round((blocksCompleted / countableBlocks) * 100) : 0;

    // Only set completedAt when reaching 100% for the first time
    const alreadyComplete = existing?.completedAt != null;
    const completedAt =
      percentComplete === 100 && !alreadyComplete ? new Date() : (existing?.completedAt ?? undefined);

    // Upsert progress record
    const progress = await prisma.learningProgress.upsert({
      where: {
        learnerId_lessonId: { learnerId, lessonId },
      },
      create: {
        learnerId,
        lessonId,
        schoolId,
        blocksCompleted,
        totalBlocks: countableBlocks,
        percentComplete,
        lastBlockId: blockId,
        ...(completedAt ? { completedAt } : {}),
      },
      update: {
        blocksCompleted,
        totalBlocks: countableBlocks,
        percentComplete,
        lastBlockId: blockId,
        ...(completedAt ? { completedAt } : {}),
      },
    });

    // Invalidate learner progress cache
    await redisCacheService.deleteByPrefix(`lms:progress:${learnerId}:`);

    // Fire-and-forget: award achievements when a lesson reaches 100% for the first time
    if (percentComplete === 100 && !alreadyComplete) {
      void LMSAchievementsService.onLessonCompleted({ learnerId, schoolId, lessonId }).catch(() => undefined);
    }

    return progress;
  }

  /**
   * Return the current LearningProgress for a learner on a lesson.
   * Reads from cache lms:progress:{learnerId}:{lessonId} (TTL 2 min).
   * Requirements: 7.2
   */
  static async getLessonProgress(
    learnerId: string,
    lessonId: string,
    schoolId: string,
  ): Promise<LearningProgress | null> {
    const cacheKey = `lms:progress:${learnerId}:${lessonId}`;
    const cached = await redisCacheService.get<LearningProgress>(cacheKey);
    if (cached) return cached;

    // Verify lesson access
    const lesson = await prisma.learningLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    const progress = await prisma.learningProgress.findFirst({
      where: { learnerId, lessonId },
    });

    if (progress) {
      await redisCacheService.set(cacheKey, progress, 120); // 2 min
    }

    return progress;
  }

  /**
   * Start a new LearningSession for a learner studying a lesson.
   * Requirements: 7.4
   */
  static async startSession(
    learnerId: string,
    lessonId: string,
    schoolId: string,
    deviceType?: string,
  ): Promise<LearningSession> {
    const lesson = await prisma.learningLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true },
    });

    if (!lesson || lesson.schoolId !== schoolId) {
      throw new ApiError(404, 'Lesson not found').withCode('LMS_LESSON_NOT_FOUND');
    }

    return prisma.learningSession.create({
      data: {
        learnerId,
        lessonId,
        schoolId,
        startedAt: new Date(),
        deviceType: deviceType ?? 'WEB',
      },
    });
  }

  /**
   * End an existing LearningSession: sets endedAt and computes durationSec.
   * Requirements: 7.5
   */
  static async endSession(
    sessionId: string,
    endedAt: Date,
  ): Promise<LearningSession> {
    const session = await prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: { startedAt: true },
    });

    if (!session) {
      throw new ApiError(404, 'Session not found').withCode('LMS_SESSION_NOT_FOUND');
    }

    const durationSec = Math.round(
      (endedAt.getTime() - session.startedAt.getTime()) / 1000,
    );

    return prisma.learningSession.update({
      where: { id: sessionId },
      data: { endedAt, durationSec },
    });
  }
}
