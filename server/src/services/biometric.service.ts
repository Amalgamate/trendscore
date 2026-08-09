/**
 * Biometric Service
 *
 * Handles device registration, credential enrollment (with AES-256-GCM encryption),
 * webhook attendance logging, and dispatching to domain attendance handlers.
 *
 * SECURITY RULES:
 *  - Biometric templates are encrypted before any DB write (encryptTemplate)
 *  - Decrypted templates never appear in logs or API responses
 *  - Device tokens are stored as-is (already UUIDs, not raw biometric data)
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrollCredentialInput {
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
  async registerDevice(data: {
    deviceId: string;
    name: string;
    type?: string;
    location?: string;
    ipAddress?: string;
    schoolId: string;
    serialNumber?: string;
    firmwareVersion?: string;
    syncMode?: string;
  }) {
    return prisma.biometricDevice.upsert({
      where: { deviceId: data.deviceId },
      update: {
        name: data.name,
        type: data.type || 'TERMINAL',
        location: data.location,
        ipAddress: data.ipAddress,
        schoolId: data.schoolId,
        serialNumber: data.serialNumber,
        firmwareVersion: data.firmwareVersion,
        syncMode: data.syncMode || 'PUSH',
        status: 'ONLINE',
        lastSeen: new Date(),
      },
      create: {
        deviceId: data.deviceId,
        name: data.name,
        type: data.type || 'TERMINAL',
        location: data.location,
        ipAddress: data.ipAddress,
        schoolId: data.schoolId,
        serialNumber: data.serialNumber,
        firmwareVersion: data.firmwareVersion,
        syncMode: data.syncMode || 'PUSH',
        status: 'ONLINE',
        lastSeen: new Date(),
      },
    });
  }

  async getDevices(schoolId?: string) {
    return prisma.biometricDevice.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
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
    const device = await prisma.biometricDevice.findFirst({
      where: {
        deviceId: data.deviceId,
        token: data.deviceToken,
      },
    });

    if (!device) {
      throw new Error('Invalid device or token');
    }

    // 2. Update device heartbeat
    await prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSeen: new Date(), status: 'ONLINE' },
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
    schoolId?: string;
  }) {
    return prisma.biometricLog.findMany({
      where: {
        ...(params.schoolId && { schoolId: params.schoolId }),
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
      include: { device: true },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
