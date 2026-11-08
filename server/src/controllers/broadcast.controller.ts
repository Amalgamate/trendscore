import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/permissions.middleware';
import { ApiError } from '../utils/error.util';

import logger from '../utils/logger';
// Type cast for broadcast models (Prisma client includes these models at runtime)
const broadcastPrisma = prisma as any;

/**
 * Save Broadcast Campaign
 * POST /api/broadcasts
 */
export const saveBroadcastCampaign = async (req: AuthRequest, res: Response) => {
  const {
    messagePreview,
    messageTemplate,
    totalRecipients,
    successCount,
    failedCount,
    recipientSource,
    recipients, // Array of {phone, name, status, messageId, sentAt}
  } = req.body;

  const senderId = req.user?.userId || (req as any).user?.id;

  if (!senderId) {
    throw new ApiError(400, 'User context required');
  }

  // Create broadcast campaign
  const campaign = await broadcastPrisma.broadcastCampaign.create({
    data: {
      senderId,
      messagePreview: messagePreview.substring(0, 150),
      messageTemplate,
      totalRecipients,
      successCount,
      failedCount,
      recipientSource,
      sentAt: new Date(),
      status: failedCount === 0 ? 'DELIVERED' : 'SENT',
      recipients: {
        createMany: {
          data: recipients.map((r: any) => ({
            recipientPhone: r.phone,
            recipientName: r.name,
            status: r.status === 'Sent' ? 'DELIVERED' : 'FAILED',
            messageId: r.messageId,
            sentAt: new Date(r.sentAt || Date.now()),
            failureReason: r.error || null,
          })),
        },
      },
    },
  });

  // Sync to AssessmentSmsAudit for unified message history — non-blocking
  try {
    if (recipients && recipients.length > 0) {
      await prisma.assessmentSmsAudit.createMany({
        data: recipients.map((r: any) => ({
          learnerId: r.id,
          parentPhone: r.phone,
          parentName: r.name || 'Parent',
          learnerName: r.studentName || r.name || 'Student',
          learnerGrade: r.grade || 'N/A',
          assessmentType: 'BROADCAST',
          templateType: 'GENERAL',
          messageContent: messagePreview,
          smsStatus: r.status === 'Sent' ? 'SENT' : 'FAILED',
          sentByUserId: senderId,
          channel: 'SMS',
          sentAt: new Date(r.sentAt || Date.now()),
        })),
      });
      logger.info(`✅ Synced ${recipients.length} recipients to audit logs`);
    }
  } catch (auditError) {
    logger.error('❌ Failed to sync broadcast to audit logs:', auditError);
  }

  logger.info(`✅ Broadcast campaign saved: ${campaign.id}`);

  res.status(201).json({
    success: true,
    message: 'Broadcast campaign saved successfully',
    campaignId: campaign.id,
    data: campaign,
  });
};

/**
 * Get Broadcast History
 * GET /api/broadcasts
 */
export const getBroadcastHistory = async (req: AuthRequest, res: Response) => {
  const { limit = 50, offset = 0 } = req.query;

  const campaigns = await broadcastPrisma.broadcastCampaign.findMany({
    where: {},
    orderBy: { sentAt: 'desc' },
    take: parseInt(limit as string) || 50,
    skip: parseInt(offset as string) || 0,
    include: {
      recipients: {
        select: {
          recipientPhone: true,
          status: true,
          messageId: true,
          sentAt: true,
          failureReason: true,
        },
        take: 10,
      },
    },
  });

  const total = await broadcastPrisma.broadcastCampaign.count({ where: {} });

  res.status(200).json({
    success: true,
    data: campaigns,
    pagination: {
      total,
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
      hasMore: (parseInt(offset as string) || 0) + (parseInt(limit as string) || 50) < total,
    },
  });
};

/**
 * Get Broadcast Campaign Details
 * GET /api/broadcasts/:campaignId
 */
export const getBroadcastDetails = async (req: AuthRequest, res: Response) => {
  const { campaignId } = req.params;

  const campaign = await broadcastPrisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: { orderBy: { sentAt: 'desc' } },
      deliveryLogs: { orderBy: { sentAt: 'desc' }, take: 100 },
    },
  });

  if (!campaign) throw new ApiError(404, 'Broadcast campaign not found');

  res.status(200).json({ success: true, data: campaign });
};

/**
 * Get Broadcast Statistics
 * GET /api/broadcasts/stats
 */
export const getBroadcastStats = async (req: AuthRequest, res: Response) => {
  const [totalBroadcasts, totalRecipients, totalSuccessful, totalFailed, recentCampaigns] =
    await Promise.all([
      broadcastPrisma.broadcastCampaign.count({ where: {} }),
      broadcastPrisma.broadcastCampaign.aggregate({ where: {}, _sum: { totalRecipients: true } }),
      broadcastPrisma.broadcastCampaign.aggregate({ where: {}, _sum: { successCount: true } }),
      broadcastPrisma.broadcastCampaign.aggregate({ where: {}, _sum: { failedCount: true } }),
      broadcastPrisma.broadcastCampaign.findMany({
        where: {},
        orderBy: { sentAt: 'desc' },
        take: 5,
        select: {
          id: true,
          messagePreview: true,
          sentAt: true,
          totalRecipients: true,
          successCount: true,
          failedCount: true,
        },
      }),
    ]);

  res.status(200).json({
    success: true,
    data: {
      totalBroadcasts,
      totalRecipients: totalRecipients._sum.totalRecipients || 0,
      totalSuccessful: totalSuccessful._sum.successCount || 0,
      totalFailed: totalFailed._sum.failedCount || 0,
      successRate: totalRecipients._sum.totalRecipients
        ? Math.round(
            ((totalSuccessful._sum.successCount || 0) /
              (totalRecipients._sum.totalRecipients || 1)) *
              100
          )
        : 0,
      recentCampaigns,
    },
  });
};

/**
 * Save SMS Delivery Log Entry
 * POST /api/broadcasts/:campaignId/delivery-logs
 */
export const saveSmsDeliveryLog = async (req: AuthRequest, res: Response) => {
  const { campaignId } = req.params;
  const { recipientPhone, message, provider, providerId, status, statusCode, errorDetails } =
    req.body;

  if (!campaignId) throw new ApiError(400, 'Missing required fields');

  // Verify campaign exists (throws P2025 if not found — let errorHandler catch it)
  await broadcastPrisma.broadcastCampaign.findUniqueOrThrow({ where: { id: campaignId } });

  const log = await broadcastPrisma.smsDeliveryLog.create({
    data: {
      campaignId,
      recipientPhone,
      message: message.substring(0, 255),
      messageLength: message.length,
      provider,
      providerId: providerId || null,
      status,
      statusCode: statusCode || null,
      errorDetails: errorDetails || null,
      sentAt: new Date(),
    },
  });

  res.status(201).json({ success: true, data: log });
};

/**
 * Delete Broadcast Campaign
 * DELETE /api/broadcasts/:campaignId
 */
export const deleteBroadcastCampaign = async (req: AuthRequest, res: Response) => {
  const { campaignId } = req.params;

  const campaign = await broadcastPrisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new ApiError(404, 'Campaign not found');

  await broadcastPrisma.broadcastCampaign.delete({ where: { id: campaignId } });

  logger.info(`✅ Broadcast campaign deleted: ${campaignId}`);

  res.status(200).json({ success: true, message: 'Broadcast campaign deleted successfully' });
};

/**
 * Send Bulk Broadcast
 * POST /api/broadcasts/send-bulk
 */
export const sendBulkBroadcast = async (req: AuthRequest, res: Response) => {
  const {
    channel = 'sms',
    recipients, // Array of { phone, name, message, studentName, grade, id (learnerId) }
    messageTemplate,
    messagePreview,
    recipientSource,
  } = req.body;

  const senderId = req.user?.userId || (req as any).user?.id;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new ApiError(400, 'Recipients array is required');
  }

  logger.info(
    `🚀 [BroadcastController] Starting bulk ${channel} send to ${recipients.length} recipients`
  );

  let sentCount = 0;
  let failedCount = 0;
  let sendResults: any[] = [];

  if (channel.toLowerCase() === 'whatsapp') {
    const { whatsappService } = await import('../services/whatsapp.service');
    const bulkResult = await whatsappService.sendBulkMessages(
      recipients.map((r: any) => ({ phone: r.phone, message: r.message }))
    );
    sentCount = bulkResult.sent;
    failedCount = bulkResult.failed;
    sendResults = bulkResult.results;
  } else {
    const { SmsService } = await import('../services/sms.service');
    const bulkResult = await SmsService.sendBulkSms(
      recipients.map((r: any) => ({ phone: r.phone, message: r.message }))
    );
    sentCount = bulkResult.sent;
    failedCount = bulkResult.failed;
    sendResults = bulkResult.results;
  }

  const recipientResults = recipients.map((recipient: any, index: number) => {
    const result = sendResults.find((entry: any) => entry.phone === recipient.phone) || sendResults[index];
    return {
      phone: recipient.phone,
      success: Boolean(result?.success),
      messageId: result?.messageId || undefined,
      error: result?.error || undefined,
    };
  });

  const campaign = await broadcastPrisma.broadcastCampaign.create({
    data: {
      senderId,
      messagePreview: (messagePreview || recipients[0].message).substring(0, 150),
      messageTemplate: messageTemplate || 'Bulk Send',
      totalRecipients: recipients.length,
      successCount: sentCount,
      failedCount: failedCount,
      recipientSource: recipientSource || 'BULK_API',
      messageChannel: channel.toUpperCase(),
      sentAt: new Date(),
      // Provider acceptance is not the same as a confirmed delivery receipt.
      // Only mark the campaign SENT/FAILED until a provider DLR callback updates it.
      status: sentCount > 0 ? 'SENT' : 'FAILED',
      recipients: {
        createMany: {
          data: recipients.map((r: any, idx: number) => {
            const sendResult = recipientResults[idx];
            return {
              recipientPhone: r.phone,
              recipientName: r.name || 'Recipient',
              status: sendResult?.success ? 'SENT' : 'FAILED',
              messageId: sendResult?.messageId || null,
              sentAt: new Date(),
              failureReason: sendResult?.error || null,
            };
          }),
        },
      },
    },
  });

  // Sync to Audit logs — non-blocking
  try {
    await prisma.assessmentSmsAudit.createMany({
      data: recipients.map((r: any, idx: number) => {
        const sendResult =
          sendResults.find((sr: any) => sr.phone === r.phone) || sendResults[idx];
        return {
          learnerId: r.id || null,
          parentPhone: r.phone,
          parentName: r.name || 'Parent',
          learnerName: r.studentName || r.name || 'Student',
          learnerGrade: r.grade || 'N/A',
          assessmentType: 'BROADCAST',
          templateType: 'GENERAL',
          messageContent: r.message,
          smsStatus: sendResult?.success ? 'SENT' : 'FAILED',
          sentByUserId: senderId,
          channel: channel.toUpperCase() as any,
          sentAt: new Date(),
        };
      }),
    });
  } catch (auditError) {
    logger.error('❌ Failed to sync bulk broadcast to audit logs:', auditError);
  }

  res.status(200).json({
    success: true,
    message: `Bulk ${channel} processed: ${sentCount} sent, ${failedCount} failed`,
    campaignId: campaign.id,
    sentCount,
    failedCount,
    results: recipientResults,
  });
};
