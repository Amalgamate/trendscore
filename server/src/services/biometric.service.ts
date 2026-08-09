/**
 * Biometric Service
 *
 * Handles device registration, credential enrollment (with AES-256-GCM encryption),
 * webhook attendance logging, and dispatching to domain attendance handlers.
 *
 * SECURITY RULES:
 *  - Biometric templates are encrypted before any DB write (encryptTemplate)
 *  - Decrypted templates never appear in logs or API responses
 *  - Device tokens are returned once and stored only as SHA-256 digests
 */

import prisma from '../config/database';
import {
  encryptTemplate,
  legacyStringToBuffer,
  CURRENT_KEY_VERSION,
} from '../domains/biometrics/biometric.encryption';
import { handleBiometricLearnerScan } from '../domains/biometrics/biometric-attendance.service';
import logger from '../utils/logger';
import { presenceService } from '../domains/presence/presence.service';
import { attendanceNotificationService } from './attendance-notification.service';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ApiError } from '../utils/error.util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrollCredentialInput {
  schoolId: string;
  userId?: string;
  learnerId?: string;
  /** FINGERPRINT | FACE | CARD */
  type: string;
  /**
   * The raw template — either a Buffer (from SDK) or a base64/hex string.
   * This is encrypted before storage. Never returned in responses.
   */
  template: Buffer | string;
  fingerIndex?: number;
  quality?: number;
}

export interface RegisterBiometricDeviceInput {
  deviceId: string;
  name: string;
  type?: string;
  location?: string;
  ipAddress?: string;
  schoolId: string;
  serialNumber?: string;
  firmwareVersion?: string;
  syncMode?: string;
  installedById?: string;
}

const DEVICE_GUIDE_VERSION = '2026.08';
const VALID_SYNC_MODES = new Set(['PUSH', 'PULL', 'BOTH']);

const SAFE_DEVICE_SELECT = {
  id: true,
  name: true,
  deviceId: true,
  type: true,
  location: true,
  ipAddress: true,
  status: true,
  lastSeen: true,
  schoolId: true,
  serialNumber: true,
  firmwareVersion: true,
  syncMode: true,
  installationStatus: true,
  installationGuideVersion: true,
  installedById: true,
  installedAt: true,
  lastConnectionTestAt: true,
  lastConnectionTestStatus: true,
  lastConnectionTestMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function secretsMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export interface ProcessAttendanceLogInput {
  deviceToken: string;
  deviceId: string;
  /** admissionNumber (learner) or staffId (staff) */
  personId: string;
  personType: 'LEARNER' | 'STAFF';
  timestamp: Date;
  direction: 'IN' | 'OUT';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BiometricService {

  // ── Device Management ────────────────────────────────────────────────────

  /**
   * Register or update a biometric device.
   * schoolId is required for all new devices.
   */
  async registerDevice(data: RegisterBiometricDeviceInput) {
    const deviceId = data.deviceId?.trim();
    const name = data.name?.trim();
    const syncMode = String(data.syncMode || 'PUSH').toUpperCase();

    if (!deviceId || !name) throw new ApiError(400, 'deviceId and name are required');
    if (!VALID_SYNC_MODES.has(syncMode)) throw new ApiError(400, 'syncMode must be PUSH, PULL, or BOTH');

    const existing = await prisma.biometricDevice.findUnique({
      where: { deviceId },
      select: { id: true, schoolId: true },
    });

    if (existing?.schoolId && existing.schoolId !== data.schoolId) {
      throw new ApiError(409, 'This hardware device is already registered to another school');
    }

    const commonData = {
      name,
      type: String(data.type || 'TERMINAL').toUpperCase(),
      location: data.location?.trim() || null,
      ipAddress: data.ipAddress?.trim() || null,
      schoolId: data.schoolId,
      serialNumber: data.serialNumber?.trim() || null,
      firmwareVersion: data.firmwareVersion?.trim() || null,
      syncMode,
      installationGuideVersion: DEVICE_GUIDE_VERSION,
    };

    if (existing) {
      const device = await prisma.biometricDevice.update({
        where: { id: existing.id },
        data: commonData,
        select: SAFE_DEVICE_SELECT,
      });
      return { device, created: false as const };
    }

    const deviceToken = randomBytes(32).toString('hex');
    const device = await prisma.biometricDevice.create({
      data: {
        ...commonData,
        deviceId,
        token: null,
        tokenHash: hashDeviceToken(deviceToken),
        status: 'OFFLINE',
        installationStatus: 'REGISTERED',
        installedById: data.installedById ?? null,
      },
      select: SAFE_DEVICE_SELECT,
    });

    return { device, deviceToken, created: true as const };
  }

  async getDevices(schoolId: string) {
    return prisma.biometricDevice.findMany({
      where: { schoolId },
      select: SAFE_DEVICE_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateDevice(
    id: string,
    schoolId: string,
    data: {
      name?: string;
      type?: string;
      location?: string | null;
      ipAddress?: string | null;
      serialNumber?: string | null;
      firmwareVersion?: string | null;
      syncMode?: string;
    },
  ) {
    const existing = await prisma.biometricDevice.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Device not found');

    const syncMode = data.syncMode?.toUpperCase();
    if (syncMode && !VALID_SYNC_MODES.has(syncMode)) {
      throw new ApiError(400, 'syncMode must be PUSH, PULL, or BOTH');
    }

    return prisma.biometricDevice.update({
      where: { id: existing.id },
      data: {
        ...(data.name?.trim() && { name: data.name.trim() }),
        ...(data.type?.trim() && { type: data.type.trim().toUpperCase() }),
        ...(data.location !== undefined && { location: data.location?.trim() || null }),
        ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress?.trim() || null }),
        ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber?.trim() || null }),
        ...(data.firmwareVersion !== undefined && { firmwareVersion: data.firmwareVersion?.trim() || null }),
        ...(syncMode && { syncMode }),
      },
      select: SAFE_DEVICE_SELECT,
    });
  }

  async rotateDeviceToken(id: string, schoolId: string) {
    const existing = await prisma.biometricDevice.findFirst({
      where: { id, schoolId },
      select: { id: true, deviceId: true, status: true },
    });
    if (!existing) throw new ApiError(404, 'Device not found');
    if (existing.status === 'DISABLED') {
      throw new ApiError(409, 'A decommissioned device cannot receive a new token');
    }

    const deviceToken = randomBytes(32).toString('hex');
    await prisma.biometricDevice.update({
      where: { id: existing.id },
      data: {
        token: null,
        tokenHash: hashDeviceToken(deviceToken),
        status: 'OFFLINE',
        installationStatus: 'CONFIGURING',
        lastConnectionTestAt: null,
        lastConnectionTestStatus: null,
        lastConnectionTestMessage: null,
      },
    });
    return { deviceId: existing.deviceId, deviceToken };
  }

  async decommissionDevice(id: string, schoolId: string) {
    const existing = await prisma.biometricDevice.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Device not found');
    return prisma.biometricDevice.update({
      where: { id: existing.id },
      data: { status: 'DISABLED', installationStatus: 'DISABLED', token: null, tokenHash: null },
      select: SAFE_DEVICE_SELECT,
    });
  }

  async testDeviceConnection(id: string, schoolId: string, installedById?: string) {
    const device = await prisma.biometricDevice.findFirst({
      where: { id, schoolId },
      select: { id: true, status: true, lastSeen: true, installationStatus: true },
    });
    if (!device) throw new ApiError(404, 'Device not found');
    if (device.status === 'DISABLED') throw new ApiError(409, 'A decommissioned device cannot be tested');

    const testedAt = new Date();
    const recentlySeen = Boolean(
      device.status === 'ONLINE' &&
      device.lastSeen &&
      testedAt.getTime() - device.lastSeen.getTime() <= 10 * 60 * 1000,
    );
    const testStatus = recentlySeen ? 'CONNECTED' : 'WAITING_FOR_SCAN';
    const message = recentlySeen
      ? 'Terminal authenticated successfully within the last 10 minutes.'
      : 'Waiting for the terminal to send an authenticated test scan.';

    const updated = await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastConnectionTestAt: testedAt,
        lastConnectionTestStatus: testStatus,
        lastConnectionTestMessage: message,
        installationStatus: recentlySeen ? 'VERIFIED' : 'CONFIGURING',
        ...(recentlySeen && {
          installedAt: testedAt,
          ...(installedById && { installedById }),
        }),
      },
      select: SAFE_DEVICE_SELECT,
    });

    return { status: testStatus, message, device: updated };
  }

  // ── Credential Enrollment ────────────────────────────────────────────────

  /**
   * Enroll a biometric credential with AES-256-GCM encryption.
   *
   * SECURITY: The raw template is encrypted immediately. The returned
   * credential record does NOT include the template — only metadata.
   */
  async enrollCredential(data: EnrollCredentialInput) {
    // Convert string templates to Buffer (handles legacy base64/hex/utf8 strings)
    const rawBuffer = Buffer.isBuffer(data.template)
      ? data.template
      : legacyStringToBuffer(data.template as string);

    const { encrypted, keyVersion } = encryptTemplate(rawBuffer);

    // Convert the packed hex string to a Buffer for BYTEA storage
    const encryptedBuffer = Buffer.from(encrypted, 'utf8');

    const credential = await prisma.biometricCredential.create({
      data: {
        schoolId: data.schoolId,
        userId: data.userId,
        learnerId: data.learnerId,
        type: data.type,
        template: encryptedBuffer,
        fingerIndex: data.fingerIndex,
        quality: data.quality,
        keyVersion,
        encryptedAt: new Date(),
        enrolledAt: new Date(),
        status: 'ACTIVE',
      },
      // IMPORTANT: select only safe fields — never return the template
      select: {
        id: true,
        userId: true,
        learnerId: true,
        type: true,
        fingerIndex: true,
        quality: true,
        keyVersion: true,
        enrolledAt: true,
        status: true,
        createdAt: true,
      },
    });

    return credential;
  }

  // ── Attendance Logging (Webhook) ─────────────────────────────────────────

  /**
   * Process an inbound attendance event from a biometric device.
   * Validates device token, writes raw log, dispatches to domain handler.
   */
  async processAttendanceLog(data: ProcessAttendanceLogInput) {
    // 1. Validate device by deviceId + token
    const device = await prisma.biometricDevice.findUnique({
      where: { deviceId: data.deviceId },
    });

    const submittedHash = hashDeviceToken(data.deviceToken);
    const validHashedToken = Boolean(device?.tokenHash && secretsMatch(device.tokenHash, submittedHash));
    const validLegacyToken = Boolean(device?.token && secretsMatch(device.token, data.deviceToken));

    if (!device || device.status === 'DISABLED' || (!validHashedToken && !validLegacyToken)) {
      throw new Error('Invalid device or token');
    }

    // Opportunistically remove legacy plaintext tokens after successful auth.
    if (validLegacyToken) {
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data: { token: null, tokenHash: submittedHash },
      });
    }

    // 2. Update device heartbeat
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSeen: new Date(),
        status: 'ONLINE',
        installationStatus: device.installationStatus === 'VERIFIED' ? 'VERIFIED' : 'CONFIGURING',
      },
    });

    // 3. Write raw log — always, regardless of what happens next
    const log = await prisma.biometricLog.create({
      data: {
        deviceId: device.id,
        schoolId: device.schoolId,
        personId: data.personId,
        personType: data.personType,
        timestamp: data.timestamp,
        direction: data.direction,
        status: 'PENDING',
      },
    });

    // 4. Dispatch to domain handler
    try {
      if (data.personType === 'LEARNER') {
        await handleBiometricLearnerScan({
          admissionNumber: data.personId,
          direction:       data.direction,
          timestamp:       data.timestamp,
          deviceId:        device.id,
          schoolId:        device.schoolId,
        });
      } else {
        await this.handleStaffAttendance(data);
      }

      await prisma.biometricLog.update({
        where: { id: log.id },
        data: { status: 'PROCESSED' },
      });

      // Emit GATE_ENTRY / GATE_EXIT presence event (fire-and-forget)
      if (device.schoolId) {
        const personId = data.personType === 'LEARNER'
          ? (await prisma.learner.findFirst({ where: { admissionNumber: data.personId }, select: { id: true } }))?.id
          : (await prisma.user.findFirst({ where: { staffId: data.personId }, select: { id: true } }))?.id;

        if (personId) {
          presenceService.emit({
            schoolId:      device.schoolId,
            personId,
            personType:    data.personType,
            eventType:     data.direction === 'IN' ? 'GATE_ENTRY' : 'GATE_EXIT',
            context:       'GATE',
            timestamp:     data.timestamp,
            deviceId:      device.id,
            direction:     data.direction,
            status:        'CONFIRMED',
            sourceModule:  'BIOMETRIC',
            sourceRecordId: log.id,
            metadata:      { deviceName: device.name, deviceType: device.type },
          }).catch(() => {/* failure recorded internally */});

          // Notify parent on learner gate entry/exit (fire-and-forget)
          if (data.personType === 'LEARNER') {
            attendanceNotificationService.notify({
              learnerId: personId,
              schoolId:  device.schoolId,
              type:      data.direction === 'IN' ? 'GATE_ENTRY' : 'GATE_EXIT',
              timestamp: data.timestamp,
            }).catch(() => {/* notification failure never blocks scan */});
          }
        }
      }
    } catch (error: any) {
      await prisma.biometricLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });
      logger.error('[BiometricService] processAttendanceLog dispatch failed', {
        logId: log.id,
        personId: data.personId,
        personType: data.personType,
        error: error.message,
      });
      throw error;
    }

    return log;
  }

  // ── Private domain handlers ──────────────────────────────────────────────

  private async handleStaffAttendance(data: ProcessAttendanceLogInput) {
    const user = await prisma.user.findFirst({
      where: { staffId: data.personId },
      select: { id: true },
    });

    if (!user) {
      throw new Error(`Staff not found: staffId=${data.personId}`);
    }

    const today = new Date(
      Date.UTC(
        data.timestamp.getUTCFullYear(),
        data.timestamp.getUTCMonth(),
        data.timestamp.getUTCDate(),
      )
    );

    const existing = await prisma.staffAttendanceLog.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    if (data.direction === 'IN') {
      if (!existing) {
        return prisma.staffAttendanceLog.create({
          data: {
            userId: user.id,
            date: today,
            clockInAt: data.timestamp,
            source: 'BIOMETRIC',
            metadata: { deviceId: data.deviceId },
          },
        });
      }
    } else if (data.direction === 'OUT') {
      if (existing && !existing.clockOutAt) {
        return prisma.staffAttendanceLog.update({
          where: { id: existing.id },
          data: { clockOutAt: data.timestamp },
        });
      }
    }
  }

  // ── Log queries ──────────────────────────────────────────────────────────

  async getLogs(params: {
    startDate?: Date;
    endDate?: Date;
    deviceId?: string;
    status?: string;
    schoolId: string;
  }) {
    return prisma.biometricLog.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.deviceId && { deviceId: params.deviceId }),
        ...(params.status && { status: params.status }),
        ...(params.startDate || params.endDate
          ? {
              timestamp: {
                ...(params.startDate && { gte: params.startDate }),
                ...(params.endDate && { lte: params.endDate }),
              },
            }
          : {}),
      },
      include: { device: { select: SAFE_DEVICE_SELECT } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async retryLog(logId: string, schoolId: string) {
    const log = await prisma.biometricLog.findFirst({
      where: { id: logId, schoolId },
      include: { device: { select: SAFE_DEVICE_SELECT } },
    });
    if (!log) throw new ApiError(404, 'Biometric log not found');
    if (!['FAILED', 'PENDING'].includes(log.status)) {
      throw new ApiError(409, `A ${log.status} log cannot be retried`);
    }

    const retryCount = log.retryCount + 1;
    try {
      if (log.personType === 'LEARNER') {
        await handleBiometricLearnerScan({
          admissionNumber: log.personId,
          direction: log.direction as 'IN' | 'OUT',
          timestamp: log.timestamp,
          deviceId: log.deviceId,
          schoolId: log.schoolId,
        });
      } else {
        await this.handleStaffAttendance({
          deviceId: log.deviceId,
          deviceToken: '',
          personId: log.personId,
          personType: 'STAFF',
          timestamp: log.timestamp,
          direction: log.direction as 'IN' | 'OUT',
        });
      }

      return prisma.biometricLog.update({
        where: { id: log.id },
        data: { status: 'PROCESSED', errorMessage: null, retryCount },
        include: { device: { select: SAFE_DEVICE_SELECT } },
      });
    } catch (error: any) {
      await prisma.biometricLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: error.message, retryCount },
      });
      throw new ApiError(422, error.message || 'Biometric log retry failed');
    }
  }
}
