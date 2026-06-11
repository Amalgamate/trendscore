/**
 * dashboard.routes.ts
 *
 * Guard contract:
 *   - authenticate — applied once in index.ts; NOT repeated here
 *   - requireRole  — applied per route for role-specific dashboards
 *
 * The /secondary endpoint is intentionally NOT gated with
 * requireInstitutionType here because the frontend calls it regardless of
 * institution context and the controller scopes the query via
 * req.resolvedInstitutionType.  Per-route institution guards should be added
 * if the endpoint is later split into context-specific handlers.
 */

import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { requireRole } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { asyncHandler } from '../utils/async.util';

const router = Router();
const dashboardController = new DashboardController();

// authenticate is applied in index.ts — do NOT add router.use(authenticate) here

/**
 * @route   GET /api/dashboard/secondary
 * @desc    Get secondary dashboard metrics
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/secondary',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  asyncHandler(dashboardController.getSecondaryMetrics.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard metrics
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM, ACCOUNTANT
 */
router.get(
  '/admin',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM', 'ACCOUNTANT']),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  asyncHandler(dashboardController.getAdminMetrics.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/teacher
 * @desc    Get teacher dashboard metrics
 * @access  TEACHER
 */
router.get(
  '/teacher',
  requireRole(['TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(dashboardController.getTeacherMetrics.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/parent
 * @desc    Get parent dashboard metrics
 * @access  PARENT
 */
router.get(
  '/parent',
  requireRole(['PARENT']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(dashboardController.getParentMetrics.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/insights
 * @desc    Get deterministic smart insights derived from live school data
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.get(
  '/insights',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  asyncHandler(dashboardController.getInsights.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/intelligence-summary
 * @desc    Get consolidated intelligence data for dashboard analyzers
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/intelligence-summary',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  asyncHandler(dashboardController.getIntelligenceSummary.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/assessment-operations
 * @desc    Get live assessment readiness and mark-entry metrics
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/assessment-operations',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  asyncHandler(dashboardController.getAssessmentOperations.bind(dashboardController))
);

/**
 * @route   GET /api/dashboard/academic-intelligence
 * @desc    Get live academic performance and report intelligence metrics
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/academic-intelligence',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM']),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  asyncHandler(dashboardController.getAcademicIntelligence.bind(dashboardController))
);

export default router;
