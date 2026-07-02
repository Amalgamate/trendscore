/**
 * Fee Comments & Pledges Controller
 * server/src/controllers/feeComments.controller.ts
 *
 * Handles:
 *  - GET    /fees/invoices/:id/comments        list comments + pledges
 *  - POST   /fees/invoices/:id/comments        add a note / call-log
 *  - POST   /fees/invoices/:id/pledges         record a pledge
 *  - PATCH  /fees/pledges/:pledgeId/cancel     cancel a pledge
 *  - PATCH  /fees/pledges/:pledgeId/fulfil     manually mark fulfilled
 *
 * FIX (Task 1 — P1): Removed all (prisma as any) casts.
 * FeeComment and FeePledge are confirmed present in the Prisma schema and
 * generated client, so typed prisma.feeComment / prisma.feePledge are safe.
 * This restores full compile-time type-checking on all queries in this file.
 */

import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { pledgeReminderService } from '../services/pledgeReminder.service';

export class FeeCommentsController {
  /**
   * GET /fees/pledges
   * Lists pledges across all invoices for pledge management.
   */
  async listPledges(req: AuthRequest, res: Response) {
    const {
      status = 'ACTIVE',
      window = 'all',
      search = '',
      limit = '300'
    } = req.query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const where: any = {
      archived: false,
      invoice: { archived: false }
    };

    const statusValue = String(status || '').toUpperCase();
    if (statusValue === 'ACTIVE') {
      where.status = { in: ['PENDING', 'DUE'] };
    } else if (statusValue && statusValue !== 'ALL') {
      where.status = statusValue;
    }

    const windowValue = String(window || 'all').toLowerCase();
    if (windowValue === 'today') {
      where.pledgeDate = { gte: today, lt: tomorrow };
    } else if (windowValue === 'this_week') {
      where.pledgeDate = { gte: today, lte: weekEnd };
    } else if (windowValue === 'overdue') {
      where.pledgeDate = { lt: today };
      where.status = { in: ['PENDING', 'DUE'] };
    } else if (windowValue === 'upcoming') {
      where.pledgeDate = { gt: weekEnd };
      where.status = { in: ['PENDING'] };
    }

    const searchText = String(search || '').trim();
    if (searchText) {
      where.OR = [
        { invoice: { invoiceNumber: { contains: searchText, mode: 'insensitive' } } },
        { invoice: { learner: { firstName: { contains: searchText, mode: 'insensitive' } } } },
        { invoice: { learner: { lastName: { contains: searchText, mode: 'insensitive' } } } },
        { invoice: { learner: { admissionNumber: { contains: searchText, mode: 'insensitive' } } } },
        { invoice: { learner: { guardianName: { contains: searchText, mode: 'insensitive' } } } },
        { invoice: { learner: { guardianPhone: { contains: searchText, mode: 'insensitive' } } } }
      ];
    }

    const take = Math.min(Math.max(Number(limit) || 300, 1), 500);

    const pledges = await prisma.feePledge.findMany({
      where,
      take,
      orderBy: [{ pledgeDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            term: true,
            academicYear: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
            status: true,
            dueDate: true,
            learner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                grade: true,
                stream: true,
                guardianName: true,
                guardianPhone: true,
                guardianEmail: true,
                parent: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } }
              }
            }
          }
        }
      }
    });

    const summary = pledges.reduce((acc: any, pledge) => {
      const amount = Number(pledge.pledgedAmount || 0);
      const pledgeDate = new Date(pledge.pledgeDate);
      const active = pledge.status === 'PENDING' || pledge.status === 'DUE';

      acc.total += 1;
      acc.amount += amount;
      acc.byStatus[pledge.status] = (acc.byStatus[pledge.status] || 0) + 1;

      if (active) {
        acc.active += 1;
        acc.activeAmount += amount;
      }
      if (active && pledgeDate >= today && pledgeDate <= weekEnd) {
        acc.thisWeek += 1;
        acc.thisWeekAmount += amount;
      }
      if (active && pledgeDate < today) {
        acc.overdue += 1;
        acc.overdueAmount += amount;
      }
      if (pledge.reminderCount > 0) {
        acc.reminded += 1;
      }
      return acc;
    }, {
      total: 0,
      amount: 0,
      active: 0,
      activeAmount: 0,
      thisWeek: 0,
      thisWeekAmount: 0,
      overdue: 0,
      overdueAmount: 0,
      reminded: 0,
      byStatus: {}
    });

    res.json({ success: true, data: { pledges, summary } });
  }

  /**
   * POST /fees/pledges/reminders/run
   * Runs the same pledge reminder automation used by the daily cron.
   */
  async runPledgeReminderCheck(_req: AuthRequest, res: Response) {
    const result = await pledgeReminderService.runDailyCheck();
    res.json({ success: true, data: result, message: 'Pledge reminder automation completed' });
  }

  /**
   * GET /fees/invoices/:id/comments
   * Returns all comments and pledges for an invoice, newest first.
   */
  async listComments(req: AuthRequest, res: Response) {
    const { id } = req.params;

    const invoice = await prisma.feeInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const [comments, pledges, payments] = await Promise.all([
      prisma.feeComment.findMany({
        where: { invoiceId: id, archived: false },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.feePledge.findMany({
        where: { invoiceId: id, archived: false },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.feePayment.findMany({
        where: { invoiceId: id, archived: false },
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          paymentDate: true,
          amount: true,
          paymentMethod: true,
          referenceNumber: true,
          receiptNumber: true
        }
      })
    ]);

    res.json({ success: true, data: { comments, pledges, payments } });
  }

  /**
   * POST /fees/invoices/:id/comments
   * Body: { type: 'NOTE' | 'CALL_LOG', body: string, isInternal?: boolean }
   */
  async addComment(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { type = 'NOTE', body, isInternal = true } = req.body;
    const userId = req.user!.userId;

    if (!body || !body.trim()) throw new ApiError(400, 'Comment body is required');

    const invoice = await prisma.feeInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const comment = await prisma.feeComment.create({
      data: {
        invoiceId: id,
        type,
        body: body.trim(),
        isInternal,
        createdById: userId
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });

    res.status(201).json({ success: true, data: comment });
  }

  /**
   * POST /fees/invoices/:id/pledges
   * Body: { pledgedAmount: number, pledgeDate: string, notes?: string }
   *
   * Creates both a FeePledge record AND a linked FeeComment of type PLEDGE
   * so the timeline stays unified.
   */
  async addPledge(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { pledgedAmount, pledgeDate, notes } = req.body;
    const userId = req.user!.userId;

    if (!pledgedAmount || !pledgeDate) {
      throw new ApiError(400, 'pledgedAmount and pledgeDate are required');
    }

    const amount = Number(pledgedAmount);
    if (isNaN(amount) || amount <= 0) throw new ApiError(400, 'pledgedAmount must be a positive number');

    const invoice = await prisma.feeInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'PAID') throw new ApiError(400, 'Invoice is already fully paid');

    const parsedDate = new Date(pledgeDate);
    if (isNaN(parsedDate.getTime())) throw new ApiError(400, 'Invalid pledgeDate format');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the comment for the timeline
      const commentBody = notes
        ? `Pledged KES ${amount.toLocaleString()} by ${parsedDate.toLocaleDateString('en-GB')}. Note: ${notes}`
        : `Pledged KES ${amount.toLocaleString()} by ${parsedDate.toLocaleDateString('en-GB')}.`;

      const comment = await tx.feeComment.create({
        data: {
          invoiceId: id,
          type: 'PLEDGE',
          body: commentBody,
          isInternal: true,
          createdById: userId
        }
      });

      // 2. Create the pledge record linked to the comment
      const pledge = await tx.feePledge.create({
        data: {
          invoiceId: id,
          commentId: comment.id,
          pledgedAmount: amount,
          pledgeDate: parsedDate,
          status: 'PENDING',
          createdById: userId
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      return { comment, pledge };
    });

    res.status(201).json({ success: true, data: result });
  }

  /**
   * PATCH /fees/pledges/:pledgeId/cancel
   * Body: { reason?: string }
   */
  async cancelPledge(req: AuthRequest, res: Response) {
    const { pledgeId } = req.params;
    const { reason } = req.body;

    const pledge = await prisma.feePledge.findUnique({ where: { id: pledgeId } });
    if (!pledge) throw new ApiError(404, 'Pledge not found');
    if (pledge.status === 'FULFILLED') throw new ApiError(400, 'Cannot cancel a fulfilled pledge');
    if (pledge.status === 'CANCELLED') throw new ApiError(400, 'Pledge is already cancelled');

    const updated = await prisma.feePledge.update({
      where: { id: pledgeId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || null
      }
    });

    res.json({ success: true, data: updated });
  }

  /**
   * PATCH /fees/pledges/:pledgeId/fulfil
   * Manually marks a pledge as fulfilled (e.g. if payment was recorded separately)
   */
  async fulfilPledge(req: AuthRequest, res: Response) {
    const { pledgeId } = req.params;

    const pledge = await prisma.feePledge.findUnique({ where: { id: pledgeId } });
    if (!pledge) throw new ApiError(404, 'Pledge not found');
    if (pledge.status === 'FULFILLED') throw new ApiError(400, 'Pledge already fulfilled');
    if (pledge.status === 'CANCELLED') throw new ApiError(400, 'Cannot fulfil a cancelled pledge');

    const updated = await prisma.feePledge.update({
      where: { id: pledgeId },
      data: { status: 'FULFILLED', fulfilledAt: new Date() }
    });

    res.json({ success: true, data: updated });
  }
}

export const feeCommentsController = new FeeCommentsController();
