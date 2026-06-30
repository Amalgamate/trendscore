import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { requireCsrf } from '../middleware/csrf.middleware';
import { AdminController } from '../controllers/admin.controller';
import { asyncHandler } from '../utils/async.util';

const router = Router();
const admin = new AdminController();

// ─────────────────────────────────────────────────────────────────────────────
// Impersonation stop — authenticate only (any user holding an impersonation
// token may end their own session; no ADMIN role required)  (Requirement 5.1)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/impersonate/stop',
  authenticate,
  requireCsrf,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  asyncHandler(admin.stopImpersonation.bind(admin))
);

// ─────────────────────────────────────────────────────────────────────────────
// All remaining admin routes: authenticate + ADMIN / SUPER_ADMIN role guard
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);
router.use(requireRole(['SUPER_ADMIN', 'ADMIN']));

// System modules
router.get(
  '/modules',
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(admin.getSchoolModules.bind(admin))
);

// Communication configuration
router.get(
  '/communication',
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(admin.getSchoolCommunication.bind(admin))
);

router.put(
  '/communication',
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  asyncHandler(admin.updateSchoolCommunication.bind(admin))
);

// ─────────────────────────────────────────────────────────────────────────────
// Impersonation routes (Requirements 3.1, 3.2, 5.1, 5.2, 7.1–7.10)
// authenticate + requireRole(['SUPER_ADMIN','ADMIN']) already applied above
// ─────────────────────────────────────────────────────────────────────────────

// Search users available for impersonation
router.get(
  '/impersonate/search',
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  asyncHandler(admin.searchUsersForImpersonation.bind(admin))
);

// Start an impersonation session
router.post(
  '/impersonate/start',
  requireCsrf,
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  asyncHandler(admin.startImpersonation.bind(admin))
);

export default router;
