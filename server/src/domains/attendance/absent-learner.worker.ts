/**
 * AbsentLearnerSmsWorker
 *
 * Daily cron job: fires at 09:30 EAT (06:30 UTC) on school days.
 *
 * Logic:
 *  1. Skip if today is a non-working day (school.staffWorkingDays config)
 *  2. Find all active learners who have NO attendance record for today
 *     (status PRESENT, LATE, EXCUSED, SICK all count as "attended" — only true ABSENT
 *      and completely unmarked are notified)
 *  3. Resolve parent phone for each absent/unmarked learner
 *  4. Send SMS via SmsService
 *  5. Write audit record to sms_outbound_audits for every attempt
 *
 * Phone resolution priority:
 *   primaryContactPhone → guardianPhone → motherPhone → fatherPhone
 *
 * Rate: processes in batches of 50 with 100ms delay between batches.
 * Does NOT send duplicates: checks sms_outbound_audits for today before sending.
 */

import prisma from '../../config/database';
import { SmsService } from '../../services/sms.service';
import logger from '../../utils/logger';

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;
const TRIGGER_TYPE = 'ABSENT_LEARNER';

// Statuses that mean the learner is accounted for (not absent)
const ACCOUNTED_STATUSES = new Set(['PRESENT', 'LATE', 'EXCUSED', 'SICK']);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve UTC midnight for today */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Is today a working day per school config?
 * staffWorkingDays is a JSON array of weekday numbers: [1,2,3,4,5] = Mon–Fri
 * JS getDay(): 0=Sun, 1=Mon, ... 6=Sat
 */
function isTodayWorkingDay(staffWorkingDays: unknown): boolean {
  const today = new Date().getDay(); // local time is fine for day-of-week check
  let workingDays: number[] = [1, 2, 3, 4, 5]; // default Mon–Fri
  try {
    if (Array.isArray(staffWorkingDays)) {
      workingDays = (staffWorkingDays as number[]).filter((d) => typeof d === 'number');
    } else if (typeof staffWorkingDays === 'string') {
      const parsed = JSON.parse(staffWorkingDays);
      if (Array.isArray(parsed)) workingDays = parsed;
    }
  } catch {
    // use default
  }
  return workingDays.includes(today);
}

/** Resolve the best available phone number for a learner's parent */
function resolveParentPhone(learner: {
  primaryContactPhone: string | null;
  guardianPhone: string | null;
  motherPhone: string | null;
  fatherPhone: string | null;
}): string | null {
  return (
    learner.primaryContactPhone ||
    learner.guardianPhone ||
    learner.motherPhone ||
    learner.fatherPhone ||
    null
  );
}

/** Build the SMS message for an absent learner */
function buildAbsentSms(
  schoolName: string,
  learnerName: string,
  grade: string,
): string {
  const date = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    `Dear Parent/Guardian, ${learnerName} (${grade}) was absent from ${schoolName} ` +
    `on ${date}. Please contact the school if this is unexpected. ` +
    `Reply OK to acknowledge. Thank you.`
  );
}

// ---------------------------------------------------------------------------
// Main worker function
// ---------------------------------------------------------------------------

export async function runAbsentLearnerSmsWorker(): Promise<{
  skipped: boolean;
  skipReason?: string;
  total: number;
  sent: number;
  alreadySent: number;
  noPhone: number;
  failed: number;
}> {
  logger.info('[AbsentLearnerWorker] Starting');

  // 1. Fetch school config
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: {
      id: true,
      name: true,
      staffWorkingDays: true,
      attendanceNotifyAbsentDefault: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!school) {
    logger.warn('[AbsentLearnerWorker] No active school found — skipping');
    return { skipped: true, skipReason: 'No active school', total: 0, sent: 0, alreadySent: 0, noPhone: 0, failed: 0 };
  }

  // 2. Skip on non-working days
  if (!isTodayWorkingDay(school.staffWorkingDays)) {
    logger.info('[AbsentLearnerWorker] Not a working day — skipping');
    return { skipped: true, skipReason: 'Non-working day', total: 0, sent: 0, alreadySent: 0, noPhone: 0, failed: 0 };
  }

  // 3. Skip if school has opted out of absent notifications
  if (school.attendanceNotifyAbsentDefault === false) {
    logger.info('[AbsentLearnerWorker] School has disabled absent notifications — skipping');
    return { skipped: true, skipReason: 'Notifications disabled', total: 0, sent: 0, alreadySent: 0, noPhone: 0, failed: 0 };
  }

  const today = utcToday();
  const schoolName = school.name.toUpperCase();

  // 4. Get IDs of learners who have an attendance record today
  // (any status counts — we only want truly absent/unmarked)
  const markedLearnerIds = await prisma.attendance.findMany({
    where: { date: today },
    select: { learnerId: true, status: true },
  });

  // Learners marked ABSENT count as "absent but we know" — still notify
  // Learners with PRESENT/LATE/EXCUSED/SICK are accounted for — skip
  const accountedIds = new Set(
    markedLearnerIds
      .filter((r) => ACCOUNTED_STATUSES.has(r.status))
      .map((r) => r.learnerId),
  );

  // 5. Get all active learners not accounted for
  const absentLearners = await prisma.learner.findMany({
    where: {
      status: 'ACTIVE',
      archived: false,
      id: { notIn: [...accountedIds] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      primaryContactPhone: true,
      guardianPhone: true,
      motherPhone: true,
      fatherPhone: true,
    },
    orderBy: { lastName: 'asc' },
  });

  const total = absentLearners.length;
  logger.info(`[AbsentLearnerWorker] ${total} absent/unmarked learners to notify`);

  if (total === 0) {
    return { skipped: false, total: 0, sent: 0, alreadySent: 0, noPhone: 0, failed: 0 };
  }

  // 6. Check which learners have already been notified today (dedup)
  const alreadyNotifiedToday = await prisma.smsOutboundAudit.findMany({
    where: {
      triggerType: TRIGGER_TYPE,
      createdAt: { gte: today },
      status: { not: 'PERMANENTLY_FAILED' },
    },
    select: { learnerId: true },
  });
  const alreadyNotifiedSet = new Set(
    alreadyNotifiedToday.map((r) => r.learnerId).filter(Boolean),
  );

  let sent = 0;
  let alreadySent = 0;
  let noPhone = 0;
  let failed = 0;

  // 7. Process in batches
  for (let i = 0; i < absentLearners.length; i += BATCH_SIZE) {
    const batch = absentLearners.slice(i, i + BATCH_SIZE);

    for (const learner of batch) {
      // Skip if already notified today
      if (alreadyNotifiedSet.has(learner.id)) {
        alreadySent++;
        continue;
      }

      const phone = resolveParentPhone(learner);
      if (!phone) {
        noPhone++;
        // Log audit record so we know the notification was attempted but no phone found
        await prisma.smsOutboundAudit.create({
          data: {
            schoolId: school.id,
            triggerType: TRIGGER_TYPE,
            recipientPhone: 'NO_PHONE',
            recipientName: `${learner.firstName} ${learner.lastName} (parent)`,
            learnerId: learner.id,
            messageBody: 'No parent phone number available',
            status: 'PERMANENTLY_FAILED',
            failureReason: 'No parent phone number on record',
          },
        });
        continue;
      }

      const learnerName = `${learner.firstName} ${learner.lastName}`;
      const message = buildAbsentSms(schoolName, learnerName, learner.grade);

      // Write PENDING audit record first
      const auditRecord = await prisma.smsOutboundAudit.create({
        data: {
          schoolId: school.id,
          triggerType: TRIGGER_TYPE,
          recipientPhone: phone,
          recipientName: `Parent of ${learnerName}`,
          learnerId: learner.id,
          messageBody: message,
          status: 'PENDING',
        },
      });

      // Attempt send
      try {
        const result = await SmsService.sendSms(phone, message);
        await prisma.smsOutboundAudit.update({
          where: { id: auditRecord.id },
          data: {
            status: result.success ? 'SENT' : 'FAILED',
            providerMsgId: result.messageId,
            provider: result.provider,
            failureReason: result.success ? null : result.error,
            sentAt: result.success ? new Date() : null,
          },
        });
        if (result.success) {
          sent++;
        } else {
          failed++;
          logger.warn(`[AbsentLearnerWorker] SMS failed for learner ${learner.id}: ${result.error}`);
        }
      } catch (err: any) {
        await prisma.smsOutboundAudit.update({
          where: { id: auditRecord.id },
          data: { status: 'FAILED', failureReason: err.message },
        });
        failed++;
        logger.error(`[AbsentLearnerWorker] SMS error for learner ${learner.id}: ${err.message}`);
      }
    }

    // Pause between batches
    if (i + BATCH_SIZE < absentLearners.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  logger.info(
    `[AbsentLearnerWorker] Complete — total=${total}, sent=${sent}, ` +
    `alreadySent=${alreadySent}, noPhone=${noPhone}, failed=${failed}`,
  );

  return { skipped: false, total, sent, alreadySent, noPhone, failed };
}
