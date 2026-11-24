import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { whatsAppBusinessService } from './whatsapp-business.service';
import { parentWhatsAppAssistantService } from '../../services/parent-whatsapp-assistant.service';
import { redisCacheService } from '../../services/redis-cache.service';
import logger from '../../utils/logger';

type RawBodyRequest = Request & { rawBody?: Buffer };
const WEBHOOK_PROCESSING_TTL_SECONDS = 10 * 60;
const WEBHOOK_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

function hasValidSignature(req: RawBodyRequest): boolean {
  const appSecret = process.env.WABA_APP_SECRET;
  const signature = req.get('x-hub-signature-256') || '';
  if (!appSecret || !req.rawBody || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = createHmac('sha256', appSecret).update(req.rawBody).digest();
  const received = Buffer.from(signature.slice('sha256='.length), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const whatsappWebhookController = {
  verify(req: Request, res: Response) {
    const challenge = whatsAppBusinessService.verifyWebhook(
      String(req.query['hub.mode'] || ''),
      String(req.query['hub.verify_token'] || ''),
      String(req.query['hub.challenge'] || ''),
    );
    if (challenge === null) return res.sendStatus(403);
    return res.status(200).type('text/plain').send(challenge);
  },

  async receive(req: RawBodyRequest, res: Response) {
    if (!hasValidSignature(req)) {
      logger.warn('[WABA] Rejected webhook with missing or invalid signature');
      return res.sendStatus(401);
    }

    const expectedPhoneNumberId = process.env.WABA_PHONE_NUMBER_ID;
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field !== 'messages') continue;
        const value = change?.value || {};
        const incomingPhoneNumberId = String(value?.metadata?.phone_number_id || '');
        // Require an explicit school-level phone ID: never route a shared app's
        // callback into a tenant that has not configured this WABA number.
        if (!expectedPhoneNumberId || incomingPhoneNumberId !== expectedPhoneNumberId) continue;

        const messages = Array.isArray(value?.messages) ? value.messages : [];
        for (const message of messages) {
          if (message?.type !== 'text' || !message?.id || !message?.from || !message?.text?.body) continue;
          const receiptKey = `whatsapp:webhook:processed:${String(message.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
          const claimed = await redisCacheService.setSecurityValueIfAbsent(receiptKey, 'processing', WEBHOOK_PROCESSING_TTL_SECONDS);
          if (!claimed) continue;

          try {
            await parentWhatsAppAssistantService.handleMessage(String(message.from), String(message.text.body));
            await redisCacheService.setSecurityValue(receiptKey, 'done', WEBHOOK_DEDUPE_TTL_SECONDS);
          } catch (error) {
            await redisCacheService.delete(receiptKey);
            logger.error({ error: error instanceof Error ? error.message : 'unknown' }, '[WABA] Inbound assistant message failed');
            return res.sendStatus(500);
          }
        }
      }
    }

    return res.sendStatus(200);
  },
};
