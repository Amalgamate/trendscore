/**
 * LMS Controller — Digital Learning Hub
 *
 * Stub implementations for all LMS API route handlers.
 * Assignment and submission handlers are fully implemented (task 8.8).
 * Lesson handlers are fully implemented (task 13.6).
 * Remaining handlers return 501 Not Implemented until the corresponding
 * service layer is wired in subsequent implementation phases.
 *
 * Settings handlers (getLmsSettings, updateLmsSettings) are fully implemented.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.6, 16.1, 16.2, 16.3, 16.4, 22.1,
 *               3.1, 4.1, 5.1, 7.1, 6.10
 *
 * @module controllers/lms.controller
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { LMSSettingsService, LMSSettingsUpdateInput } from '../services/lms-settings.service';
import { LMSAssignmentService } from '../services/lms-assignment.service';
import { LMSLessonService } from '../services/lms-lesson.service';
import { LMSResourceService } from '../services/lms-resource.service';
import { LMSMarketplaceService } from '../services/lms-marketplace.service';
import { LMSAnalyticsService } from '../services/lms-analytics.service';
import { LMSService } from '../services/lms.service';
import { LMSAIService } from '../services/lms-ai.service';
import { LMSAchievementsService } from '../services/lms-achievements.service';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';

const lmsService = new LMSService();

// ─── Helper: resolve learnerId for the authenticated STUDENT user ────────────
/**
 * Looks up the Learner record whose admissionNumber matches the user's
 * username (the same convention used throughout the existing LMS service).
 * Returns the learnerId string or throws 404 if not found.
 */
async function resolveLearnerId(req: AuthRequest): Promise<string> {
  const userId = req.user?.userId;
  if (!userId) throw new ApiError(401, 'Authentication required');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true },
  });

  if (!user) throw new ApiError(401, 'User not found');

  const usernameCandidates = [
    user.username,
    user.username?.replace(/-/g, '/'),
    user.email?.split('@')[0],
    user.email?.split('@')[0]?.replace(/-/g, '/'),
  ].filter(Boolean) as string[];

  const learner = await prisma.learner.findFirst({
    where: { admissionNumber: { in: usernameCandidates } },
    select: { id: true },
  });

  if (!learner) {
    throw new ApiError(404, 'Learner record not found for this user').withCode('LMS_LEARNER_NOT_FOUND');
  }

  return learner.id;
}

const NOT_IMPLEMENTED = { success: false, message: 'Not implemented yet' };

function isZodError(err: any): boolean {
  return Boolean(err && (err.name === 'ZodError' || Array.isArray(err.issues)));
}

function zodMessage(err: any): string {
  const issue = err?.issues?.[0];
  return issue?.message || 'Invalid request payload';
}

// ─────────────────────────────────────────────────────────────────────────────
// LESSONS
// Requirements: 7.1, 6.10
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/lessons
 * Paginated, filtered list of lessons (no block content — list view only).
 * Requirements: 6.9
 */
export const getLessons = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const filters = {
      classId: req.query.classId as string | undefined,
      learningAreaId: req.query.learningAreaId as string | undefined,
      termId: req.query.termId as string | undefined,
      status: req.query.status as any,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await LMSLessonService.getLessons(filters, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLessons error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve lessons' });
    }
  }
};

/**
 * GET /api/lms/lessons/:id
 * Returns a lesson with all its blocks ordered by `order` ASC.
 * For STUDENT role, TEACHER_NOTES blocks are filtered out of the response.
 * Requirements: 6.10, 7.1
 */
export const getLessonWithBlocks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const lesson = await LMSLessonService.getLessonWithBlocks(id, schoolId);

    // Filter out TEACHER_NOTES blocks for student-facing requests (Requirement 6.10, 7.1)
    const role = req.user?.role ?? '';
    if (role === 'STUDENT') {
      (lesson as any).blocks = lesson.blocks.filter(
        (block: any) => block.type !== 'TEACHER_NOTES',
      );
    }

    res.json({ success: true, data: lesson });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLessonWithBlocks error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve lesson' });
    }
  }
};

/**
 * POST /api/lms/lessons
 * Create a new lesson in DRAFT status.
 * Requirements: 6.1
 */
export const createLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const createdById = req.user?.userId;
    if (!createdById) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const body = { ...req.body, schoolId };
    const lesson = await LMSLessonService.createLesson(body, createdById);
    res.status(201).json({ success: true, data: lesson });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] createLesson error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to create lesson' });
    }
  }
};

/**
 * PUT /api/lms/lessons/:id
 * Partially update lesson metadata (school-scoped).
 * Requirements: 6.1
 */
export const updateLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const lesson = await LMSLessonService.updateLesson(id, schoolId, req.body);
    res.json({ success: true, data: lesson });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateLesson error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update lesson' });
    }
  }
};

/**
 * POST /api/lms/lessons/:id/blocks
 * Upsert the full block list for a lesson.
 * Validates sequential order and content schemas before persisting.
 * Requirements: 6.3
 */
export const upsertBlocks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id: lessonId } = req.params;
    const { blocks } = req.body;

    if (!Array.isArray(blocks)) {
      res.status(400).json({ success: false, message: 'Request body must contain a "blocks" array' });
      return;
    }

    const result = await LMSLessonService.upsertBlocks(lessonId, schoolId, blocks);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] upsertBlocks error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to save lesson blocks' });
    }
  }
};

/**
 * PUT /api/lms/lessons/:id/publish
 * Publish a lesson; validates required fields; fires notifications and audit log.
 * Requirements: 6.5, 6.6, 6.7
 */
export const publishLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const teacherId = req.user?.userId;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const lesson = await LMSLessonService.publishLesson(id, schoolId, teacherId);
    res.json({ success: true, data: lesson });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] publishLesson error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to publish lesson' });
    }
  }
};

/**
 * DELETE /api/lms/lessons/:id
 * Archive a lesson (sets archived=true; preserves all related records).
 * Requirements: 6.8
 */
export const archiveLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const lesson = await LMSLessonService.archiveLesson(id, schoolId);
    res.json({ success: true, data: lesson });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] archiveLesson error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to archive lesson' });
    }
  }
};

/**
 * POST /api/lms/lessons/:id/progress
 * Mark a single block as complete for the authenticated student.
 * Body: { blockId: string }
 * Requirements: 7.2, 7.3
 */
export const markLessonProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: lessonId } = req.params;
    const { blockId } = req.body;

    if (!blockId) {
      res.status(400).json({ success: false, message: 'blockId is required' });
      return;
    }

    const progress = await LMSLessonService.markBlockComplete(learnerId, lessonId, blockId, schoolId);
    res.json({ success: true, data: progress });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] markLessonProgress error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to record lesson progress' });
    }
  }
};

/**
 * GET /api/lms/lessons/:id/progress
 * Return the authenticated learner's current progress for a lesson.
 * Requirements: 7.2
 */
export const getLessonProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: lessonId } = req.params;

    const progress = await LMSLessonService.getLessonProgress(learnerId, lessonId, schoolId);
    res.json({ success: true, data: progress ?? null });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLessonProgress error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve lesson progress' });
    }
  }
};

/**
 * POST /api/lms/lessons/:id/session
 * Start a learning session for the authenticated student.
 * Body: { deviceType?: string }
 * Requirements: 7.4
 */
export const startLessonSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: lessonId } = req.params;
    const { deviceType } = req.body;

    const session = await LMSLessonService.startSession(learnerId, lessonId, schoolId, deviceType);
    res.status(201).json({ success: true, data: session });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] startLessonSession error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to start lesson session' });
    }
  }
};

/**
 * PUT /api/lms/lessons/sessions/:sessionId
 * End a lesson session; computes durationSec from startedAt.
 * Body: { endedAt?: string } — defaults to now if omitted.
 * Requirements: 7.5
 */
export const endLessonSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const endedAt = req.body.endedAt ? new Date(req.body.endedAt) : new Date();

    const session = await LMSLessonService.endSession(sessionId, endedAt);
    res.json({ success: true, data: session });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] endLessonSession error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to end lesson session' });
    }
  }
};

/**
 * POST /api/lms/lessons/media
 * Upload a single media file (image/video/audio/pdf/diagram) for use inside a
 * lesson content block. upload.single('file') middleware is applied in
 * lms.routes.ts. Returns { url, fileName, fileSize, fileType } — the caller
 * (LessonBlockEditor) sets this onto the relevant block's content.url and
 * saves it via the normal upsertBlocks() flow.
 */
export const uploadLessonMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const file: Express.Multer.File | undefined = req.file;
    if (!file) {
      res.status(422).json({ success: false, message: 'No file provided', code: 'LMS_BLOCK_MEDIA_MISSING_FILE' });
      return;
    }

    const result = await LMSLessonService.uploadBlockMedia(file, schoolId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] uploadLessonMedia error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to upload file' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// Requirements: 3.1, 4.1, 5.1, 17.1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/assignments
 * Role-scoped paginated list of assignments.
 * Requirements: 3.1
 */
export const getAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const requesterId = req.user?.userId ?? '';
    const role = req.user?.role ?? '';

    const rawLearnerIds = req.query.learnerIds as string | string[] | undefined;
    const learnerIds = rawLearnerIds
      ? (Array.isArray(rawLearnerIds) ? rawLearnerIds : rawLearnerIds.split(','))
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;

    const filters = {
      classId: req.query.classId as string | undefined,
      learningAreaId: req.query.learningAreaId as string | undefined,
      termId: req.query.termId as string | undefined,
      status: req.query.status as any,
      category: req.query.category as any,
      assignmentId: req.query.assignmentId as string | undefined,
      learnerIds,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    // For STUDENT role, resolve their classId if not supplied
    let requesterClassId: string | undefined;
    if (role === 'STUDENT') {
      const learnerId = await resolveLearnerId(req);
      const activeEnrollment = await prisma.classEnrollment.findFirst({
        where: { learnerId, active: true, archived: false },
        select: { classId: true },
      });
      requesterClassId = activeEnrollment?.classId ?? undefined;
    }

    const result = await LMSAssignmentService.getAssignments(
      filters,
      requesterId,
      role,
      schoolId,
      requesterClassId,
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getAssignments error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve assignments' });
    }
  }
};

/**
 * GET /api/lms/assignments/:id
 * Assignment detail including attached files.
 * Requirements: 3.1
 */
export const getAssignmentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const result = await LMSAssignmentService.getAssignmentDetail(id, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getAssignmentDetail error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve assignment' });
    }
  }
};

/**
 * POST /api/lms/assignments
 * Create a new assignment in DRAFT status.
 * Requirements: 3.1
 */
export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const teacherId = req.user?.userId;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Inject schoolId into the body before passing to service
    const body = { ...req.body, schoolId };

    const result = await LMSAssignmentService.createAssignment(body, teacherId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] createAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to create assignment' });
    }
  }
};

/**
 * PUT /api/lms/assignments/:id
 * Partially update an assignment (school-scoped).
 * Requirements: 3.1
 */
export const updateAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const result = await LMSAssignmentService.updateAssignment(id, schoolId, req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update assignment' });
    }
  }
};

/**
 * POST /api/lms/assignments/:id/publish
 * Publish an assignment; validates required fields; fires notifications.
 * Requirements: 3.1
 */
export const publishAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const teacherId = req.user?.userId;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const result = await LMSAssignmentService.publishAssignment(id, schoolId, teacherId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] publishAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to publish assignment' });
    }
  }
};

/**
 * POST /api/lms/assignments/:id/close
 * Set assignment status to CLOSED.
 */
export const closeAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const result = await LMSAssignmentService.closeAssignment(id, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] closeAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to close assignment' });
    }
  }
};

/**
 * DELETE /api/lms/assignments/:id
 * Archive an assignment (sets archived=true, preserves data).
 */
export const archiveAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const result = await LMSAssignmentService.archiveAssignment(id, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] archiveAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to archive assignment' });
    }
  }
};

/**
 * GET /api/lms/assignments/:id/submissions
 * All submissions for an assignment (teacher/admin view).
 * Requirements: 4.1
 */
export const getSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id: assignmentId } = req.params;
    const result = await LMSAssignmentService.getSubmissions(assignmentId, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getSubmissions error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
    }
  }
};

/**
 * POST /api/lms/assignments/:id/submit
 * Student submits an assignment with optional file uploads.
 * upload.array('files', 10) middleware is applied in lms.routes.ts.
 * Requirements: 4.1
 */
export const submitAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: assignmentId } = req.params;

    // req.files is populated by upload.array('files', 10) in the route
    const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : [];

    const result = await LMSAssignmentService.createSubmission(
      assignmentId,
      learnerId,
      req.body,
      files,
      schoolId,
    );

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] submitAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to submit assignment' });
    }
  }
};

/**
 * PUT /api/lms/submissions/:id
 * Update a DRAFT submission before final submit.
 * upload.array('files', 10) middleware may optionally be present on this route.
 * Requirements: 4.1
 */
export const updateDraftSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: submissionId } = req.params;
    const files: Express.Multer.File[] = Array.isArray(req.files) ? req.files : [];

    const result = await LMSAssignmentService.updateDraftSubmission(
      submissionId,
      learnerId,
      req.body,
      files,
      schoolId,
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateDraftSubmission error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update submission' });
    }
  }
};

/**
 * POST /api/lms/submissions/:id/mark
 * Teacher marks a submission with score and feedback.
 * Requirements: 5.1
 */
export const markSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const markerId = req.user?.userId;
    if (!markerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { id: submissionId } = req.params;
    const { marks, feedback } = req.body;

    const result = await LMSAssignmentService.markSubmission(
      submissionId,
      markerId,
      Number(marks),
      feedback ?? '',
      schoolId,
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] markSubmission error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to mark submission' });
    }
  }
};

/**
 * GET /api/lms/submissions/my
 * Learner's own submission history (scoped to authenticated student).
 * Requirements: 4.1
 */
export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);

    const filters = {
      assignmentId: req.query.assignmentId as string | undefined,
      status: req.query.status as any,
    };

    const result = await LMSAssignmentService.getMySubmissions(learnerId, filters, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getMySubmissions error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCES (REVISION LIBRARY)
// Requirements: 8.1, 8.6, 18.1, 18.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/resources
 * Full-text search and filtered list of resources for the school.
 * Supports query params: query, classId, learningAreaId, resourceType,
 * topic, term, year, difficulty, language, page, limit.
 * Results are paginated and cached per school + filter combination.
 * Requirements: 8.4, 8.5
 */
export const searchResources = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const filters = {
      query: req.query.query as string | undefined,
      classId: req.query.classId as string | undefined,
      learningAreaId: req.query.learningAreaId as string | undefined,
      resourceType: req.query.resourceType as any,
      topic: req.query.topic as string | undefined,
      term: req.query.term ? Number(req.query.term) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      difficulty: req.query.difficulty as any,
      language: req.query.language as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await LMSResourceService.searchResources(filters, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] searchResources error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to search resources' });
    }
  }
};

/**
 * GET /api/lms/resources/:id
 * Return full details for a single resource and increment its view count.
 * Requirements: 8.5, 8.8
 */
export const getResourceDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const resource = await LMSResourceService.getResourceDetail(id, schoolId);
    res.json({ success: true, data: resource });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getResourceDetail error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve resource' });
    }
  }
};

/**
 * POST /api/lms/resources
 * Upload a new learning resource with an optional file attachment.
 * upload.single('file') multer middleware is applied in lms.routes.ts.
 * Requirements: 8.1, 8.2, 8.3, 18.1, 18.2
 */
export const createResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const uploaderId = req.user?.userId;
    if (!uploaderId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // req.file is populated by upload.single('file') in the route
    const file: Express.Multer.File | undefined = req.file;

    const body = { ...req.body, schoolId };
    const resource = await LMSResourceService.createResource(body, uploaderId, file);
    res.status(201).json({ success: true, data: resource });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] createResource error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to create resource' });
    }
  }
};

/**
 * PUT /api/lms/resources/:id
 * Partially update a resource's metadata (school-scoped).
 * Invalidates the resource cache for the school.
 * Requirements: 8.9
 */
export const updateResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const resource = await LMSResourceService.updateResource(id, schoolId, req.body);
    res.json({ success: true, data: resource });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateResource error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update resource' });
    }
  }
};

/**
 * DELETE /api/lms/resources/:id
 * Archive a resource (sets archived=true; preserves all data and Cloudinary file).
 * Requirements: 8.9
 */
export const archiveResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { id } = req.params;
    const resource = await LMSResourceService.archiveResource(id, schoolId);
    res.json({ success: true, data: resource });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] archiveResource error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to archive resource' });
    }
  }
};

/**
 * POST /api/lms/resources/:id/download
 * Generate a signed Cloudinary URL for the resource and increment downloadCount.
 * Returns the signed URL to the client.
 * Requirements: 8.6, 8.8
 */
export const downloadResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: resourceId } = req.params;

    const signedUrl = await LMSResourceService.trackDownload(resourceId, learnerId, schoolId);
    res.json({ success: true, data: { url: signedUrl } });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] downloadResource error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to generate download URL' });
    }
  }
};

/**
 * POST /api/lms/resources/:id/bookmark
 * Toggle a bookmark on a resource for the authenticated learner.
 * Returns `{ bookmarked: boolean }` reflecting the new state.
 * Requirements: 8.7
 */
export const toggleBookmark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const learnerId = await resolveLearnerId(req);
    const { id: resourceId } = req.params;

    const bookmarked = await LMSResourceService.toggleBookmark(resourceId, learnerId, schoolId);
    res.json({ success: true, data: { bookmarked } });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] toggleBookmark error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to toggle bookmark' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE (Enterprise)
// ─────────────────────────────────────────────────────────────────────────────

export const browseListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    // Accept both legacy and UI-friendly query param names.
    const {
      listingType,
      type,
      minPrice,
      priceMin,
      maxPrice,
      priceMax,
      search,
      page,
      limit,
    } = req.query as any;
    const result = await LMSMarketplaceService.browseListings(
      {
        ...(search && { search: String(search) }),
        ...((type || listingType) && { type: String(type || listingType) }),
        ...((priceMin ?? minPrice) !== undefined && { priceMin: Number(priceMin ?? minPrice) }),
        ...((priceMax ?? maxPrice) !== undefined && { priceMax: Number(priceMax ?? maxPrice) }),
        ...(page !== undefined && { page: Number(page) }),
        ...(limit !== undefined && { limit: Number(limit) }),
      },
      schoolId,
    );
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] browseListings error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to browse listings' });
    }
  }
};

export const getListingDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const listing = await LMSMarketplaceService.getListingDetail(req.params.id, schoolId);
    res.status(200).json({ success: true, data: listing });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getListingDetail error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to fetch listing' });
    }
  }
};

export const createListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const sellerId = req.user?.userId;
    if (!sellerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const listing = await LMSMarketplaceService.createListing({ ...req.body, schoolId }, sellerId);
    res.status(201).json({ success: true, data: listing });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] createListing error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to create listing' });
    }
  }
};

export const approveListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const approverId = req.user?.userId;
    if (!approverId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const listing = await LMSMarketplaceService.approveListing(req.params.id, approverId, schoolId);
    res.status(200).json({ success: true, data: listing });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] approveListing error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to approve listing' });
    }
  }
};

export const rejectListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const approverId = req.user?.userId;
    if (!approverId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const listing = await LMSMarketplaceService.rejectListing(
      req.params.id,
      approverId,
      req.body?.reason ?? '',
      schoolId,
    );
    res.status(200).json({ success: true, data: listing });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] rejectListing error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to reject listing' });
    }
  }
};

export const initiatePurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const buyerId = req.user?.userId;
    if (!buyerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const { phone, firstName, lastName } = req.body ?? {};
    // NOTE: phone is only required for PAID listings. The service enforces this.
    const result = await LMSMarketplaceService.initiatePurchase(
      req.params.id,
      buyerId,
      phone,
      schoolId,
      { firstName, lastName },
    );
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] initiatePurchase error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to initiate purchase' });
    }
  }
};

/**
 * M-Pesa STK push callback — public endpoint (no auth), IP-verified.
 * See route registration for the guard approach.
 */
export const handleMpesaCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  // Defensive/idempotent secondary entry point — see LMSMarketplaceService
  // module header §1.3. The primary completion path is the hook added to
  // the generic mpesa.controller.ts handleCallback, since Safaricom is
  // configured with a single global callback URL.
  try {
    await LMSMarketplaceService.handleMpesaCallback(req.body);
  } catch (error: any) {
    console.error('[LMS] handleMpesaCallback error:', error?.message ?? error);
  }
  res.status(200).json({ success: true });
};

export const getMyListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const sellerId = req.user?.userId;
    if (!sellerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const listings = await LMSMarketplaceService.getMyListings(sellerId, schoolId);
    res.status(200).json({ success: true, data: listings });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getMyListings error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to fetch listings' });
    }
  }
};

export const getMyPurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const buyerId = req.user?.userId;
    if (!buyerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const purchases = await LMSMarketplaceService.getMyPurchases(buyerId, schoolId);
    res.status(200).json({ success: true, data: purchases });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getMyPurchases error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to fetch purchases' });
    }
  }
};

export const rateResource = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const { rating } = req.body ?? {};
    // Route param is the purchaseId (POST /api/lms/marketplace/purchases/:id/rate)
    const listing = await LMSMarketplaceService.rateResource(req.params.id, Number(rating), buyerId);
    res.status(200).json({ success: true, data: listing });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] rateResource error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to rate listing' });
    }
  }
};

export const downloadPurchase = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const buyerId = req.user?.userId;
    if (!buyerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const url = await LMSMarketplaceService.downloadPurchasedResource(req.params.id, buyerId);
    res.status(200).json({ success: true, data: { url } });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] downloadPurchase error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to generate download link' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI LEARNING ASSISTANT (Enterprise)
// ─────────────────────────────────────────────────────────────────────────────

export const aiAsk = (_req: AuthRequest, res: Response): void => {
  void (async () => {
    try {
      const schoolId = _req.school?.id;
      const userId = _req.user?.userId;
      if (!schoolId) {
        res.status(400).json({ success: false, message: 'School context is required' });
        return;
      }
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const data = await LMSAIService.ask(_req.body, { schoolId, userId });
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      if (isZodError(error)) {
        res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
      } else if (error instanceof ApiError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
      } else {
        console.error('[LMS] aiAsk error:', error?.message ?? error);
        res.status(500).json({ success: false, message: 'AI request failed' });
      }
    }
  })();
};

export const aiSimplify = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.simplify(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiSimplify error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiFlashcards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.flashcards(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiFlashcards error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiPractice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.practice(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiPractice error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiExplainMistake = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.explainMistake(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiExplainMistake error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiGenerateAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.generateAssignment(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiGenerateAssignment error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiGenerateLessonPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.generateLessonPlan(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiGenerateLessonPlan error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiGenerateRubric = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.generateRubric(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiGenerateRubric error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

export const aiQuestionBank = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    const userId = req.user?.userId;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const data = await LMSAIService.questionBank(req.body, { schoolId, userId });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (isZodError(error)) {
      res.status(400).json({ success: false, message: zodMessage(error), code: 'LMS_AI_INVALID_INPUT' });
    } else if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] aiQuestionBank error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'AI request failed' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// Requirements: 14.1, 14.2, 26.8
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/analytics/overview?termId=...
 * School-wide LMS metrics: active lessons, assignments, avg completion/submission
 * rates, total learning time, and top lessons by engagement.
 * Requirements: 14.1, 13.1
 */
export const getAnalyticsOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const termId = req.query.termId as string | undefined;
    if (!termId) {
      res.status(400).json({ success: false, message: 'termId query parameter is required' });
      return;
    }

    const data = await LMSAnalyticsService.getOverview(schoolId, termId);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getAnalyticsOverview error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve analytics overview' });
    }
  }
};

/**
 * GET /api/lms/analytics/class/:classId?termId=...
 * Per-class metrics: lessons started/completed, avg completion %, session time,
 * and active learner count.
 * Requirements: 14.1, 13.2
 */
export const getClassAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { classId } = req.params;
    const termId = req.query.termId as string | undefined;
    if (!termId) {
      res.status(400).json({ success: false, message: 'termId query parameter is required' });
      return;
    }

    const data = await LMSAnalyticsService.getClassAnalytics(classId, schoolId, termId);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getClassAnalytics error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve class analytics' });
    }
  }
};

/**
 * GET /api/lms/analytics/learner/:learnerId?termId=...
 * Individual learner analytics: lessons started/completed, total learning minutes,
 * assignment submission rate, and average mark.
 *
 * PARENT access guard (Requirement 14.2):
 * When the authenticated user has role PARENT, the requested learner's
 * parentId must match the authenticated user's id. Any attempt to view
 * another learner's data returns 403.
 *
 * Requirements: 14.1, 14.2, 13.3
 */
export const getLearnerAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const { learnerId } = req.params;
    const termId = req.query.termId as string | undefined;
    if (!termId) {
      res.status(400).json({ success: false, message: 'termId query parameter is required' });
      return;
    }

    // Requirement 14.2: PARENT role may only fetch analytics for their own child.
    const role = req.user?.role ?? '';
    if (role === 'PARENT') {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { parentId: true },
      });

      if (!learner) {
        res.status(404).json({ success: false, message: 'Learner not found', code: 'LMS_LEARNER_NOT_FOUND' });
        return;
      }

      if (learner.parentId !== userId) {
        res
          .status(403)
          .json({ success: false, message: 'Access denied: not your child', code: 'LMS_PARENT_ACCESS_DENIED' });
        return;
      }
    }

    const data = await LMSAnalyticsService.getLearnerAnalytics(learnerId, schoolId, termId);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLearnerAnalytics error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve learner analytics' });
    }
  }
};

/**
 * GET /api/lms/analytics/assignments?termId=...
 * Per-assignment analytics for the school + term: submission rates, avg marks,
 * pending marking counts.
 * Requirements: 14.1, 13.4
 */
export const getAssignmentAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const termId = req.query.termId as string | undefined;
    if (!termId) {
      res.status(400).json({ success: false, message: 'termId query parameter is required' });
      return;
    }

    const data = await LMSAnalyticsService.getAssignmentAnalytics(schoolId, termId);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getAssignmentAnalytics error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve assignment analytics' });
    }
  }
};

/**
 * GET /api/lms/analytics/lessons
 * Per-lesson engagement statistics for all non-archived lessons in the school:
 * view counts, avg completion %, avg time spent.
 * Requirements: 14.1, 13.5, 26.8
 */
export const getLessonEngagementStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const data = await LMSAnalyticsService.getLessonEngagementStats(schoolId);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLessonEngagementStats error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve lesson engagement stats' });
    }
  }
};

export const getMarketplaceAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }
    const sellerId = req.user?.userId;
    if (!sellerId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const analytics = await LMSMarketplaceService.getMarketplaceAnalytics(sellerId, schoolId);
    res.status(200).json({ success: true, data: analytics });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getMarketplaceAnalytics error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to fetch marketplace analytics' });
    }
  }
};

/**
 * GET /api/lms/analytics/leaderboard?limit=10
 * School-wide XP leaderboard, ranked by total achievement XP earned.
 */
export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await LMSAchievementsService.getLeaderboard({ schoolId, limit });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLeaderboard error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve leaderboard' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/settings
 *
 * Returns the current LMS settings for the authenticated school.
 * Reads from Redis cache (TTL 10 min); on miss, queries DB and creates
 * a default record if none exists yet.
 *
 * Requirements: 16.1, 16.2, 22.1
 */
export const getLmsSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const settings = await LMSSettingsService.getSettings(schoolId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLmsSettings error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve LMS settings' });
    }
  }
};

// All 23 configurable field names — used to strip unknown keys from PUT body
const ALLOWED_SETTINGS_FIELDS: ReadonlySet<keyof LMSSettingsUpdateInput> = new Set([
  'enableLearning',
  'enableMarketplace',
  'enableAI',
  'enableRevisionLibrary',
  'allowLateSubmission',
  'allowResubmission',
  'maxUploadSizeMB',
  'allowedFileTypes',
  'assignmentDueTime',
  'enableComments',
  'enableStudentQuestions',
  'enableDownloads',
  'enableGamification',
  'enableXP',
  'enableBadges',
  'enableLeaderboards',
  'enableStreaks',
  'notifyParents',
  'showFeedbackToParents',
  'showProgressToParents',
  'marketplaceRevenuePct',
  'requireApproval',
  'allowFreeContent',
]);

/**
 * PUT /api/lms/settings
 *
 * Updates one or more of the 23 configurable LMS settings fields.
 * Unknown fields are silently ignored. After persisting, the Redis cache
 * entry for this school is invalidated.
 *
 * Requirements: 16.1, 16.3, 16.4, 22.1
 */
export const updateLmsSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    // Validate body is an object
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ success: false, message: 'Request body must be a JSON object' });
      return;
    }

    // Extract only the known/allowed fields from the request body
    const data: LMSSettingsUpdateInput = {};
    for (const key of ALLOWED_SETTINGS_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        (data as any)[key] = req.body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid settings fields provided',
        allowedFields: Array.from(ALLOWED_SETTINGS_FIELDS),
      });
      return;
    }

    const updated = await LMSSettingsService.updateSettings(schoolId, data);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateLmsSettings error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update LMS settings' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/lms/courses
 * Creates a new LMS course. The authenticated user becomes the course creator.
 */
export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { title, description, subject, grade, category, status = 'DRAFT' } = req.body;

    if (!title || !subject || !grade || !category) {
      res.status(400).json({ success: false, message: 'title, subject, grade and category are required' });
      return;
    }

    const course = await prisma.lMSCourse.create({
      data: {
        title,
        description: description ?? null,
        subject,
        grade,
        category,
        status,
        createdById: userId,
      },
    });

    res.status(201).json({ success: true, data: course });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] createCourse error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to create course' });
    }
  }
};

/**
 * GET /api/lms/courses/:id
 * Retrieves a single LMS course by its ID.
 */
export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const course = await prisma.lMSCourse.findUnique({ where: { id } });

    if (!course || course.archived) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }

    res.json({ success: true, data: course });
  } catch (error: any) {
    console.error('[LMS] getCourseById error:', error?.message ?? error);
    res.status(500).json({ success: false, message: 'Failed to retrieve course' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD & ENROLLMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/dashboard/stats
 * Surfaced dashboard statistics.
 */
export const getLMSDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await lmsService.getLMSDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[LMS] getLMSDashboardStats error:', error?.message ?? error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats' });
  }
};

/**
 * GET /api/lms/enrollments
 * Get list of enrollments with optional filtering.
 *
 * Role scoping: STUDENT is forced to their own learnerId regardless of the
 * query param; PARENT must supply learnerId and may only query their own
 * child; TEACHER/HEAD_TEACHER/ADMIN/SUPER_ADMIN are unrestricted.
 */
export const getEnrollments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role ?? '';
    const userId = req.user?.userId;
    let learnerId = req.query.learnerId as string | undefined;

    if (role === 'STUDENT') {
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const selfLearner = await lmsService.getStudentLearnerByUserId(userId);
      learnerId = selfLearner.id; // force scope to self, ignore any query override
    } else if (role === 'PARENT') {
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      if (!learnerId) {
        res.status(400).json({ success: false, message: 'learnerId is required' });
        return;
      }
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { parentId: true },
      });
      if (!learner) {
        res.status(404).json({ success: false, message: 'Learner not found', code: 'LMS_LEARNER_NOT_FOUND' });
        return;
      }
      if (learner.parentId !== userId) {
        res
          .status(403)
          .json({ success: false, message: 'Access denied: not your child', code: 'LMS_PARENT_ACCESS_DENIED' });
        return;
      }
    }
    // TEACHER / HEAD_TEACHER / ADMIN / SUPER_ADMIN: unrestricted

    const filters = {
      courseId: req.query.courseId as string | undefined,
      learnerId,
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await lmsService.getEnrollments(filters);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getEnrollments error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve enrollments' });
    }
  }
};

/**
 * POST /api/lms/enrollments
 * Enroll a learner in a course.
 */
export const enrollLearner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { courseId, learnerId } = req.body;
    if (!courseId || !learnerId) {
      res.status(400).json({ success: false, message: 'courseId and learnerId are required' });
      return;
    }

    const enrollment = await lmsService.enrollLearner({
      courseId,
      learnerId,
      enrolledById: userId,
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] enrollLearner error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to enroll learner' });
    }
  }
};

/**
 * DELETE /api/lms/enrollments/:id
 * Unenroll a learner.
 */
export const unenrollLearner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await lmsService.unenrollLearner(id);
    res.json({ success: true, message: 'Learner unenrolled successfully' });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] unenrollLearner error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to unenroll learner' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT PORTAL SPECIFIC ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/my-courses
 * Returns the active student's enrolled courses with progress details.
 */
export const getStudentCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await lmsService.getStudentCourses(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getStudentCourses error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve student courses' });
    }
  }
};

/**
 * GET /api/lms/my-courses/:courseId
 * Returns detailed progress of a course for the student.
 */
export const getStudentCourseDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { courseId } = req.params;
    const result = await lmsService.getStudentCourse(userId, courseId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getStudentCourseDetail error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve student course details' });
    }
  }
};

/**
 * GET /api/lms/my-assignments
 * Returns assignments across all enrolled courses for the student, using the
 * full assignment lifecycle service (LearningAssignment/LearningSubmission)
 * so the response includes class, learningArea, totalMarks, and mySubmission
 * (with marks) — not the legacy LMSCourse/LMSContent stub.
 */
export const getStudentAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await LMSAssignmentService.getStudentAssignments(userId, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getStudentAssignments error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve student assignments' });
    }
  }
};

/**
 * GET /api/lms/children/:learnerId/assignments
 * Returns published assignments (with submission status) for one of the
 * authenticated parent's children, or the authenticated student's own record.
 *
 * PARENT → own children only (via parentAccessService).
 * STUDENT → self only.
 * Staff roles → unrestricted (useful for teacher/admin views of a learner).
 *
 * Batch 4, Assessment UX Overhaul.
 */
export const getChildAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { learnerId } = req.params;
    const role   = req.user?.role ?? '';
    const userId = req.user?.userId;
    const schoolId = req.school?.id;

    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // ── Access control ───────────────────────────────────────────────────
    if (role === 'STUDENT') {
      const selfLearner = await lmsService.getStudentLearnerByUserId(userId);
      if (selfLearner.id !== learnerId) {
        res.status(403).json({ success: false, message: 'Access denied: not your own record' });
        return;
      }
    } else if (role === 'PARENT') {
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { parentId: true },
      });
      if (!learner) {
        res.status(404).json({ success: false, message: 'Learner not found' });
        return;
      }
      if (learner.parentId !== userId) {
        // Also allow access via parentAccessService (linked family accounts)
        const { parentAccessService: pas } = await import('../services/parent-access.service');
        const accessible = await pas.getAccessibleLearnerIds(userId);
        if (!accessible.includes(learnerId)) {
          res.status(403).json({ success: false, message: 'Access denied: not your child' });
          return;
        }
      }
    }
    // TEACHER / HEAD_TEACHER / ADMIN / SUPER_ADMIN: no extra restriction

    const result = await LMSAssignmentService.getChildAssignments(learnerId, schoolId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getChildAssignments error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve child assignments' });
    }
  }
};

/**
 * PUT /api/lms/my-progress
 * Updates the student's progress for a content item.
 */
export const updateStudentProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { enrollmentId, contentItemId, completed, progress, timeSpent } = req.body;
    if (!enrollmentId || !contentItemId) {
      res.status(400).json({ success: false, message: 'enrollmentId and contentItemId are required' });
      return;
    }

    const result = await lmsService.updateStudentProgress(userId, enrollmentId, {
      contentId: contentItemId,
      completed,
      progress,
      timeSpent,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] updateStudentProgress error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to update student progress' });
    }
  }
};

/**
 * GET /api/lms/progress/:learnerId/:courseId
 * Content-level progress for a specific learner within a specific legacy
 * LMSCourse (total content items, completed items, per-item completion).
 * Uses the pre-existing LMSService.getLearnerProgress implementation, which
 * was previously unreachable — no route or controller ever called it.
 *
 * Access: TEACHER/HEAD_TEACHER/ADMIN/SUPER_ADMIN may view any learner;
 * STUDENT may only view their own record; PARENT may only view their own
 * children (Requirement 14.2 pattern, mirrored from getLearnerAnalytics).
 */
export const getLearnerProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { learnerId, courseId } = req.params;
    const role = req.user?.role ?? '';
    const userId = req.user?.userId;

    if (role === 'STUDENT') {
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const selfLearner = await lmsService.getStudentLearnerByUserId(userId);
      if (selfLearner.id !== learnerId) {
        res.status(403).json({ success: false, message: 'Access denied: not your own record' });
        return;
      }
    } else if (role === 'PARENT') {
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { parentId: true },
      });
      if (!learner) {
        res.status(404).json({ success: false, message: 'Learner not found', code: 'LMS_LEARNER_NOT_FOUND' });
        return;
      }
      if (learner.parentId !== userId) {
        res
          .status(403)
          .json({ success: false, message: 'Access denied: not your child', code: 'LMS_PARENT_ACCESS_DENIED' });
        return;
      }
    }
    // TEACHER / HEAD_TEACHER / ADMIN / SUPER_ADMIN: no extra restriction

    const result = await lmsService.getLearnerProgress(learnerId, courseId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getLearnerProgress error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve learner progress' });
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/lms/achievements
 * Returns the authenticated student's XP, level, streak and earned badges.
 * Streak-based achievements (7/30-day) are computed and awarded on read.
 * Student-only — staff/parent roles receive 403.
 */
export const getAchievements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.school?.id;
    if (!schoolId) {
      res.status(400).json({ success: false, message: 'School context is required' });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const data = await LMSAchievementsService.getMyAchievements({ userId, schoolId });
    res.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    } else {
      console.error('[LMS] getAchievements error:', error?.message ?? error);
      res.status(500).json({ success: false, message: 'Failed to retrieve achievements' });
    }
  }
};
