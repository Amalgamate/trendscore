/**
 * Assessment Routes
 * Routes for formative and summative assessments
 */

import express from 'express';
import { z } from 'zod';
import * as assessmentController from '../controllers/assessmentController';
import * as setupController from '../controllers/setupController';
import { authenticate } from '../middleware/auth.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';
import { auditLog, ResourceAccessControl, requireRole } from '../middleware/permissions.middleware';
import { checkNotLocked } from '../middleware/workflow.authorization';

const router = express.Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createFormativeAssessmentSchema = z.object({
  learnerId: z.string().min(1, 'learnerId is required'),
  learningArea: z.string().min(1, 'learningArea is required'),
  strand: z.string().optional(),
  subStrand: z.string().optional(),
  term: z.preprocess((v) => {
    const raw = String(v || '').toUpperCase().trim();
    if (raw === 'TERM 1') return 'TERM_1';
    if (raw === 'TERM 2') return 'TERM_2';
    if (raw === 'TERM 3') return 'TERM_3';
    return raw;
  }, z.enum(['TERM_1', 'TERM_2', 'TERM_3'])),
  academicYear: z.coerce.number().int().min(2020).max(2100),
  overallRating: z.enum(['EE', 'ME', 'AE', 'BE']),
  detailedRating: z.enum(['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']).optional(),
  teacherComment: z.string().max(1000).optional(),
  nextSteps: z.string().max(1000).optional(),
  weight: z.coerce.number().min(0).max(100).optional(),
  title: z.string().max(255).optional(),
  type: z.enum([
    'OPENER', 'WEEKLY', 'MONTHLY', 'CAT', 'MID_TERM',
    'ASSIGNMENT', 'PROJECT', 'PRACTICAL', 'QUIZ',
    'OBSERVATION', 'ORAL', 'EXAM', 'OTHER'
  ]).optional()
});

// ── Summative test creation schema ────────────────────────────────────────────
// FIXED: 
//  1. Added `type` as a passthrough alias for `testType` — the useSummativeTestForm
//     hook sends both `type` and `testType`; the controller reads `testType`. 
//     Keeping both in the schema ensures Zod never strips either.
//  2. Removed fragile `.refine()` chains — replaced with individual `.min(1)` 
//     guards. The controller's own guard ("Missing required fields") is the 
//     authoritative validator; the Zod schema's job is only to coerce types and 
//     strip obvious garbage, not to re-implement business logic.
//  3. Made `grade` accept any non-empty string so the schema never silently 
//     rejects a grade that's valid in the DB but not in this enum list.
//  4. Removed the broken `data.term && data.academicYear` refine — after 
//     preprocessing, `term` becomes the parsed value which is always truthy when 
//     present, but the refine ran on the intermediate object and was unreliable.
const createSummativeTestSchema = z.object({
  // Title fields — both accepted, controller merges them
  title: z.string().max(500).optional(),
  name: z.string().max(500).optional(),

  // `type` is what useSummativeTestForm sends; `testType` is what BulkCreateTest
  // and the controller's destructuring both use. Accept both so nothing is stripped.
  type: z.string().optional(),
  testType: z.string().optional(),

  // Grade — any valid string (DB-side enum enforced by Prisma, not Zod)
  grade: z.string().optional(),

  // Term — normalised from "Term 1" → "TERM_1" etc.
  term: z.preprocess((value) => {
    if (!value) return value;
    const raw = String(value).toUpperCase().trim();
    if (raw === 'TERM 1' || raw === 'TERM1') return 'TERM_1';
    if (raw === 'TERM 2' || raw === 'TERM2') return 'TERM_2';
    if (raw === 'TERM 3' || raw === 'TERM3') return 'TERM_3';
    return raw;
  }, z.string().optional()),

  academicYear: z.coerce.number().int().min(2020).max(2100).optional(),
  testDate: z.string().optional(),

  // Marks — coerced from string inputs
  totalMarks: z.coerce.number().int().min(1).max(1000).optional(),
  maxScore:   z.coerce.number().int().min(1).max(1000).optional(),
  passMarks:  z.coerce.number().int().min(0).max(1000).optional(),
  duration:   z.coerce.number().int().min(1).max(600).optional(),

  // Subject
  learningArea:   z.string().optional(),
  learningAreaId: z.string().optional(),

  // Misc
  description:  z.string().optional(),
  instructions: z.string().optional(),
  stream:       z.string().optional(),
  curriculum:   z.string().optional(),
  scaleId:      z.string().nullable().optional(),
  scaleGroupId: z.string().nullable().optional(),
  weight:       z.coerce.number().min(0).max(100).optional(),
  status:       z.string().optional(),
  published:    z.boolean().optional(),
  active:       z.boolean().optional(),

  // Extra fields the hooks may pass through — accepted and forwarded
  createdBy:  z.string().optional(),
  scaleName:  z.string().optional(),
});

const recordSummativeResultSchema = z.object({
  testId: z.string().min(1),
  learnerId: z.string().min(1),
  marksObtained: z.coerce.number().min(0).optional(),
  rawScore: z.coerce.number().min(0).optional(),
  assessmentStatusCode: z.enum(['X', 'Y', 'Z', 'EX', 'TR', 'WD']).optional(),
  remarks: z.string().max(500).optional(),
  teacherComment: z.string().max(1000).optional(),
  moderationComment: z.string().max(1000).optional(),
});

// ============================================
// FORMATIVE ASSESSMENT ROUTES
// ============================================

router.post(
  '/formative',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createFormativeAssessmentSchema),
  checkNotLocked,
  auditLog('CREATE_FORMATIVE_ASSESSMENT'),
  assessmentController.createFormativeAssessment
);

router.post(
  '/formative/bulk',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  // Bulk formative uses upsert; lock checks are enforced inside the controller.
  auditLog('RECORD_FORMATIVE_BULK'),
  assessmentController.recordFormativeResultsBulk
);

router.get(
  '/formative',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getFormativeAssessments
);

router.get(
  '/formative/bulk',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  assessmentController.getBulkFormativeResults
);

router.get(
  '/formative/learner/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getFormativeByLearner
);

router.delete(
  '/formative/:id',
  authenticate,
  ResourceAccessControl.canAccessAssessment(),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_FORMATIVE_ASSESSMENT'),
  assessmentController.deleteFormativeAssessment
);

// ============================================
// SUMMATIVE TEST ROUTES
// ============================================

// Single test creation — uses the relaxed schema above
router.post(
  '/tests',
  authenticate,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(createSummativeTestSchema),
  auditLog('CREATE_SUMMATIVE_TEST'),
  assessmentController.createSummativeTest
);

// Bulk test creation — no per-test schema needed; controller validates internally
router.post(
  '/tests/bulk',
  authenticate,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  auditLog('GENERATE_TESTS_BULK'),
  assessmentController.generateTestsBulk
);

router.get(
  '/tests',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getSummativeTests
);

router.get(
  '/tests/:id',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getSummativeTest
);

router.put(
  '/tests/:id',
  authenticate,
  ResourceAccessControl.canAccessAssessment(),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('UPDATE_SUMMATIVE_TEST'),
  assessmentController.updateSummativeTest
);

router.delete(
  '/tests/bulk',
  authenticate,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('DELETE_TESTS_BULK'),
  assessmentController.deleteSummativeTestsBulk
);

router.delete(
  '/tests/:id',
  authenticate,
  requireRole(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  ResourceAccessControl.canAccessAssessment(),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_SUMMATIVE_TEST'),
  assessmentController.deleteSummativeTest
);

// ============================================
// SUMMATIVE RESULT ROUTES
// ============================================

router.post(
  '/summative/results',
  authenticate,
  ResourceAccessControl.canAccessAssessment(),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(recordSummativeResultSchema),
  checkNotLocked,
  auditLog('RECORD_SUMMATIVE_RESULT'),
  assessmentController.recordSummativeResult
);

router.post(
  '/summative/results/bulk',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  // NOTE: checkNotLocked is NOT applied here because the testId comes from
  // the request body, not params, and checkNotLocked only reads req.params.
  // The controller's own test lookup handles the "not found" case cleanly.
  auditLog('RECORD_SUMMATIVE_BULK'),
  assessmentController.recordSummativeResultsBulk
);

router.get(
  '/summative/results/bulk',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getBulkSummativeResults
);

router.get(
  '/summative/results/learner/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getSummativeByLearner
);

router.get(
  '/summative/results/test/:testId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  assessmentController.getTestResults
);

// ============================================
// SCHOOL SETUP ROUTES — BULK OPERATIONS
// ============================================

router.post(
  '/setup/create-scales',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SETUP_CREATE_SCALES'),
  setupController.bulkCreateGradingScales
);

router.post(
  '/setup/create-tests',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SETUP_CREATE_TESTS'),
  setupController.bulkCreateSummativeTests
);

router.post(
  '/setup/complete',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SETUP_COMPLETE_SCHOOL'),
  setupController.completeSchoolSetup
);

router.post(
  '/setup/reset',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('SETUP_RESET_DATABASE'),
  setupController.resetAssessments
);

export default router;
