/**
 * user.routes.ts
 *
 * Guard contract:
 *   - authenticate — applied once in index.ts; NOT repeated here
 *   - requireRole / requirePermission — applied per-route
 *
 * authorize() from auth.middleware has been removed from this file.
 * All role checks use requireRole() which emits the RFC-compliant payload
 * (code, requestId, userRoles, allowedRoles).
 */

import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requirePermission, requireRole, auditLog } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { idSchema, createUserSchema, updateUserSchema } from '../utils/validation.util';

const router = Router();
const userController = new UserController();

// authenticate is applied in index.ts — do NOT add it here

/**
 * @route   GET /api/users
 * @access  VIEW_ALL_USERS permission (SUPER_ADMIN, ADMIN, HEAD_TEACHER, etc.)
 */
router.get(
  '/',
  requirePermission('VIEW_ALL_USERS'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(userController.getAllUsers)
);

/**
 * @route   GET /api/users/stats
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.get(
  '/stats',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(userController.getUserStats)
);

router.get(
  '/verification-settings',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(userController.getVerificationSettings)
);

router.put(
  '/verification-settings',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('UPDATE_VERIFICATION_SETTINGS'),
  asyncHandler(userController.updateSchoolVerificationSettings)
);

router.put(
  '/me/profile',
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 30 }),
  auditLog('UPDATE_OWN_PROFILE'),
  asyncHandler(userController.updateOwnProfile)
);

/**
 * @route   GET /api/users/role/:role
 * @access  VIEW_ALL_USERS permission
 */
router.get(
  '/role/:role',
  requirePermission('VIEW_ALL_USERS'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(userController.getUsersByRole)
);

/**
 * @route   GET /api/users/:id
 * @access  SUPER_ADMIN, ADMIN, or self (controller enforces self-check)
 */
router.get(
  '/:id',
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(userController.getUserById)
);

/**
 * @route   POST /api/users
 * @access  EDIT_USER permission
 */
router.post(
  '/',
  requirePermission('EDIT_USER'),
  validate(createUserSchema),
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 }),
  auditLog('CREATE_USER'),
  asyncHandler(userController.createUser)
);

/**
 * @route   PUT /api/users/:id
 * @access  EDIT_USER permission
 */
router.put(
  '/:id',
  requirePermission('EDIT_USER'),
  validate(updateUserSchema),
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 30 }),
  auditLog('UPDATE_USER'),
  asyncHandler(userController.updateUser)
);

router.put(
  '/:id/verification-required',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('UPDATE_USER_VERIFICATION_REQUIRED'),
  asyncHandler(userController.updateUserVerificationRequirement)
);

/**
 * @route   POST /api/users/:id/archive
 * @access  TEACHER (parents only), ADMIN, SUPER_ADMIN, HEAD_TEACHER
 */
router.post(
  '/:id/archive',
  requireRole(['TEACHER', 'ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER']),
  auditLog('ARCHIVE_USER'),
  asyncHandler(userController.archiveUser)
);

/**
 * @route   POST /api/users/:id/unarchive
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/:id/unarchive',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('UNARCHIVE_USER'),
  asyncHandler(userController.unarchiveUser)
);

/**
 * @route   DELETE /api/users/:id
 * @access  DELETE_USER permission
 */
router.delete(
  '/:id',
  requirePermission('DELETE_USER'),
  auditLog('DELETE_USER'),
  asyncHandler(userController.deleteUser)
);

/**
 * @route   POST /api/users/:id/photo
 * @access  SUPER_ADMIN, ADMIN, or self (controller enforces self-check)
 */
router.post(
  '/:id/photo',
  auditLog('UPLOAD_USER_PHOTO'),
  asyncHandler(userController.uploadProfilePicture)
);

/**
 * @route   POST /api/users/:id/reset-password
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/:id/reset-password',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('RESET_PASSWORD'),
  asyncHandler(userController.resetPassword)
);

/**
 * @route   POST /api/users/:id/credentials
 * @access  ADMIN, SUPER_ADMIN, TEACHER, HEAD_TEACHER
 */
router.post(
  '/:id/credentials',
  requireRole(['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'HEAD_TEACHER']),
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }),
  auditLog('SEND_CREDENTIALS'),
  asyncHandler(userController.sendCredentials)
);

export default router;
