/**
 * WhatsApp channel facade — Baileys only.
 *
 * Notification services that send WhatsApp text go through this facade so
 * they share the school's paired Baileys socket in `whatsapp.service.ts`.
 *
 * Keeping the facade means those call sites stay readable and a future
 * transport swap is a one-file change.
 */

import { whatsappService } from '../../services/whatsapp.service';
import logger from '../../utils/logger';

export interface WhatsAppChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** True when the Baileys socket is paired and connected. */
export function isWhatsAppChannelReady(): boolean {
  return whatsappService.getStatus().status === 'authenticated';
}

/**
 * Send a plain text WhatsApp message through the paired Baileys session.
 * Never throws: transport failures are returned as `{ success: false }` so
 * notification pipelines can log and continue.
 */
export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppChannelResult> {
  if (!isWhatsAppChannelReady()) {
    return { success: false, error: 'WhatsApp is not connected' };
  }

  try {
    const result = await whatsappService.sendMessage({ to, message: body });
    if (!result.success) {
      return { success: false, error: result.error || result.message };
    }
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    logger.warn('[WhatsAppChannel] send failed', { error: error?.message });
    return { success: false, error: error?.message || 'send failed' };
  }
}
