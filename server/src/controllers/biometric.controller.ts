/**
 * Biometric Controller
 *
 * SECURITY NOTE: This controller never returns biometric template data.
 * All credential responses include metadata only (id, type, enrolledAt, quality, status).
 */

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { BiometricService } from '../services/biometric.service';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';
import prisma from '../config/database';

const biometricService = new BiometricService();

/** Minimum quality score accepted for fingerprint/face enrollment */
const MIN_QUALITY_SCORE = 60;

/** Resolve school from DB (req.user has no schoolId field) */
async function resolveSchoolId(): Promise<string> {
  const school = await prisma.school.findFirst({
    where: { archived: false, active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!school) throw new ApiError(500, 'No active school found');
  return school.id;
}

export class BiometricController {

  // ── Device Management ──────────────────────────────────────────────────────

  /**
   * POST /api/biometric/devices
   * Register or update a biometric device.
   */
  async registerDevice(req: AuthRequest, res: Response) {
    try {
      const schoolId = await resolveSchoolId();

      const device = await biometricService.registerDevice({
        ...req.body,
        schoolId,
      });
      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: device,
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
      const schoolId = await resolveSchoolId().catch(() => undefined);
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
      const { id } = req.params;
      const device = await prisma.biometricDevice.findUnique({ where: { id } });
      if (!device) throw new ApiError(404, 'Device not found');

      const newToken = randomBytes(32).toString('hex');
      await prisma.biometricDevice.update({
        where: { id },
        data:  { token: newToken, updatedAt: new Date() },
      });

      res.json({
        success: true,
        message: 'Device token rotated. Store this token securely — it will not be shown again.',
        data: { deviceId: device.deviceId, newToken },
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
      const { id } = req.params;
      const { name, location, type, ipAddress, syncMode, firmwareVersion, serialNumber } = req.body;

      const existing = await prisma.biometricDevice.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, 'Device not found');

      const updated = await prisma.biometricDevice.update({
        where: { id },
        data: {
          ...(name             && { name }),
          ...(location         !== undefined && { location }),
          ...(type             && { type }),
          ...(ipAddress        !== undefined && { ipAddress }),
          ...(syncMode         && { syncMode }),
          ...(firmwareVersion  !== undefined && { firmwareVersion }),
          ...(serialNumber     !== undefined && { serialNumber }),
        },
      });

      res.json({ success: true, data: updated });
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
      const { userId, learnerId } = req.query;
      if (!userId && !learnerId) {
        return res.status(400).json({ success: false, message: 'userId or learnerId is required' });
      }

      const credentials = await prisma.biometricCredential.findMany({
        where: {
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
      const { id } = req.params;
      const credential = await prisma.biometricCredential.findUnique({ where: { id } });
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

  // ── Attendance Webhook ─────────────────────────────────────────────────────

  /**
   * POST /api/biometric/log  (public — device token auth in body)
   * Webhook called by hardware devices when a person scans.
   */
  async logAttendance(req: Request, res: Response) {
    try {
      const { deviceId, deviceToken, personId, personType, timestamp, direction } = req.body;

      if (!deviceId || !deviceToken || !personId || !personType || !timestamp) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: deviceId, deviceToken, personId, personType, timestamp',
        });
      }

      const validTypes = ['LEARNER', 'STAFF'];
      if (!validTypes.includes(personType)) {
        return res.status(400).json({
          success: false,
          message: `personType must be one of: ${validTypes.join(', ')}`,
        });
      }

      const log = await biometricService.processAttendanceLog({
        deviceId,
        deviceToken,
        personId,
        personType: personType as 'LEARNER' | 'STAFF',
        timestamp: new Date(timestamp),
        direction: direction || 'IN',
      });

      res.status(200).json({
        success: true,
        message: 'Attendance log processed',
        data: { id: log.id, status: log.status },
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
      const schoolId = await resolveSchoolId().catch(() => undefined);

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
}

export const biometricController = new BiometricController();
