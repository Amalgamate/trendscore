/**
 * Webhook Routes — PUBLIC (no JWT auth)
 *
 * These routes are called by external services (SMS providers, payment gateways).
 * Authentication is handled per-endpoint by token/signature, NOT by user session.
 *
 * Registered at: /api/webhooks/
 */

import { Router } from 'express';
import express from 'express';
import { smsCallbackController } from '../domains/communication/sms-callback.controller';
import { whatsappWebhookController } from '../domains/communication/whatsapp-webhook.controller';

const router = Router();

// Meta WhatsApp Cloud API callback. The global JSON parser captures the exact
// request bytes in app.ts so this endpoint can verify X-Hub-Signature-256.
router.get('/whatsapp', whatsappWebhookController.verify);
router.post('/whatsapp', whatsappWebhookController.receive);

// ── Inbound SMS callbacks ────────────────────────────────────────────────────
// Raw body parsing needed for HMAC signature verification on MobileSasa

router.post(
  '/sms/inbound/africastalking',
  express.urlencoded({ extended: true }), // AT sends form-encoded
  smsCallbackController.africasTalkingCallback.bind(smsCallbackController),
);

router.post(
  '/sms/inbound/mobilesasa',
  express.json(),                          // MobileSasa sends JSON
  smsCallbackController.mobileSasaCallback.bind(smsCallbackController),
);

export default router;
