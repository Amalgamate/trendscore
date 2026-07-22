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
  async preview(entries: AssessmentSmsEntry[]) {
    const learnerIds = [...new Set(entries.map(entry => entry.learnerId))];
    const learners = await prisma.learner.findMany({
      where: { id: { in: learnerIds }, archived: false },
      include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
    });
    const learnerMap = new Map(learners.map(learner => [learner.id, learner]));

    return entries.map((entry) => {
      const learner = learnerMap.get(entry.learnerId);
      if (!learner) {
        return { learnerId: entry.learnerId, learnerName: 'Unknown learner', phone: '', message: entry.message, valid: false, error: 'Learner not found' };
      }
      const phone = resolveLearnerPhone(learner, entry.phoneOverride);
      return {
        learnerId: learner.id,
        learnerName: learnerName(learner),
        parentName: resolveParentName(learner),
        phone,
        message: entry.message,
        smsParts: Math.max(1, Math.ceil(entry.message.length / 160)),
        valid: Boolean(phone),
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

    const results: Array<Record<string, unknown>> = [];
    for (const entry of request.entries) {
      const learner = learnerMap.get(entry.learnerId);
      if (!learner) {
        results.push({ learnerId: entry.learnerId, success: false, error: 'Learner not found' });
        continue;
      }

      const phone = resolveLearnerPhone(learner, entry.phoneOverride);
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
    }

    const sent = results.filter(result => result.success === true).length;
    return { total: results.length, sent, failed: results.length - sent, results };
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
