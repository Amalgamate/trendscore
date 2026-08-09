import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { biometricController } from '../controllers/biometric.controller';

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

/** Rotate device shared-secret token — returns new token once */
router.post(
  '/devices/:id/rotate-token',
  authenticate,
  requirePermission('MANAGE_BIOMETRIC_DEVICES'),
  asyncHandler(biometricController.rotateDeviceToken.bind(biometricController)),
);

// ── Enrollment ────────────────────────────────────────────────────────────────

router.post(
  '/enroll',
  authenticate,
  requirePermission('ENROLL_FINGERPRINTS'),
  asyncHandler(biometricController.enrollCredential.bind(biometricController)),
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

// ── Attendance Webhook (public — device token auth in body) ───────────────────

router.post('/log', biometricController.logAttendance.bind(biometricController));

// ── Log Queries ───────────────────────────────────────────────────────────────

router.get(
  '/logs',
  authenticate,
  requirePermission('VIEW_BIOMETRIC_LOGS'),
  asyncHandler(biometricController.getLogs.bind(biometricController)),
);

export default router;
