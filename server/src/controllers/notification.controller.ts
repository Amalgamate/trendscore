/**
 * Notification Controller
 * Handles sending notifications (WhatsApp, SMS, Email) to parents
 * 
 * @module controllers/notification.controller
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/permissions.middleware';
import { whatsappService } from '../services/whatsapp.service';
import prisma from '../config/database';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { ApiError } from '../utils/error.util';

import logger from '../utils/logger';
import { assessmentSmsDeliveryService } from '../services/assessment-sms-delivery.service';
import { hasAnyRole } from '../utils/roleNormalizer';

// Roles that may message the parents of any learner. Teachers are limited to
// learners enrolled in a class they teach (the same rule the in-app chat uses).
const UNRESTRICTED_MESSENGER_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'HEAD_TEACHER',
  'DEPUTY_HEAD_TEACHER',
  'HEAD_OF_CURRICULUM',
  'ACCOUNTANT',
];

const isUnrestrictedMessenger = (user: AuthRequest['user']) =>
  hasAnyRole(user, UNRESTRICTED_MESSENGER_ROLES);

async function messageableLearnerIds(req: AuthRequest, learnerIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(learnerIds.filter(Boolean))];
  if (isUnrestrictedMessenger(req.user)) return new Set(ids);

  const userId = req.user?.userId;
  if (!userId || !hasAnyRole(req.user, ['TEACHER']) || ids.length === 0) return new Set<string>();

  const rows = await prisma.classEnrollment.findMany({
    where: {
      learnerId: { in: ids },
      active: true,
      archived: false,
      class: {
        active: true,
        archived: false,
        OR: [{ teacherId: userId }, { teacherAssignments: { some: { teacherId: userId } } }],
      },
    },
    select: { learnerId: true },
  });
  return new Set(rows.map((row) => row.learnerId));
}

async function assertCanMessageLearners(req: AuthRequest, learnerIds: string[]): Promise<void> {
  const wanted = [...new Set(learnerIds.filter(Boolean))];
  const allowed = await messageableLearnerIds(req, wanted);
  if (wanted.some((id) => !allowed.has(id))) {
    throw new ApiError(403, 'You can only message parents of learners in your assigned classes');
  }
}

const lastNineDigits = (value?: string | null) => String(value || '').replace(/\D/g, '').slice(-9);

/**
 * Staff who are not unrestricted must send only to a number that is on the
 * learner's own contact record, so the endpoint cannot be used to text
 * arbitrary numbers.
 */
async function assertPhoneBelongsToLearner(req: AuthRequest, learnerId: string, phone: string): Promise<void> {
  if (isUnrestrictedMessenger(req.user)) return;

  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    select: {
      guardianPhone: true,
      fatherPhone: true,
      motherPhone: true,
      primaryContactPhone: true,
      emergencyPhone: true,
      parent: { select: { phone: true } },
    },
  });

  const wanted = lastNineDigits(phone);
  const known = [
    learner?.guardianPhone,
    learner?.fatherPhone,
    learner?.motherPhone,
    learner?.primaryContactPhone,
    learner?.emergencyPhone,
    learner?.parent?.phone,
  ].map(lastNineDigits).filter(Boolean);

  if (!wanted || !known.includes(wanted)) {
    throw new ApiError(403, "That phone number is not on this learner's contact record");
  }
}

/** Bulk entries: enforce class scope, and ignore phone overrides for non-privileged staff. */
async function scopeBulkEntries<T extends { learnerId: string; phoneOverride?: string }>(
  req: AuthRequest,
  entries: T[]
): Promise<T[]> {
  await assertCanMessageLearners(req, entries.map((entry) => entry.learnerId));
  if (isUnrestrictedMessenger(req.user)) return entries;
  return entries.map((entry) => {
    const { phoneOverride: _ignored, ...rest } = entry;
    return rest as T;
  });
}

async function resolveLearnerIds(filter: { classId?: string; grade?: string }): Promise<string[]> {
  if (filter.classId) {
    const rows = await prisma.classEnrollment.findMany({
      where: { classId: filter.classId, active: true, archived: false },
      select: { learnerId: true },
    });
    return rows.map((row) => row.learnerId);
  }
  const rows = await prisma.learner.findMany({
    where: { grade: filter.grade as any, status: 'ACTIVE' },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export class NotificationController {
  /**
   * Send assessment completion notification to parent
   * POST /api/notifications/assessment-complete
   */
  async sendAssessmentNotification(req: AuthRequest, res: Response) {
    const {
      learnerId,
      subject,
      grade,
      term,
    } = req.body;
    const assessmentType = req.body.assessmentType || 'Summative'; // 'Formative' or 'Summative'

    // Validate input
    if (!learnerId) {
      throw new ApiError(400, 'Learner ID is required');
    }

    await assertCanMessageLearners(req, [learnerId]);

    // Get learner with parent info
    const learner = await prisma.learner.findUnique({
      where: {
        id: learnerId
      },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!learner) {
      throw new ApiError(404, 'Learner not found');
    }

    if (!learner.parent) {
      throw new ApiError(400, 'Parent information not available for this learner');
    }

    if (!learner.parent.phone) {
      throw new ApiError(400, 'Parent phone number not available');
    }

    // Send WhatsApp notification
    const result = await whatsappService.sendAssessmentNotification({
      parentPhone: learner.parent.phone,
      parentName: `${learner.parent.firstName} ${learner.parent.lastName}`,
      learnerName: `${learner.firstName} ${learner.lastName}`,
      assessmentType,
      subject,
      grade: grade || learner.grade,
      term
    } as any);

    if (result.success) {
      res.json({
        success: true,
        message: 'Assessment notification sent successfully',
        data: {
          sent: true,
          recipient: learner.parent.phone,
        },
      });
    } else {
      throw new ApiError(500, result.error || 'Failed to send notification');
    }
  }

  /**
   * Send bulk assessment notifications to multiple parents
   * POST /api/notifications/assessment-complete/bulk
   */
  async sendBulkAssessmentNotifications(req: AuthRequest, res: Response) {
    const {
      classId,
      subject,
      grade,
      term,
    } = req.body;
    const assessmentType = req.body.assessmentType || 'Summative';

    let learnerIds: string[] = Array.isArray(req.body.learnerIds) ? req.body.learnerIds : [];
    if (learnerIds.length === 0 && (classId || grade)) {
      learnerIds = await resolveLearnerIds({ classId, grade });
    }

    // Validate input
    if (learnerIds.length === 0) {
      throw new ApiError(400, 'Learner IDs, a class, or a grade is required');
    }

    await assertCanMessageLearners(req, learnerIds);

    // Get learners with parent info
    const learners = await prisma.learner.findMany({
      where: {
        id: { in: learnerIds }
      },
      include: {
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Prepare notifications
    const notifications = learners
      .filter(l => l.parent && l.parent.phone) // Only include learners with parent phone
      .map(l => ({
        parentPhone: l.parent!.phone!,
        parentName: `${l.parent!.firstName} ${l.parent!.lastName}`,
        learnerName: `${l.firstName} ${l.lastName}`,
        assessmentType,
        subject,
        grade: grade || l.grade,
        term,
      }));

    if (notifications.length === 0) {
      throw new ApiError(400, 'No valid parent phone numbers found for the selected learners');
    }

    // Send bulk notifications
    const result = await whatsappService.sendBulkAssessmentNotifications(notifications);

    res.json({
      success: true,
      message: `Sent ${result.sent} notifications, ${result.failed} failed`,
      data: {
        total: learnerIds.length,
        sent: result.sent,
        failed: result.failed,
        skipped: learnerIds.length - notifications.length,
      },
    });
  }

  /**
   * Send custom message to parent
   * POST /api/notifications/custom
   */
  async sendCustomMessage(req: AuthRequest, res: Response) {
    const { message } = req.body;
    let parentId: string | undefined = req.body.parentId;
    const learnerId: string | undefined = req.body.learnerId;

    // Validate input
    if (!message || (!parentId && !learnerId)) {
      throw new ApiError(400, 'A learner or parent, and a message, are required');
    }

    if (learnerId) {
      await assertCanMessageLearners(req, [learnerId]);
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: { parentId: true },
      });
      if (!learner?.parentId) {
        throw new ApiError(400, 'Parent information not available for this learner');
      }
      if (parentId && parentId !== learner.parentId) {
        throw new ApiError(400, 'This parent is not linked to the learner');
      }
      parentId = learner.parentId;
    } else if (!isUnrestrictedMessenger(req.user)) {
      // A parent ID alone: the caller must teach at least one of that parent's children.
      const children = await prisma.learner.findMany({
        where: { parentId },
        select: { id: true },
      });
      const allowed = await messageableLearnerIds(req, children.map((child) => child.id));
      if (allowed.size === 0) {
        throw new ApiError(403, 'You can only message parents of learners in your assigned classes');
      }
    }

    // Get parent info
    const parent = await prisma.user.findUnique({
      where: {
        id: parentId as string
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
      },
    });

    if (!parent) {
      throw new ApiError(404, 'Parent not found');
    }

    if (parent.role !== 'PARENT') {
      throw new ApiError(400, 'User is not a parent');
    }

    if (!parent.phone) {
      throw new ApiError(400, 'Parent phone number not available');
    }

    // Send message
    const result = await whatsappService.sendCustomMessage({
      parentPhone: parent.phone,
      message
    } as any);

    if (result.success) {
      res.json({
        success: true,
        message: 'Custom message sent successfully',
        data: {
          sent: true,
          recipient: parent.phone,
        },
      });
    } else {
      throw new ApiError(500, result.error || 'Failed to send message');
    }
  }

  /**
   * Send announcement to all parents or filtered group
   * POST /api/notifications/announcement
   */
  async sendAnnouncement(req: AuthRequest, res: Response) {
    const { title, grade, stream, classId } = req.body;
    const content = req.body.content ?? req.body.message;

    // Validate input
    if (!title || !content) {
      throw new ApiError(400, 'Title and content are required');
    }

    // Build where clause
    const whereClause: any = {
      role: 'PARENT',
      phone: { not: null }
    };

    // If grade/stream specified, filter parents by their children's grade/stream
    let parents;
    if (grade || stream || classId) {
      const learnerWhere: any = {};
      if (grade) learnerWhere.grade = grade;
      if (stream) learnerWhere.stream = stream;
      if (classId) {
        learnerWhere.enrollments = { some: { classId, active: true, archived: false } };
      }

      // Get unique parent IDs from learners
      const learners = await prisma.learner.findMany({
        where: { ...learnerWhere },
        select: { parentId: true },
      });

      const parentIds = [...new Set(learners.map(l => l.parentId).filter(Boolean))];

      parents = await prisma.user.findMany({
        where: {
          id: { in: parentIds as string[] },
          phone: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });
    } else {
      // Get all parents
      parents = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      });
    }

    if (parents.length === 0) {
      throw new ApiError(400, 'No parents found with phone numbers');
    }

    // Send announcements
    let sent = 0;
    let failed = 0;
    const results = [];

    for (const parent of parents) {
      const result = await whatsappService.sendAnnouncement({
        parentPhone: parent.phone!,
        parentName: `${parent.firstName} ${parent.lastName}`,
        title,
        content
      } as any);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      results.push({
        parentId: parent.id,
        phone: parent.phone,
        success: result.success,
        error: result.error,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      message: `Announcement sent to ${sent} parents, ${failed} failed`,
      data: {
        total: parents.length,
        sent,
        failed,
        results,
      },
    });
  }

  /**
   * Send assessment report via SMS to parent
   * POST /api/notifications/sms/assessment-report
   */
  async sendAssessmentReportSms(req: AuthRequest, res: Response) {
    const {
      learnerId,
      learnerName,
      learnerGrade,
      parentPhone,
      parentName,
      term,
      totalTests,
      averageScore,
      overallGrade,
      totalMarks,
      maxPossibleMarks,
      subjects,
      pathwayPrediction,
    } = req.body;

    // Validate required fields
    if (!learnerId || !learnerName || !learnerGrade || !parentPhone || !term) {
      throw new ApiError(400, 'Missing required fields: learnerId, learnerName, learnerGrade, parentPhone, term');
    }

    if (!totalTests || totalTests === 0) {
      throw new ApiError(400, 'Cannot send report with no tests');
    }

    await assertCanMessageLearners(req, [learnerId]);
    await assertPhoneBelongsToLearner(req, learnerId, parentPhone);

    // Import SmsService
    const { SmsService } = await import('../services/sms.service');

    // Send SMS
    const result = await SmsService.sendAssessmentReport({
      learnerId,
      learnerName,
      learnerGrade,
      parentPhone,
      parentName,
      term,
      totalTests,
      averageScore,
      overallGrade,
      totalMarks,
      maxPossibleMarks,
      subjects,
      pathwayPrediction,
      sentByUserId: req.user?.userId,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Assessment report SMS sent successfully',
        data: {
          sent: true,
          recipient: parentPhone,
          messageId: result.messageId,
        },
      });
    } else {
      throw new ApiError(500, result.error || 'Failed to send SMS');
    }
  }

  async sendAssessmentReportSmsBulk(req: AuthRequest, res: Response) {
    const result = await assessmentSmsDeliveryService.sendBulk({
      entries: await scopeBulkEntries(req, req.body.entries),
      term: req.body.term,
      academicYear: Number(req.body.academicYear),
      sentByUserId: req.user?.userId,
    });

    res.json({
      success: true,
      message: `Assessment SMS processing completed: ${result.sent} sent, ${result.alreadySent} already delivered, ${result.failed} failed`,
      data: result,
    });
  }

  async previewAssessmentReportSmsBulk(req: AuthRequest, res: Response) {
    const results = await assessmentSmsDeliveryService.preview(await scopeBulkEntries(req, req.body.entries), {
      term: req.body.term,
      academicYear: Number(req.body.academicYear),
    });
    res.json({
      success: true,
      data: {
        total: results.length,
        valid: results.filter(result => result.valid).length,
        invalid: results.filter(result => !result.valid).length,
        alreadySent: results.filter(result => result.alreadySent).length,
        sendable: results.filter(result => result.valid && !result.alreadySent).length,
        totalParts: results.reduce((sum, result) => sum + (result.valid && !result.alreadySent ? result.smsParts || 0 : 0), 0),
        results,
      },
    });
  }

  async retryAssessmentReportSms(req: AuthRequest, res: Response) {
    const audit = await prisma.assessmentSmsAudit.findUnique({
      where: { id: req.params.auditId },
      select: { learnerId: true },
    });
    if (audit?.learnerId) {
      await assertCanMessageLearners(req, [audit.learnerId]);
    }

    try {
      const result = await assessmentSmsDeliveryService.retry(req.params.auditId, req.user?.userId);
      res.json({
        success: result.success,
        message: result.success ? 'Assessment SMS resent successfully' : result.error || 'Assessment SMS retry failed',
        data: result,
      });
    } catch (error: any) {
      throw new ApiError(404, error?.message || 'Assessment SMS audit record not found');
    }
  }

  /**
   * Send assessment report via WhatsApp to parent
   * POST /api/notifications/whatsapp/assessment-report
   */
  async sendAssessmentReportWhatsApp(req: AuthRequest, res: Response) {
    const {
      learnerId,
      learnerName,
      learnerGrade,
      parentPhone,
      parentName,
      term,
      academicYear,
      totalTests,
      averageScore,
      overallGrade,
      subjects,
      pathwayPrediction,
      reportHtml,
      reportImageBase64,
    } = req.body;

    // Validate required fields
    if (!learnerId || !learnerName || !learnerGrade || !parentPhone || !term) {
      throw new ApiError(400, 'Missing required fields: learnerId, learnerName, learnerGrade, parentPhone, term');
    }

    await assertCanMessageLearners(req, [learnerId]);
    await assertPhoneBelongsToLearner(req, learnerId, parentPhone);

    // Get school name from School model or fallback
    const school = await prisma.school.findFirst();
    const schoolName = school?.name || PRODUCT_DISPLAY_NAME;

    const result = await whatsappService.sendAssessmentReport({
      learnerId,
      learnerName,
      learnerGrade,
      parentPhone,
      parentName,
      term,
      totalTests,
      averageScore,
      overallGrade,
      subjects,
      pathwayPrediction,
      schoolName,
      reportHtml,
      reportImageBase64
    } as any);

    // Audit log
    await prisma.assessmentSmsAudit.create({
      data: {
        learnerId,
        assessmentType: 'SUMMATIVE',
        term,
        academicYear: academicYear ? parseInt(academicYear) : new Date().getFullYear(),
        parentPhone: parentPhone,
        parentName: parentName || 'Unknown',
        learnerName: learnerName,
        learnerGrade: learnerGrade,
        templateType: 'SUMMATIVE_TERM',
        messageContent: 'WhatsApp Report',
        channel: 'WHATSAPP',
        smsStatus: result.success ? 'SENT' : 'FAILED',
        failureReason: result.error,
        sentByUserId: req.user?.userId,
      }
    });

    if (result.success) {
      res.json({ success: true, message: 'WhatsApp sent' });
    } else {
      // Return specific status codes for different types of "not ready" states
      let statusCode = 500;
      if (result.error?.includes('initializing') || result.error?.includes('disconnected')) {
        statusCode = 503; // Service Unavailable
      } else if (result.error?.includes('qr_needed')) {
        statusCode = 401; // Unauthorized
      }
      
      res.status(statusCode).json({ 
        success: false, 
        message: result.message || 'Failed to send WhatsApp',
        error: result.error 
      });
    }
  }

  /**
   * Log a communication action (e.g., WhatsApp send which is client-side)
   * POST /api/notifications/log-communication
   */
  async logCommunication(req: AuthRequest, res: Response) {
    const {
      learnerId,
      channel, // 'SMS' or 'WHATSAPP'
      term,
      academicYear,
      assessmentType = 'SUMMATIVE'
    } = req.body;

    if (!learnerId || !channel) {
      throw new ApiError(400, 'Learner ID and channel are required');
    }

    await assertCanMessageLearners(req, [learnerId]);

    // Get learner info for the audit record
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
      include: {
        parent: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    if (!learner) {
      throw new ApiError(404, 'Learner not found');
    }

    // Create audit record
    const audit = await prisma.assessmentSmsAudit.create({
      data: {
        learnerId,
        assessmentType,
        term,
        academicYear: academicYear ? parseInt(academicYear) : new Date().getFullYear(),
        parentPhone: learner.parent?.phone || learner.guardianPhone || 'Unknown',
        parentName: learner.parent ? `${learner.parent.firstName} ${learner.parent.lastName}` : (learner.guardianName || 'Parent'),
        learnerName: `${learner.firstName} ${learner.lastName}`,
        learnerGrade: learner.grade,
        templateType: 'SUMMATIVE_TERM',
        messageContent: `Action: ${channel} log via Dashboard`,
        channel: channel as any,
        smsStatus: 'SENT',
        sentByUserId: req.user?.userId,
      }
    });

    res.json({
      success: true,
      data: audit
    });
  }

  /**
   * Test WhatsApp connection
   * POST /api/notifications/test
   */
  async testWhatsApp(req: AuthRequest, res: Response) {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      throw new ApiError(400, 'Phone number is required');
    }

    const testMsg = message || `This is a test message from ${PRODUCT_DISPLAY_NAME}. WhatsApp integration is working correctly!`;

    const result = await whatsappService.sendMessage({
      to: phoneNumber,
      message: testMsg
    } as any);

    res.json({
      success: result.success,
      message: result.message,
      error: result.error,
    });
  }

  /**
   * Get audit logs for SMS and WhatsApp communications
   * GET /api/notifications/audit-logs
   * 
   * TODO: Implement proper audit logging with assessmentSmsAudit model
   */
  async getAuditLogs(req: AuthRequest, res: Response) {
    const {
      startDate,
      endDate,
      grade,
      channel,
      status,
      search,
      page = 1,
      limit = 50
    } = req.query as any;

    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
      const safetyBuffer = skip + take + 500; // Limit DB fetch to what we likely need

      const searchText = (search || '').toString().trim().toLowerCase();
      const normalizedGrade = grade ? String(grade).trim().toUpperCase() : undefined;
      const normalizedChannel = channel ? String(channel).toUpperCase() : undefined;
      const normalizedStatus = status ? String(status).toUpperCase() : undefined;
      const wantsOnlyBounced = normalizedStatus === 'BOUNCED';

      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      if (end) {
        end.setHours(23, 59, 59, 999);
      }

      const isSuccessfulStatus = (rawStatus: any) => {
        const value = String(rawStatus || '').toUpperCase();
        return value === 'SENT' || value === 'DELIVERED' || value === 'READ';
      };

      const normalizeStatus = (rawStatus: any) => {
        const value = String(rawStatus || '').toUpperCase();
        if (value === 'BOUNCED') return 'BOUNCED';
        if (isSuccessfulStatus(value)) return 'SENT';
        return 'FAILED';
      };

      const auditWhere: any = {};
      // Staff who can only message their own learners see only what they sent;
      // school-wide history is for roles that can message any learner's parents.
      const scopedToSelf = !isUnrestrictedMessenger(req.user);
      if (scopedToSelf) auditWhere.sentByUserId = req.user?.userId ?? '__none__';
      if (normalizedGrade) {
        const validGrades = new Set([
          'PLAYGROUP', 'PP1', 'PP2',
          ...Array.from({ length: 9 }, (_, index) => `GRADE_${index + 1}`),
          ...Array.from({ length: 4 }, (_, index) => `FORM_${index + 1}`),
        ]);
        if (!validGrades.has(normalizedGrade)) throw new ApiError(400, 'Invalid grade filter');
        auditWhere.learner = { grade: normalizedGrade };
      }
      if (normalizedChannel) auditWhere.channel = normalizedChannel;
      if (normalizedStatus && normalizedStatus !== 'BOUNCED') auditWhere.smsStatus = normalizedStatus;
      if (start || end) {
        auditWhere.sentAt = {};
        if (start) auditWhere.sentAt.gte = start;
        if (end) auditWhere.sentAt.lte = end;
      }
      if (searchText) {
        auditWhere.OR = [
          { parentPhone: { contains: searchText, mode: 'insensitive' } },
          { parentName: { contains: searchText, mode: 'insensitive' } },
          { learnerName: { contains: searchText, mode: 'insensitive' } },
          { messageContent: { contains: searchText, mode: 'insensitive' } },
        ];
      }

      const auditLogs = wantsOnlyBounced
        ? []
        : await prisma.assessmentSmsAudit.findMany({
            where: auditWhere,
            include: {
              learner: {
                select: { id: true, firstName: true, lastName: true, admissionNumber: true, grade: true }
              }
            },
            orderBy: { sentAt: 'desc' },
            take: safetyBuffer, // SCALE FIX: Don't load everything
          });

      const canUseBroadcast = (!normalizedChannel || normalizedChannel === 'SMS') && !wantsOnlyBounced && !normalizedGrade && !scopedToSelf;
      
      const broadcastWhere: any = {};
      if (start || end) {
        broadcastWhere.sentAt = {};
        if (start) broadcastWhere.sentAt.gte = start;
        if (end) broadcastWhere.sentAt.lte = end;
      }
      if (searchText) {
        broadcastWhere.OR = [
          { recipientPhone: { contains: searchText, mode: 'insensitive' } },
          { recipientName: { contains: searchText, mode: 'insensitive' } },
        ];
      }

      const broadcastRecipients = canUseBroadcast
        ? await (prisma as any).broadcastRecipient.findMany({
            where: broadcastWhere,
            include: {
              campaign: {
                select: { id: true, senderId: true, messageChannel: true, messagePreview: true, sentAt: true }
              }
            },
            orderBy: { sentAt: 'desc' },
            take: safetyBuffer, // SCALE FIX
          })
        : [];

      const deliveryWhere: any = {};
      if (start || end) {
        deliveryWhere.sentAt = {};
        if (start) deliveryWhere.sentAt.gte = start;
        if (end) deliveryWhere.sentAt.lte = end;
      }
      if (searchText) {
        deliveryWhere.OR = [
          { recipientPhone: { contains: searchText, mode: 'insensitive' } },
          { message: { contains: searchText, mode: 'insensitive' } },
        ];
      }

      const deliveryLogs = canUseBroadcast
        ? await (prisma as any).smsDeliveryLog.findMany({
            where: deliveryWhere,
            include: {
              campaign: {
                select: { id: true, senderId: true, sentAt: true }
              }
            },
            orderBy: { sentAt: 'desc' },
            take: safetyBuffer, // SCALE FIX
          })
        : [];

      const messageReceiptWhere: any = {
        message: { messageType: 'SMS' },
      };
      if (normalizedStatus && normalizedStatus !== 'BOUNCED') {
        messageReceiptWhere.status = normalizedStatus;
      }
      if (start || end) {
        messageReceiptWhere.createdAt = {};
        if (start) messageReceiptWhere.createdAt.gte = start;
        if (end) messageReceiptWhere.createdAt.lte = end;
      }
      if (searchText) {
        messageReceiptWhere.OR = [
          { recipientPhone: { contains: searchText, mode: 'insensitive' } },
          { message: { body: { contains: searchText, mode: 'insensitive' } } },
        ];
      }

      const genericMessageReceipts = canUseBroadcast
        ? await prisma.messageReceipt.findMany({
            where: messageReceiptWhere,
            include: {
              message: {
                select: { id: true, body: true, messageType: true, senderId: true, sentAt: true, createdAt: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: safetyBuffer,
          })
        : [];

      // Resolve sender names so the log shows who actually sent each message.
      const senderIds = new Set<string>();
      auditLogs.forEach((log: any) => { if (log.sentByUserId) senderIds.add(log.sentByUserId); });
      broadcastRecipients.forEach((r: any) => { if (r.campaign?.senderId) senderIds.add(r.campaign.senderId); });
      deliveryLogs.forEach((d: any) => { if (d.campaign?.senderId) senderIds.add(d.campaign.senderId); });
      genericMessageReceipts.forEach((r: any) => { if (r.message?.senderId) senderIds.add(r.message.senderId); });
      const senderRows = senderIds.size
        ? await prisma.user.findMany({
            where: { id: { in: [...senderIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
      const senderById = new Map(senderRows.map((u) => [u.id, { firstName: u.firstName, lastName: u.lastName }]));
      const senderFor = (id?: string | null) =>
        (id && senderById.get(id)) || { firstName: 'System', lastName: '' };

      const normalizedAudit = auditLogs.map((log: any) => ({
        id: `audit_${log.id}`,
        sentByUserId: log.sentByUserId,
        createdAt: log.sentAt || log.createdAt,
        sentAt: log.sentAt || log.createdAt,
        learner: log.learner,
        phoneNumber: log.parentPhone,
        channel: log.channel,
        status: normalizeStatus(log.smsStatus),
        sentBy: senderFor(log.sentByUserId),
        term: log.term,
        source: 'ASSESSMENT_AUDIT',
        messageContent: log.messageContent,
        assessmentType: log.assessmentType,
        templateType: log.templateType,
        failureReason: log.failureReason,
        auditId: log.id,
        canRetry: log.channel === 'SMS' && normalizeStatus(log.smsStatus) === 'FAILED',
      }));

      const normalizedBroadcastRecipients = broadcastRecipients.map((recipient: any) => ({
        id: `broadcast_${recipient.id}`,
        sentByUserId: recipient.campaign?.senderId,
        createdAt: recipient.sentAt || recipient.createdAt || recipient.campaign?.sentAt,
        sentAt: recipient.sentAt || recipient.createdAt || recipient.campaign?.sentAt,
        learner: { firstName: recipient.recipientName || 'Recipient', lastName: '', admissionNumber: null, grade: null },
        phoneNumber: recipient.recipientPhone,
        channel: recipient.campaign?.messageChannel || 'SMS',
        status: normalizeStatus(recipient.status),
        sentBy: senderFor(recipient.campaign?.senderId),
        term: null,
        source: 'BROADCAST_RECIPIENT',
        messageContent: recipient.campaign?.messagePreview,
      }));

      const normalizedDeliveryLogs = deliveryLogs.map((delivery: any) => ({
        id: `delivery_${delivery.id}`,
        sentByUserId: delivery.campaign?.senderId,
        createdAt: delivery.sentAt || delivery.createdAt,
        sentAt: delivery.sentAt || delivery.createdAt,
        learner: { firstName: 'Recipient', lastName: '', admissionNumber: null, grade: null },
        phoneNumber: delivery.recipientPhone,
        channel: 'SMS',
        status: normalizeStatus(delivery.status),
        sentBy: senderFor(delivery.campaign?.senderId),
        term: null,
        source: 'SMS_DELIVERY_LOG',
        messageContent: delivery.message,
        failureReason: delivery.errorDetails,
      }));

      const normalizedMessageReceipts = genericMessageReceipts.map((receipt: any) => {
        const summaryName = receipt.message?.body?.match(/Summary for\s+(.+?)\s*\(/i)?.[1]?.trim();
        return {
          id: `message_receipt_${receipt.id}`,
          createdAt: receipt.message?.sentAt || receipt.createdAt || receipt.message?.createdAt,
          sentAt: receipt.message?.sentAt || receipt.createdAt || receipt.message?.createdAt,
          learner: { firstName: summaryName || 'Recipient', lastName: '', admissionNumber: null, grade: null },
          phoneNumber: receipt.recipientPhone,
          channel: 'SMS',
          status: normalizeStatus(receipt.status),
          sentBy: senderFor(receipt.message?.senderId),
          term: receipt.message?.body?.match(/\((Term\s+\d+)\)/i)?.[1] || null,
          source: 'MESSAGE_RECEIPT',
          messageContent: receipt.message?.body,
          failureReason: receipt.failureReason,
          canRetry: false,
        };
      });

      // Dedupe and merge
      const dedupeMap = new Map<string, any>();
      for (const entry of [...normalizedAudit, ...normalizedBroadcastRecipients, ...normalizedDeliveryLogs, ...normalizedMessageReceipts]) {
        const key = `${entry.phoneNumber || 'unknown'}|${entry.createdAt ? new Date(entry.createdAt).toISOString() : 'no-date'}|${entry.channel || 'unknown'}|${entry.status}`;
        const existing = dedupeMap.get(key);
        if (!existing) {
          dedupeMap.set(key, entry);
          continue;
        }
        const score = (record: any) => {
          if (record.source === 'ASSESSMENT_AUDIT') return 3;
          if (record.source === 'BROADCAST_RECIPIENT') return 2;
          if (record.source === 'SMS_DELIVERY_LOG') return 1;
          return 0;
        };
        if (score(entry) > score(existing)) dedupeMap.set(key, entry);
      }

      let allLogs = Array.from(dedupeMap.values());

      allLogs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Get counts for stats from total rows in DB conceptually, 
      // but for accuracy on the filtered set we need the full count.
      // Since we limited DB fetch, these stats reflect the recent safety buffer.
      const total = allLogs.length;
      const paginatedLogs = allLogs.slice(skip, skip + take);
      const successfulSent = allLogs.filter(log => log.status === 'SENT').length;
      const failedSent = allLogs.filter(log => log.status === 'FAILED' || log.status === 'BOUNCED').length;
      const bouncedSent = allLogs.filter(log => log.status === 'BOUNCED').length;
      const successRate = total > 0 ? Math.round((successfulSent / total) * 100) : 0;

      res.json({
        success: true,
        data: {
          logs: paginatedLogs,
          total,
          summary: {
            totalSent: total,
            successRate,
            failed: failedSent,
            bounced: bouncedSent,
            estimatedCost: 0
          }
        }
      });
    } catch (error: any) {
      logger.error('[NotificationController] getAuditLogs error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
