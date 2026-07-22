import prisma from '../config/database';
import { SmsService } from './sms.service';

export interface AssessmentSmsEntry {
  learnerId: string;
  message: string;
  phoneOverride?: string;
}

export interface AssessmentSmsBulkRequest {
  entries: AssessmentSmsEntry[];
  term: string;
  academicYear: number;
  sentByUserId?: string;
}

interface AssessmentSmsContext {
  term: string;
  academicYear: number;
}

const phoneKey = (phone: string): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
};

const deliveryKey = (learnerId: string, phone: string, message: string): string =>
  `${learnerId}\u0000${phoneKey(phone)}\u0000${message}`;

const resolveLearnerPhone = (learner: any, override?: string): string => (
  override ||
  learner?.primaryContactPhone ||
  learner?.guardianPhone ||
  learner?.parent?.phone ||
  learner?.fatherPhone ||
  learner?.motherPhone ||
  ''
).trim();

const resolveParentName = (learner: any): string => (
  learner?.primaryContactName ||
  learner?.guardianName ||
  [learner?.parent?.firstName, learner?.parent?.lastName].filter(Boolean).join(' ') ||
  learner?.fatherName ||
  learner?.motherName ||
  'Parent/Guardian'
);

const learnerName = (learner: any): string =>
  [learner?.firstName, learner?.middleName, learner?.lastName].filter(Boolean).join(' ');

export class AssessmentSmsDeliveryService {
  private async deliveredMessages(learnerIds: string[], context: AssessmentSmsContext) {
    if (!learnerIds.length) return new Map<string, any>();
    const audits = await prisma.assessmentSmsAudit.findMany({
      where: {
        learnerId: { in: learnerIds },
        assessmentType: 'SUMMATIVE',
        term: context.term,
        academicYear: context.academicYear,
        channel: 'SMS',
        smsStatus: 'SENT',
      },
      orderBy: { sentAt: 'desc' },
    });
    return new Map(audits.map(audit => [deliveryKey(audit.learnerId, audit.parentPhone, audit.messageContent), audit]));
  }

  async preview(entries: AssessmentSmsEntry[], context?: AssessmentSmsContext) {
    const learnerIds = [...new Set(entries.map(entry => entry.learnerId))];
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds }, archived: false },
      include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
    });
    const learnerMap = new Map(learners.map(learner => [learner.id, learner]));

    const delivered = context
      ? await this.deliveredMessages(learnerIds, context)
      : new Map<string, any>();

    return entries.map((entry) => {
      const learner = learnerMap.get(entry.learnerId);
      if (!learner) {
        return { learnerId: entry.learnerId, learnerName: 'Unknown learner', phone: '', message: entry.message, valid: false, error: 'Learner not found' };
      }
      const phone = resolveLearnerPhone(learner, entry.phoneOverride);
      const priorDelivery = phone ? delivered.get(deliveryKey(learner.id, phone, entry.message)) : undefined;
      return {
        learnerId: learner.id,
        learnerName: learnerName(learner),
        parentName: resolveParentName(learner),
        phone,
        message: entry.message,
        smsParts: Math.max(1, Math.ceil(entry.message.length / 160)),
        valid: Boolean(phone),
        alreadySent: Boolean(priorDelivery),
        existingAuditId: priorDelivery?.id,
        previouslySentAt: priorDelivery?.sentAt,
        error: phone ? undefined : 'No parent or guardian phone number is configured',
      };
    });
  }

  async sendBulk(request: AssessmentSmsBulkRequest) {
    const learnerIds = [...new Set(request.entries.map(entry => entry.learnerId))];
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds }, archived: false },
      include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
    });
    const learnerMap = new Map(learners.map(learner => [learner.id, learner]));
    const delivered = await this.deliveredMessages(learnerIds, request);

    const results: Array<Record<string, unknown>> = [];
    for (const entry of request.entries) {
      const learner = learnerMap.get(entry.learnerId);
      if (!learner) {
        results.push({ learnerId: entry.learnerId, success: false, error: 'Learner not found' });
        continue;
      }

      const phone = resolveLearnerPhone(learner, entry.phoneOverride);
      const key = deliveryKey(learner.id, phone, entry.message);
      const priorDelivery = phone ? delivered.get(key) : undefined;
      if (priorDelivery) {
        results.push({
          learnerId: learner.id,
          learnerName: learnerName(learner),
          phone,
          success: true,
          skipped: true,
          alreadySent: true,
          existingAuditId: priorDelivery.id,
          previouslySentAt: priorDelivery.sentAt,
        });
        continue;
      }
      const audit = await prisma.assessmentSmsAudit.create({
        data: {
          learnerId: learner.id,
          assessmentType: 'SUMMATIVE',
          term: request.term,
          academicYear: request.academicYear,
          parentPhone: phone || 'MISSING',
          parentName: resolveParentName(learner),
          learnerName: learnerName(learner),
          learnerGrade: learner.grade,
          templateType: 'SUMMATIVE_TERM',
          messageContent: entry.message,
          channel: 'SMS',
          smsStatus: 'PENDING',
          sentByUserId: request.sentByUserId,
        },
      });

      if (!phone) {
        const error = 'No parent or guardian phone number is configured';
        await prisma.assessmentSmsAudit.update({
          where: { id: audit.id },
          data: { smsStatus: 'FAILED', failureReason: error },
        });
        results.push({ auditId: audit.id, learnerId: learner.id, learnerName: learnerName(learner), success: false, error });
        continue;
      }

      const delivery = await SmsService.sendSms(phone, entry.message);
      await prisma.assessmentSmsAudit.update({
        where: { id: audit.id },
        data: {
          parentPhone: phone,
          smsMessageId: delivery.messageId || null,
          smsStatus: delivery.success ? 'SENT' : 'FAILED',
          failureReason: delivery.success ? null : delivery.error || 'Delivery failed',
        },
      });
      results.push({
        auditId: audit.id,
        learnerId: learner.id,
        learnerName: learnerName(learner),
        phone,
        success: delivery.success,
        messageId: delivery.messageId,
        error: delivery.success ? undefined : delivery.error || 'Delivery failed',
      });
      if (delivery.success) delivered.set(key, { id: audit.id, sentAt: new Date() });
    }

    const alreadySent = results.filter(result => result.alreadySent === true).length;
    const sent = results.filter(result => result.success === true && result.alreadySent !== true).length;
    const failed = results.filter(result => result.success !== true).length;
    return { total: results.length, sent, alreadySent, failed, results };
  }

  async retry(auditId: string, sentByUserId?: string) {
    const audit = await prisma.assessmentSmsAudit.findUnique({
      where: { id: auditId },
      include: { learner: { include: { parent: { select: { firstName: true, lastName: true, phone: true } } } } },
    });
    if (!audit || audit.channel !== 'SMS') throw new Error('Assessment SMS audit record not found');

    const phone = audit.parentPhone === 'MISSING'
      ? resolveLearnerPhone(audit.learner)
      : audit.parentPhone;
    if (!phone) {
      const error = 'No parent or guardian phone number is configured';
      await prisma.assessmentSmsAudit.update({ where: { id: audit.id }, data: { smsStatus: 'FAILED', failureReason: error } });
      return { success: false, auditId, error };
    }

    const delivered = audit.term && audit.academicYear
      ? await this.deliveredMessages([audit.learnerId], {
        term: audit.term,
        academicYear: audit.academicYear,
      })
      : new Map<string, any>();
    const priorDelivery = delivered.get(deliveryKey(audit.learnerId, phone, audit.messageContent));
    if (priorDelivery && priorDelivery.id !== audit.id) {
      await prisma.assessmentSmsAudit.update({
        where: { id: audit.id },
        data: {
          smsStatus: 'SKIPPED',
          failureReason: `Already delivered by audit ${priorDelivery.id}`,
          parentPhone: phone,
          sentByUserId,
        },
      });
      return { success: true, skipped: true, alreadySent: true, auditId, existingAuditId: priorDelivery.id, phone };
    }

    await prisma.assessmentSmsAudit.update({
      where: { id: audit.id },
      data: { smsStatus: 'PENDING', failureReason: null, parentPhone: phone, sentByUserId, sentAt: new Date() },
    });
    const delivery = await SmsService.sendSms(phone, audit.messageContent);
    await prisma.assessmentSmsAudit.update({
      where: { id: audit.id },
      data: {
        smsStatus: delivery.success ? 'SENT' : 'FAILED',
        smsMessageId: delivery.messageId || null,
        failureReason: delivery.success ? null : delivery.error || 'Delivery failed',
      },
    });
    return { success: delivery.success, auditId, phone, messageId: delivery.messageId, error: delivery.error };
  }
}

export const assessmentSmsDeliveryService = new AssessmentSmsDeliveryService();
