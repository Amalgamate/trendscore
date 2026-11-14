import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.middleware';
import { requireSingleSchoolContext } from '../middleware/school.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { auditLog } from '../middleware/permissions.middleware';
import * as refundController from '../controllers/refund.controller';
import { asyncHandler } from '../utils/async.util';

const router = Router();

// All refund routes require authentication + school context
router.use(authenticate, requireSingleSchoolContext);

// ─── Submit Refund ──────────────────────────────────────────────────────────
// Finance staff and linked parents can submit refund requests.
router.post(
    '/',
    requirePermission('SUBMIT_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('SUBMIT_REFUND'),
    asyncHandler(refundController.submitRefund),
);

// ─── Approve Refund ─────────────────────────────────────────────────────────
// Only school Admin or Head Teacher can approve; self-approval is blocked by the service.
router.post(
    '/:id/approve',
    requirePermission('APPROVE_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('APPROVE_REFUND'),
    asyncHandler(refundController.approveRefund),
);

// ─── Reject Refund ──────────────────────────────────────────────────────────
router.post(
    '/:id/reject',
    requirePermission('APPROVE_REFUND'),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('REJECT_REFUND'),
    asyncHandler(refundController.rejectRefund),
);

// ─── List Refunds ───────────────────────────────────────────────────────────
router.get(
    '/',
    requireAnyPermission(['VIEW_REFUND_REQUESTS', 'APPROVE_REFUND', 'FINANCIAL_REPORTS', 'VIEW_OWN_BALANCE']),
    rateLimit({ windowMs: 60_000, maxRequests: 50 }),
    asyncHandler(refundController.listRefunds),
);

// ─── Get Single Refund ──────────────────────────────────────────────────────
router.get(
    '/:id',
    requireAnyPermission(['VIEW_REFUND_REQUESTS', 'APPROVE_REFUND', 'FINANCIAL_REPORTS', 'VIEW_OWN_BALANCE']),
    asyncHandler(refundController.getRefund),
);

export default router;
