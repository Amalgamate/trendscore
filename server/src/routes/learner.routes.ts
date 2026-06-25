/**
 * Learner Routes
 * Handles learner management endpoints for single-tenancy
 */

import express, { Router } from 'express';
import { LearnerController } from '../controllers/learner.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission, requireRole, ResourceAccessControl, auditLog } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { getNextAdmissionNumberPreview } from '../services/admissionNumber.service';
import { createLearnerPayloadSchema, updateLearnerPayloadSchema } from '../contracts/learnerPayload.contract';

const router = Router();
const learnerController = new LearnerController();

const createLearnerSchema = createLearnerPayloadSchema;
const updateLearnerSchema = updateLearnerPayloadSchema;

// Protect all routes
router.use(authenticate);

router.get('/next-admission-number',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(async (_req, res) => {
    const year = new Date().getFullYear();
    const preview = await getNextAdmissionNumberPreview('MC', year);
    res.json({ success: true, data: { nextAdmissionNumber: preview || '1000' } });
  })
);

router.get('/birthdays/upcoming', 
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(learnerController.getUpcomingBirthdays.bind(learnerController))
);

router.get('/stats', 
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']), 
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(learnerController.getLearnerStats.bind(learnerController))
);

router.get('/', 
  requirePermission('VIEW_ALL_LEARNERS'), 
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(learnerController.getAllLearners.bind(learnerController))
);

router.get('/grade/:grade', 
  requirePermission('VIEW_ALL_LEARNERS'), 
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(learnerController.getLearnersByGrade.bind(learnerController))
);

router.get('/admission/:admissionNumber', 
  requirePermission('VIEW_ALL_LEARNERS'), 
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(learnerController.getLearnerByAdmissionNumber.bind(learnerController))
);

router.get('/:id', 
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(learnerController.getLearnerById.bind(learnerController))
);

router.post('/', 
  requirePermission('CREATE_LEARNER'), 
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  express.json({ limit: '10mb' }),  // new learner may include base64 photo
  validate(createLearnerSchema),
  auditLog('CREATE_LEARNER'), 
  asyncHandler(learnerController.createLearner.bind(learnerController))
);

router.put('/:id', 
  requirePermission('EDIT_LEARNER'), 
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  express.json({ limit: '10mb' }),  // learner record may include base64 photo
  validate(updateLearnerSchema),
  auditLog('UPDATE_LEARNER'), 
  asyncHandler(learnerController.updateLearner.bind(learnerController))
);

router.patch('/:id/parent-update',
  requireRole(['PARENT']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  express.json({ limit: '10mb' }),
  auditLog('PARENT_UPDATE_LEARNER_PROFILE'),
  asyncHandler(learnerController.parentUpdateLearner.bind(learnerController))
);

router.delete('/:id', 
  requirePermission('DELETE_LEARNER'), 
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_LEARNER'), 
  asyncHandler(learnerController.deleteLearner.bind(learnerController))
);

router.post('/:id/photo', 
  requirePermission('EDIT_LEARNER'), 
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  express.json({ limit: '10mb' }),  // base64 photo upload
  auditLog('UPLOAD_LEARNER_PHOTO'), 
  asyncHandler(learnerController.uploadLearnerPhoto.bind(learnerController))
);

router.delete('/:id/photo', 
  requirePermission('EDIT_LEARNER'), 
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('DELETE_LEARNER_PHOTO'), 
  asyncHandler(learnerController.deleteLearnerPhoto.bind(learnerController))
);

router.post('/bulk-promote', 
  requirePermission('PROMOTE_LEARNER'), 
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('BULK_PROMOTE_LEARNERS'), 
  asyncHandler(learnerController.promoteLearners.bind(learnerController))
);

export default router;
