/**
 * SmsRetryWorker
 *
 * Hourly cron job: retries FAILED SMS records from sms_outbound_audits.
 *
 * Retry schedule (exponential back-off):
 *   Attempt 1 — after 5  minutes
 *   Attempt 2 — after 15 minutes
 *   Attempt 3 — after 45 minutes
 *   After 3 retries → PERMANENTLY_FAILED + admin in-app notification
 *
 * Only retries records that:
 *   - status = FAILED
 *   - retryCount < 3
 *   - createdAt is older than 5 minutes (avoids retrying records still in flight)
 *   - retryAt is null OR retryAt <= now (respects the back-off schedule)
 */

import prisma from '../../config/database';
import { SmsService } from '../../services/sms.service';
import { NotificationService, NotificationType } from '../../services/notification.service';
import logger from '../../utils/logger';

const MAX_RETRIES = 3;
const MIN_AGE_MS = 5 * 60 * 1000; // 5 minutes — don't retry fresh failures

/** Back-off delays in minutes per retry attempt (0-indexed) */
const BACKOFF_MINUTES = [5, 15, 45];

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function runSmsRetryWorker(): Promise<{
  processed: number;
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
}> {
  logger.info('[SmsRetryWorker] Starting');

  const cutoff = new Date(Date.now() - MIN_AGE_MS);

  // Find eligible failed records
  const candidates = await prisma.smsOutboundAudit.findMany({
    where: {
      status: 'FAILED',
      retryCount: { lt: MAX_RETRIES },
      createdAt: { lte: cutoff },
      OR: [
        { retryAt: null },
        { retryAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 100, // cap per run to avoid overloading provider
  });

  logger.info(`[SmsRetryWorker] ${candidates.length} records eligible for retry`);

  let retried = 0;
  let succeeded = 0;
  let permanentlyFailed = 0;

  for (const record of candidates) {
    const newRetryCount = record.retryCount + 1;
    retried++;

    try {
      const result = await SmsService.sendSms(record.recipientPhone, record.messageBody);

      if (result.success) {
        await prisma.smsOutboundAudit.update({
          where: { id: record.id },
          data: {
            status: 'SENT',
            retryCount: newRetryCount,
            providerMsgId: result.messageId,
            provider: result.provider,
            failureReason: null,
            sentAt: new Date(),
          },
        });
        succeeded++;
        logger.info(`[SmsRetryWorker] Retry succeeded for ${record.id} (attempt ${newRetryCount})`);
      } else {
        // Still failing — schedule next retry or mark permanent
        if (newRetryCount >= MAX_RETRIES) {
          await prisma.smsOutboundAudit.update({
            where: { id: record.id },
            data: {
              status: 'PERMANENTLY_FAILED',
              retryCount: newRetryCount,
              failureReason: result.error,
            },
          });
          permanentlyFailed++;
          logger.warn(`[SmsRetryWorker] Permanently failed: ${record.id} — ${result.error}`);
          await notifyAdminOfPermanentFailure(record);
        } else {
          const nextRetryAt = minutesFromNow(BACKOFF_MINUTES[newRetryCount] ?? 45);
          await prisma.smsOutboundAudit.update({
            where: { id: record.id },
            data: {
              status: 'FAILED',
              retryCount: newRetryCount,
              failureReason: result.error,
              retryAt: nextRetryAt,
            },
          });
          logger.warn(
            `[SmsRetryWorker] Retry ${newRetryCount} failed for ${record.id}. ` +
            `Next retry at ${nextRetryAt.toISOString()}`,
          );
        }
      }
    } catch (err: any) {
      // Unexpected error during send — treat like a failure
      if (newRetryCount >= MAX_RETRIES) {
        await prisma.smsOutboundAudit.update({
          where: { id: record.id },
          data: { status: 'PERMANENTLY_FAILED', retryCount: newRetryCount, failureReason: err.message },
        });
        permanentlyFailed++;
        await notifyAdminOfPermanentFailure(record);
      } else {
        const nextRetryAt = minutesFromNow(BACKOFF_MINUTES[newRetryCount] ?? 45);
        await prisma.smsOutboundAudit.update({
          where: { id: record.id },
          data: { status: 'FAILED', retryCount: newRetryCount, failureReason: err.message, retryAt: nextRetryAt },
        });
      }
      logger.error(`[SmsRetryWorker] Exception retrying ${record.id}: ${err.message}`);
    }
  }

  logger.info(
    `[SmsRetryWorker] Complete — retried=${retried}, succeeded=${succeeded}, permanentlyFailed=${permanentlyFailed}`,
  );

  return { processed: candidates.length, retried, succeeded, permanentlyFailed };
}

// ---------------------------------------------------------------------------
// Admin notification for permanently failed SMS
// ---------------------------------------------------------------------------

async function notifyAdminOfPermanentFailure(record: {
  id: string;
  triggerType: string;
  recipientPhone: string;
  learnerId: string | null;
}): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        OR: [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN' }],
        archived: false,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const learnerInfo = record.learnerId
      ? await prisma.learner.findUnique({
          where: { id: record.learnerId },
          select: { firstName: true, lastName: true },
        })
      : null;

    const learnerLabel = learnerInfo
      ? `${learnerInfo.firstName} ${learnerInfo.lastName}`
      : 'Unknown learner';

    const maskedPhone =
      record.recipientPhone.length > 6
        ? record.recipientPhone.slice(0, 5) + '****' + record.recipientPhone.slice(-3)
        : '***';

    await Promise.all(
      admins.map((admin) =>
        NotificationService.createNotification({
          userId: admin.id,
          title: 'SMS Delivery Failed',
          message: `Absent notification for ${learnerLabel} could not be delivered to ${maskedPhone} after ${MAX_RETRIES} attempts.`,
          type: NotificationType.WARNING,
          link: '/app/settings/communication',
        }).catch(() => {}),
      ),
    );
  } catch (err: any) {
    logger.warn(`[SmsRetryWorker] Could not notify admins of permanent failure: ${err.message}`);
  }
}
