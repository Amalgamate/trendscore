/**
 * SmsCallbackController
 *
 * Handles inbound SMS callbacks from Africa's Talking and MobileSasa.
 * These are PUBLIC endpoints — authenticated by provider signature/IP, not user JWT.
 *
 * Africa's Talking callback format:
 *   POST body (form-encoded):
 *     from     — sender phone
 *     to       — recipient shortcode
 *     text     — message body
 *     id       — provider message ID
 *     date     — timestamp
 *
 * MobileSasa callback format:
 *   POST body (JSON):
 *     phone    — sender phone
 *     message  — message body
 *     messageId — provider ID
 *   Header: X-Mobilesasa-Signature: <hmac>
 */

import { Request, Response } from 'express';
import { smsReplyService } from './sms-reply.service';
import { SmsReplyService } from './sms-reply.service';
import logger from '../../utils/logger';

const SMS_CALLBACK_SECRET = process.env.SMS_CALLBACK_SECRET || '';

export class SmsCallbackController {

  /**
   * POST /api/webhooks/sms/inbound/africastalking
   * Africa's Talking inbound SMS callback.
   * Security: IP whitelist enforced at reverse proxy / firewall level.
   */
  async africasTalkingCallback(req: Request, res: Response) {
    try {
      // AT sends form-encoded body
      const from      = req.body?.from    || req.body?.From;
      const text      = req.body?.text    || req.body?.Text    || req.body?.message;
      const messageId = req.body?.id      || req.body?.messageId;

      if (!from || !text) {
        logger.warn('[SmsCallback AT] Missing from or text in payload');
        // AT expects 200 even on rejection to stop retries
        return res.status(200).json({ success: false, message: 'Missing fields' });
      }

      await smsReplyService.processInbound({
        fromPhone:     from,
        messageBody:   text,
        provider:      'africastalking',
        providerMsgId: messageId,
        receivedAt:    new Date(),
      });

      // AT expects HTTP 200
      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error('[SmsCallback AT] Processing error', { error: err.message });
      res.status(200).json({ success: false }); // 200 to prevent provider retry
    }
  }

  /**
   * POST /api/webhooks/sms/inbound/mobilesasa
   * MobileSasa inbound SMS callback.
   * Security: HMAC-SHA256 signature on request body.
   */
  async mobileSasaCallback(req: Request, res: Response) {
    try {
      // Verify HMAC signature if secret is configured
      if (SMS_CALLBACK_SECRET) {
        const signature = req.headers['x-mobilesasa-signature'] as string | undefined;
        const rawBody   = JSON.stringify(req.body);
        const valid     = SmsReplyService.verifyMobileSasaSignature(rawBody, signature, SMS_CALLBACK_SECRET);
        if (!valid) {
          logger.warn('[SmsCallback MobileSasa] Invalid signature — rejecting');
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      }

      const from      = req.body?.phone    || req.body?.from;
      const text      = req.body?.message  || req.body?.text;
      const messageId = req.body?.messageId || req.body?.id;

      if (!from || !text) {
        return res.status(200).json({ success: false, message: 'Missing fields' });
      }

      await smsReplyService.processInbound({
        fromPhone:     from,
        messageBody:   text,
        provider:      'mobilesasa',
        providerMsgId: messageId,
        receivedAt:    new Date(),
      });

      res.status(200).json({ success: true });
    } catch (err: any) {
      logger.error('[SmsCallback MobileSasa] Processing error', { error: err.message });
      res.status(200).json({ success: false });
    }
  }
}

export const smsCallbackController = new SmsCallbackController();
