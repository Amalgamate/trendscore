/**
 * SmsReplyService
 *
 * Handles inbound SMS replies from parents.
 *
 * Flow:
 *  1. Provider posts callback to POST /api/webhooks/sms/inbound
 *  2. SmsReplyService.processInbound() is called
 *  3. Reply is parsed for intent (ACKNOWLEDGE_ABSENCE | REQUEST_CALL | OTHER)
 *  4. Phone is matched to a learner's parent contact
 *  5. Reply is linked to the most recent outbound SMS to that phone (24h window)
 *  6. Appropriate action taken (acknowledge presence event, notify teacher, etc.)
 *
 * Security:
 *  - Africa's Talking: IP whitelist (no signature)
 *  - MobileSasa: HMAC-SHA256 signature verification
 *
 * Privacy: phone numbers are never echoed in logs (only masked form).
 */

import { createHmac } from 'crypto';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { NotificationService, NotificationType } from '../../services/notification.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmsIntent = 'ACKNOWLEDGE_ABSENCE' | 'REQUEST_CALL' | 'OTHER';

export interface InboundSmsPayload {
  fromPhone:     string;
  messageBody:   string;
  provider:      'africastalking' | 'mobilesasa';
  providerMsgId?: string;
  receivedAt?:   Date;
}

export interface InboundSmsResult {
  accepted:      boolean;
  intent:        SmsIntent;
  learnerId:     string | null;
  replyId:       string;
  message:       string;
}

// ---------------------------------------------------------------------------
// Intent parser
// ---------------------------------------------------------------------------

const ACKNOWLEDGE_PATTERNS = [
  /^ok$/i,
  /^okay$/i,
  /^acknowledged?$/i,
  /\bok\b/i,
  /received/i,
  /noted/i,
  /aware/i,
  /nimepokea/i,  // Swahili: "I have received"
  /nimeona/i,    // Swahili: "I have seen"
  /sawa/i,       // Swahili: "okay"
];

const CALL_REQUEST_PATTERNS = [
  /call\s*me/i,
  /please\s*call/i,
  /nipigie/i,   // Swahili: "call me"
  /niite/i,     // Swahili: "call me"
];

function parseIntent(body: string): SmsIntent {
  const trimmed = body.trim();
  if (CALL_REQUEST_PATTERNS.some(p => p.test(trimmed))) return 'REQUEST_CALL';
  if (ACKNOWLEDGE_PATTERNS.some(p => p.test(trimmed))) return 'ACKNOWLEDGE_ABSENCE';
  return 'OTHER';
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return phone.slice(0, 5) + '****' + phone.slice(-3);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SmsReplyService {
  /**
   * Process an inbound SMS from a provider callback.
   * Entry point for both Africa's Talking and MobileSasa callbacks.
   */
  async processInbound(payload: InboundSmsPayload): Promise<InboundSmsResult> {
    const receivedAt = payload.receivedAt ?? new Date();
    const intent = parseIntent(payload.messageBody);

    logger.info('[SmsReplyService] Inbound SMS received', {
      phone: maskPhone(payload.fromPhone),
      intent,
      provider: payload.provider,
    });

    // Resolve school
    const school = await prisma.school.findFirst({
      where: { archived: false, active: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    // Find most recent outbound SMS to this phone in the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOutbound = await prisma.smsOutboundAudit.findFirst({
      where: {
        recipientPhone:   payload.fromPhone,
        status:           { in: ['SENT', 'PENDING'] },
        triggerType:      'ABSENT_LEARNER',
        createdAt:        { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve learner from the outbound record OR by scanning parent phones
    let learnerId = recentOutbound?.learnerId ?? null;
    let linkedNotificationId: string | null = null;

    if (!learnerId) {
      // Fallback: look up parent by phone number directly
      learnerId = await this.resolveLearnerFromPhone(payload.fromPhone);
    }

    // Create the reply record
    const reply = await prisma.parentSmsReply.create({
      data: {
        schoolId:              school?.id ?? null,
        fromPhone:             payload.fromPhone,
        messageBody:           payload.messageBody,
        receivedAt,
        provider:              payload.provider,
        providerMsgId:         payload.providerMsgId ?? null,
        intent,
        linkedLearnerId:       learnerId,
        linkedNotificationId,
        processed:             false,
      },
    });

    // Act on the intent
    let resultMessage = 'Reply recorded';

    if (intent === 'ACKNOWLEDGE_ABSENCE' && learnerId) {
      await this.handleAbsenceAcknowledgement(reply.id, learnerId, school?.id ?? null);
      resultMessage = 'Absence acknowledged by parent';
    } else if (intent === 'REQUEST_CALL' && learnerId) {
      await this.handleCallRequest(learnerId, payload.fromPhone, school?.id ?? null);
      resultMessage = 'Call request forwarded to class teacher';
    }

    // Mark as processed
    await prisma.parentSmsReply.update({
      where: { id: reply.id },
      data: { processed: true, processedAt: new Date() },
    });

    return { accepted: true, intent, learnerId, replyId: reply.id, message: resultMessage };
  }

  // ---------------------------------------------------------------------------
  // Intent handlers
  // ---------------------------------------------------------------------------

  private async handleAbsenceAcknowledgement(
    replyId: string,
    learnerId: string,
    schoolId: string | null,
  ): Promise<void> {
    // Find the most recent ABSENT attendance record for this learner today
    const today = new Date();
    const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const attendance = await prisma.attendance.findUnique({
      where: { learnerId_date: { learnerId, date: utcToday } },
    });

    // Notify class teacher that the parent has acknowledged
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true, grade: true },
    });

    if (!learner) return;

    // Find class teacher
    const classRecord = await prisma.class.findFirst({
      where: { grade: learner.grade, active: true, archived: false },
      select: { teacherId: true },
    });

    if (classRecord?.teacherId) {
      await NotificationService.createNotification({
        userId:  classRecord.teacherId,
        title:   'Absence Acknowledged',
        message: `Parent of ${learner.firstName} ${learner.lastName} (${learner.grade}) has acknowledged today's absence via SMS.`,
        type:    NotificationType.INFO,
        link:    `/app/attendance`,
      }).catch(() => {});
    }

    logger.info('[SmsReplyService] Absence acknowledged', {
      learnerId,
      attendanceId: attendance?.id ?? 'not found',
    });
  }

  private async handleCallRequest(
    learnerId: string,
    fromPhone: string,
    schoolId: string | null,
  ): Promise<void> {
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: { firstName: true, lastName: true, grade: true },
    });

    if (!learner) return;

    // Notify class teacher and head teacher
    const classRecord = await prisma.class.findFirst({
      where: { grade: learner.grade, active: true, archived: false },
      select: { teacherId: true },
    });

    const maskedPhone = maskPhone(fromPhone);

    const recipients: string[] = [];
    if (classRecord?.teacherId) recipients.push(classRecord.teacherId);

    // Also notify admins
    const admins = await prisma.user.findMany({
      where: {
        OR: [{ role: 'ADMIN' }, { role: 'HEAD_TEACHER' }],
        archived: false, status: 'ACTIVE',
      },
      select: { id: true },
    });
    admins.forEach(a => recipients.push(a.id));

    await Promise.all(
      [...new Set(recipients)].map(userId =>
        NotificationService.createNotification({
          userId,
          title:   'Parent Requesting Call',
          message: `Parent of ${learner.firstName} ${learner.lastName} (${learner.grade}) replied to the absence SMS requesting a call back. Contact: ${maskedPhone}`,
          type:    NotificationType.WARNING,
          link:    `/app/attendance`,
        }).catch(() => {}),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Phone resolution
  // ---------------------------------------------------------------------------

  private async resolveLearnerFromPhone(phone: string): Promise<string | null> {
    // Check learner primary contact phones
    const learner = await prisma.learner.findFirst({
      where: {
        archived: false,
        status: 'ACTIVE',
        OR: [
          { primaryContactPhone: phone },
          { guardianPhone: phone },
          { motherPhone: phone },
          { fatherPhone: phone },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (learner) return learner.id;

    // Check parent user phone
    const user = await prisma.user.findFirst({
      where: { phone, role: 'PARENT', archived: false },
      select: { learners: { select: { id: true }, take: 1 } },
    });

    return user?.learners[0]?.id ?? null;
  }

  // ---------------------------------------------------------------------------
  // HMAC verification (MobileSasa)
  // ---------------------------------------------------------------------------

  static verifyMobileSasaSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string,
  ): boolean {
    if (!signature) return false;
    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    // Timing-safe comparison
    try {
      return signature.length === expected.length &&
        createHmac('sha256', 'compare-key').update(signature).digest('hex') ===
        createHmac('sha256', 'compare-key').update(expected).digest('hex');
    } catch {
      return false;
    }
  }
}

export const smsReplyService = new SmsReplyService();
