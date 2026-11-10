import { Router } from 'express';
import express from 'express';
import * as mpesaController from '../controllers/mpesa.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { verifyDarajaCallback } from '../middleware/daraja-verify.middleware';

const router = Router();

// ── Public — Safaricom Daraja Callback ──────────────────────────────────────
// Daraja cannot authenticate, so the endpoint is public — but we verify the
// HMAC-SHA256 signature Daraja sends in the Authorization header to reject
// forged payloads. A route-level express.json() with a `verify` hook captures
// the raw body needed for HMAC computation (the global parser doesn't).
router.post(
    '/callback',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaCallback,
    mpesaController.handleCallback,
);

// ── Protected ──────────────────────────────────────────────────────────────
router.post('/initiate', authenticate, mpesaController.initiatePayment);
router.get('/status/:checkoutRequestId/:invoiceId', authenticate, mpesaController.queryStatus);

// Money-action routes — restricted to authorised roles only.
// Previously these used `authenticate` alone, meaning any logged-in user
// (parent, teacher) could trigger salary payouts or release unmatched payments.
router.post('/payout/bulk',    authenticate, requirePermission('INITIATE_PAYOUT'),     mpesaController.initiateBulkPayout);

// Unmatched payments (Buy Goods Till organic payments)
router.get('/unmatched',             authenticate, requirePermission('VIEW_UNMATCHED_PAYMENTS'), mpesaController.getUnmatchedPayments);
router.get('/unmatched/count',       authenticate, requirePermission('VIEW_UNMATCHED_PAYMENTS'), mpesaController.getUnmatchedCount);
router.put('/unmatched/:id/resolve', authenticate, requirePermission('RELEASE_UNMATCHED'),     mpesaController.resolveUnmatchedPayment);
router.put('/unmatched/:id/dismiss', authenticate, requirePermission('RELEASE_UNMATCHED'),     mpesaController.dismissUnmatchedPayment);

export default router;
