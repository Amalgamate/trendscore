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
} from '../domains/biometrics/biometric.encryption';
import { handleBiometricLearnerScan } from '../domains/biometrics/biometric-attendance.service';
import logger from '../utils/logger';
import { presenceService } from '../domains/presence/presence.service';
import { attendanceNotificationService } from './attendance-notification.service';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
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
  provider?: string;
  consentRecordedAt?: Date;
  consentRecordedById?: string;
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
const VALID_MODALITIES = new Set(['QR', 'NFC', 'CARD', 'FACE', 'FINGERPRINT', 'MANUAL', 'UNKNOWN']);
const ACTIVATION_TTL_MS = 10 * 60 * 1000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

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

function hashActivationCode(deviceId: string, code: string): string {
  return createHash('sha256').update(`${deviceId}:${code}`, 'utf8').digest('hex');
}

function secretsMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export interface ProcessAttendanceLogInput {
  deviceToken: string;
  deviceId: string;
  eventId?: string;
  /** admissionNumber (learner) or staffId (staff) */
  personId: string;
  personType: 'LEARNER' | 'STAFF';
  timestamp: Date;
  direction: 'IN' | 'OUT';
  modality?: string;
  matchConfidence?: number;
  livenessStatus?: string;
  livenessConfidence?: number;
  offlineCaptured?: boolean;
  /** Internal-only proof that TrendSCORE completed provider matching. Never accept from request bodies. */
  providerVerified?: boolean;
}

export interface TerminalAttendanceOutcome {
  action: string;
  message: string;
  person: {
    id: string;
    reference: string;
    name: string;
    personType: 'LEARNER' | 'STAFF';
    grade?: string;
  };
  attendance: {
    id: string | null;
    status: string | null;
  };
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

  async createTerminalActivation(id: string, schoolId: string, createdById?: string) {
    const device = await prisma.biometricDevice.findFirst({
      where: { id, schoolId },
      select: { id: true, deviceId: true, name: true, status: true },
    });
    if (!device) throw new ApiError(404, 'Device not found');
    if (device.status === 'DISABLED') {
      throw new ApiError(409, 'A decommissioned device cannot be activated');
    }

    const now = new Date();
    await prisma.biometricDeviceActivation.updateMany({
      where: { deviceId: device.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    const activationCode = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const expiresAt = new Date(now.getTime() + ACTIVATION_TTL_MS);
    await prisma.biometricDeviceActivation.create({
      data: {
        deviceId: device.id,
        codeHash: hashActivationCode(device.deviceId, activationCode),
        expiresAt,
        createdById: createdById ?? null,
      },
    });

    return {
      deviceId: device.deviceId,
      deviceName: device.name,
      activationCode,
      expiresAt,
    };
  }

  async activateTerminal(deviceIdInput: string, activationCodeInput: string) {
    const deviceId = deviceIdInput?.trim();
    const activationCode = activationCodeInput?.replace(/\s/g, '');
    if (!deviceId || !/^\d{8}$/.test(activationCode || '')) {
      throw new ApiError(400, 'A valid device ID and 8-digit activation code are required');
    }

    const activation = await prisma.biometricDeviceActivation.findUnique({
      where: { codeHash: hashActivationCode(deviceId, activationCode) },
      include: {
        device: {
          select: {
            id: true,
            deviceId: true,
            name: true,
            location: true,
            status: true,
            school: { select: { name: true } },
          },
        },
      },
    });
    if (!activation || activation.device.deviceId !== deviceId) {
      throw new ApiError(401, 'Invalid or expired terminal activation code');
    }
    if (activation.usedAt || activation.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(401, 'Invalid or expired terminal activation code');
    }
    if (activation.device.status === 'DISABLED') {
      throw new ApiError(409, 'This terminal has been decommissioned');
    }

    const deviceToken = randomBytes(32).toString('hex');
    const claimedAt = new Date();
    const activated = await prisma.$transaction(async (tx) => {
      const claim = await tx.biometricDeviceActivation.updateMany({
        where: { id: activation.id, usedAt: null, expiresAt: { gt: claimedAt } },
        data: { usedAt: claimedAt },
      });
      if (claim.count !== 1) throw new ApiError(409, 'Activation code has already been used');

      return tx.biometricDevice.update({
        where: { id: activation.device.id },
        data: {
          token: null,
          tokenHash: hashDeviceToken(deviceToken),
          status: 'OFFLINE',
          installationStatus: 'CONFIGURING',
        },
        select: SAFE_DEVICE_SELECT,
      });
    });

    return {
      device: activated,
      schoolName: activation.device.school?.name || 'TrendSCORE School',
      deviceToken,
    };
  }

  async authenticateTerminal(deviceIdInput: string, deviceToken: string) {
    const deviceId = deviceIdInput?.trim();
    if (!deviceId || !deviceToken) throw new ApiError(401, 'Terminal bearer token is required');

    const device = await prisma.biometricDevice.findUnique({ where: { deviceId } });
    const submittedHash = hashDeviceToken(deviceToken);
    const validHashedToken = Boolean(device?.tokenHash && secretsMatch(device.tokenHash, submittedHash));
    const validLegacyToken = Boolean(device?.token && secretsMatch(device.token, deviceToken));

    if (!device || device.status === 'DISABLED' || (!validHashedToken && !validLegacyToken)) {
      throw new ApiError(401, 'Invalid device or token');
    }

    if (validLegacyToken) {
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data: { token: null, tokenHash: submittedHash },
      });
    }

    return device;
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
        provider: data.provider,
        consentRecordedAt: data.consentRecordedAt,
        consentRecordedById: data.consentRecordedById,
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
        provider: true,
        consentRecordedAt: true,
        consentRecordedById: true,
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
    const device = await this.authenticateTerminal(data.deviceId, data.deviceToken);

    const modality = String(data.modality || 'UNKNOWN').toUpperCase();
    if (!VALID_MODALITIES.has(modality)) throw new ApiError(400, 'Unsupported attendance modality');
    if (device.type === 'PHONE' && ['FACE', 'FINGERPRINT'].includes(modality) && !data.providerVerified) {
      throw new ApiError(403, 'Phone biometric events must complete the verified face session endpoint');
    }

    if (data.eventId) {
      const existingEvent = await prisma.biometricLog.findUnique({
        where: { deviceId_eventId: { deviceId: device.id, eventId: data.eventId } },
      });
      if (existingEvent) {
        const sameEvent = existingEvent.personId === data.personId &&
          existingEvent.personType === data.personType &&
          existingEvent.direction === data.direction &&
          existingEvent.timestamp.getTime() === data.timestamp.getTime();
        if (!sameEvent) throw new ApiError(409, 'eventId was already used for a different attendance event');
        return {
          log: existingEvent,
          outcome: existingEvent.resultPayload as unknown as TerminalAttendanceOutcome | null,
          duplicate: true,
        };
      }
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
    let log;
    try {
      log = await prisma.biometricLog.create({
        data: {
          deviceId: device.id,
          eventId: data.eventId || null,
          schoolId: device.schoolId,
          personId: data.personId,
          personType: data.personType,
          timestamp: data.timestamp,
          direction: data.direction,
          modality,
          matchConfidence: data.matchConfidence,
          livenessStatus: data.livenessStatus?.toUpperCase(),
          livenessConfidence: data.livenessConfidence,
          offlineCaptured: Boolean(data.offlineCaptured),
          status: 'PENDING',
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002' && data.eventId) {
        const racedEvent = await prisma.biometricLog.findUnique({
          where: { deviceId_eventId: { deviceId: device.id, eventId: data.eventId } },
        });
        if (racedEvent) {
          const sameEvent = racedEvent.personId === data.personId &&
            racedEvent.personType === data.personType &&
            racedEvent.direction === data.direction &&
            racedEvent.timestamp.getTime() === data.timestamp.getTime();
          if (!sameEvent) throw new ApiError(409, 'eventId was already used for a different attendance event');
          return {
            log: racedEvent,
            outcome: racedEvent.resultPayload as unknown as TerminalAttendanceOutcome | null,
            duplicate: true,
          };
        }
      }
      throw error;
    }

    // 4. Dispatch to domain handler
    try {
      let outcome: TerminalAttendanceOutcome;
      if (data.personType === 'LEARNER') {
        const learnerResult = await handleBiometricLearnerScan({
          admissionNumber: data.personId,
          direction:       data.direction,
          timestamp:       data.timestamp,
          deviceId:        device.id,
          schoolId:        device.schoolId,
        });
        outcome = {
          action: learnerResult.action,
          message: learnerResult.message,
          person: {
            id: learnerResult.learnerId,
            reference: learnerResult.admissionNumber,
            name: learnerResult.learnerName,
            personType: 'LEARNER',
            grade: learnerResult.grade,
          },
          attendance: { id: learnerResult.attendanceId, status: learnerResult.status },
        };
      } else {
        outcome = await this.handleStaffAttendance(data);
      }

      const processedLog = await prisma.biometricLog.update({
        where: { id: log.id },
        data: { status: 'PROCESSED', resultPayload: outcome as any },
      });

      // Emit GATE_ENTRY / GATE_EXIT presence event (fire-and-forget)
      if (device.schoolId) {
        const personId = outcome.person.id;

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
      return { log: processedLog, outcome, duplicate: false };
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
  }

  // ── Private domain handlers ──────────────────────────────────────────────

  private async handleStaffAttendance(data: ProcessAttendanceLogInput): Promise<TerminalAttendanceOutcome> {
    const user = await prisma.user.findFirst({
      where: { staffId: data.personId },
      select: { id: true, staffId: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error(`Staff not found: staffId=${data.personId}`);
    }

    const eatDate = new Date(data.timestamp.getTime() + EAT_OFFSET_MS);
    const today = new Date(
      Date.UTC(
        eatDate.getUTCFullYear(),
        eatDate.getUTCMonth(),
        eatDate.getUTCDate(),
      )
    );

    const existing = await prisma.staffAttendanceLog.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });

    let attendance = existing;
    let action = 'skipped_existing';
    let message = 'Staff attendance was already recorded';
    if (data.direction === 'IN') {
      if (!existing) {
        attendance = await prisma.staffAttendanceLog.create({
          data: {
            userId: user.id,
            date: today,
            clockInAt: data.timestamp,
            source: 'BIOMETRIC',
            metadata: { deviceId: data.deviceId },
          },
        });
        action = 'created';
        message = 'Staff clock-in recorded';
      }
    } else if (data.direction === 'OUT') {
      if (existing && !existing.clockOutAt) {
        attendance = await prisma.staffAttendanceLog.update({
          where: { id: existing.id },
          data: { clockOutAt: data.timestamp },
        });
        action = 'updated';
        message = 'Staff clock-out recorded';
      } else if (!existing) {
        action = 'skipped_missing_clock_in';
        message = 'No staff clock-in exists for this date';
      }
    }

    return {
      action,
      message,
      person: {
        id: user.id,
        reference: user.staffId || data.personId,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        personType: 'STAFF',
      },
      attendance: { id: attendance?.id || null, status: attendance?.status || null },
    };
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
