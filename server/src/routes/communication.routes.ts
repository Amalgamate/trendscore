
import express from 'express';
import { z } from 'zod';
import {
    getCommunicationConfig,
    saveCommunicationConfig,
    sendTestSms,
    sendTestEmail,
    getBirthdaysToday,
    sendBirthdayWishes,
    getInboxMessages,
    markMessageRead,
    getBroadcastRecipients,
    getStaffContacts,
    createContactGroup,
    getContactGroups,
    getContactGroupById,
    updateContactGroup,
    deleteContactGroup,
    getSmsBalance
} from '../controllers/communication.controller';
import { requireRole, auditLog } from '../middleware/permissions.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = express.Router();

/**
 * Apply authentication and school context middleware to all routes
 */
router.use(authenticate);
router.use(requireSchoolContext);

// Validation schemas
const saveCommunicationConfigSchema = z.object({
    schoolId: z.string().optional(),
    sms: z.object({
        enabled: z.boolean().optional(),
        provider: z.string().optional(),
        baseUrl: z.string().optional(),
        senderId: z.string().optional(),
        apiKey: z.string().optional(),
        username: z.string().optional(),
        customName: z.string().optional(),
        customBaseUrl: z.string().optional(),
        customAuthHeader: z.string().optional(),
        customToken: z.string().optional()
    }).optional(),
    email: z.object({
        enabled: z.boolean().optional(),
        provider: z.string().optional(),
        fromEmail: z.string().optional(),
        fromName: z.string().optional(),
        apiKey: z.string().optional(),
        emailTemplates: z.any().optional()
    }).optional(),
    mpesa: z.object({
        enabled: z.boolean().optional(),
        provider: z.string().optional(),
        publicKey: z.string().optional(),
        secretKey: z.string().optional(),
        businessNumber: z.string().optional()
    }).optional(),
    birthdays: z.object({
        enabled: z.boolean().optional(),
        template: z.string().optional()
    }).optional(),
    otp: z.object({
        enabled: z.boolean()
    }).optional()
});

const sendTestSmsSchema = z.object({
    schoolId: z.string().optional(),
    phoneNumber: z.string().min(9),
    message: z.string().min(1).max(1000),
    scheduledFor: z.string().optional()
});

const sendTestEmailSchema = z.object({
    email: z.string().email(),
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(5000)
});

const createContactGroupSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    recipients: z.array(z.string()).optional()
});

/**
 * Communication Routes
 * Base path: /api/communication (defined in index.ts)
 */

// Get Configuration
// Allowed: Admin, Super Admin, Head Teacher
router.get(
    '/config',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 50 }),
    getCommunicationConfig
);

// Get SMS Balance
// Allowed: Admin, Super Admin, Head Teacher
router.get(
    '/balance',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 50 }),
    getSmsBalance
);

// Save Configuration
// Allowed: Admin, Super Admin
router.post(
    '/config',
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    validate(saveCommunicationConfigSchema),
    auditLog('SAVE_COMMUNICATION_CONFIG'),
    saveCommunicationConfig
);

// Send Test SMS
// Allowed: Admin, Super Admin, Head Teacher
router.post(
    '/test/sms',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(sendTestSmsSchema),
    sendTestSms
);

// Get Inbox Messages
// Allowed: any authenticated user
router.get(
    '/messages/inbox',
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getInboxMessages
);

// Mark Receipt Read
// Allowed: any authenticated user
router.patch(
    '/messages/receipts/:id/read',
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    markMessageRead
);

// Send Test Email
// Allowed: Admin, Super Admin
router.post(
    '/test/email',
    requireRole(['SUPER_ADMIN', 'ADMIN']),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(sendTestEmailSchema),
    sendTestEmail
);

// Birthday Birthdays Today
// Allowed: Admin, Super Admin, Head Teacher, Teacher, Accountant
router.get(
    '/birthdays/today',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER', 'ACCOUNTANT']),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getBirthdaysToday
);

// Send Birthday Wishes
// Allowed: Admin, Super Admin, Head Teacher
router.post(
    '/birthdays/send',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('SEND_BIRTHDAY_WISHES'),
    sendBirthdayWishes
);

// Get Broadcast Recipients
// Allowed: Admin, Super Admin, Head Teacher
router.get(
    '/recipients',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getBroadcastRecipients
);

// Get Staff Contacts
// Allowed: Admin, Super Admin, Head Teacher, Teacher
router.get(
    '/staff',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getStaffContacts
);

// Contact Groups Routes
// Get all contact groups
router.get(
    '/groups',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getContactGroups
);

// Get contact group by ID
router.get(
    '/groups/:id',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    getContactGroupById
);

// Create contact group
router.post(
    '/groups',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(createContactGroupSchema),
    auditLog('CREATE_CONTACT_GROUP'),
    createContactGroup
);

// Update contact group
router.put(
    '/groups/:id',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(createContactGroupSchema),
    auditLog('UPDATE_CONTACT_GROUP'),
    updateContactGroup
);

// Delete contact group
router.delete(
    '/groups/:id',
    requireRole(['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'TEACHER']),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('DELETE_CONTACT_GROUP'),
    deleteContactGroup
);

export default router;
