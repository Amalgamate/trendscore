/**
 * BiometricLogRetryWorker
 *
 * Nightly cron (02:00 UTC): retries biometric_logs with status=FAILED.
 *
 * These failures typically occur because:
 *  - The learner admissionNumber wasn't found at scan time (not yet enrolled)
 *  - No admin user was found for markedBy
 *  - Transient DB errors during the original webhook call
 *
 * Retry strategy:
 *  - Attempts up to MAX_RETRIES (3)
 *  - Only retries LEARNER records (STAFF failures are handled by HR clock-in)
 *  - Skips records older than MAX_AGE_DAYS
 *  - After MAX_RETRIES: status stays FAILED, retryCount incremented, no more retries
 */

import prisma from '../../config/database';
import logger from '../../utils/logger';
import { handleBiometricLearnerScan } from './biometric-attendance.service';

const MAX_RETRIES   = 3;
const MAX_AGE_DAYS  = 7;
const BATCH_SIZE    = 50;

export interface RetryWorkerResult {
  processed:   number;
  succeeded:   number;
  stillFailed: number;
  exhausted:   number;
}

export async function runBiometricLogRetryWorker(): Promise<RetryWorkerResult> {
  logger.info('[BiometricLogRetryWorker] Starting');

  const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const failedLogs = await prisma.biometricLog.findMany({
    where: {
      status:     'FAILED',
      personType: 'LEARNER',
      retryCount: { lt: MAX_RETRIES },
      timestamp:  { gte: cutoffDate },
    },
    include: { device: true },
    orderBy: { timestamp: 'asc' },
    take: BATCH_SIZE,
  });

  logger.info(`[BiometricLogRetryWorker] ${failedLogs.length} logs eligible for retry`);

  let succeeded   = 0;
  let stillFailed = 0;
  let exhausted   = 0;

  for (const log of failedLogs) {
    const newRetryCount = log.retryCount + 1;

    try {
      await handleBiometricLearnerScan({
        admissionNumber: log.personId,
        direction:       log.direction as 'IN' | 'OUT',
        timestamp:       log.timestamp,
        deviceId:        log.deviceId,
        schoolId:        log.schoolId,
      });

      await prisma.biometricLog.update({
        where: { id: log.id },
        data:  { status: 'PROCESSED', retryCount: newRetryCount },
      });

      succeeded++;
      logger.info('[BiometricLogRetryWorker] Retry succeeded', { logId: log.id, pin: log.personId });

    } catch (err: any) {
      if (newRetryCount >= MAX_RETRIES) {
        // Exhausted — leave as FAILED, mark retry count at max
        await prisma.biometricLog.update({
          where: { id: log.id },
          data:  { retryCount: newRetryCount },
        });
        exhausted++;
        logger.warn('[BiometricLogRetryWorker] Exhausted retries', {
          logId: log.id, pin: log.personId, error: err.message,
        });
      } else {
        await prisma.biometricLog.update({
          where: { id: log.id },
          data:  { retryCount: newRetryCount, errorMessage: err.message },
        });
        stillFailed++;
        logger.warn('[BiometricLogRetryWorker] Retry failed', {
          logId: log.id, attempt: newRetryCount, error: err.message,
        });
      }
    }
  }

  logger.info(
    `[BiometricLogRetryWorker] Complete — processed=${failedLogs.length}, ` +
    `succeeded=${succeeded}, stillFailed=${stillFailed}, exhausted=${exhausted}`,
  );

  return { processed: failedLogs.length, succeeded, stillFailed, exhausted };
}
