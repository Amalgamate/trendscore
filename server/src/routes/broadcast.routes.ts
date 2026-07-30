import express from 'express';
import { z } from 'zod';
import {
  saveBroadcastCampaign,
  getBroadcastHistory,
  getBroadcastDetails,
  getBroadcastStats,
  saveSmsDeliveryLog,
  deleteBroadcastCampaign,
  sendBulkBroadcast
} from '../controllers/broadcast.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { BROADCAST_MANAGER_ROLES } from '../config/permissions';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = express.Router();

const createCampaignSchema = z.object({
  messagePreview: z.string().min(1).max(1000),
  messageTemplate: z.string().min(1).max(5000),
  totalRecipients: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  recipientSource: z.string(),
  recipients: z.array(z.object({
    id: z.string().optional(),
    phone: z.string(),
    name: z.string().optional(),
    status: z.string(),
    messageId: z.string().optional(),
    sentAt: z.string().optional(),
    error: z.string().optional(),
    studentName: z.string().optional(),
    grade: z.string().optional()
  }))
});

const bulkSendSchema = z.object({
  channel: z.enum(['sms', 'whatsapp']),
  messageTemplate: z.string().min(1),
  messagePreview: z.string().optional(),
  recipients: z.array(z.object({
    id: z.string().optional(),
    phone: z.string(),
    name: z.string().optional(),
    message: z.string(),
    studentName: z.string().optional(),
    grade: z.string().optional()
  }))
});

const deliveryLogSchema = z.object({
  recipientPhone: z.string().min(10),
  status: z.enum(['SENT', 'FAILED', 'PENDING']),
  messageId: z.string().optional(),
  errorMessage: z.string().max(500).optional()
});

/**
 * Apply authentication and school context middleware to all routes
 */
router.use(authenticate);
router.use(requireSchoolContext);

/**
 * Broadcast Routes
 * Base path: /api/broadcasts
 */

/**
 * @route   POST /api/broadcasts
 * @desc    Save broadcast campaign after sending
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/',
  requireRole(BROADCAST_MANAGER_ROLES),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(createCampaignSchema),
  auditLog('CREATE_BROADCAST_CAMPAIGN'),
  saveBroadcastCampaign
);

/**
 * @route   POST /api/broadcasts/send-bulk
 * @desc    Send broadcast to multiple recipients using backend batching
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.post(
  '/send-bulk',
  requireRole(BROADCAST_MANAGER_ROLES),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }), // Strict rate limit for bulk send initiation
  validate(bulkSendSchema),
  auditLog('SEND_BULK_BROADCAST'),
  sendBulkBroadcast
);

/**
 * @route   GET /api/broadcasts
 * @desc    Get broadcast history
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/',
  requireRole(BROADCAST_MANAGER_ROLES),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  getBroadcastHistory
);

/**
 * @route   GET /api/broadcasts/stats
 * @desc    Get broadcast statistics
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/stats',
  requireRole(BROADCAST_MANAGER_ROLES),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  getBroadcastStats
);

/**
 * @route   GET /api/broadcasts/:campaignId
 * @desc    Get broadcast campaign details
 * @access  ADMIN, SUPER_ADMIN, HEAD_TEACHER, HEAD_OF_CURRICULUM
 */
router.get(
  '/:campaignId',
  requireRole(BROADCAST_MANAGER_ROLES),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  getBroadcastDetails
);

/**
 * @route   POST /api/broadcasts/:campaignId/delivery-logs
 * @desc    Save SMS delivery log
 * @access  ADMIN, SUPER_ADMIN
 */
router.post(
  '/:campaignId/delivery-logs',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  validate(deliveryLogSchema),
  auditLog('LOG_DELIVERY_STATUS'),
  saveSmsDeliveryLog
);

/**
 * @route   DELETE /api/broadcasts/:campaignId
 * @desc    Delete broadcast campaign
 * @access  ADMIN, SUPER_ADMIN
 */
router.delete(
  '/:campaignId',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_BROADCAST_CAMPAIGN'),
  deleteBroadcastCampaign
);

export default router;
