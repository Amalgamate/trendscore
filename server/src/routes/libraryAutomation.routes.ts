/**
 * Library Automation & Reports Routes — Phases 4 & 5
 *
 * Mounted at: /api/library
 * (alongside the existing library.routes.ts entries in routes/index.ts)
 *
 * Automation endpoints (Phase 4):
 *   POST /api/library/automation/run-all
 *   POST /api/library/automation/run/:job
 *
 * Report endpoints (Phase 5):
 *   GET  /api/library/reports/inventory
 *   GET  /api/library/reports/categories
 *   GET  /api/library/reports/copy-audit
 *   GET  /api/library/reports/circulation
 *   GET  /api/library/reports/members
 *   GET  /api/library/reports/fines
 *   GET  /api/library/reports/dashboard
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, auditLog } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { LibraryAutomationController } from '../controllers/libraryAutomation.controller';
import { requireApp } from '../middleware/requireApp';

const router = Router();
const ctrl   = new LibraryAutomationController();

router.use(authenticate, requireApp('library'));

// ─── Phase 4: Automation ─────────────────────────────────────────────────────

/**
 * Run all automation jobs manually.
 * Useful for an admin "Run Now" button in the Library Settings UI.
 */
router.post(
    '/automation/run-all',
    requirePermission('LIBRARY_MANAGEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 5 }),
    auditLog('LIBRARY_AUTOMATION_RUN_ALL'),
    ctrl.runAllJobs
);

/**
 * Run a single named job.
 * Valid :job values: assess-fines | send-reminders | suspend-members | expire-memberships
 */
router.post(
    '/automation/run/:job',
    requirePermission('LIBRARY_MANAGEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('LIBRARY_AUTOMATION_RUN_JOB'),
    ctrl.runJob
);

// ─── Phase 5: Reports ────────────────────────────────────────────────────────

/** Full book catalog with copy-level aggregates */
router.get(
    '/reports/inventory',
    requirePermission('VIEW_LIBRARY_INVENTORY'),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    ctrl.getInventoryReport
);

/** Holdings and circulation statistics by category */
router.get(
    '/reports/categories',
    requirePermission('VIEW_LIBRARY_INVENTORY'),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    ctrl.getCategoryReport
);

/** Copy condition and location audit */
router.get(
    '/reports/copy-audit',
    requirePermission('VIEW_LIBRARY_INVENTORY'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    ctrl.getCopyConditionAudit
);

/** Daily loan / return / renewal activity over a date range */
router.get(
    '/reports/circulation',
    requirePermission('LIBRARY_MANAGEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    ctrl.getCirculationReport
);

/** Per-member borrowing and fines activity */
router.get(
    '/reports/members',
    requirePermission('MANAGE_LIBRARY_MEMBERS'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    ctrl.getMemberActivityReport
);

/** Outstanding overdue fines with aging buckets */
router.get(
    '/reports/fines',
    requirePermission('LIBRARY_MANAGEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    ctrl.getOverdueFinesReport
);

/** Aggregated dashboard summary — single call for the library overview page */
router.get(
    '/reports/dashboard',
    requirePermission('LIBRARY_MANAGEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 60 }),
    ctrl.getDashboardSummary
);

export default router;
