/**
 * Fee Waiver Controller
 *
 * Fixes vs previous version:
 *  - SmsService: consolidated to static SmsService.sendSms() throughout.
 *    The previous version instantiated `new SmsService()` and called
 *    `this.smsService.sendSMS()` (wrong method name, instance vs static),
 *    while fee.controller.ts used the correct `SmsService.sendSms()` static.
 *  - EmailService: removed `new EmailService()` instance — all email calls
 *    now use `EmailService.sendNotificationEmail()` static.
 *  - Accounting: `postFeeWaiverToLedger()` (already in accounting.service)
 *    replaces the removed `recordTransaction()` call that referenced a
 *    non-existent method.
 *  - On full-waiver approval (newBalance === 0), invoice status is set to
 *    WAIVED (wiring up the previously-dead WAIVED PaymentStatus enum value)
 *    rather than PAID, to accurately distinguish paid-in-full from waived.
 *
 * FIX (Task 2 — P1): Added cumulative waiver balance guard in approveWaiver().
 *  Before applying a waiver, the sum of all existing APPROVED waivers for the
 *  invoice is checked. If adding the new waiver would exceed invoice.totalAmount,
 *  the request is rejected with a clear error message.
 *  This prevents two or more independently-approved waivers from together
 *  cancelling more than the student actually owes.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email.service';
import { whatsappService } from '../services/whatsapp.service';
import { accountingService } from '../services/accounting.service';
import { NotificationService, NotificationType } from '../services/notification.service';

import logger from '../utils/logger';
export class FeeWaiverController {

  // ─── Create ──────────────────────────────────────────────────────────────

  async createWaiver(req: AuthRequest, res: Response) {
    const { invoiceId, amountWaived, reason, waiverCategory } = req.body;
    const userId = req.user?.userId;

    if (!userId) throw new ApiError(401, 'User not authenticated');
    if (!invoiceId || !amountWaived || !reason) {
      throw new ApiError(400, 'Missing required fields: invoiceId, amountWaived, reason');
    }

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: invoiceId },
      include: { learner: { include: { parent: true } } }
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const amount = typeof amountWaived === 'string' ? parseFloat(amountWaived) : amountWaived;
    if (amount <= 0) throw new ApiError(400, 'Amount waived must be greater than 0');
    if (amount > Number(invoice.balance)) {
      throw new ApiError(400, 'Waiver amount cannot exceed outstanding balance');
    }

    const waiver = await prisma.feeWaiver.create({
      data: {
        invoiceId,
        amountWaived: amount,
        reason,
        waiverCategory: waiverCategory || 'OTHER',
        status: 'PENDING',
        createdById: userId
      },
      include: {
        invoice: { include: { learner: { include: { parent: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    // Best-effort notification to school office
    setImmediate(() => this.notifyWaiverRequested(waiver));

    res.status(201).json({
      success: true,
      data: waiver,
      message: 'Fee waiver request created successfully'
    });
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async listWaivers(req: AuthRequest, res: Response) {
    const { status, invoiceId, learnerId, waiverCategory, page = '1', limit = '20' } = req.query;
    const where: any = { archived: false };

    if (status && status !== 'undefined' && status !== 'ALL') {
      where.status = status;
    }
    if (invoiceId)      where.invoiceId = invoiceId;
    if (waiverCategory) where.waiverCategory = waiverCategory;

    if (learnerId) {
      return this.listWaiversByLearner(req, res, learnerId as string);
    }

    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [waivers, total] = await Promise.all([
      prisma.feeWaiver.findMany({
        where,
        include: {
          invoice: { include: { learner: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.feeWaiver.count({ where })
    ]);

    res.json({
      success: true,
      data: { waivers, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } }
    });
  }

  private async listWaiversByLearner(req: AuthRequest, res: Response, learnerId: string) {
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;
    const where: any = { invoice: { learnerId }, archived: false };
    if (status && status !== 'undefined' && status !== 'ALL') {
      where.status = status;
    }

    const [waivers, total] = await Promise.all([
      prisma.feeWaiver.findMany({
        where,
        include: {
          invoice: { include: { learner: true } },
          createdBy:  { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.feeWaiver.count({ where })
    ]);

    res.json({
      success: true,
      data: { waivers, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } }
    });
  }

  // ─── Get by ID ────────────────────────────────────────────────────────────

  async getWaiverById(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const waiver = await prisma.feeWaiver.findUnique({
      where: { id },
      include: {
        invoice: { include: { learner: { include: { parent: true } } } },
        createdBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    if (!waiver) throw new ApiError(404, 'Fee waiver not found');
    res.json({ success: true, data: waiver });
  }

  // ─── Approve ──────────────────────────────────────────────────────────────

  async approveWaiver(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'User not authenticated');

    const waiver = await prisma.feeWaiver.findUnique({
      where: { id },
      include: {
        invoice: { include: { learner: { include: { parent: true } } } },
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });
    if (!waiver) throw new ApiError(404, 'Fee waiver not found');
    if (waiver.status !== 'PENDING') throw new ApiError(400, `Cannot approve waiver with status: ${waiver.status}`);

    // ── CUMULATIVE WAIVER GUARD (Task 2 — P1) ───────────────────────────────
    // Sum all already-APPROVED waivers for this invoice to prevent multiple
    // independently-approved waivers from together exceeding the invoice total.
    const approvedAggregate = await prisma.feeWaiver.aggregate({
      where: {
        invoiceId: waiver.invoiceId,
        status: 'APPROVED',
        archived: false,
        id: { not: id }          // exclude the current waiver being approved
      },
      _sum: { amountWaived: true }
    });

    const alreadyWaived = Number(approvedAggregate._sum.amountWaived ?? 0);
    const thisWaiverAmount = Number(waiver.amountWaived);
    const newWaivedTotal = alreadyWaived + thisWaiverAmount;
    const invoiceTotal = Number(waiver.invoice.totalAmount);

    if (newWaivedTotal > invoiceTotal) {
      throw new ApiError(
        400,
        `Cannot approve: cumulative waivers (KES ${newWaivedTotal.toLocaleString()}) ` +
        `would exceed invoice total of KES ${invoiceTotal.toLocaleString()}. ` +
        `Already approved: KES ${alreadyWaived.toLocaleString()}.`
      );
    }
    // ────────────────────────────────────────────────────────────────────────

    const [updatedWaiver, updatedInvoice] = await prisma.$transaction(async (tx) => {
      const approved = await tx.feeWaiver.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
        include: {
          invoice: { include: { learner: { include: { parent: true } } } },
          approvedBy: { select: { firstName: true, lastName: true } }
        }
      });

      // Re-read inside transaction to avoid stale balance
      const fresh = await tx.feeInvoice.findUnique({
        where: { id: waiver.invoiceId },
        select: { balance: true, paidAmount: true, totalAmount: true }
      });

      const newBalance = Math.max(0, Number(fresh!.balance) - thisWaiverAmount);

      // FIX: use WAIVED when the invoice is fully cleared by a waiver,
      // rather than PAID — keeping the two cases distinguishable in reports.
      let newStatus: string;
      if (newBalance <= 0) {
        newStatus = Number(fresh!.paidAmount) > 0 ? 'PAID' : 'WAIVED';
      } else if (Number(fresh!.paidAmount) > 0) {
        newStatus = 'PARTIAL';
      } else {
        newStatus = 'PENDING';
      }

      const inv = await tx.feeInvoice.update({
        where: { id: waiver.invoiceId },
        data: { balance: newBalance, status: newStatus as any }
      });

      return [approved, inv];
    });

    // Accounting entry (best-effort)
    try {
      await accountingService.postFeeWaiverToLedger(updatedWaiver);
    } catch (err) {
      logger.error('[FeeWaiver] Failed to post waiver to ledger:', err);
    }

    setImmediate(() => this.notifyWaiverApproved(updatedWaiver, Number(updatedInvoice.balance)));

    res.json({ success: true, data: updatedWaiver, message: 'Fee waiver approved successfully' });
  }

  // ─── Reject ───────────────────────────────────────────────────────────────

  async rejectWaiver(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const userId = req.user?.userId;

    if (!userId) throw new ApiError(401, 'User not authenticated');
    if (!rejectionReason) throw new ApiError(400, 'rejectionReason is required');

    const waiver = await prisma.feeWaiver.findUnique({
      where: { id },
      include: { invoice: { include: { learner: { include: { parent: true } } } } }
    });
    if (!waiver) throw new ApiError(404, 'Fee waiver not found');
    if (waiver.status !== 'PENDING') throw new ApiError(400, `Cannot reject waiver with status: ${waiver.status}`);

    const updatedWaiver = await prisma.feeWaiver.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason, approvedById: userId, approvedAt: new Date() },
      include: {
        invoice: { include: { learner: { include: { parent: true } } } },
        approvedBy: { select: { firstName: true, lastName: true } }
      }
    });

    setImmediate(() => this.notifyWaiverRejected(updatedWaiver));

    res.json({ success: true, data: updatedWaiver, message: 'Fee waiver rejected successfully' });
  }

  // ─── Delete (soft) ────────────────────────────────────────────────────────

  async deleteWaiver(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const waiver = await prisma.feeWaiver.findUnique({ where: { id } });
    if (!waiver) throw new ApiError(404, 'Fee waiver not found');
    await prisma.feeWaiver.update({ where: { id }, data: { archived: true } });
    res.json({ success: true, message: 'Fee waiver archived successfully' });
  }

  // ─── Private notification helpers ─────────────────────────────────────────
  // All SMS calls use the static SmsService.sendSms() (FIX: was mixing instance
  // method sendSMS() with static sendSms(), causing silent failures).

  private async notifyWaiverRequested(waiver: any) {
    try {
      const school = await prisma.school.findFirst();
      if (!school) return;

      const learnerName = `${waiver.invoice.learner.firstName} ${waiver.invoice.learner.lastName}`;
      const message = `Fee waiver request received: KES ${Number(waiver.amountWaived).toLocaleString()} for ${learnerName}. Reason: ${waiver.reason}`;

      if (school.phone) {
        await SmsService.sendSms(school.phone, message);
      }
      if ((school as any).whatsappNumber) {
        await whatsappService.sendMessage({ to: (school as any).whatsappNumber, message });
      }
      if (school.email) {
        await EmailService.sendNotificationEmail({
          to: school.email,
          subject: 'New Fee Waiver Request',
          html: `
            <h2>New Fee Waiver Request</h2>
            <p>A waiver has been requested for <b>${learnerName}</b>.</p>
            <ul>
              <li><b>Amount:</b> KES ${Number(waiver.amountWaived).toLocaleString()}</li>
              <li><b>Reason:</b> ${waiver.reason}</li>
              <li><b>Invoice:</b> ${waiver.invoice.invoiceNumber}</li>
            </ul>
            <p>Log in to review and approve or reject this request.</p>
          `
        });
      }

      // Internal System Alert for Admins
      await NotificationService.notifyRoles(['ADMIN', 'SUPER_ADMIN', 'HEAD_TEACHER'], {
        title: 'New Waiver Request',
        message: `KES ${Number(waiver.amountWaived).toLocaleString()} requested for ${learnerName}`,
        type: NotificationType.WAIVER,
        link: '/finance/fees'
      });
    } catch (err) {
      logger.error('[FeeWaiver] Failed to notify waiver requested:', err);
    }
  }

  private async notifyWaiverApproved(waiver: any, newBalance: number) {
    try {
      const parent = waiver.invoice?.learner?.parent;
      const school = await prisma.school.findFirst();
      if (!parent) return;

      const message = `Good news! Your fee waiver of KES ${Number(waiver.amountWaived).toLocaleString()} for ${waiver.invoice.learner.firstName} has been approved. New balance: KES ${newBalance.toLocaleString()}.`;

      if (parent.phone) {
        await SmsService.sendSms(parent.phone, message);
      }
      if ((parent as any).whatsappPhone) {
        await whatsappService.sendMessage({ to: (parent as any).whatsappPhone, message });
      }
      if (parent.email) {
        await EmailService.sendNotificationEmail({
          to: parent.email,
          subject: 'Fee Waiver Approved',
          html: `
            <h2>Fee Waiver Approved</h2>
            <p>Dear ${parent.firstName},</p>
            <p>A fee waiver of <b>KES ${Number(waiver.amountWaived).toLocaleString()}</b> has been approved for <b>${waiver.invoice.learner.firstName}</b>.</p>
            <p><b>Updated balance:</b> KES ${newBalance.toLocaleString()}</p>
            <p>${school?.name || 'School Management'}</p>
          `
        });
      }

      // Internal System Alert for the staff member who requested it
      if (waiver.createdById) {
        await NotificationService.createNotification({
          userId: waiver.createdById,
          title: 'Waiver Approved',
          message: `Your request of KES ${Number(waiver.amountWaived).toLocaleString()} for ${waiver.invoice.learner.firstName} was approved.`,
          type: NotificationType.SUCCESS,
          link: '/finance/fees'
        });
      }
    } catch (err) {
      logger.error('[FeeWaiver] Failed to notify waiver approved:', err);
    }
  }

  private async notifyWaiverRejected(waiver: any) {
    try {
      const parent = waiver.invoice?.learner?.parent;
      const school = await prisma.school.findFirst();
      if (!parent) return;

      const message = `Your fee waiver request of KES ${Number(waiver.amountWaived).toLocaleString()} for ${waiver.invoice.learner.firstName} has been declined. Reason: ${waiver.rejectionReason}`;

      if (parent.phone) {
        await SmsService.sendSms(parent.phone, message);
      }
      if ((parent as any).whatsappPhone) {
        await whatsappService.sendMessage({ to: (parent as any).whatsappPhone, message });
      }
      if (parent.email) {
        await EmailService.sendNotificationEmail({
          to: parent.email,
          subject: 'Fee Waiver Declined',
          html: `
            <h2>Fee Waiver Declined</h2>
            <p>Dear ${parent.firstName},</p>
            <p>Your waiver request of <b>KES ${Number(waiver.amountWaived).toLocaleString()}</b> for <b>${waiver.invoice.learner.firstName}</b> was declined.</p>
            <p><b>Reason:</b> ${waiver.rejectionReason}</p>
            <p>Contact the school office if you have questions.</p>
            <p>${school?.name || 'School Management'}</p>
          `
        });
      }

      // Internal System Alert for the staff member who requested it
      if (waiver.createdById) {
        await NotificationService.createNotification({
          userId: waiver.createdById,
          title: 'Waiver Rejected',
          message: `Your request of KES ${Number(waiver.amountWaived).toLocaleString()} for ${waiver.invoice.learner.firstName} was declined.`,
          type: NotificationType.ERROR,
          link: '/finance/fees'
        });
      }
    } catch (err) {
      logger.error('[FeeWaiver] Failed to notify waiver rejected:', err);
    }
  }
}

export const feeWaiverController = new FeeWaiverController();
