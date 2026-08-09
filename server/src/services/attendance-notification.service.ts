/**
 * AttendanceNotificationService
 *
 * Real-time parent notifications for attendance events.
 *
 * Handles three scenarios:
 *   1. GATE_ENTRY  — biometric/RFID gate IN scan  → "Your child has arrived at school"
 *   2. GATE_EXIT   — biometric/RFID gate OUT scan  → "Your child has left school"
 *   3. MANUAL_MARK — teacher marks attendance       → notify only on ABSENT (real-time)
 *
 * Delivery:
 *   - SMS via SmsService.sendSms()  (always attempted first)
 *   - WhatsApp via WhatsAppBusinessService.sendText() (if WABA configured)
 *   - Both attempts are logged to sms_outbound_audit / wa_message_log
 *   - Failures are soft — never propagate to the caller
 *
 * Deduplication:
 *   - Gate entry/exit: one notification per learner per direction per calendar day
 *   - Manual absent: one notification per learner per absent day
 *
 * Phone resolution priority:
 *   parent.phone → primaryContactPhone → guardianPhone → motherPhone → fatherPhone
 */

import prisma from '../config/database';
import { SmsService } from './sms.service';
import { whatsAppBusinessService, isWabaConfigured } from '../domains/communication/whatsapp-business.service';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttendanceNotificationType =
  | 'GATE_ENTRY'
  | 'GATE_EXIT'
  | 'MANUAL_ABSENT'
  | 'MANUAL_PRESENT'
  | 'BUS_BOARDED'
  | 'BUS_ALIGHTED';

export interface AttendanceNotificationPayload {
  learnerId:  string;
  schoolId:   string;
  type:       AttendanceNotificationType;
  timestamp:  Date;
}

interface LearnerWithContact {
  id:                   string;
  firstName:            string;
  lastName:             string;
  grade:                string;
  parentId:             string | null;
  primaryContactPhone:  string | null;
  guardianPhone:        string | null;
  motherPhone:          string | null;
  fatherPhone:          string | null;
  parent: {
    phone: string | null;
    firstName: string;
    lastName:  string;
  } | null;
}

const TRIGGER_TYPE_MAP: Record<AttendanceNotificationType, string> = {
  GATE_ENTRY:     'GATE_ARRIVAL',
  GATE_EXIT:      'GATE_DEPARTURE',
  MANUAL_ABSENT:  'MANUAL_ABSENT',
  MANUAL_PRESENT: 'MANUAL_PRESENT',
  BUS_BOARDED:    'BUS_BOARDED',
  BUS_ALIGHTED:   'BUS_ALIGHTED',
};

// ---------------------------------------------------------------------------
// Phone resolver
// ---------------------------------------------------------------------------

function resolveParentPhone(learner: LearnerWithContact): string | null {
  return (
    learner.parent?.phone         ||
    learner.primaryContactPhone   ||
    learner.guardianPhone         ||
    learner.motherPhone           ||
    learner.fatherPhone           ||
    null
  );
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function formatTime(ts: Date): string {
  // EAT = UTC+3
  const eat = new Date(ts.getTime() + 3 * 60 * 60 * 1000);
  const hh  = String(eat.getUTCHours()).padStart(2, '0');
  const mm  = String(eat.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildMessage(
  type:        AttendanceNotificationType,
  learnerName: string,
  grade:       string,
  schoolName:  string,
  timestamp:   Date,
): string {
  const time = formatTime(timestamp);
  const date = timestamp.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });

  switch (type) {
    case 'GATE_ENTRY':
      return (
        `Dear Parent, ${learnerName} (${grade}) has arrived at ${schoolName} at ${time} EAT on ${date}. ` +
        `They are safely on school grounds.`
      );
    case 'GATE_EXIT':
      return (
        `Dear Parent, ${learnerName} (${grade}) has left ${schoolName} at ${time} EAT on ${date}. ` +
        `Please ensure they arrive home safely.`
      );
    case 'MANUAL_ABSENT':
      return (
        `Dear Parent, ${learnerName} (${grade}) was marked ABSENT from ${schoolName} on ${date}. ` +
        `Please contact the school if this is unexpected. Reply OK to acknowledge.`
      );
    case 'MANUAL_PRESENT':
      return (
        `Dear Parent, ${learnerName} (${grade}) has been marked PRESENT at ${schoolName} for ${date}.`
      );
    case 'BUS_BOARDED':
      return (
        `Dear Parent, ${learnerName} (${grade}) has boarded the school bus at ${time} EAT. They are on their way to school.`
      );
    case 'BUS_ALIGHTED':
      return (
        `Dear Parent, ${learnerName} (${grade}) alighted from the school bus at ${time} EAT. Please ensure they arrive home safely.`
      );
  }
}

// ---------------------------------------------------------------------------
// Deduplication check
// ---------------------------------------------------------------------------

async function isAlreadyNotifiedToday(
  learnerId:   string,
  triggerType: string,
  today:       Date,
): Promise<boolean> {
  const existing = await prisma.smsOutboundAudit.findFirst({
    where: {
      learnerId,
      triggerType,
      createdAt: { gte: today },
      status:    { not: 'PERMANENTLY_FAILED' },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export class AttendanceNotificationService {

  /**
   * Notify a parent about an attendance event.
   * Fire-and-forget safe — never throws. All errors are logged.
   */
  async notify(payload: AttendanceNotificationPayload): Promise<void> {
    try {
      await this._notify(payload);
    } catch (err: any) {
      logger.error('[AttendanceNotification] Unexpected error — notification suppressed', {
        learnerId: payload.learnerId,
        type:      payload.type,
        error:     err?.message,
      });
    }
  }

  private async _notify(payload: AttendanceNotificationPayload): Promise<void> {
    const { learnerId, schoolId, type, timestamp } = payload;

    // Skip MANUAL_PRESENT — not typically sent to avoid notification fatigue
    if (type === 'MANUAL_PRESENT') return;

    // Fetch learner + parent contact
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      select: {
        id: true, firstName: true, lastName: true, grade: true,
        parentId: true,
        primaryContactPhone: true, guardianPhone: true,
        motherPhone: true, fatherPhone: true,
        parent: { select: { phone: true, firstName: true, lastName: true } },
      },
    }) as LearnerWithContact | null;

    if (!learner) {
      logger.warn('[AttendanceNotification] Learner not found — skipping', { learnerId });
      return;
    }

    const phone = resolveParentPhone(learner);
    if (!phone) {
      logger.debug('[AttendanceNotification] No parent phone — skipping', { learnerId });
      return;
    }

    // Fetch school name
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, attendanceNotifyAbsentDefault: true },
    });
    if (!school) return;

    // Check if absent notifications are disabled for this school
    if (type === 'MANUAL_ABSENT' && school.attendanceNotifyAbsentDefault === false) {
      return;
    }

    const triggerType = TRIGGER_TYPE_MAP[type];
    const today = new Date(
      Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()),
    );

    // Deduplicate: only one notification per learner per type per day
    if (await isAlreadyNotifiedToday(learnerId, triggerType, today)) {
      logger.debug('[AttendanceNotification] Already notified today — skipping', { learnerId, triggerType });
      return;
    }

    const learnerName  = `${learner.firstName} ${learner.lastName}`;
    const message      = buildMessage(type, learnerName, learner.grade, school.name, timestamp);

    // ── SMS delivery ────────────────────────────────────────────────────────
    const auditRecord = await prisma.smsOutboundAudit.create({
      data: {
        schoolId,
        triggerType,
        recipientPhone: phone,
        recipientName:  `Parent of ${learnerName}`,
        learnerId,
        messageBody:    message,
        status:         'PENDING',
      },
    });

    try {
      const smsResult = await SmsService.sendSms(phone, message);
      await prisma.smsOutboundAudit.update({
        where: { id: auditRecord.id },
        data: {
          status:        smsResult.success ? 'SENT' : 'FAILED',
          providerMsgId: smsResult.messageId,
          provider:      smsResult.provider,
          failureReason: smsResult.success ? null : smsResult.error,
          sentAt:        smsResult.success ? new Date() : null,
        },
      });

      if (smsResult.success) {
        logger.info('[AttendanceNotification] SMS sent', { learnerId, type, phone: phone.slice(0, 7) + '****' });
      } else {
        logger.warn('[AttendanceNotification] SMS failed', { learnerId, type, error: smsResult.error });
      }
    } catch (smsErr: any) {
      await prisma.smsOutboundAudit.update({
        where: { id: auditRecord.id },
        data: { status: 'FAILED', failureReason: smsErr.message },
      });
      logger.warn('[AttendanceNotification] SMS exception', { learnerId, error: smsErr.message });
    }

    // ── WhatsApp delivery (WABA only, if configured) ────────────────────────
    if (isWabaConfigured()) {
      try {
        const waResult = await whatsAppBusinessService.sendText({ to: phone, body: message });
        logger.info('[AttendanceNotification] WhatsApp sent', {
          learnerId,
          type,
          success: waResult.success,
          messageId: waResult.messageId,
        });
      } catch (waErr: any) {
        // WhatsApp failure never blocks SMS — already logged above
        logger.warn('[AttendanceNotification] WhatsApp exception', { learnerId, error: waErr.message });
      }
    }
  }
}

export const attendanceNotificationService = new AttendanceNotificationService();
