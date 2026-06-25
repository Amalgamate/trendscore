/**
 * teacher.routes.ts
 *
 * Teacher-scoped context endpoints.
 * All routes are protected by authenticate (applied in routes/index.ts).
 *
 * Guard contract:
 *   - GET /api/teacher/context  — TEACHER, HEAD_TEACHER, HEAD_OF_CURRICULUM, ADMIN, SUPER_ADMIN
 */

import { Router } from 'express';
import { teacherContextController } from '../controllers/teacherContext.controller';
import { requireRole } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { asyncHandler } from '../utils/async.util';

const router = Router();

/**
 * @route   GET /api/teacher/context
 * @desc    Returns the authenticated teacher's class-teacher assignment,
 *          subject assignments, and whether they are a class teacher.
 *          Non-teacher admin roles receive a "full access" context (no restrictions).
 * @access  TEACHER, HEAD_TEACHER, HEAD_OF_CURRICULUM, ADMIN, SUPER_ADMIN
 */
router.get(
  '/context',
  requireRole(['TEACHER', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 120 }),
  asyncHandler(teacherContextController.getMyContext.bind(teacherContextController))
);

export default router;
