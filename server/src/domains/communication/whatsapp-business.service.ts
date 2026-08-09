/**
 * WhatsApp Business API (WABA) Service
 *
 * Official WhatsApp Cloud API adapter.
 * Replaces the Baileys/wwebjs unofficial approach with a stable,
 * production-grade integration using Meta's official Cloud API.
 *
 * Required env vars:
 *   WABA_PHONE_NUMBER_ID   — WhatsApp Business phone number ID
 *   WABA_ACCESS_TOKEN      — Permanent / long-lived access token
 *   WABA_VERIFY_TOKEN      — Webhook verification token (any random string)
 *
 * Features:
 *   - Send text messages
 *   - Send template messages (for outbound notifications outside 24h window)
 *   - Receive inbound messages via webhook
 *
 * Architecture decision:
 *   WABA is feature-flagged — only activates when WABA_PHONE_NUMBER_ID is set.
 *   Falls back to the existing Baileys service if not configured.
 *   This enables schools to migrate gradually without disruption.
 *
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from 'axios';
import logger from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WabaTextMessage {
  to:      string;   // phone in E.164 format: +254712345678
  body:    string;
}

interface WabaTemplateMessage {
  to:            string;
  templateName:  string;
  languageCode:  string;
  components?:   WabaTemplateComponent[];
}

interface WabaTemplateComponent {
  type:       'header' | 'body' | 'button';
  parameters: WabaTemplateParameter[];
}

interface WabaTemplateParameter {
  type:  'text' | 'currency' | 'date_time';
  text?: string;
}

export interface WabaSendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getConfig() {
  return {
    phoneNumberId: process.env.WABA_PHONE_NUMBER_ID ?? '',
    accessToken:   process.env.WABA_ACCESS_TOKEN    ?? '',
    verifyToken:   process.env.WABA_VERIFY_TOKEN    ?? '',
    apiVersion:    process.env.WABA_API_VERSION     ?? 'v19.0',
  };
}

export function isWabaConfigured(): boolean {
  const { phoneNumberId, accessToken } = getConfig();
  return Boolean(phoneNumberId && accessToken);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WhatsAppBusinessService {

  private get baseUrl(): string {
    const { apiVersion, phoneNumberId } = getConfig();
    return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${getConfig().accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a plain text message.
   * Only works within the 24-hour customer service window.
   * For outbound notifications, use sendTemplate().
   */
  async sendText(msg: WabaTextMessage): Promise<WabaSendResult> {
    if (!isWabaConfigured()) {
      return { success: false, error: 'WhatsApp Business API not configured' };
    }

    const phone = this.normalisePhone(msg.to);

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type:    'individual',
          to:                phone,
          type:              'text',
          text:              { preview_url: false, body: msg.body },
        },
        { headers: this.headers },
      );

      const messageId = response.data?.messages?.[0]?.id;
      logger.info('[WABA] Text message sent', { phone: this.maskPhone(phone), messageId });
      return { success: true, messageId };

    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message ?? err.message;
      logger.error('[WABA] Failed to send text', { phone: this.maskPhone(phone), error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send a pre-approved WhatsApp template message.
   * Templates are required for outbound messages outside the 24h window
   * (e.g. daily absent child notifications, fee reminders).
   */
  async sendTemplate(msg: WabaTemplateMessage): Promise<WabaSendResult> {
    if (!isWabaConfigured()) {
      return { success: false, error: 'WhatsApp Business API not configured' };
    }

    const phone = this.normalisePhone(msg.to);

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          to:                phone,
          type:              'template',
          template: {
            name:     msg.templateName,
            language: { code: msg.languageCode },
            ...(msg.components && { components: msg.components }),
          },
        },
        { headers: this.headers },
      );

      const messageId = response.data?.messages?.[0]?.id;
      logger.info('[WABA] Template sent', {
        template: msg.templateName, phone: this.maskPhone(phone), messageId,
      });
      return { success: true, messageId };

    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message ?? err.message;
      logger.error('[WABA] Failed to send template', {
        template: msg.templateName, phone: this.maskPhone(phone), error: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send an absent child notification via WhatsApp.
   * Uses the school_absent_child template (must be pre-approved in Meta Business Manager).
   *
   * Fallback: if template not found, sends plain text (works in 24h window).
   */
  async sendAbsentNotification(
    to: string,
    learnerName: string,
    grade: string,
    schoolName: string,
  ): Promise<WabaSendResult> {
    // Try template first
    const templateResult = await this.sendTemplate({
      to,
      templateName:  'school_absent_child',
      languageCode:  'en',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: learnerName },
          { type: 'text', text: grade },
          { type: 'text', text: schoolName },
        ],
      }],
    });

    if (templateResult.success) return templateResult;

    // Fallback to plain text (requires active chat window)
    return this.sendText({
      to,
      body: `Dear Parent, ${learnerName} (${grade}) was absent from ${schoolName} today. Please contact the school if this is unexpected.`,
    });
  }

  // ---------------------------------------------------------------------------
  // Webhook verification (GET /api/webhooks/whatsapp)
  // ---------------------------------------------------------------------------

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const { verifyToken } = getConfig();
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalisePhone(phone: string): string {
    // Strip non-digits except leading +
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('0')) return '+254' + digits.slice(1);
    if (digits.startsWith('254')) return '+' + digits;
    return '+254' + digits;
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return phone.slice(0, 5) + '****' + phone.slice(-3);
  }
}

export const whatsAppBusinessService = new WhatsAppBusinessService();
