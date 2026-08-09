/**
 * Presence Platform Routes
 *
 * All routes are prefixed /api/v1/presence (registered in routes/index.ts)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  requirePermission,
  requireAnyPermission,
} from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { presenceController } from '../domains/presence/presence.controller';

const router = Router();

// All presence routes require authentication (registered under authenticate in index)

/**
 * @route GET /api/v1/presence/learner/:learnerId/today
 * @desc  Today's presence timeline for a learner
 */
router.get(
  '/learner/:learnerId/today',
  requireAnyPermission(['VIEW_PRESENCE_TIMELINE', 'VIEW_ALL_PRESENCE']),
  asyncHandler(presenceController.getLearnerTimeline.bind(presenceController)),
);

/**
 * @route GET /api/v1/presence/learner/:learnerId/timeline
 * @desc  Presence timeline for a specific date (?date=YYYY-MM-DD)
 */
router.get(
  '/learner/:learnerId/timeline',
  requireAnyPermission(['VIEW_PRESENCE_TIMELINE', 'VIEW_ALL_PRESENCE']),
  asyncHandler(presenceController.getLearnerTimeline.bind(presenceController)),
);

/**
 * @route GET /api/v1/presence/school/snapshot
 * @desc  School-wide presence snapshot for today
 */
router.get(
  '/school/snapshot',
  requirePermission('VIEW_ALL_PRESENCE'),
  asyncHandler(presenceController.getSchoolSnapshot.bind(presenceController)),
);

/**
 * @route GET /api/v1/presence/school/absent-today
 * @desc  List of learners with no attendance record today
 */
router.get(
  '/school/absent-today',
  requirePermission('VIEW_ALL_PRESENCE'),
  asyncHandler(presenceController.getAbsentToday.bind(presenceController)),
);

export default router;
