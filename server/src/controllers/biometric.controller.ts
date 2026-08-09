/**
 * Biometric Controller
 *
 * SECURITY NOTE: This controller never returns biometric template data.
 * All credential responses include metadata only (id, type, enrolledAt, quality, status).
 */

import { Request, Response } from 'express';
import { BiometricService } from '../services/biometric.service';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';

const biometricService = new BiometricService();

/** Minimum quality score accepted for fingerprint/face enrollment */
const MIN_QUALITY_SCORE = 60;

/** School context is populated before routes by schoolContextMiddleware. */
function resolveSchoolId(req: AuthRequest): string {
  const schoolId = req.school?.id;
  if (!schoolId) throw new ApiError(400, 'School context is required');
  return schoolId;
}

export class BiometricController {

  // ── Device Management ──────────────────────────────────────────────────────

  /**
   * POST /api/biometric/devices
   * Register or update a biometric device.
   */
  async registerDevice(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const { deviceId, name, type, location, ipAddress, serialNumber, firmwareVersion, syncMode } = req.body;

      const result = await biometricService.registerDevice({
        deviceId,
        name,
        type,
        location,
        ipAddress,
        serialNumber,
        firmwareVersion,
        syncMode,
        schoolId,
        installedById: req.user?.userId,
      });
      res.status(result.created ? 201 : 200).json({
        success: true,
        message: result.created
          ? 'Device registered. Store the device token now; it will not be shown again.'
          : 'Device metadata updated. Rotate the token if the original is unavailable.',
        data: {
          ...result.device,
          ...(result.deviceToken && { deviceToken: result.deviceToken }),
        },
      });
    } catch (error: any) {
      const status = error.statusCode || 400;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/biometric/devices
   * List devices scoped to the current school.
   */
  async getDevices(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const devices  = await biometricService.getDevices(schoolId);
      res.json({ success: true, data: devices, count: devices.length });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/biometric/devices/:id/rotate-token
   * Rotate the shared secret token for a biometric device.
   * Returns the new plaintext token ONCE — admin must reconfigure the device.
   */
  async rotateDeviceToken(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const result = await biometricService.rotateDeviceToken(req.params.id, schoolId);

      res.json({
        success: true,
        message: 'Device token rotated. Store this token securely — it will not be shown again.',
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /** POST /api/biometric/devices/:id/activation — issue a short-lived phone setup code. */
  async createTerminalActivation(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const activation = await biometricService.createTerminalActivation(
        req.params.id,
        schoolId,
        req.user?.userId,
      );
      res.status(201).json({
        success: true,
        message: 'Activation code created. It expires in 10 minutes and can be used once.',
        data: activation,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /**
   * PATCH /api/biometric/devices/:id
   * Update device metadata (name, location, syncMode, etc.)
   */
  async updateDevice(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const updated = await biometricService.updateDevice(req.params.id, schoolId, req.body);

      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /** DELETE /api/biometric/devices/:id — decommission without deleting audit logs. */
  async decommissionDevice(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const device = await biometricService.decommissionDevice(req.params.id, schoolId);
      res.json({ success: true, message: 'Device decommissioned', data: device });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /** POST /api/biometric/devices/:id/test — verify a recent authenticated heartbeat. */
  async testDeviceConnection(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const result = await biometricService.testDeviceConnection(req.params.id, schoolId, req.user?.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/biometric/configuration — safe platform readiness metadata only. */
  async getConfiguration(req: AuthRequest, res: Response) {
    try {
      resolveSchoolId(req);
      const key = process.env.BIOMETRIC_ENCRYPTION_KEY || '';
      res.json({
        success: true,
        data: {
          encryptionConfigured: /^[0-9a-fA-F]{64}$/.test(key),
          keyVersion: Number.parseInt(process.env.BIOMETRIC_KEY_VERSION || '1', 10),
          guideVersion: '2026.08',
          webhookPath: '/api/biometric/log',
          phoneTerminalPath: '/#/terminal/biometric',
          terminalEventPath: '/api/biometric/terminal/events',
          terminalEventContractVersion: 1,
          faceRecognitionConfigured: false,
          supportedModes: ['PUSH', 'PULL', 'BOTH'],
        },
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Enrollment ─────────────────────────────────────────────────────────────

  /**
   * POST /api/biometric/enroll
   * Enroll a biometric credential. Template is encrypted before storage.
   * Enforces minimum quality score. Checks for duplicate enrollment.
   * The response NEVER includes the template.
   */
  async enrollCredential(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const { userId, learnerId, type, template, fingerIndex, quality } = req.body;

      if (!template) return res.status(400).json({ success: false, message: 'template is required' });
      if (!type)     return res.status(400).json({ success: false, message: 'type is required' });
      if (!userId && !learnerId) {
        return res.status(400).json({ success: false, message: 'userId or learnerId is required' });
      }

      // Quality gate — enforce minimum threshold for fingerprint/face
      const qualityScore = quality ? parseInt(quality, 10) : null;
      if (qualityScore !== null && qualityScore < MIN_QUALITY_SCORE) {
        return res.status(422).json({
          success: false,
          message: `Template quality score ${qualityScore} is below minimum threshold (${MIN_QUALITY_SCORE}). Re-capture required.`,
          data: { qualityScore, minimumRequired: MIN_QUALITY_SCORE },
        });
      }

      // Duplicate check — same person + same finger index + same type + ACTIVE
      const fingerIdx = fingerIndex ? parseInt(fingerIndex, 10) : null;
      const duplicateWhere: any = {
        schoolId,
        status: 'ACTIVE',
        type,
        ...(userId    && { userId }),
        ...(learnerId && { learnerId }),
        ...(fingerIdx !== null && { fingerIndex: fingerIdx }),
      };

      const existing = await prisma.biometricCredential.findFirst({ where: duplicateWhere });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `An active ${type} credential already exists for this person` +
            (fingerIdx !== null ? ` (finger ${fingerIdx})` : '') +
            `. Revoke the existing credential before re-enrolling.`,
        });
      }

      const templateBuffer = Buffer.isBuffer(template)
        ? template
        : Buffer.from(template, 'base64');

      const credential = await biometricService.enrollCredential({
        schoolId,
        userId, learnerId, type, template: templateBuffer,
        fingerIndex: fingerIdx ?? undefined,
        quality:     qualityScore ?? undefined,
      });

      res.status(201).json({
        success: true,
        message: 'Biometric credential enrolled',
        data: credential,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/biometric/credentials
   * List credentials for a person (no templates returned).
   */
  async getCredentials(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const { userId, learnerId } = req.query;
      if (!userId && !learnerId) {
        return res.status(400).json({ success: false, message: 'userId or learnerId is required' });
      }

      const credentials = await prisma.biometricCredential.findMany({
        where: {
          schoolId,
          ...(userId    && { userId:    userId as string }),
          ...(learnerId && { learnerId: learnerId as string }),
          status: 'ACTIVE',
        },
        select: {
          id: true, type: true, fingerIndex: true, quality: true,
          keyVersion: true, enrolledAt: true, status: true, createdAt: true,
          // template is NEVER selected
        },
        orderBy: { enrolledAt: 'desc' },
      });

      res.json({ success: true, data: credentials, count: credentials.length });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/biometric/credentials/:id
   * Revoke a credential (sets status=REVOKED).
   */
  async revokeCredential(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const { id } = req.params;
      const credential = await prisma.biometricCredential.findFirst({ where: { id, schoolId } });
      if (!credential) throw new ApiError(404, 'Credential not found');

      await prisma.biometricCredential.update({
        where: { id },
        data:  { status: 'REVOKED' },
      });

      res.json({ success: true, message: 'Credential revoked' });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/biometric/enroll/:personType/:personId */
  async getEnrollmentStatus(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const personType = String(req.params.personType || '').toUpperCase();
      const personId = req.params.personId;
      if (!['LEARNER', 'STAFF'].includes(personType)) {
        return res.status(400).json({ success: false, message: 'personType must be learner or staff' });
      }

      const credentials = await prisma.biometricCredential.findMany({
        where: {
          schoolId,
          status: 'ACTIVE',
          ...(personType === 'LEARNER' ? { learnerId: personId } : { userId: personId }),
        },
        select: { id: true, type: true, fingerIndex: true, quality: true, enrolledAt: true, status: true },
        orderBy: { enrolledAt: 'desc' },
      });
      res.json({ success: true, data: { isEnrolled: credentials.length > 0, credentials } });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }

  // ── Attendance Webhook ─────────────────────────────────────────────────────

  /** POST /api/biometric/terminal/activate — exchange a one-time setup code for a terminal token. */
  async activateTerminal(req: Request, res: Response) {
    try {
      const result = await biometricService.activateTerminal(req.body.deviceId, req.body.activationCode);
      res.json({
        success: true,
        message: 'Phone terminal activated. The device token will not be returned again.',
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({ success: false, message: error.message });
    }
  }

  /** POST /api/biometric/terminal/events — replay-safe phone/offline event contract. */
  async recordTerminalEvent(req: Request, res: Response) {
    try {
      const bearerToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
      if (!bearerToken) throw new ApiError(401, 'Terminal bearer token is required');

      const eventId = String(req.body.eventId || '').trim();
      const deviceId = String(req.body.deviceId || '').trim();
      const personId = String(req.body.personId || '').trim();
      const personType = String(req.body.personType || '').toUpperCase();
      const direction = String(req.body.direction || 'IN').toUpperCase();
      const modality = String(req.body.modality || 'QR').toUpperCase();
      const timestamp = new Date(req.body.timestamp);

      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(eventId)) {
        throw new ApiError(400, 'eventId must be an 8-128 character terminal-generated identifier');
      }
      if (!deviceId || !personId || deviceId.length > 128 || personId.length > 128) {
        throw new ApiError(400, 'A valid deviceId and personId are required');
      }
      if (!['LEARNER', 'STAFF'].includes(personType)) {
        throw new ApiError(400, 'personType must be LEARNER or STAFF');
      }
      if (!['IN', 'OUT'].includes(direction)) throw new ApiError(400, 'direction must be IN or OUT');
      if (!['QR', 'NFC', 'CARD', 'FACE', 'FINGERPRINT', 'MANUAL'].includes(modality)) {
        throw new ApiError(400, 'Unsupported terminal modality');
      }
      if (Number.isNaN(timestamp.getTime())) throw new ApiError(400, 'timestamp must be a valid ISO 8601 value');
      const ageMs = Date.now() - timestamp.getTime();
      if (ageMs > 30 * 24 * 60 * 60 * 1000 || ageMs < -5 * 60 * 1000) {
        throw new ApiError(400, 'timestamp must be within the last 30 days and no more than 5 minutes in the future');
      }

      const matchConfidence = req.body.matchConfidence === undefined
        ? undefined
        : Number(req.body.matchConfidence);
      const livenessConfidence = req.body.livenessConfidence === undefined
        ? undefined
        : Number(req.body.livenessConfidence);
      for (const [label, value] of [['matchConfidence', matchConfidence], ['livenessConfidence', livenessConfidence]] as const) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
          throw new ApiError(400, `${label} must be between 0 and 1`);
        }
      }

      const result = await biometricService.processAttendanceLog({
        deviceId,
        deviceToken: bearerToken,
        eventId,
        personId,
        personType: personType as 'LEARNER' | 'STAFF',
        timestamp,
        direction: direction as 'IN' | 'OUT',
        modality,
        matchConfidence,
        livenessStatus: req.body.livenessStatus,
        livenessConfidence,
        offlineCaptured: Boolean(req.body.offlineCaptured),
      });

      res.status(result.duplicate ? 200 : 201).json({
        success: true,
        message: result.duplicate ? 'Attendance event already accepted' : 'Attendance event accepted',
        data: {
          eventId,
          logId: result.log.id,
          processingStatus: result.log.status,
          duplicate: result.duplicate,
          outcome: result.outcome,
        },
      });
    } catch (error: any) {
      const status = error.statusCode || (error.message?.includes('Invalid device') ? 401 : 400);
      res.status(status).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/biometric/log  (public — bearer token, legacy body token supported)
   * Webhook called by hardware devices when a person scans.
   */
  async logAttendance(req: Request, res: Response) {
    try {
      const { deviceId, personId, timestamp } = req.body;
      const bearerToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
      const deviceToken = bearerToken || req.body.deviceToken;
      const personType = String(req.body.personType || '').toUpperCase();
      const direction = String(req.body.direction || 'IN').toUpperCase();

      if (!deviceId || !deviceToken || !personId || !personType || !timestamp) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: deviceId, device token, personId, personType, timestamp',
        });
      }

      const validTypes = ['LEARNER', 'STAFF'];
      if (!validTypes.includes(personType)) {
        return res.status(400).json({
          success: false,
          message: `personType must be one of: ${validTypes.join(', ')}`,
        });
      }
      if (!['IN', 'OUT'].includes(direction)) {
        return res.status(400).json({ success: false, message: 'direction must be IN or OUT' });
      }

      const scanTimestamp = new Date(timestamp);
      if (Number.isNaN(scanTimestamp.getTime())) {
        return res.status(400).json({ success: false, message: 'timestamp must be a valid ISO 8601 value' });
      }

      const result = await biometricService.processAttendanceLog({
        deviceId,
        deviceToken,
        personId,
        personType: personType as 'LEARNER' | 'STAFF',
        timestamp: scanTimestamp,
        direction: direction as 'IN' | 'OUT',
      });

      res.status(200).json({
        success: true,
        message: 'Attendance log processed',
        data: {
          id: result.log.id,
          status: result.log.status,
          duplicate: result.duplicate,
          outcome: result.outcome,
        },
      });
    } catch (error: any) {
      const status = error.message?.includes('Invalid') ? 401 : 400;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  // ── Log Queries ────────────────────────────────────────────────────────────

  /**
   * GET /api/biometric/logs
   * View recent biometric scan logs, scoped to school.
   */
  async getLogs(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, deviceId, status } = req.query;
      const schoolId = resolveSchoolId(req);

      const logs = await biometricService.getLogs({
        schoolId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        deviceId: deviceId as string | undefined,
        status: status as string | undefined,
      });

      res.json({ success: true, data: logs, count: logs.length });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** POST /api/biometric/logs/:id/process — retry a failed school-owned record. */
  async retryLog(req: AuthRequest, res: Response) {
    try {
      const schoolId = resolveSchoolId(req);
      const log = await biometricService.retryLog(req.params.id, schoolId);
      res.json({ success: true, message: 'Biometric log reprocessed', data: log });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }
}

export const biometricController = new BiometricController();
