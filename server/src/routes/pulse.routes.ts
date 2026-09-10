import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/permissions.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { asyncHandler } from '../utils/async.util';
import { getTodayPulse } from '../controllers/pulse.controller';

const router = Router();

const PULSE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'] as const;

router.get(
    '/today',
    authenticate,
    requireRole([...PULSE_ROLES]),
    rateLimit({ windowMs: 60_000, maxRequests: 120 }),
    asyncHandler(getTodayPulse)
);

export default router;
