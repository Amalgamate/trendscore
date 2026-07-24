/**
 * LMS Routes — Digital Learning Hub
 *
 * Registers all LMS API endpoints with appropriate middleware:
 *   - authenticate (applied globally in index.ts before this router)
 *   - requireApp('lms-professional') for all routes (index.ts mount)
 *   - requireApp('lms-enterprise') for Marketplace + AI groups (per-route)
 *   - requirePermission(...) for RBAC
 *   - requireCsrf for state-mutating routes (POST / PUT / DELETE)
 *
 * Mount point: /api/lms  (see server/src/routes/index.ts)
 *
 * Requirements: 17.1, 17.2, 17.3, 17.6
 *
 * @module routes/lms.routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requirePermission } from '../middleware/permissions.middleware';
import { requireApp } from '../middleware/requireApp';
import { requireCsrf } from '../middleware/csrf.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import upload from '../middleware/upload.middleware';
import { authenticate } from '../middleware/auth.middleware';
import * as lmsController from '../controllers/lms.controller';

const router = Router();

// Apply JWT authentication to all LMS routes
router.use(authenticate);

// ─── AI rate limit preset (10 req / min per client) ────────────────────────
const aiRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 10 });

// ═══════════════════════════════════════════════════════════════════════════════
// LESSONS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/lms/lessons — list lessons */
router.get(
  '/lessons',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLessons
);

/** GET /api/lms/lessons/:id — lesson with blocks */
router.get(
  '/lessons/:id',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLessonWithBlocks
);

/** POST /api/lms/lessons — create lesson (draft) */
router.post(
  '/lessons',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  lmsController.createLesson
);

/** PUT /api/lms/lessons/:id — update lesson metadata */
router.put(
  '/lessons/:id',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  lmsController.updateLesson
);

/** POST /api/lms/lessons/:id/blocks — upsert lesson blocks */
router.post(
  '/lessons/:id/blocks',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  lmsController.upsertBlocks
);

/** PUT /api/lms/lessons/:id/publish — publish lesson */
router.put(
  '/lessons/:id/publish',
  requirePermission('LESSON_PUBLISH'),
  requireCsrf,
  lmsController.publishLesson
);

/** DELETE /api/lms/lessons/:id — archive lesson */
router.delete(
  '/lessons/:id',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  lmsController.archiveLesson
);

/** POST /api/lms/lessons/:id/progress — mark block complete */
router.post(
  '/lessons/:id/progress',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.markLessonProgress
);

/** GET /api/lms/lessons/:id/progress — get learner progress */
router.get(
  '/lessons/:id/progress',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLessonProgress
);

/** POST /api/lms/lessons/:id/session — start lesson session */
router.post(
  '/lessons/:id/session',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.startLessonSession
);

/** PUT /api/lms/lessons/sessions/:sessionId — end lesson session */
router.put(
  '/lessons/sessions/:sessionId',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.endLessonSession
);

/**
 * POST /api/lms/lessons/media — upload a single media file (image/video/audio/
 * pdf/diagram) for use inside a lesson block. Returns a hosted URL that the
 * block editor sets onto content.url before saving via /lessons/:id/blocks.
 */
router.post(
  '/lessons/media',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  upload.single('file'),
  lmsController.uploadLessonMedia
);

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/lms/assignments — list assignments (role-scoped in service layer) */
router.get(
  '/assignments',
  requirePermission('LEARNING_VIEW'),
  lmsController.getAssignments
);

/** GET /api/lms/assignments/:id — assignment detail */
router.get(
  '/assignments/:id',
  requirePermission('LEARNING_VIEW'),
  lmsController.getAssignmentDetail
);

/** POST /api/lms/assignments — create assignment */
router.post(
  '/assignments',
  requirePermission('ASSIGNMENT_CREATE'),
  requireCsrf,
  lmsController.createAssignment
);

/** PUT /api/lms/assignments/:id — update assignment */
router.put(
  '/assignments/:id',
  requirePermission('ASSIGNMENT_CREATE'),
  requireCsrf,
  lmsController.updateAssignment
);

/** POST /api/lms/assignments/:id/publish — publish assignment */
router.post(
  '/assignments/:id/publish',
  requirePermission('ASSIGNMENT_CREATE'),
  requireCsrf,
  lmsController.publishAssignment
);

/** POST /api/lms/assignments/:id/close — close assignment */
router.post(
  '/assignments/:id/close',
  requirePermission('ASSIGNMENT_CREATE'),
  requireCsrf,
  lmsController.closeAssignment
);

/** DELETE /api/lms/assignments/:id — archive assignment */
router.delete(
  '/assignments/:id',
  requirePermission('ASSIGNMENT_CREATE'),
  requireCsrf,
  lmsController.archiveAssignment
);

/** GET /api/lms/assignments/:id/submissions — all submissions for an assignment */
router.get(
  '/assignments/:id/submissions',
  requirePermission('ASSIGNMENT_MARK'),
  lmsController.getSubmissions
);

/** POST /api/lms/assignments/:id/submit — student submits assignment (with files) */
router.post(
  '/assignments/:id/submit',
  requirePermission('ASSIGNMENT_SUBMIT'),
  requireCsrf,
  upload.array('files', 10),
  lmsController.submitAssignment
);

/** PUT /api/lms/submissions/:id — update draft submission */
router.put(
  '/submissions/:id',
  requirePermission('ASSIGNMENT_SUBMIT'),
  requireCsrf,
  lmsController.updateDraftSubmission
);

/** POST /api/lms/submissions/:id/mark — mark a submission */
router.post(
  '/submissions/:id/mark',
  requirePermission('ASSIGNMENT_MARK'),
  requireCsrf,
  lmsController.markSubmission
);

router.post(
  '/submissions/:id/return',
  requirePermission('ASSIGNMENT_MARK'),
  requireCsrf,
  lmsController.returnSubmissionForCorrection,
);

/** GET /api/lms/submissions/my — learner's own submissions */
router.get(
  '/submissions/my',
  requirePermission('ASSIGNMENT_SUBMIT'),
  lmsController.getMySubmissions
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES (REVISION LIBRARY)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/lms/resources — search/list resources */
router.get(
  '/resources',
  requirePermission('LEARNING_VIEW'),
  lmsController.searchResources
);

/** GET /api/lms/resources/:id — resource detail */
router.get(
  '/resources/:id',
  requirePermission('LEARNING_VIEW'),
  lmsController.getResourceDetail
);

/** POST /api/lms/resources — upload resource (single file) */
router.post(
  '/resources',
  requirePermission('LEARNING_MANAGE'),
  requireCsrf,
  upload.single('file'),
  lmsController.createResource
);

/** PUT /api/lms/resources/:id — update resource metadata */
router.put(
  '/resources/:id',
  requirePermission('LEARNING_MANAGE'),
  requireCsrf,
  lmsController.updateResource
);

/** DELETE /api/lms/resources/:id — archive resource */
router.delete(
  '/resources/:id',
  requirePermission('LEARNING_MANAGE'),
  requireCsrf,
  lmsController.archiveResource
);

/** POST /api/lms/resources/:id/download — generate signed download URL */
router.post(
  '/resources/:id/download',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.downloadResource
);

/** POST /api/lms/resources/:id/bookmark — toggle bookmark */
router.post(
  '/resources/:id/bookmark',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.toggleBookmark
);

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE  (Enterprise tier — requireApp('lms-enterprise') on all routes)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * M-Pesa STK push callback — PUBLIC, no auth, no enterprise gate.
 * Must be registered BEFORE the lms-enterprise guard block below
 * so it is not intercepted by requireApp('lms-enterprise').
 *
 * IP allowlisting / Safaricom signature verification is handled
 * inside the controller / service layer.
 */
router.post(
  '/marketplace/mpesa-callback',
  lmsController.handleMpesaCallback
);

// All remaining marketplace routes require lms-enterprise.
// Using a sub-router avoids repeating requireApp on every route.
const enterpriseRouter = Router();
enterpriseRouter.use(requireApp('lms-enterprise'));

enterpriseRouter.get(
  '/marketplace',
  requirePermission('LEARNING_VIEW'),
  lmsController.browseListings
);

enterpriseRouter.get(
  '/marketplace/my-listings',
  requirePermission('MARKETPLACE_PUBLISH'),
  lmsController.getMyListings
);

enterpriseRouter.get(
  '/marketplace/my-purchases',
  requirePermission('MARKETPLACE_PURCHASE'),
  lmsController.getMyPurchases
);

enterpriseRouter.get(
  '/marketplace/:id',
  requirePermission('LEARNING_VIEW'),
  lmsController.getListingDetail
);

enterpriseRouter.post(
  '/marketplace',
  requirePermission('MARKETPLACE_PUBLISH'),
  requireCsrf,
  lmsController.createListing
);

enterpriseRouter.post(
  '/marketplace/:id/approve',
  requirePermission('MARKETPLACE_APPROVE'),
  requireCsrf,
  lmsController.approveListing
);

enterpriseRouter.post(
  '/marketplace/:id/reject',
  requirePermission('MARKETPLACE_APPROVE'),
  requireCsrf,
  lmsController.rejectListing
);

enterpriseRouter.post(
  '/marketplace/:id/purchase',
  requirePermission('MARKETPLACE_PURCHASE'),
  requireCsrf,
  lmsController.initiatePurchase
);

enterpriseRouter.post(
  '/marketplace/purchases/:id/download',
  requirePermission('MARKETPLACE_PURCHASE'),
  requireCsrf,
  lmsController.downloadPurchase
);

enterpriseRouter.post(
  '/marketplace/purchases/:id/rate',
  requirePermission('MARKETPLACE_PURCHASE'),
  requireCsrf,
  lmsController.rateResource
);

// ─── AI LEARNING ASSISTANT (Enterprise + rate-limited) ──────────────────────

enterpriseRouter.post(
  '/ai/ask',
  requirePermission('LEARNING_VIEW'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiAsk
);

enterpriseRouter.post(
  '/ai/simplify',
  requirePermission('LEARNING_VIEW'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiSimplify
);

enterpriseRouter.post(
  '/ai/flashcards',
  requirePermission('LEARNING_VIEW'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiFlashcards
);

enterpriseRouter.post(
  '/ai/practice',
  requirePermission('LEARNING_VIEW'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiPractice
);

enterpriseRouter.post(
  '/ai/explain-mistake',
  requirePermission('LEARNING_VIEW'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiExplainMistake
);

enterpriseRouter.post(
  '/ai/generate-assignment',
  requirePermission('LESSON_CREATE'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiGenerateAssignment
);

enterpriseRouter.post(
  '/ai/generate-lesson-plan',
  requirePermission('LESSON_CREATE'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiGenerateLessonPlan
);

enterpriseRouter.post(
  '/ai/generate-rubric',
  requirePermission('ASSIGNMENT_CREATE'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiGenerateRubric
);

enterpriseRouter.post(
  '/ai/question-bank',
  requirePermission('LESSON_CREATE'),
  aiRateLimit,
  requireCsrf,
  lmsController.aiQuestionBank
);

// Mount enterprise sub-router onto the main LMS router
router.use('/', enterpriseRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/analytics/overview',
  requirePermission('ANALYTICS_LEARNING'),
  lmsController.getAnalyticsOverview
);

router.get(
  '/analytics/class/:classId',
  requirePermission('ANALYTICS_LEARNING'),
  lmsController.getClassAnalytics
);

router.get(
  '/analytics/learner/:learnerId',
  requirePermission('ANALYTICS_LEARNING'),
  lmsController.getLearnerAnalytics
);

router.get(
  '/analytics/assignments',
  requirePermission('ANALYTICS_LEARNING'),
  lmsController.getAssignmentAnalytics
);

router.get(
  '/analytics/lessons',
  requirePermission('ANALYTICS_LEARNING'),
  lmsController.getLessonEngagementStats
);

router.get(
  '/analytics/marketplace',
  requirePermission('MARKETPLACE_PUBLISH'),
  lmsController.getMarketplaceAnalytics
);

router.get(
  '/analytics/leaderboard',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLeaderboard
);

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/settings',
  requirePermission('LEARNING_MANAGE'),
  lmsController.getLmsSettings
);

router.put(
  '/settings',
  requirePermission('LEARNING_MANAGE'),
  requireCsrf,
  lmsController.updateLmsSettings
);

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD & ENROLLMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/lms/dashboard/stats — dashboard overview stats */
router.get(
  '/dashboard/stats',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLMSDashboardStats
);

/** GET /api/lms/enrollments — search/list enrollments */
router.get(
  '/enrollments',
  requirePermission('LEARNING_VIEW'),
  lmsController.getEnrollments
);

/** POST /api/lms/enrollments — enroll a learner */
router.post(
  '/enrollments',
  requirePermission('MANAGE_ENROLLMENTS'),
  requireCsrf,
  lmsController.enrollLearner
);

/** DELETE /api/lms/enrollments/:id — unenroll a learner */
router.delete(
  '/enrollments/:id',
  requirePermission('MANAGE_ENROLLMENTS'),
  requireCsrf,
  lmsController.unenrollLearner
);

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT PORTAL SPECIFIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/lms/my-courses — active student's courses */
router.get(
  '/my-courses',
  requirePermission('LEARNING_VIEW'),
  lmsController.getStudentCourses
);

/** GET /api/lms/my-courses/:courseId — progress details of a course */
router.get(
  '/my-courses/:courseId',
  requirePermission('LEARNING_VIEW'),
  lmsController.getStudentCourseDetail
);

/** GET /api/lms/my-assignments — assignments across student's courses */
router.get(
  '/my-assignments',
  requirePermission('LEARNING_VIEW'),
  lmsController.getStudentAssignments
);

/**
 * GET /api/lms/children/:learnerId/assignments
 * Parent-facing: assignments for one of the parent's children, with submission
 * status per assignment. Also accessible by the student themselves and staff.
 * Batch 4, Assessment UX Overhaul.
 */
router.get(
  '/children/:learnerId/assignments',
  requirePermission('LEARNING_VIEW'),
  lmsController.getChildAssignments
);

/** PUT /api/lms/my-progress — update student course progress */
router.put(
  '/my-progress',
  requirePermission('LEARNING_VIEW'),
  requireCsrf,
  lmsController.updateStudentProgress
);

/**
 * GET /api/lms/progress/:learnerId/:courseId
 * Content-level progress for a learner within a specific legacy LMSCourse.
 * Role scoping (self/own-child/any) is enforced in the controller.
 */
router.get(
  '/progress/:learnerId/:courseId',
  requirePermission('LEARNING_VIEW'),
  lmsController.getLearnerProgress
);

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /api/lms/courses — create a new course */
router.post(
  '/courses',
  requirePermission('LESSON_CREATE'),
  requireCsrf,
  lmsController.createCourse
);

/** GET /api/lms/courses/:id — retrieve course by ID */
router.get(
  '/courses/:id',
  requirePermission('LEARNING_VIEW'),
  lmsController.getCourseById
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/achievements',
  requirePermission('LEARNING_VIEW'),
  lmsController.getAchievements
);

export default router;
