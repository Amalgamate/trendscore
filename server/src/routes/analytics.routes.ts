/**
 * Analytics Routes — /api/v1/analytics/
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { analyticsController } from '../domains/presence/analytics.controller';

const router = Router();

// ── Attendance Analytics ──────────────────────────────────────────────────────
router.get('/attendance/daily',   authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getDailyRates.bind(analyticsController)));
router.get('/attendance/weekly',  authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getWeeklyTrend.bind(analyticsController)));
router.get('/attendance/by-grade',authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getByGrade.bind(analyticsController)));
router.get('/late-patterns',      authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getLatePatterns.bind(analyticsController)));

// ── School Overview ───────────────────────────────────────────────────────────
router.get('/school/overview', authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getSchoolOverview.bind(analyticsController)));

// ── Boarding Compliance ───────────────────────────────────────────────────────
router.get('/boarding/compliance', authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'), asyncHandler(analyticsController.getBoardingCompliance.bind(analyticsController)));

// ── At-Risk & Early Warning ───────────────────────────────────────────────────
router.get('/at-risk',                                    authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'),  asyncHandler(analyticsController.getAtRisk.bind(analyticsController)));
router.post('/early-warning/run',                         authenticate, requirePermission('VIEW_ALL_PRESENCE'),        asyncHandler(analyticsController.runEarlyWarning.bind(analyticsController)));
router.get('/early-warning/violations',                   authenticate, requirePermission('VIEW_PRESENCE_ANALYTICS'),  asyncHandler(analyticsController.getViolations.bind(analyticsController)));
router.post('/early-warning/violations/:id/resolve',      authenticate, requirePermission('VIEW_ALL_PRESENCE'),        asyncHandler(analyticsController.resolveViolation.bind(analyticsController)));

// ── NEMIS Export — ADMIN only ─────────────────────────────────────────────────
router.get('/nemis/report',  authenticate, requireAnyPermission(['SUPER_ADMIN_ONLY', 'SCHOOL_SETTINGS']), asyncHandler(analyticsController.getNEMISReport.bind(analyticsController)));

export default router;
