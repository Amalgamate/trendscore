import prisma from '../config/database';
import { SmsService } from './sms.service';
import { whatsappService } from './whatsapp.service';
import { EmailService } from './email-resend.service';
import { MessageStatus } from '@prisma/client';
import { LibraryService } from './library.service';
import logger from '../utils/logger';
import { decrypt } from '../utils/encryption.util';

const libraryService = new LibraryService();

type RecipientPayload = {
  recipientId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
};

type MessageType = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'IN_APP';
type RecipientType = 'INDIVIDUAL' | 'CLASS' | 'GRADE' | 'ALL_PARENTS' | 'ALL_TEACHERS' | 'CUSTOM';

type CreateMessagePayload = {
  senderId: string;
  senderType: string;
  recipientType: RecipientType;
  recipients: RecipientPayload[];
  subject?: string;
  body: string;
  messageType?: MessageType;
  scheduledFor?: string | Date;
  attachments?: any;
};

const SCHEDULE_INTERVAL_MS = 60 * 1000; // 1 minute

export class MessageService {
  private normalizeRecipient(recipient: RecipientPayload) {
    const recipientId = recipient.recipientId || recipient.recipientPhone || recipient.recipientEmail || 'external-recipient';
    return {
      recipientId,
      recipientPhone: recipient.recipientPhone || null,
      recipientEmail: recipient.recipientEmail || null,
      status: MessageStatus.DRAFT,
      failureReason: null,
    };
  }

  private buildRecipientData(recipients: RecipientPayload[]) {
    return recipients.map(r => this.normalizeRecipient(r));
  }

  private buildRecipientIds(recipients: RecipientPayload[]) {
    return recipients.map((recipient) => recipient.recipientId || recipient.recipientPhone || recipient.recipientEmail || 'external-recipient');
  }

  async createMessageRecord(payload: CreateMessagePayload) {
    const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : new Date();
    const recipientRows = this.buildRecipientData(payload.recipients);
    const recipientIds = this.buildRecipientIds(payload.recipients);

    const message = await prisma.message.create({
      data: {
        senderId: payload.senderId,
        senderType: payload.senderType as any,
        recipientType: payload.recipientType as any,
        recipientIds,
        subject: payload.subject || null,
        body: payload.body,
        messageType: (payload.messageType || 'SMS') as any,
        scheduledFor,
        status: MessageStatus.DRAFT,
        attachments: payload.attachments || null,
        receipts: {
          create: recipientRows
        }
      },
      include: {
        receipts: true
      }
    });

    return message;
  }

  async _deliverMessage(message: any) {
    const receipts = message.receipts ||
      await prisma.messageReceipt.findMany({ where: { messageId: message.id } });
    const now = new Date();
    let successCount = 0;
    let failureCount = 0;
    const failureReasons: string[] = [];
    const updatedReceiptIds: string[] = [];

    for (const receipt of receipts) {
      let result: { success: boolean; messageId?: string; error?: string } = { success: false, error: 'No valid recipient address' };

      try {
        if (message.messageType === 'SMS' && receipt.recipientPhone) {
          result = await SmsService.sendSms(receipt.recipientPhone, message.body);
        } else if (message.messageType === 'WHATSAPP' && receipt.recipientPhone) {
          result = await whatsappService.sendMessage({ to: receipt.recipientPhone, message: message.body } as any);
        } else if (message.messageType === 'EMAIL' && receipt.recipientEmail) {
          await EmailService.sendEmail({
            to: receipt.recipientEmail,
            subject: message.subject || 'School Notification',
            html: message.body,
            text: message.body.replace(/<[^>]*>/g, ' ')
          });
          result = { success: true };
        } else {
          result = { success: false, error: 'No valid recipient contact information' };
        }
      } catch (error: any) {
        result = { success: false, error: error?.message || 'Delivery failed' };
      }

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (result.error?.trim()) {
          failureReasons.push(result.error.trim());
        }
      }

      await prisma.messageReceipt.update({
        where: { id: receipt.id },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          deliveredAt: result.success ? now : undefined,
          failureReason: result.success ? null : result.error || 'Delivery failed'
        }
      });
      updatedReceiptIds.push(receipt.id);
    }

    const messageStatus = successCount > 0 ? 'SENT' : 'FAILED';
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: messageStatus as any,
        sentAt: now
      }
    });

    const uniqueFailureReasons = [...new Set(failureReasons)];
    const deliveryError = uniqueFailureReasons.length === 1
      ? uniqueFailureReasons[0]
      : uniqueFailureReasons.length > 1
        ? `Failed to deliver to any recipients: ${uniqueFailureReasons.join('; ')}`
        : 'Failed to deliver to any recipients';

    return {
      success: successCount > 0,
      messageId: message.id,
      sent: successCount,
      failed: failureCount,
      error: successCount === 0 ? deliveryError : undefined
    };
  }

  async createAndDispatchMessage(payload: CreateMessagePayload) {
    const now = new Date();
    const scheduledAt = payload.scheduledFor ? new Date(payload.scheduledFor) : now;
    const isFuture = scheduledAt > now;

    const message = await this.createMessageRecord({ ...payload, scheduledFor: scheduledAt });

    if (isFuture) {
      return { success: true, scheduled: true, message };
    }

    const deliveryResult = await this._deliverMessage({ ...message, receipts: message.receipts });
    return { ...deliveryResult, scheduled: false, message };
  }

  async processScheduledMessages() {
    const now = new Date();
    const dueMessages = await prisma.message.findMany({
      where: {
        status: 'DRAFT',
        scheduledFor: { lte: now }
      },
      include: { receipts: true }
    });

    for (const message of dueMessages) {
      await this._deliverMessage(message);
    }

    return dueMessages.length;
  }

  async getInboxMessages(userId: string) {
    return prisma.messageReceipt.findMany({
      where: { recipientId: userId },
      include: { message: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markReceiptRead(receiptId: string, userId: string) {
    const receipt = await prisma.messageReceipt.findFirst({
      where: { id: receiptId, recipientId: userId }
    });

    if (!receipt) {
      throw new Error('Message receipt not found or access denied');
    }

    return prisma.messageReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // AI Birthday Message Generator
  // ────────────────────────────────────────────────────────────────────────────

  private async generateAiBirthdayMessage(params: {
    firstName: string;
    fullName: string;
    gradeName: string;
    schoolName: string;
    age: number;
    ageOrdinal: string;
    persona: string;
    customInstructions: string;
    aiConfig: { apiKey: string; model: string; apiUrl: string };
  }): Promise<string> {
    const { firstName, fullName, gradeName, schoolName, age, ageOrdinal, persona, customInstructions, aiConfig } = params;

    const personaDescriptions: Record<string, string> = {
      'Enthusiastic Principal': 'a warm, professional and enthusiastic school principal who genuinely cares about students',
      'Fun Mascot': 'a playful and energetic school mascot character, keeping things fun and age-appropriate',
      'Wise Mentor': 'a wise, inspirational mentor who encourages growth and celebrates milestones'
    };
    const personaDesc = personaDescriptions[persona] || personaDescriptions['Enthusiastic Principal'];

    const prompt = [
      `You are ${personaDesc}, writing a birthday SMS message for a student.`,
      `Student name: ${fullName} (call them ${firstName})`,
      `Grade: ${gradeName}`,
      `School: ${schoolName}`,
      `Turning: ${ageOrdinal} birthday (age ${age})`,
      customInstructions ? `Special instructions: ${customInstructions}` : '',
      'Rules:',
      '- Write ONLY the SMS message text. No preamble, no JSON, no quotes.',
      '- Maximum 160 characters (one SMS).',
      '- Must feel personal, warm and celebratory.',
      '- Include the student first name naturally.',
      '- End with the school name.',
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch(aiConfig.apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${aiConfig.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: 'You write concise, heartfelt birthday SMS messages for school students. Reply with the SMS text only.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 80,
          temperature: 0.85
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (!response.ok) {
        logger.warn(`[BirthdayService] AI API error ${response.status}. Falling back to standard message.`);
        return '';
      }

      const payload: any = await response.json();
      const text = payload?.choices?.[0]?.message?.content?.trim() || '';
      if (!text) return '';

      // Clamp to 160 chars for SMS safety
      return text.slice(0, 160);
    } catch (err: any) {
      logger.warn(`[BirthdayService] AI generation failed: ${err?.message}. Falling back to standard message.`);
      return '';
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Daily Birthday Wish Scheduler
  // ────────────────────────────────────────────────────────────────────────────

  async ensureDailyBirthdayWishes() {
    const config = await prisma.communicationConfig.findFirst();
    if (!config?.birthdayEnabled) return 0;

    // ── Resolve birthday AI settings ──────────────────────────────────────────
    const templates = (config.emailTemplates && typeof config.emailTemplates === 'object')
      ? config.emailTemplates as Record<string, any>
      : {};
    const birthdayAi = templates.__birthday || {};
    const aiEnabled = !!birthdayAi.enabled;
    const channelStrategy: string = birthdayAi.channelStrategy || 'Smart Fallback';
    const persona: string = birthdayAi.persona || 'Enthusiastic Principal';
    const customInstructions: string = birthdayAi.customInstructions || '';

    // ── Resolve OpenAI config if AI is enabled ────────────────────────────────
    let aiConfig: { apiKey: string; model: string; apiUrl: string } | null = null;
    if (aiEnabled) {
      const openAiCfg = templates.__ai || {};
      const envKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
      let savedKey: string | undefined;
      if (openAiCfg.apiKey) {
        try { savedKey = decrypt(openAiCfg.apiKey); } catch { /* fall through */ }
      }
      const resolvedKey = savedKey || envKey;
      if (resolvedKey) {
        aiConfig = {
          apiKey: resolvedKey,
          model: openAiCfg.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
          apiUrl: openAiCfg.apiUrl || process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
        };
      } else {
        logger.warn('[BirthdayService] AI birthdays enabled but no API key configured. Falling back to standard messages.');
      }
    }

    const now = new Date();
    const monthDay = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const school = await prisma.school.findFirst({ select: { name: true } });
    const schoolName = school?.name || 'Your School';

    const learners = await prisma.learner.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        guardianPhone: true,
        emergencyPhone: true,
        grade: true
      }
    });

    const birthdaysToday = learners.filter((l) => {
      if (!l.dateOfBirth) return false;
      const dob = new Date(l.dateOfBirth);
      const dobMonthDay = `${(dob.getMonth() + 1).toString().padStart(2, '0')}-${dob.getDate().toString().padStart(2, '0')}`;
      return dobMonthDay === monthDay;
    });

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const formatTitleCase = (str: string) =>
      str ? str.toLowerCase().split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

    let sentCount = 0;

    for (const learner of birthdaysToday) {
      const phoneNumber = learner.guardianPhone || learner.emergencyPhone;
      if (!phoneNumber) continue;

      // Dedup: skip if already sent today
      const existingMessage = await prisma.message.findFirst({
        where: {
          subject: 'Birthday Wishes',
          recipientIds: { has: learner.id },
          scheduledFor: { gte: todayStart, lt: tomorrowStart }
        }
      });
      if (existingMessage) continue;

      const firstName = formatTitleCase(learner.firstName);
      const lastName = formatTitleCase(learner.lastName);
      const fullName = `${firstName} ${lastName}`;
      const gradeName = learner.grade ? formatTitleCase(learner.grade) : 'Learner';
      const dob = learner.dateOfBirth ? new Date(learner.dateOfBirth) : null;
      const age = dob ? (now.getFullYear() - dob.getFullYear() - ((now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) ? 1 : 0)) : 0;
      const ageOrdinal = getOrdinal(age);

      // ── Build the message text ───────────────────────────────────────────────
      const manualTemplate = config.birthdayMessageTemplate || null;
      let messageText: string;

      if (aiEnabled && aiConfig) {
        const aiMessage = await this.generateAiBirthdayMessage({
          firstName, fullName, gradeName, schoolName, age, ageOrdinal,
          persona, customInstructions, aiConfig
        });
        messageText = aiMessage || (manualTemplate
          ? manualTemplate.replace(/{learnerName}/g, fullName).replace(/{firstName}/g, firstName)
              .replace(/{lastName}/g, lastName).replace(/{schoolName}/g, schoolName).replace(/{gradeName}/g, gradeName)
          : `Happy Birthday ${firstName}! 🎂 Wishing you a wonderful ${ageOrdinal} birthday from ${schoolName}.`);
      } else {
        messageText = manualTemplate
          ? manualTemplate.replace(/{learnerName}/g, fullName).replace(/{firstName}/g, firstName)
              .replace(/{lastName}/g, lastName).replace(/{schoolName}/g, schoolName).replace(/{gradeName}/g, gradeName)
          : `Happy Birthday ${firstName}! Wishing you a wonderful day from ${schoolName}.`;
      }

      logger.info(`[BirthdayService] Sending wishes to ${fullName} via strategy: ${channelStrategy}`);

      // ── Dispatch per channel strategy ────────────────────────────────────────
      try {
        if (channelStrategy === 'WhatsApp Only') {
          const waResult = await whatsappService.sendMessage({ to: phoneNumber, message: messageText } as any);
          if (!waResult.success) logger.warn(`[BirthdayService] WhatsApp failed for ${fullName}: ${waResult.error}`);

        } else if (channelStrategy === 'SMS Only') {
          await SmsService.sendSms(phoneNumber, messageText);

        } else if (channelStrategy === 'Both Channels') {
          // Fire both in parallel, don't let one failure block the other
          const [waResult] = await Promise.allSettled([
            whatsappService.sendMessage({ to: phoneNumber, message: messageText } as any),
            SmsService.sendSms(phoneNumber, messageText)
          ]);
          if (waResult.status === 'rejected') logger.warn(`[BirthdayService] WhatsApp failed for ${fullName}: ${waResult.reason}`);

        } else {
          // Smart Fallback: WhatsApp first, SMS if fail
          let delivered = false;
          try {
            const waResult = await whatsappService.sendMessage({ to: phoneNumber, message: messageText } as any);
            delivered = !!waResult?.success;
          } catch { /* will fall through to SMS */ }

          if (!delivered) {
            logger.info(`[BirthdayService] WhatsApp unavailable for ${fullName}, falling back to SMS.`);
            await SmsService.sendSms(phoneNumber, messageText);
          }
        }

        // Record in message history (as SMS for auditability)
        await this.createMessageRecord({
          senderId: 'system',
          senderType: 'ADMIN',
          recipientType: 'INDIVIDUAL',
          recipients: [{ recipientId: learner.id, recipientPhone: phoneNumber }],
          subject: 'Birthday Wishes',
          body: messageText,
          messageType: 'SMS',
          scheduledFor: now
        });

        sentCount++;
      } catch (err: any) {
        logger.error(`[BirthdayService] Failed to send birthday wish to ${fullName}: ${err?.message}`);
      }
    }

    logger.info(`[BirthdayService] ✅ Sent ${sentCount}/${birthdaysToday.length} birthday wishes.`);
    return sentCount;
  }

  startScheduler() {
    const run = async () => {
      try {
        await this.ensureDailyBirthdayWishes();
        await this.processScheduledMessages();
        await libraryService.sendOverdueReminders();
      } catch (error) {
        console.error('Message scheduler error:', error);
      }
    };

    run();
    setInterval(run, SCHEDULE_INTERVAL_MS);
  }
}

export default new MessageService();
