/**
 * Notification Routes
 * Handles WhatsApp/SMS/Email notification endpoints
 * 
 * @module routes/notification.routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { NotificationController } from '../controllers/notification.controller';
import { whatsappStatusController } from '../controllers/whatsapp-status.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission, requireRole, auditLog } from '../middleware/permissions.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();
const notificationController = new NotificationController();

// Validation schemas
const sendNotificationSchema = z.object({
  learnerId: z.string().min(1),
  message: z.string().min(1).max(5000),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL']).optional()
});

const sendBulkNotificationSchema = z.object({
  classId: z.string().min(1).optional(),
  grade: z.string().optional(),
  message: z.string().min(1).max(5000),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL']).optional()
});

const sendAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  targetAudience: z.enum(['ALL', 'CLASS', 'GRADE']).optional(),
  classId: z.string().optional()
});

const sendAssessmentReportSchema = z.object({
  learnerId: z.string().min(1),
  learnerName: z.string().min(1),
  learnerGrade: z.string().min(1),
  parentPhone: z.string().min(1),
  parentName: z.string().optional(),
  term: z.string().min(1),
  academicYear: z.any().optional(),
  totalTests: z.number().optional(),
  averageScore: z.any().optional(),
  overallGrade: z.string().optional(),
  subjects: z.any().optional(),
  pathwayPrediction: z.any().optional(),
  reportHtml: z.string().optional(),
  reportImageBase64: z.string().optional()
});

const sendAssessmentReportBulkSchema = z.object({
  term: z.string().min(1),
  academicYear: z.coerce.number().int().min(2000).max(2200),
  entries: z.array(z.object({
    learnerId: z.string().min(1),
    message: z.string().min(1).max(5000),
    phoneOverride: z.string().max(30).optional(),
  })).min(1).max(250),
});

/**
 * @route   POST /api/notifications/assessment-complete
 * @desc    Send assessment completion notification to parent
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/assessment-complete',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(sendNotificationSchema),
  auditLog('SEND_ASSESSMENT_NOTIFICATION'),
  asyncHandler(notificationController.sendAssessmentNotification.bind(notificationController))
);

/**
 * @route   POST /api/notifications/assessment-complete/bulk
 * @desc    Send bulk assessment notifications
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/assessment-complete/bulk',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(sendBulkNotificationSchema),
  auditLog('SEND_BULK_ASSESSMENT_NOTIFICATIONS'),
  asyncHandler(notificationController.sendBulkAssessmentNotifications.bind(notificationController))
);

/**
 * @route   POST /api/notifications/custom
 * @desc    Send custom message to parent
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/custom',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  validate(sendNotificationSchema),
  auditLog('SEND_CUSTOM_MESSAGE'),
  asyncHandler(notificationController.sendCustomMessage.bind(notificationController))
);

/**
 * @route   POST /api/notifications/announcement
 * @desc    Send announcement to all parents or filtered group
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER
 */
router.post(
  '/announcement',
  authenticate,
  requirePermission('SEND_SCHOOL_NOTICES'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(sendAnnouncementSchema),
  auditLog('SEND_ANNOUNCEMENT'),
  asyncHandler(notificationController.sendAnnouncement.bind(notificationController))
);

/**
 * @route   POST /api/notifications/sms/assessment-report
 * @desc    Send assessment report via SMS to parent
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/sms/assessment-report',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(sendAssessmentReportSchema),
  auditLog('SEND_ASSESSMENT_REPORT_SMS'),
  asyncHandler(notificationController.sendAssessmentReportSms.bind(notificationController))
);

router.post(
  '/sms/assessment-report/bulk/preview',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(sendAssessmentReportBulkSchema),
  asyncHandler(notificationController.previewAssessmentReportSmsBulk.bind(notificationController))
);

router.post(
  '/sms/assessment-report/bulk',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(sendAssessmentReportBulkSchema),
  auditLog('SEND_ASSESSMENT_REPORT_SMS_BULK'),
  asyncHandler(notificationController.sendAssessmentReportSmsBulk.bind(notificationController))
);

router.post(
  '/sms/assessment-report/:auditId/retry',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('RETRY_ASSESSMENT_REPORT_SMS'),
  asyncHandler(notificationController.retryAssessmentReportSms.bind(notificationController))
);

/**
 * @route   POST /api/notifications/whatsapp/assessment-report
 * @desc    Send assessment report via WhatsApp to parent
 * @access  SUPER_ADMIN, ADMIN, HEAD_TEACHER, TEACHER
 */
router.post(
  '/whatsapp/assessment-report',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(sendAssessmentReportSchema),
  auditLog('SEND_ASSESSMENT_REPORT_WHATSAPP'),
  asyncHandler(notificationController.sendAssessmentReportWhatsApp.bind(notificationController))
);

router.post(
  '/log-communication',
  authenticate,
  requirePermission('SEND_MESSAGES'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  auditLog('LOG_COMMUNICATION'),
  asyncHandler(notificationController.logCommunication.bind(notificationController))
);

/**
 * @route   POST /api/notifications/test
 * @desc    Test WhatsApp connection
 * @access  SUPER_ADMIN, ADMIN
 */
router.post(
  '/test',
  authenticate,
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  asyncHandler(notificationController.testWhatsApp.bind(notificationController))
);

/**
 * @route   GET /api/notifications/whatsapp/status
 * @desc    Get WhatsApp connection status
 * @access  Authenticated
 */
router.get(
  '/whatsapp/status',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(whatsappStatusController.getStatus.bind(whatsappStatusController))
);

/**
 * @route   GET /api/notifications/whatsapp/qr
 * @desc    Get WhatsApp QR code for authentication
 * @access  Authenticated
 */
router.get(
  '/whatsapp/qr',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  asyncHandler(whatsappStatusController.getQRCode.bind(whatsappStatusController))
);

/**
 * @route   POST /api/notifications/whatsapp/initialize
 * @desc    Initialize WhatsApp service
 * @access  Authenticated
 */
router.post(
  '/whatsapp/initialize',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  asyncHandler(whatsappStatusController.initialize.bind(whatsappStatusController))
);

/**
 * @route   POST /api/notifications/whatsapp/logout
 * @desc    Logout WhatsApp and clear session
 * @access  Authenticated
 */
router.post(
  '/whatsapp/logout',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  asyncHandler(whatsappStatusController.logout.bind(whatsappStatusController))
);

/**
 * @route   GET /api/notifications/audit-logs
 * @desc    Get message history audit logs (SMS & WhatsApp)
 * @access  Authenticated
 */
router.get(
  '/audit-logs',
  authenticate,
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(notificationController.getAuditLogs.bind(notificationController))
);

export default router;
