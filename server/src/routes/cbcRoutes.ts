/**
 * CBC Assessment Routes
 * Routes for Core Competencies, Values, and Co-Curricular Activities
 */

import express from 'express';
import { z } from 'zod';
import * as cbcController from '../controllers/cbcController';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, auditLog } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { validate } from '../middleware/validation.middleware';

const router = express.Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const DETAILED_RATING = z.enum(['EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']);
const TERM_ENUM = z.preprocess((v) => {
  const raw = String(v || '').toUpperCase().trim();
  if (raw === 'TERM 1') return 'TERM_1';
  if (raw === 'TERM 2') return 'TERM_2';
  if (raw === 'TERM 3') return 'TERM_3';
  return raw;
}, z.enum(['TERM_1', 'TERM_2', 'TERM_3']));

const competenciesSchema = z.object({
  learnerId: z.string().min(1),
  term: TERM_ENUM,
  academicYear: z.coerce.number().int().min(2020).max(2100),
  communication: DETAILED_RATING,
  communicationComment: z.string().max(500).optional(),
  criticalThinking: DETAILED_RATING,
  criticalThinkingComment: z.string().max(500).optional(),
  creativity: DETAILED_RATING,
  creativityComment: z.string().max(500).optional(),
  collaboration: DETAILED_RATING,
  collaborationComment: z.string().max(500).optional(),
  citizenship: DETAILED_RATING,
  citizenshipComment: z.string().max(500).optional(),
  learningToLearn: DETAILED_RATING,
  learningToLearnComment: z.string().max(500).optional(),
});

const competenciesBulkSchema = z.object({
  records: z.array(competenciesSchema).min(1, 'At least one record is required')
});

const valuesSchema = z.object({
  learnerId: z.string().min(1),
  term: TERM_ENUM,
  academicYear: z.coerce.number().int().min(2020).max(2100),
  love: DETAILED_RATING,
  responsibility: DETAILED_RATING,
  respect: DETAILED_RATING,
  unity: DETAILED_RATING,
  peace: DETAILED_RATING,
  patriotism: DETAILED_RATING,
  integrity: DETAILED_RATING,
  comment: z.string().max(1000).optional(),
});

const valuesBulkSchema = z.object({
  records: z.array(valuesSchema).min(1, 'At least one record is required')
});

const coCurricularSchema = z.object({
  learnerId: z.string().min(1),
  term: TERM_ENUM,
  academicYear: z.coerce.number().int().min(2020).max(2100),
  activityName: z.string().min(1).max(255),
  activityType: z.string().min(1).max(100),
  performance: DETAILED_RATING,
  achievements: z.string().max(1000).optional(),
  remarks: z.string().max(1000).optional(),
});

const coCurricularBulkSchema = z.object({
  records: z.array(coCurricularSchema).min(1, 'At least one record is required')
});

const reportCommentsSchema = z.object({
  learnerId: z.string().min(1),
  term: TERM_ENUM,
  academicYear: z.coerce.number().int().min(2020).max(2100),
  classTeacherComment: z.string().min(1).max(2000),
  classTeacherName: z.string().min(1).max(255),
  classTeacherSignature: z.string().max(500).optional(),
  headTeacherComment: z.string().max(2000).optional(),
  headTeacherName: z.string().max(255).optional(),
  headTeacherSignature: z.string().max(500).optional(),
  nextTermOpens: z.string().min(1),
});

// ============================================
// CORE COMPETENCIES
// ============================================

router.get(
  '/holistic-summary',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  cbcController.getHolisticSummary
);

router.post(
  '/competencies',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(competenciesSchema),
  auditLog('SAVE_COMPETENCIES'),
  cbcController.createOrUpdateCompetencies
);

// FIX: bulk-save for whole-class competency entry
router.post(
  '/competencies/bulk',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(competenciesBulkSchema),
  auditLog('SAVE_COMPETENCIES_BULK'),
  cbcController.createOrUpdateCompetenciesBulk
);

router.get(
  '/competencies/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  cbcController.getCompetenciesByLearner
);

// ============================================
// VALUES ASSESSMENT
// ============================================

router.post(
  '/values',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(valuesSchema),
  auditLog('SAVE_VALUES'),
  cbcController.createOrUpdateValues
);

// FIX: bulk-save for whole-class values entry
router.post(
  '/values/bulk',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(valuesBulkSchema),
  auditLog('SAVE_VALUES_BULK'),
  cbcController.createOrUpdateValuesBulk
);

router.get(
  '/values/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  cbcController.getValuesByLearner
);

// ============================================
// CO-CURRICULAR ACTIVITIES
// ============================================

router.post(
  '/cocurricular',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(coCurricularSchema),
  auditLog('CREATE_COCURRICULAR'),
  cbcController.createCoCurricular
);

// FIX: bulk-create for whole-class CCA entry
router.post(
  '/cocurricular/bulk',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(coCurricularBulkSchema),
  auditLog('CREATE_COCURRICULAR_BULK'),
  cbcController.createCoCurricularBulk
);

router.get(
  '/cocurricular/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  cbcController.getCoCurricularByLearner
);

// Note: bulk update of CCA is intentionally not provided — activities are per-learner
// and updating them individually preserves the ownership/audit trail.
router.put(
  '/cocurricular/:id',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('UPDATE_COCURRICULAR'),
  cbcController.updateCoCurricular
);

router.delete(
  '/cocurricular/:id',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_COCURRICULAR'),
  cbcController.deleteCoCurricular
);

// ============================================
// TERMLY REPORT COMMENTS
// ============================================

router.post(
  '/comments',
  authenticate,
  requirePermission('ACCESS_ASSESSMENT_MODULE'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(reportCommentsSchema),
  auditLog('SAVE_REPORT_COMMENTS'),
  cbcController.saveReportComments
);

router.get(
  '/comments/:learnerId',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  cbcController.getCommentsByLearner
);

export default router;
