import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { biometricController } from '../controllers/biometric.controller';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

// ── Device Management ─────────────────────────────────────────────────────────

router.post(
  '/devices',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.registerDevice.bind(biometricController)),
);

router.get(
  '/devices',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.getDevices.bind(biometricController)),
);

router.patch(
  '/devices/:id',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.updateDevice.bind(biometricController)),
);

router.delete(
  '/devices/:id',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.decommissionDevice.bind(biometricController)),
);

/** Rotate device shared-secret token — returns new token once */
router.post(
  '/devices/:id/rotate-token',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.rotateDeviceToken.bind(biometricController)),
);

router.post(
  '/devices/:id/activation',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.createTerminalActivation.bind(biometricController)),
);

router.post(
  '/devices/:id/test',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.testDeviceConnection.bind(biometricController)),
);

router.get(
  '/configuration',
  authenticate,
  requirePermission('CONFIGURE_BIOMETRIC_API'),
  asyncHandler(biometricController.getConfiguration.bind(biometricController)),
);

// ── Enrollment ────────────────────────────────────────────────────────────────

router.post(
  '/face/enrollment/session',
  authenticate,
  requirePermission('ENROLL_FINGERPRINTS'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  asyncHandler(biometricController.createFaceEnrollmentSession.bind(biometricController)),
);

router.post(
  '/face/enrollment/session/:sessionId/complete',
  authenticate,
  requirePermission('ENROLL_FINGERPRINTS'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  asyncHandler(biometricController.completeFaceEnrollmentSession.bind(biometricController)),
);

router.post(
  '/enroll',
  authenticate,
  requirePermission('ENROLL_FINGERPRINTS'),
  asyncHandler(biometricController.enrollCredential.bind(biometricController)),
);

router.get(
  '/enroll/:personType/:personId',
  authenticate,
  requirePermission('ENROLL_FINGERPRINTS'),
  asyncHandler(biometricController.getEnrollmentStatus.bind(biometricController)),
);

router.get(
  '/credentials',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.getCredentials.bind(biometricController)),
);

router.delete(
  '/credentials/:id',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.revokeCredential.bind(biometricController)),
);

// ── Attendance Webhook (public — bearer token, legacy body token supported) ──

router.post(
  '/terminal/activate',
  rateLimit({ windowMs: 15 * 60_000, maxRequests: 10 }),
  biometricController.activateTerminal.bind(biometricController),
);

router.post(
  '/terminal/events',
  rateLimit({ windowMs: 60_000, maxRequests: 180 }),
  biometricController.recordTerminalEvent.bind(biometricController),
);

router.post(
  '/terminal/face/session',
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  biometricController.createTerminalFaceSession.bind(biometricController),
);

router.post(
  '/terminal/face/session/:sessionId/complete',
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  biometricController.completeTerminalFaceSession.bind(biometricController),
);

router.post('/log', biometricController.logAttendance.bind(biometricController));

// ── Log Queries ───────────────────────────────────────────────────────────────

router.get(
  '/logs',
  authenticate,
  requirePermission('VIEW_BIOMETRIC_LOGS'),
  asyncHandler(biometricController.getLogs.bind(biometricController)),
);

router.post(
  '/logs/:id/process',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.retryLog.bind(biometricController)),
);

export default router;
