import { Router } from 'express';
import express from 'express';
import * as mpesaController from '../controllers/mpesa.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { verifyDarajaCallback } from '../middleware/daraja-verify.middleware';
import { verifyDarajaIP } from '../middleware/daraja-ip-allowlist.middleware';

const router = Router();

// ── Public — Safaricom Daraja Callbacks ─────────────────────────────────────
// Daraja cannot authenticate, so these endpoints are public. We apply two
// layers of verification:
//   1. IP allowlist (verifyDarajaIP) — rejects calls from non-Safaricom IPs
//   2. HMAC signature (verifyDarajaCallback) — verifies the payload integrity
// Both must pass for a callback to be processed.

// STK Push callback (collections)
router.post(
    '/callback',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaIP,
    verifyDarajaCallback,
    mpesaController.handleCallback,
);

// C2B confirmation (organic paybill payments — completed transaction)
router.post(
    '/c2b/confirmation',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaIP,
    verifyDarajaCallback,
    mpesaController.handleC2bConfirmation,
);

// C2B validation (real-time account reference check — before payment completes)
router.post(
    '/c2b/validation',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaIP,
    verifyDarajaCallback,
    mpesaController.handleC2bValidation,
);

// B2C result callback (payout disbursement result)
router.post(
    '/b2c/result',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaIP,
    verifyDarajaCallback,
    mpesaController.handleB2cResult,
);

// B2C queue timeout callback
router.post(
    '/b2c/timeout',
    express.json({
        limit: '2mb',
        verify: (req, _res, buf) => { (req as any).rawBody = buf; },
    }),
    verifyDarajaIP,
    verifyDarajaCallback,
    mpesaController.handleB2cTimeout,
);

// ── Protected ──────────────────────────────────────────────────────────────
router.post('/initiate', authenticate, mpesaController.initiatePayment);
router.get('/status/:checkoutRequestId/:invoiceId', authenticate, mpesaController.queryStatus);

// C2B URL registration — admin setup (one-time)
router.post('/c2b/register', authenticate, requirePermission('SYSTEM_SETTINGS'), mpesaController.registerC2bUrls);

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
