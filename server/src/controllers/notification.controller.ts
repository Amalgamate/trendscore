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
export class NotificationController {
  /**
   * Send assessment completion notification to parent
   * POST /api/notifications/assessment-complete
   */
  async sendAssessmentNotification(req: AuthRequest, res: Response) {
    const {
      learnerId,
      assessmentType, // 'Formative' or 'Summative'
      subject,
      grade,
      term,
    } = req.body;

    // Validate input
    if (!learnerId || !assessmentType) {
      throw new ApiError(400, 'Learner ID and assessment type are required');
    }

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
      learnerIds,
      assessmentType,
      subject,
      grade,
      term,
    } = req.body;

    // Validate input
    if (!learnerIds || !Array.isArray(learnerIds) || learnerIds.length === 0) {
      throw new ApiError(400, 'Learner IDs array is required');
    }

    if (!assessmentType) {
      throw new ApiError(400, 'Assessment type is required');
    }

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
    const { parentId, message } = req.body;

    // Validate input
    if (!parentId || !message) {
      throw new ApiError(400, 'Parent ID and message are required');
    }

    // Get parent info
    const parent = await prisma.user.findUnique({
      where: {
        id: parentId
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
    const { title, content, grade, stream } = req.body;

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
    if (grade || stream) {
      const learnerWhere: any = {};
      if (grade) learnerWhere.grade = grade;
      if (stream) learnerWhere.stream = stream;

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
      entries: req.body.entries,
      term: req.body.term,
      academicYear: Number(req.body.academicYear),
      sentByUserId: req.user?.userId,
    });

    res.json({
      success: true,
      message: `Assessment SMS processing completed: ${result.sent} sent, ${result.failed} failed`,
      data: result,
    });
  }

  async retryAssessmentReportSms(req: AuthRequest, res: Response) {
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

      const canUseBroadcast = (!normalizedChannel || normalizedChannel === 'SMS') && !wantsOnlyBounced;
      
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

      const normalizedAudit = auditLogs.map((log: any) => ({
        id: `audit_${log.id}`,
        createdAt: log.sentAt || log.createdAt,
        sentAt: log.sentAt || log.createdAt,
        learner: log.learner,
        phoneNumber: log.parentPhone,
        channel: log.channel,
        status: normalizeStatus(log.smsStatus),
        sentBy: { firstName: 'System', lastName: '' },
        term: log.term,
        source: 'ASSESSMENT_AUDIT',
        messageContent: log.messageContent,
        failureReason: log.failureReason,
        auditId: log.id,
        canRetry: log.channel === 'SMS' && normalizeStatus(log.smsStatus) === 'FAILED',
      }));

      const normalizedBroadcastRecipients = broadcastRecipients.map((recipient: any) => ({
        id: `broadcast_${recipient.id}`,
        createdAt: recipient.sentAt || recipient.createdAt || recipient.campaign?.sentAt,
        sentAt: recipient.sentAt || recipient.createdAt || recipient.campaign?.sentAt,
        learner: { firstName: recipient.recipientName || 'Recipient', lastName: '', admissionNumber: null, grade: null },
        phoneNumber: recipient.recipientPhone,
        channel: recipient.campaign?.messageChannel || 'SMS',
        status: normalizeStatus(recipient.status),
        sentBy: { firstName: 'System', lastName: '' },
        term: null,
        source: 'BROADCAST_RECIPIENT',
        messageContent: recipient.campaign?.messagePreview,
      }));

      const normalizedDeliveryLogs = deliveryLogs.map((delivery: any) => ({
        id: `delivery_${delivery.id}`,
        createdAt: delivery.sentAt || delivery.createdAt,
        sentAt: delivery.sentAt || delivery.createdAt,
        learner: { firstName: 'Recipient', lastName: '', admissionNumber: null, grade: null },
        phoneNumber: delivery.recipientPhone,
        channel: 'SMS',
        status: normalizeStatus(delivery.status),
        sentBy: { firstName: 'System', lastName: '' },
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
          sentBy: { firstName: 'System', lastName: '' },
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
