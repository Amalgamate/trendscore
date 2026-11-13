import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { requireSingleSchoolContext } from '../middleware/school.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../middleware/permissions.middleware';
import { uploadSingle } from '../middleware/upload.middleware';
import * as reconciliationController from '../controllers/reconciliation.controller';

const router = Router();

// All reconciliation routes require authentication + school context
router.use(authenticate, requireSingleSchoolContext);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get(
    '/dashboard',
    requirePermission('VIEW_BANK_RECONCILIATION'),
    rateLimit({ windowMs: 60_000, maxRequests: 60 }),
    reconciliationController.getDashboard,
);

// ── Import M-Pesa Statement ────────────────────────────────────────────────
// Accepts CSV file upload or JSON body with pre-parsed rows.
router.post(
    '/import',
    requirePermission('IMPORT_MPESA_STATEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('IMPORT_MPESA_STATEMENT'),
    uploadSingle,
    reconciliationController.importStatement,
);

// ── List Statements ────────────────────────────────────────────────────────
router.get(
    '/statements',
    requirePermission('VIEW_BANK_RECONCILIATION'),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    reconciliationController.listStatements,
);

// ── Statement Detail (with paginated lines) ────────────────────────────────
router.get(
    '/statements/:id',
    requirePermission('VIEW_BANK_RECONCILIATION'),
    reconciliationController.getStatementDetail,
);

// ── Manual Reconcile a Line ────────────────────────────────────────────────
router.post(
    '/lines/:id/reconcile',
    requirePermission('RECONCILE_MPESA_STATEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    auditLog('RECONCILE_MPESA_LINE'),
    reconciliationController.manualReconcile,
);

// ── Undo Reconciliation ────────────────────────────────────────────────────
router.post(
    '/lines/:id/unreconcile',
    requirePermission('RECONCILE_MPESA_STATEMENT'),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    auditLog('UNRECONCILE_MPESA_LINE'),
    reconciliationController.unreconcileLine,
);

// ── Suggest Matches for a Line ─────────────────────────────────────────────
router.get(
    '/lines/:id/suggest-matches',
    requirePermission('VIEW_BANK_RECONCILIATION'),
    reconciliationController.suggestMatches,
);

export default router;
