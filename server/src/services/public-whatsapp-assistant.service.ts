/**
 * Public WhatsApp assistance for senders who have not linked a parent account.
 *
 * This deliberately does not use Prisma, the AI tool registry, or school AI
 * context. Only explicitly configured public contact details and fixed public
 * guidance can be returned from this path.
 */

import {
  PRODUCT_PARENT_PORTAL_URL,
  PRODUCT_SUPPORT_EMAIL,
  PRODUCT_WEBSITE,
} from '../config/productIdentity';
import { whatsappService } from './whatsapp.service';

const MAX_MESSAGE_LENGTH = 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REPLIES_PER_WINDOW = 6;
const MAX_TRACKED_SENDERS = 5000;
const replyWindows = new Map<string, { startedAt: number; count: number }>();

const normalize = (value: string) => value.trim().toLowerCase();
const publicContact = () => {
  const lines = [
    process.env.PUBLIC_SCHOOL_CONTACT_PHONE ? `Phone: ${process.env.PUBLIC_SCHOOL_CONTACT_PHONE}` : null,
    process.env.PUBLIC_SCHOOL_CONTACT_EMAIL ? `Email: ${process.env.PUBLIC_SCHOOL_CONTACT_EMAIL}` : null,
    process.env.PUBLIC_SCHOOL_WEBSITE ? `Website: ${process.env.PUBLIC_SCHOOL_WEBSITE}` : null,
  ].filter(Boolean);
  return lines.length
    ? `Public school contact details:\n${lines.join('\n')}`
    : 'The school has not configured public contact details on this WhatsApp line yet. Please use the phone number or website published on the school’s official materials.';
};

const PARENT_RECORD_GUIDANCE = [
  'For a child’s private fee balance or published results, first link this number from the signed-in Parent Portal:',
  `${PRODUCT_PARENT_PORTAL_URL} → My Profile → WhatsApp assistant.`,
  'Turn it on and reply YES to the consent message sent to the phone number on your profile. After linking, send FEES or RESULTS.',
].join('\n');

function buildPublicReply(rawMessage: string): string {
  const message = normalize(rawMessage);

  if (/\b(stop|unsubscribe)\b/.test(message)) {
    return 'This number is not linked to a parent assistant account, so there is no parent service to pause. You can still ask for public school information. To access a child’s private information, link your number from the Parent Portal first.';
  }

  if (/\b(link|connect|parent portal|parent account|my child|my son|my daughter|student|learner|balance|fee balance|results?|marks|grades|attendance|absent|payment history)\b/.test(message)) {
    return `I can help with general school enquiries, but I can’t look up a learner or family record for an unlinked number.\n\n${PARENT_RECORD_GUIDANCE}`;
  }

  if (/\b(contact|phone|email|address|location|where|directions|website|office|call|reach)\b/.test(message)) {
    return `${publicContact()}\n\nI can only share contact details that the school has explicitly marked for public use.`;
  }

  if (/\b(admission|admissions|enrol|enroll|enrollment|enrolment|joining|fees?|tuition|charges|fee structure|school calendar|term dates|opening date|closing date|uniform|transport|bus route)\b/.test(message)) {
    return `I don’t have an approved public answer for that school-specific question on this WhatsApp line yet. Please contact the school office for current admissions, fees, dates, uniform, or transport information.\n\n${publicContact()}`;
  }

  if (/\b(trendscore|school management system|register a school|apply for trendscore|new school account)\b/.test(message)) {
    return `For information about TrendSCORE or to apply for a school account, visit https://admin.trendscore.co.ke/apply or email ${PRODUCT_SUPPORT_EMAIL}.\n\n${PRODUCT_WEBSITE}`;
  }

  return [
    'Hello! I’m the public assistant for this school’s WhatsApp line.',
    'I can help route general enquiries about admissions, school contacts, fees, dates, and parent-portal access. I don’t have access to private learner or family records for an unlinked number.',
    '',
    'Ask “contact details” for the school’s published contact information, or “parent portal” for instructions to link your number.',
  ].join('\n');
}

function canReply(phone: string): boolean {
  const now = Date.now();
  if (replyWindows.size >= MAX_TRACKED_SENDERS && !replyWindows.has(phone)) {
    for (const [sender, window] of replyWindows) {
      if (now - window.startedAt >= RATE_WINDOW_MS) replyWindows.delete(sender);
    }
    if (replyWindows.size >= MAX_TRACKED_SENDERS) {
      const oldestSender = replyWindows.keys().next().value;
      if (oldestSender) replyWindows.delete(oldestSender);
    }
  }
  const current = replyWindows.get(phone);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    replyWindows.set(phone, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REPLIES_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export class PublicWhatsAppAssistantService {
  async handleMessage(from: string, text: string): Promise<void> {
    const message = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!message || !canReply(from)) return;

    const result = await whatsappService.sendMessage({ to: from, message: buildPublicReply(message) });
    if (!result.success) {
      throw new Error(`Public WhatsApp assistant reply failed: ${result.error || result.message}`);
    }
  }
}

export const publicWhatsAppAssistantService = new PublicWhatsAppAssistantService();
