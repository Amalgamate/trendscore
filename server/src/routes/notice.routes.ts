import { Router } from 'express';
import { z } from 'zod';
import { noticeController } from '../controllers/notice.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { requirePermission, requireAnyPermission, auditLog } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/async.util';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

const noticeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  category: z.string().max(100).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  targetAudience: z.string().max(100).optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional().nullable()
});

router.use(authenticate, requireSchoolContext);

router.get(
  '/',
  requirePermission('VIEW_INBOX'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(noticeController.getNotices.bind(noticeController))
);

router.get(
  '/:id',
  requirePermission('VIEW_INBOX'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(noticeController.getNoticeById.bind(noticeController))
);

router.post(
  '/',
  requireAnyPermission(['SEND_SCHOOL_NOTICES', 'PUBLISH_CLASS_DIARY']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(noticeSchema),
  auditLog('CREATE_NOTICE'),
  asyncHandler(noticeController.createNotice.bind(noticeController))
);

router.put(
  '/:id',
  requirePermission('SEND_SCHOOL_NOTICES'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(noticeSchema.partial()),
  auditLog('UPDATE_NOTICE'),
  asyncHandler(noticeController.updateNotice.bind(noticeController))
);

router.delete(
  '/:id',
  requirePermission('SEND_SCHOOL_NOTICES'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_NOTICE'),
  asyncHandler(noticeController.deleteNotice.bind(noticeController))
);

export default router;
