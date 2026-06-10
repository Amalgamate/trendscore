import prisma from '../config/database';
import { SmsService } from './sms.service';
import { whatsappService } from './whatsapp.service';
import { EmailService } from './email-resend.service';
import { MessageStatus } from '@prisma/client';
import { LibraryService } from './library.service';

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

    return {
      success: successCount > 0,
      messageId: message.id,
      sent: successCount,
      failed: failureCount,
      error: successCount === 0 ? 'Failed to deliver to any recipients' : undefined
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

  async ensureDailyBirthdayWishes() {
    const config = await prisma.communicationConfig.findFirst();
    if (!config?.birthdayEnabled) {
      return 0;
    }

    const now = new Date();
    const monthDay = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
      .getDate()
      .toString()
      .padStart(2, '0')}`;

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

    const birthdaysToday = learners.filter((learner) => {
      if (!learner.dateOfBirth) return false;
      const dob = new Date(learner.dateOfBirth);
      const dobMonthDay = `${(dob.getMonth() + 1).toString().padStart(2, '0')}-${dob
        .getDate()
        .toString()
        .padStart(2, '0')}`;
      return dobMonthDay === monthDay;
    });

    const createdMessages = [];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    for (const learner of birthdaysToday) {
      const phoneNumber = learner.guardianPhone || learner.emergencyPhone;
      if (!phoneNumber) continue;

      const existingMessage = await prisma.message.findFirst({
        where: {
          subject: 'Birthday Wishes',
          recipientIds: { has: learner.id },
          scheduledFor: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      });

      if (existingMessage) continue;

      const template = config.birthdayMessageTemplate || null;
      const school = await prisma.school.findFirst({ select: { name: true } });
      const schoolName = school?.name || 'Your School';
      const fullName = `${learner.firstName} ${learner.lastName}`;
      const gradeName = learner.grade ? learner.grade.replace(/_/g, ' ') : 'Learner';
      const smsMessage = template
        ? template
            .replace(/{learnerName}/g, fullName)
            .replace(/{firstName}/g, learner.firstName)
            .replace(/{lastName}/g, learner.lastName)
            .replace(/{schoolName}/g, schoolName)
            .replace(/{gradeName}/g, gradeName)
        : `Happy Birthday ${learner.firstName}! Wishing you a wonderful day from ${schoolName}.`;

      const message = await this.createMessageRecord({
        senderId: 'system',
        senderType: 'ADMIN',
        recipientType: 'INDIVIDUAL',
        recipients: [{ recipientId: learner.id, recipientPhone: phoneNumber }],
        subject: 'Birthday Wishes',
        body: smsMessage,
        messageType: 'SMS',
        scheduledFor: now
      });

      createdMessages.push(message);
    }

    return createdMessages.length;
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
