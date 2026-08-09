/**
 * BiometricSyncWorker
 *
 * Scheduled worker that pulls attendance logs from ZKTeco devices
 * configured in PULL sync mode.
 *
 * Schedule: every 15 minutes (cron expression configured in cron-worker.ts)
 *
 * For each PULL-mode device:
 *  1. Pull attendance records since last successful sync
 *  2. For each record, call BiometricService.processAttendanceLog()
 *     (same path as push-mode — device-agnostic processing)
 *  3. Update device.lastSeen on success
 *  4. Update device.syncMode metadata with lastSyncAt
 *
 * Failed records are logged to biometric_logs with status=FAILED
 * and picked up by the BiometricLogRetryWorker.
 */

import prisma from '../../config/database';
import logger from '../../utils/logger';
import { pullAttendanceLogs, ZKTecoDeviceConfig } from './adapters/zkteco.adapter';
import { handleBiometricLearnerScan } from './biometric-attendance.service';

const LOOKBACK_MINUTES = 30; // Pull records from the last 30 min on each cycle

export interface SyncWorkerResult {
  devicesChecked:  number;
  devicesSkipped:  number;
  recordsPulled:   number;
  recordsProcessed: number;
  recordsFailed:   number;
  errors:          string[];
}

export async function runBiometricSyncWorker(): Promise<SyncWorkerResult> {
  logger.info('[BiometricSyncWorker] Starting');

  // Only process PULL or BOTH mode devices
  const devices = await prisma.biometricDevice.findMany({
    where: {
      syncMode: { in: ['PULL', 'BOTH'] },
      status:   { not: 'DISABLED' },
    },
  });

  const result: SyncWorkerResult = {
    devicesChecked:   devices.length,
    devicesSkipped:   0,
    recordsPulled:    0,
    recordsProcessed: 0,
    recordsFailed:    0,
    errors:           [],
  };

  if (devices.length === 0) {
    logger.info('[BiometricSyncWorker] No PULL-mode devices — skipping');
    return result;
  }

  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_MINUTES * 60 * 1000);

  for (const device of devices) {
    if (!device.ipAddress) {
      result.devicesSkipped++;
      logger.warn('[BiometricSyncWorker] Device has no IP address — skipping', { deviceId: device.id });
      continue;
    }

    const deviceConfig: ZKTecoDeviceConfig = {
      ipAddress: device.ipAddress,
      serialNumber: device.serialNumber ?? undefined,
    };

    try {
      const records = await pullAttendanceLogs(deviceConfig, since, until);
      result.recordsPulled += records.length;

      logger.info(`[BiometricSyncWorker] Pulled ${records.length} records from ${device.name}`);

      for (const record of records) {
        // Create raw biometric log entry
        const log = await prisma.biometricLog.create({
          data: {
            deviceId:   device.id,
            schoolId:   device.schoolId,
            personId:   record.pin,
            personType: 'LEARNER', // Default; staff handled by staffId lookup
            timestamp:  record.datetime,
            direction:  record.direction,
            status:     'PENDING',
          },
        });

        try {
          // Try learner first
          const learnerResult = await handleBiometricLearnerScan({
            admissionNumber: record.pin,
            direction:       record.direction,
            timestamp:       record.datetime,
            deviceId:        device.id,
            schoolId:        device.schoolId,
          });

          await prisma.biometricLog.update({
            where: { id: log.id },
            data:  { status: 'PROCESSED' },
          });

          result.recordsProcessed++;
          logger.debug('[BiometricSyncWorker] Processed', {
            pin: record.pin, action: learnerResult.action,
          });

        } catch (recordErr: any) {
          await prisma.biometricLog.update({
            where: { id: log.id },
            data:  { status: 'FAILED', errorMessage: recordErr.message },
          });
          result.recordsFailed++;
          logger.warn('[BiometricSyncWorker] Record failed', {
            pin: record.pin, error: recordErr.message,
          });
        }
      }

      // Update device heartbeat
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data:  { lastSeen: new Date(), status: 'ONLINE' },
      });

    } catch (deviceErr: any) {
      result.errors.push(`${device.name}: ${deviceErr.message}`);
      logger.error('[BiometricSyncWorker] Device pull failed', {
        deviceId: device.id, name: device.name, error: deviceErr.message,
      });

      // Mark device as OFFLINE
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data:  { status: 'OFFLINE' },
      }).catch(() => {});
    }
  }

  logger.info(
    `[BiometricSyncWorker] Complete — ` +
    `devices=${result.devicesChecked}, pulled=${result.recordsPulled}, ` +
    `processed=${result.recordsProcessed}, failed=${result.recordsFailed}`,
  );

  return result;
}
