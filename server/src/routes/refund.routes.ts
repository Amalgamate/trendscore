import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../middleware/permissions.middleware';
import * as refundController from '../controllers/refund.controller';

const router = Router();

// All refund routes require authentication + school context
router.use(authenticate, requireSchoolContext);

// ─── Submit Refund ──────────────────────────────────────────────────────────
// Finance staff (ACCOUNTANT, ADMIN) can submit refund requests.
router.post(
    '/',
    requirePermission('SUBMIT_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('SUBMIT_REFUND'),
    refundController.submitRefund,
);

// ─── Approve Refund ─────────────────────────────────────────────────────────
// Only school owner (SUPER_ADMIN) can approve. The permission APPROVE_REFUND
// is restricted to SUPER_ADMIN in permissions.ts.
router.post(
    '/:id/approve',
    requirePermission('APPROVE_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('APPROVE_REFUND'),
    refundController.approveRefund,
);

// ─── Reject Refund ──────────────────────────────────────────────────────────
router.post(
    '/:id/reject',
    requirePermission('APPROVE_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('REJECT_REFUND'),
    refundController.rejectRefund,
);

// ─── List Refunds ───────────────────────────────────────────────────────────
router.get(
    '/',
    requirePermission('FINANCIAL_REPORTS'),
    rateLimit({ windowMs: 60_000, maxRequests: 50 }),
    refundController.listRefunds,
);

// ─── Get Single Refund ──────────────────────────────────────────────────────
router.get(
    '/:id',
    requirePermission('FINANCIAL_REPORTS'),
    refundController.getRefund,
);

export default router;
