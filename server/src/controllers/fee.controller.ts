/**
 * Fee Management Controller
 * Handles fee structures, invoices, and payments for a single-tenant environment
 *
 * Fixes applied:
 *  1. Transport amount now uses resolveTransportAmount() from fee.service — single source of truth
 *     shared with the auto-generation path (was diverging between service and controller).
 *  2. getAllInvoices pagination guard: pages/limit are safe when limit='all'.
 *  3. FeeStructure.grade / .term treated as optional throughout (schema allows Grade? / Term?).
 *  4. WAIVED and CANCELLED PaymentStatus values are now wired up:
 *       - cancelInvoice() sets status → CANCELLED
 *       - (WAIVED is applied by feeWaiver.controller on full-waiver approval)
 *  5. SmsService calls are all via the static sendSms() — no instance-method divergence.
 *  6. updateInvoice() added (Task 3 — P2): PATCH /invoices/:id allows editing
 *     dueDate and adjusting totalAmount/balance before any payment is recorded.
 *  7. recordPayment() now returns receiptData in the response (Task 4 — P2):
 *     a structured payload that the frontend can use to render/download a PDF receipt,
 *     since server-side PDF generation is deprecated on the current hosting environment.
 */

import { Response } from 'express';
import { PaymentStatus } from '@prisma/client';
import prisma from '../config/database';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { SmsService } from '../services/sms.service';
import { whatsappService } from '../services/whatsapp.service';
import { accountingService } from '../services/accounting.service';
import { complianceService } from '../services/compliance.service';
import { EmailService } from '../services/email.service';
import { calculateLearnerInvoice } from '../services/learnerFeeConfiguration.service';
import { parentAccessService } from '../services/parent-access.service';
import { getInstitutionType } from '../utils/institutionNormalizer';

import logger from '../utils/logger';
function normalizeEnumValue(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  return normalized
    .replace(/GRADE[_-]?(\d+)/, 'GRADE_$1')
    .replace(/TERM[_-]?(\d+)/, 'TERM_$1');
}

const INVOICE_NUMBER_RETRY_COUNT = 3;
const RECEIPT_NUMBER_RETRY_COUNT = 3;

function getPreviousTermContext(termRaw: string, academicYearRaw: number): { term: string; academicYear: number } | null {
  const term = normalizeEnumValue(termRaw);
  const academicYear = Number(academicYearRaw);
  if (!term || !academicYear) return null;
  if (term === 'TERM_2') return { term: 'TERM_1', academicYear };
  if (term === 'TERM_3') return { term: 'TERM_2', academicYear };
  if (term === 'TERM_1') return { term: 'TERM_3', academicYear: academicYear - 1 };
  return null;
}

const SECONDARY_GRADE_CODES = ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FORM_1', 'FORM_2', 'FORM_3', 'FORM_4'] as const;

function applyInvoiceInstitutionScope(req: AuthRequest, whereClause: any = {}) {
  const institutionType = getInstitutionType(req);
  const learnerFilter: any = { archived: false, status: 'ACTIVE' };

  // If the query already filters by a specific grade, we use it, otherwise apply scope
  if (whereClause.learner?.grade) {
    learnerFilter.grade = whereClause.learner.grade;
  } else {
    if (institutionType === 'SECONDARY') {
      learnerFilter.OR = [
        { grade: { in: [...SECONDARY_GRADE_CODES] as any } },
        { grade: { startsWith: 'FORM' } }
      ];
    } else {
      learnerFilter.NOT = {
        OR: [
          { grade: { in: [...SECONDARY_GRADE_CODES] as any } },
          { grade: { startsWith: 'FORM' } }
        ]
      };
    }
  }

  whereClause.learner = {
    ...(whereClause.learner || {}),
    ...learnerFilter
  };

  return whereClause;
}


function parseInvoiceNumber(raw: string | null): number {
  if (!raw) return 0;
  const match = raw.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getNextInvoiceNumber(client: any, academicYear: number): Promise<string> {
  const result = await client.feeInvoice.aggregate({
    _max: { invoiceNumber: true },
    where: { academicYear }
  });
  const currentMax = result._max.invoiceNumber as string | null;
  const nextSequence = parseInvoiceNumber(currentMax) + 1;
  return `INV-${academicYear}-${String(nextSequence).padStart(6, '0')}`;
}

async function createInvoiceWithSafeNumber(client: any, invoiceData: any, include: any): Promise<any> {
  let lastError: any;
  for (let attempt = 1; attempt <= INVOICE_NUMBER_RETRY_COUNT; attempt++) {
    const invoiceNumber = await getNextInvoiceNumber(client, invoiceData.academicYear);
    try {
      return await client.feeInvoice.create({
        data: { ...invoiceData, invoiceNumber },
        include
      });
    } catch (error: any) {
      lastError = error;
      if (error?.code === 'P2002' && attempt < INVOICE_NUMBER_RETRY_COUNT) continue;
      throw error;
    }
  }
  throw lastError;
}

export class FeeController {
  // ─── Fee Structures ────────────────────────────────────────────────────────

  async getAllFeeStructures(req: AuthRequest, res: Response) {
    const { academicYear, term, grade, active } = req.query;
    const where: any = {};

    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (term) where.term = normalizeEnumValue(term as string) || term;
    if (grade) where.grade = normalizeEnumValue(grade as string) || grade;
    if (active !== undefined) where.active = active === 'true';

    const feeStructures = await prisma.feeStructure.findMany({
      where,
      include: { feeItems: { include: { feeType: true } } } as any,
      orderBy: [{ academicYear: 'desc' }, { term: 'asc' }, { grade: 'asc' }]
    });

    res.json({ success: true, data: feeStructures, count: feeStructures.length });
  }

  async createFeeStructure(req: AuthRequest, res: Response) {
    const { name, description, feeItems, grade, term, academicYear, mandatory, active } = req.body;
    const userId = req.user!.userId;

    // grade and term are optional (a school-wide structure has neither)
    const normalizedGrade = grade ? (normalizeEnumValue(grade) || grade) : null;
    const normalizedTerm  = term  ? (normalizeEnumValue(term)  || term)  : null;

    if (!name || !feeItems || !Array.isArray(feeItems) || feeItems.length === 0 || !academicYear) {
      throw new ApiError(400, 'Missing required fields: name, feeItems, academicYear');
    }

    const existing = await prisma.feeStructure.findFirst({
      where: {
        name,
        academicYear,
        ...(normalizedTerm  ? { term: normalizedTerm as any }   : { term: null  as any }),
        ...(normalizedGrade ? { grade: normalizedGrade as any } : { grade: null as any })
      }
    });
    if (existing) throw new ApiError(400, 'Fee structure already exists for this period');

    const feeStructure = await prisma.feeStructure.create({
      data: {
        name,
        description,
        grade: normalizedGrade as any,
        term: normalizedTerm as any,
        academicYear,
        mandatory: mandatory !== undefined ? mandatory : true,
        active: active !== undefined ? active : true,
        createdBy: userId,
        feeItems: {
          create: feeItems.map((item: any) => ({
            feeTypeId: item.feeTypeId,
            amount: item.amount,
            mandatory: item.mandatory !== undefined ? item.mandatory : true
          }))
        } as any
      },
      include: { feeItems: { include: { feeType: true } } } as any
    });

    res.status(201).json({ success: true, data: feeStructure });
  }

  async updateFeeStructure(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name, description, feeItems, grade, term, mandatory, active } = req.body;

    const existing = await prisma.feeStructure.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Fee structure not found');

    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.feeStructure.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(grade !== undefined && { grade: (normalizeEnumValue(grade) || grade || null) as any }),
          ...(term  !== undefined && { term:  (normalizeEnumValue(term)  || term  || null) as any }),
          ...(mandatory !== undefined && { mandatory }),
          ...(active !== undefined && { active })
        }
      });

      if (feeItems && Array.isArray(feeItems)) {
        await tx.feeStructureItem.deleteMany({ where: { feeStructureId: id } });
        if (feeItems.length > 0) {
          await tx.feeStructureItem.createMany({
            data: feeItems.map((item: any) => ({
              feeStructureId: id,
              feeTypeId: item.feeTypeId,
              amount: item.amount,
              mandatory: item.mandatory !== undefined ? item.mandatory : true
            }))
          });
        }
      }

      return tx.feeStructure.findUnique({
        where: { id },
        include: { feeItems: { include: { feeType: true } } } as any
      });
    });

    res.json({ success: true, data: updated });
  }

  async deleteFeeStructure(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const existing = await prisma.feeStructure.findUnique({
      where: { id },
      include: { invoices: true }
    });

    if (!existing) throw new ApiError(404, 'Fee structure not found');
    if (existing.invoices.length > 0)
      throw new ApiError(400, 'Cannot delete structure with existing invoices');

    await prisma.feeStructure.delete({ where: { id } });
    res.json({ success: true, message: 'Fee structure deleted successfully' });
  }

  // ─── Invoices ──────────────────────────────────────────────────────────────

  async getAllInvoices(req: AuthRequest, res: Response) {
    const { status, term, academicYear, grade, learnerId, startDate, endDate, paymentMethod } = req.query;
    const where: any = {};




    if (paymentMethod && paymentMethod !== 'all') {
      where.payments = {
        some: {
          paymentMethod: paymentMethod as string,
          archived: false
        }
      };
    }

    if (status && status !== 'undefined' && status !== 'all' && status !== 'ALL') {
      where.status = status;
    }
    if (term) where.term = normalizeEnumValue(term as string) || term;
    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (learnerId) where.learnerId = learnerId;
    if (grade) where.learner = { grade: normalizeEnumValue(grade as string) || grade };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const { isTransport, sortBy, sortOrder } = req.query;
    if (isTransport !== undefined && isTransport !== 'all') {
      where.learner = {
        ...where.learner,
        isTransportStudent: isTransport === 'true'
      };
    }

    applyInvoiceInstitutionScope(req, where);


    const orderBy: any = {};
    if (sortBy) {
      if (sortBy === 'studentName') {
        orderBy.learner = { firstName: sortOrder === 'desc' ? 'desc' : 'asc' };
      } else if (sortBy === 'grade') {
        orderBy.learner = { grade: sortOrder === 'desc' ? 'desc' : 'asc' };
      } else {
        orderBy[sortBy as string] = sortOrder === 'desc' ? 'desc' : 'asc';
      }
    } else {
      orderBy.createdAt = 'desc';
    }

    // FIX: pages calculation was NaN when limit='all'
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limitParam = req.query.limit as string;
    const limit = limitParam === 'all'
      ? undefined
      : Math.min(200, Math.max(1, parseInt(limitParam || '50', 10)));
    const skip = limit ? (page - 1) * limit : undefined;

    const results = await Promise.all([
      prisma.feeInvoice.findMany({
        where,
        orderBy,
        include: {
          learner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              grade: true,
              stream: true,
              parent: { select: { id: true, firstName: true, lastName: true, phone: true } }
            }
          },
          feeStructure: true,
          waivers: {
            where: { archived: false },
            select: { id: true, status: true, amountWaived: true }
          },
          payments: {
            where: { archived: false },
            orderBy: { paymentDate: 'desc' },
            select: { 
              id: true, 
              paymentDate: true, 
              amount: true, 
              transportAmount: true,
              paymentMethod: true, 
              referenceNumber: true, 
              receiptNumber: true 
            }
          },
          pledges: {
            where: { archived: false },
            select: {
              id: true,
              pledgedAmount: true,
              pledgeDate: true,
              status: true
            }
          }
        },
        skip,
        take: limit
      }),
      prisma.feeInvoice.count({ where }),
      prisma.feeInvoice.aggregate({
        where,
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balance: true
        }
      }),
      prisma.feeWaiver.aggregate({
        where: {
          status: 'APPROVED',
          archived: false,
          invoice: where
        },
        _sum: {
          amountWaived: true
        }
      }),
      prisma.feeInvoice.aggregate({
        where: { ...where, balance: { gt: 0 } },
        _sum: { balance: true }
      }),
      prisma.feeInvoice.aggregate({
        where: { ...where, paidAmount: { gt: prisma.feeInvoice.fields.totalAmount } },
        _sum: { paidAmount: true, totalAmount: true },
        _count: true
      }).catch(() => null)
    ]);

    const invoices = results[0] as any[];
    const total = results[1] as number;
    const aggregate = results[2] as any;
    const waiverAggregate = results[3] as any;
    const debtAggregate = results[4] as any;
    const creditAggregate = results[5] as any;

    // If step 4 (creditAggregate) was null, we fetch all relevant to compute accurately
    let overpaidSum = 0;
    let overpaidCount = 0;
    if (creditAggregate) {
      overpaidSum = Number(creditAggregate._sum.paidAmount || 0) - Number(creditAggregate._sum.totalAmount || 0);
      overpaidCount = creditAggregate._count || 0;
    } else {
      const allInvoicesShort = await prisma.feeInvoice.findMany({
        where,
        select: { totalAmount: true, paidAmount: true }
      });
      allInvoicesShort.forEach(inv => {
        const surplus = Number(inv.paidAmount) - Number(inv.totalAmount);
        if (surplus > 0) {
          overpaidSum += surplus;
          overpaidCount += 1;
        }
      });
    }

    // Guard: when fetching all records limit is undefined — use total to keep pages=1
    const effectiveLimit = limit ?? total;
    res.json({
      success: true,
      data: invoices,
      count: invoices.length,
      totals: {
        totalBilled: Number(aggregate?._sum?.totalAmount || 0),
        totalPaid: Number(aggregate?._sum?.paidAmount || 0),
        totalBalance: Number(debtAggregate?._sum?.balance || 0),
        totalOverpaid: overpaidSum,
        totalWaived: Number(waiverAggregate?._sum?.amountWaived || 0),
        overpaidInvoices: overpaidCount
      },
      pagination: {
        total,
        page,
        limit: effectiveLimit,
        pages: effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 1
      }
    });
  }

  /**
   * GET /fees/invoices/aggregates
   *
   * Lightweight aggregate-only endpoint used by the frontend TOTALS row.
   * Returns per-learner closing balances (learnerId, term, academicYear, balance)
   * for all invoices matching the filter set — no invoice payload, no pagination.
   *
   * The frontend uses these to compute carry-forward (B/F) and current-term-due
   * totals without downloading the full invoice dataset, fixing the performance
   * loophole introduced by limit='all' in fetchGrandTotals.
   */
  async getInvoiceAggregates(req: AuthRequest, res: Response) {
    const { status, term, academicYear, grade, learnerId, startDate, endDate, paymentMethod } = req.query;
    const where: any = {};

    if (status && status !== 'undefined' && status !== 'all' && status !== 'ALL') {
      where.status = status;
    }
    if (term) where.term = normalizeEnumValue(term as string) || term;
    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (learnerId) where.learnerId = learnerId;
    if (grade) where.learner = { grade: normalizeEnumValue(grade as string) || grade };

    if (paymentMethod && paymentMethod !== 'all') {
      where.payments = { some: { paymentMethod: paymentMethod as string, archived: false } };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    applyInvoiceInstitutionScope(req, where);

    // Return lightweight rows AND pre-computed grand totals so the client
    // never needs to re-derive B/F from client-side state (which has a timing
    // dependency on statsInvoices loading).
    const rows = await prisma.feeInvoice.findMany({

      where,
      select: {
        learnerId: true,
        term: true,
        academicYear: true,
        totalAmount: true,
        paidAmount: true,
        balance: true,
        status: true,
        feeStructure: {
          select: { feeItems: { select: { amount: true } } }
        },
        learner: { select: { id: true, grade: true } },
        payments: {
          where: { archived: false },
          select: { amount: true }
        },
        waivers: {
          where: { status: 'APPROVED', archived: false },
          select: { amountWaived: true }
        }
      }
    });

    // Server-side grand totals logic was incomplete (ignored legacy B/F and non-sequential terms)
    // Removed so that the frontend's robust `closingBalanceByLearnerTermMap` logic takes over.
    res.json({ success: true, data: rows });
  }

  async getLearnerInvoices(req: AuthRequest, res: Response) {
    const { learnerId } = req.params;
    const learner = await prisma.learner.findUnique({ where: { id: learnerId } });
    if (!learner) throw new ApiError(404, 'Learner not found');

    if (req.user!.role === 'PARENT') {
      if (!(await parentAccessService.canAccessLearner(req.user!.userId, learnerId))) {
        throw new ApiError(403, 'You can only view invoices for your own children');
      }
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { learnerId },
      include: {
        feeStructure: true,
        payments: { orderBy: { paymentDate: 'desc' } },
        waivers: {
          where: { status: 'APPROVED', archived: false },
          select: { amountWaived: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: invoices });
  }

  /**
   * Create single invoice.
   *
   * FIX: transport amount now resolved via resolveTransportAmount() — same
   * logic as fee.service.ts (was previously using only the fee-structure item
   * which could differ from the route-based amount used in the service path).
   */
  async createInvoice(req: AuthRequest, res: Response) {
    const { learnerId, feeStructureId, term, academicYear, dueDate, includeTransport } = req.body;
    const userId = req.user!.userId;
    const normalizedTerm = normalizeEnumValue(term) || term;
    const normalizedYear = Number(academicYear);

    if (!learnerId || !feeStructureId || !normalizedTerm || !normalizedYear || !dueDate) {
      throw new ApiError(400, 'Missing required fields');
    }

    const [learner, feeStructure] = await Promise.all([
      prisma.learner.findUnique({ where: { id: learnerId } }),
      prisma.feeStructure.findUnique({
        where: { id: feeStructureId },
        include: { feeItems: { include: { feeType: true } } } as any
      })
    ]);

    if (!learner || !feeStructure) throw new ApiError(404, 'Learner or fee structure not found');
    if (learner.archived || learner.status !== 'ACTIVE') {
      throw new ApiError(400, 'Cannot create a fee invoice for an inactive or archived learner');
    }

    const shouldIncludeTransport =
      includeTransport !== undefined
        ? includeTransport === true || includeTransport === 'true'
        : (learner as any).isTransportStudent;

    // Enforce carry-forward: billed amount for a term must include prior-term outstanding balance.
    const prevCtx = getPreviousTermContext(normalizedTerm, normalizedYear);
    let carryForwardAmount = 0;
    if (prevCtx) {
      const previousInvoices = await prisma.feeInvoice.findMany({
        where: {
          learnerId,
          term: prevCtx.term as any,
          academicYear: prevCtx.academicYear,
          archived: false,
          status: { not: 'CANCELLED' as PaymentStatus }
        },
        select: { balance: true }
      });
      // Use net prior-term balance so credits (negative balances) automatically reduce next-term billed amount.
      carryForwardAmount = previousInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    }
    const calculation = await calculateLearnerInvoice({
      learner,
      feeStructure,
      term: normalizedTerm,
      academicYear: normalizedYear,
      includeTransport: shouldIncludeTransport,
      carryForwardAmount,
    });

    const existing = await prisma.feeInvoice.findFirst({
      where: { learnerId, feeStructureId, term: normalizedTerm, academicYear: normalizedYear }
    });
    if (existing) throw new ApiError(400, 'An invoice for this period already exists for the student');

    const invoice = await createInvoiceWithSafeNumber(
      prisma,
      {
        learnerId,
        feeStructureId,
        term: normalizedTerm,
        academicYear: normalizedYear,
        dueDate: new Date(dueDate),
        totalAmount: calculation.totalAmount,
        paidAmount: 0,
        balance: calculation.totalAmount,
        transportBilled: calculation.transportAmount,
        transportPaid: 0,
        transportBalance: calculation.transportAmount,
        grossAmount: calculation.grossAmount,
        adjustmentAmount: calculation.adjustmentAmount,
        sponsorAmount: calculation.sponsorAmount,
        sponsorPaidAmount: 0,
        sponsorBalance: calculation.sponsorAmount,
        studentAmount: calculation.studentAmount,
        carryForwardAmount: calculation.carryForwardAmount,
        calculationSnapshot: calculation.calculationSnapshot,
        feeConfigurationId: calculation.feeConfigurationId,
        status: calculation.totalAmount === 0 && calculation.sponsorAmount === 0 ? 'PAID' : 'PENDING',
        issuedBy: userId
      },
      {
        learner: true,
        feeStructure: { include: { feeItems: { include: { feeType: true } } } } as any
      }
    );

    setImmediate(async () => {
      try {
        const contactPhone = learner.primaryContactPhone || learner.guardianPhone;
        if (contactPhone) {
          await Promise.allSettled([
            SmsService.sendFeeInvoiceNotification({
              parentPhone: contactPhone,
              parentName: learner.primaryContactName || 'Parent',
              learnerName: `${learner.firstName} ${learner.lastName}`,
              invoiceNumber: invoice.invoiceNumber,
              term: invoice.term,
              amount: Number(invoice.totalAmount),
              dueDate: new Date(invoice.dueDate).toLocaleDateString()
            }),
            whatsappService.sendMessage({
              to: contactPhone,
              message: `Official Fee Invoice ${invoice.invoiceNumber} for ${learner.firstName} has been generated. Amount: KES ${Number(invoice.totalAmount).toLocaleString()}.`
            })
          ]);
        }
      } catch (err) {
        logger.error('Post-creation notification error:', err);
      }

      try {
        await accountingService.postFeeInvoiceToLedger(invoice);
        await complianceService.syncInvoiceToETIMS(invoice.id);
      } catch (err) {
        logger.error('Post-creation background tasks error:', err);
      }
    });

    res.status(201).json({ success: true, data: invoice });
  }

  /**
   * Update an invoice (Task 3 — P2).
   *
   * Allows editing dueDate and adjusting totalAmount/balance before any payment
   * is recorded. Guards:
   *  - Invoice must exist.
   *  - Invoice must have paidAmount === 0 (no payments recorded yet).
   *  - If CANCELLED, editing is not allowed.
   *  - newTotalAmount must be > 0.
   */
  async updateInvoice(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { dueDate, totalAmount } = req.body;

    if (!dueDate && totalAmount === undefined) {
      throw new ApiError(400, 'Provide at least one field to update: dueDate or totalAmount');
    }

    const invoice = await prisma.feeInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    if (invoice.status === 'CANCELLED') {
      throw new ApiError(400, 'Cannot edit a cancelled invoice');
    }
    if (Number(invoice.paidAmount) > 0 || Number(invoice.sponsorPaidAmount || 0) > 0) {
      throw new ApiError(
        400,
        'Cannot edit an invoice that already has recorded payments. Reverse the payment(s) first.'
      );
    }

    const updateData: any = {};

    if (dueDate) {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) throw new ApiError(400, 'Invalid dueDate format');
      updateData.dueDate = parsed;
    }

    if (totalAmount !== undefined) {
      const newTotal = Number(totalAmount);
      if (isNaN(newTotal) || newTotal <= 0) {
        throw new ApiError(400, 'totalAmount must be a positive number');
      }
      updateData.totalAmount = newTotal;
      updateData.balance = newTotal; // balance === total when no payments recorded
    }

    const updated = await prisma.feeInvoice.update({
      where: { id },
      data: updateData,
      include: {
        learner: {
          select: {
            id: true, firstName: true, lastName: true,
            admissionNumber: true, grade: true
          }
        },
        feeStructure: true
      }
    });

    res.json({ success: true, data: updated });
  }

  async reviseInvoiceFromConfiguration(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) throw new ApiError(400, 'A revision reason is required');
    const invoice = await prisma.feeInvoice.findUnique({
      where: { id },
      include: {
        learner: true,
        feeStructure: { include: { feeItems: { include: { feeType: true } } } } as any,
      },
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'CANCELLED') throw new ApiError(400, 'Cannot revise a cancelled invoice');
    if (Number(invoice.paidAmount) > 0) {
      throw new ApiError(400, 'Only unpaid invoices can be revised. Reverse recorded payments first.');
    }

    const calculation = await calculateLearnerInvoice({
      learner: invoice.learner,
      feeStructure: invoice.feeStructure,
      term: invoice.term,
      academicYear: invoice.academicYear,
      includeTransport: Number(invoice.transportBilled) > 0 || invoice.learner.isTransportStudent,
      carryForwardAmount: Number(invoice.carryForwardAmount || 0),
    });
    const revisionNumber = invoice.revisionNumber + 1;
    const previousSnapshot = {
      totalAmount: Number(invoice.totalAmount),
      balance: Number(invoice.balance),
      grossAmount: Number(invoice.grossAmount || invoice.totalAmount),
      adjustmentAmount: Number(invoice.adjustmentAmount || 0),
      sponsorAmount: Number(invoice.sponsorAmount || 0),
      studentAmount: Number(invoice.studentAmount || invoice.totalAmount),
      carryForwardAmount: Number(invoice.carryForwardAmount || 0),
      calculationSnapshot: invoice.calculationSnapshot,
      feeConfigurationId: invoice.feeConfigurationId,
    };
    const revisedSnapshot = { ...calculation, revisionNumber };

    const updated = await prisma.$transaction(async (tx) => {
      await tx.feeInvoiceRevision.create({
        data: {
          invoiceId: invoice.id,
          revisionNumber,
          reason,
          previousSnapshot,
          revisedSnapshot,
          revisedById: req.user!.userId,
        },
      });
      return tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount: calculation.totalAmount,
          balance: calculation.totalAmount,
          grossAmount: calculation.grossAmount,
          adjustmentAmount: calculation.adjustmentAmount,
          sponsorAmount: calculation.sponsorAmount,
          sponsorPaidAmount: 0,
          sponsorBalance: calculation.sponsorAmount,
          studentAmount: calculation.studentAmount,
          carryForwardAmount: calculation.carryForwardAmount,
          transportBilled: calculation.transportAmount,
          transportBalance: calculation.transportAmount,
          calculationSnapshot: calculation.calculationSnapshot,
          feeConfigurationId: calculation.feeConfigurationId,
          revisionNumber,
          status: calculation.totalAmount === 0 && calculation.sponsorAmount === 0 ? 'PAID' : 'PENDING',
        },
        include: { revisions: { orderBy: { revisionNumber: 'desc' } } },
      });
    });

    await accountingService.postFeeInvoiceRevisionToLedger(
      invoice.invoiceNumber,
      revisionNumber,
      (calculation.totalAmount + calculation.sponsorAmount)
        - (Number(invoice.totalAmount) + Number(invoice.sponsorAmount || 0))
    );
    res.json({ success: true, data: updated, message: 'Invoice revised from the approved fee configuration' });
  }

  /**
   * Record payment.
   * Status transitions: PENDING/PARTIAL → PARTIAL | PAID | OVERPAID
   * All SmsService calls use the static sendSms() method.
   *
   * FIX (Task 4 — P2): The response now includes a `receiptData` object
   * containing all the fields needed for the frontend to render or download
   * a PDF receipt. Server-side PDF generation is deprecated on the current
   * hosting environment (Render Native Node); the frontend should use
   * html2canvas / jsPDF with this data.
   */
  async recordPayment(req: AuthRequest, res: Response) {
    const { invoiceId, learnerId, amount: rawAmount, paymentMethod, paymentDate, referenceNumber, notes, allocatedTuition, allocatedTransport, payerType = 'STUDENT' } = req.body;
    const userId = req.user!.userId;

    if ((!invoiceId && !learnerId) || rawAmount === undefined || rawAmount === null || !paymentMethod) {
      throw new ApiError(400, 'Missing required fields: invoiceId or learnerId, amount, paymentMethod');
    }

    const amount = Number(rawAmount);

    let invoice: any;
    if (invoiceId) {
      invoice = await prisma.feeInvoice.findUnique({
        where: { id: invoiceId },
        include: { learner: true }
      });
    } else {
      invoice = await prisma.feeInvoice.findFirst({
        where: { learnerId, status: { in: ['PENDING', 'PARTIAL'] } },
        orderBy: { createdAt: 'desc' },
        include: { learner: true }
      });
      if (!invoice && learnerId) {
        invoice = await prisma.feeInvoice.findFirst({
          where: { learnerId },
          orderBy: { createdAt: 'desc' },
          include: { learner: true }
        });
      }
    }

    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'PAID') throw new ApiError(400, 'Invoice is already fully paid');
    if (invoice.status === 'CANCELLED') throw new ApiError(400, 'Cannot record payment on a cancelled invoice');

    const actualInvoiceId = invoice.id;

    let result: any;
    let lastPaymentError: any;

    for (let attempt = 1; attempt <= RECEIPT_NUMBER_RETRY_COUNT; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const maxResult = await tx.feePayment.aggregate({ _max: { receiptNumber: true } });
          const lastSeq = (() => {
            const raw = maxResult._max.receiptNumber as string | null;
            if (!raw) return 0;
            const m = raw.match(/(\d+)$/);
            return m ? parseInt(m[1], 10) : 0;
          })();
          const receiptNumber = `RCP-${new Date().getFullYear()}-${String(lastSeq + 1).padStart(6, '0')}`;
          const isSponsorPayment = payerType === 'SPONSOR';
          if (isSponsorPayment && Number(invoice.sponsorBalance || 0) <= 0) {
            throw new ApiError(400, 'This invoice has no outstanding sponsor balance');
          }
          if (isSponsorPayment && amount > Number(invoice.sponsorBalance || 0) + 0.01) {
            throw new ApiError(400, 'Sponsor payment cannot exceed the sponsor balance');
          }

          // Calculate Explicit Allocation. Default: Tuition First
          let tuitionChunk = 0;
          let transportChunk = 0;
          const invoiceDetails = isSponsorPayment
            ? null
            : await tx.feeInvoice.findUnique({ where: { id: actualInvoiceId }});
          const currentTuitionBal = Math.max(0, Number(invoiceDetails?.balance || 0));
          const currentTransportBal = Math.max(0, Number(invoiceDetails?.transportBalance || 0));

          if (isSponsorPayment) {
            tuitionChunk = 0;
            transportChunk = 0;
          } else if (allocatedTuition !== undefined || allocatedTransport !== undefined) {
             tuitionChunk = Number(allocatedTuition || 0);
             transportChunk = Number(allocatedTransport || 0);
             if (tuitionChunk < 0 || transportChunk < 0) {
                 throw new ApiError(400, "Allocated amounts cannot be negative");
             }
             if (Math.abs((tuitionChunk + transportChunk) - amount) > 0.01) {
                 throw new ApiError(400, "Allocated amounts must match the total payment amount");
             }
             if (transportChunk > currentTransportBal + 0.01) {
                 throw new ApiError(400, "Transport allocation cannot exceed the outstanding transport balance");
             }
          } else {
             // Default Intelligent Allocation: Tuition first, then Transport
             if (amount <= currentTuitionBal) {
                 tuitionChunk = amount;
             } else {
                 tuitionChunk = currentTuitionBal;
                 const remainder = amount - currentTuitionBal;
                 transportChunk = Math.min(remainder, currentTransportBal);
                 tuitionChunk += Math.max(0, remainder - transportChunk);
             }
          }

          const payment = await tx.feePayment.create({
            data: { 
               receiptNumber, 
               invoiceId: actualInvoiceId, 
               amount, 
               transportAmount: transportChunk,
               paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
               paymentMethod, 
                referenceNumber,
                notes,
                payerType,
                recordedBy: userId
            }
          });

          const updatedInvoice = await tx.feeInvoice.update({
            where: { id: actualInvoiceId },
            data: isSponsorPayment ? {
              sponsorPaidAmount: { increment: amount },
              sponsorBalance: { decrement: amount },
            } : {
              paidAmount: { increment: tuitionChunk },
              balance: { decrement: tuitionChunk },
              transportPaid: { increment: transportChunk },
              transportBalance: { decrement: transportChunk },
            },
            include: { waivers: { where: { archived: false } } }
          });

          const balance = Number(updatedInvoice.balance);
          const totalAmount = Number(updatedInvoice.totalAmount);
          const paidAmount = Number(updatedInvoice.paidAmount);
          const sponsorBalance = Number(updatedInvoice.sponsorBalance || 0);

          let newStatus: PaymentStatus;
          if (paidAmount > totalAmount) {
            newStatus = 'OVERPAID';
          } else if (balance <= 0 && sponsorBalance <= 0) {
            newStatus = 'PAID';
          } else if (paidAmount > 0 || Number(updatedInvoice.sponsorPaidAmount || 0) > 0) {
            newStatus = 'PARTIAL';
          } else {
            // Check if there are any waivers (even if balance > 0)
            const hasWaivers = updatedInvoice.waivers && updatedInvoice.waivers.length > 0;
            newStatus = hasWaivers ? 'PARTIAL' : 'PENDING';
          }

          const finalInvoice = await tx.feeInvoice.update({
            where: { id: actualInvoiceId },
            data: { status: newStatus },
            include: {
              learner: true,
              payments: { orderBy: { paymentDate: 'desc' } },
              feeStructure: { include: { feeItems: { include: { feeType: true } } } } as any
            }
          });

          return { payment, invoice: finalInvoice };
        });
        break;
      } catch (error: any) {
        lastPaymentError = error;
        if (error?.code === 'P2002' && attempt < RECEIPT_NUMBER_RETRY_COUNT) continue;
        throw error;
      }
    }

    if (!result) throw lastPaymentError;

    // Background: accounting + SMS (static method throughout)
    (async () => {
      try {
        await accountingService.postFeePaymentToLedger(result.payment, paymentMethod);

        const learner = result.invoice.learner;
        const contactPhone = learner.primaryContactPhone || learner.guardianPhone;
        const newStatus: string = result.invoice.status;

        if (contactPhone) {
          let smsMessage: string;
          if (newStatus === 'PAID') {
            smsMessage = `Payment of KES ${amount.toLocaleString()} received for ${learner.firstName}. Invoice fully settled. Thank you.`;
          } else if (newStatus === 'OVERPAID') {
            smsMessage = `Payment of KES ${amount.toLocaleString()} received for ${learner.firstName}. Credit balance: KES ${Math.abs(Number(result.invoice.balance)).toLocaleString()}. Please contact the school to arrange a refund or apply to next term.`;
          } else {
            smsMessage = `Payment of KES ${amount.toLocaleString()} received for ${learner.firstName}. Outstanding balance: KES ${Number(result.invoice.balance).toLocaleString()}. Thank you.`;
          }

          const school = await prisma.school.findFirst({ select: { name: true } });
          const schoolName = school?.name || PRODUCT_DISPLAY_NAME;

          await Promise.allSettled([
            SmsService.sendSms(contactPhone, smsMessage),
            whatsappService.sendFeePaymentNotification({
              parentPhone: contactPhone,
              parentName: learner.primaryContactName || 'Parent',
              learnerName: `${learner.firstName} ${learner.lastName}`,
              receiptNumber: result.payment.receiptNumber,
              amount: amount,
              balance: Number(result.invoice.balance),
              status: newStatus.replace('_', ' '),
              schoolName
            })
          ]);
        }
      } catch (err) {
        logger.error('Post-payment error:', err);
      }
    })();

    // ── RECEIPT DATA (Task 4 — P2) ─────────────────────────────────────────
    // Structured receipt payload for frontend PDF generation.
    // Server-side PDF generation is unavailable on the current hosting
    // environment; the frontend (html2canvas / jsPDF) consumes this object.
    const school = await prisma.school.findFirst({ select: { name: true, logoUrl: true, phone: true, email: true, address: true } });
    const learner = result.invoice.learner;
    const receiptData = {
      receiptNumber: result.payment.receiptNumber,
      paymentDate: result.payment.paymentDate,
      paymentMethod,
      referenceNumber: referenceNumber || null,
      amount,
      invoiceNumber: result.invoice.invoiceNumber,
      invoiceStatus: result.invoice.status,
      balance: Number(result.invoice.balance),
      totalAmount: Number(result.invoice.totalAmount),
      paidAmount: Number(result.invoice.paidAmount),
      term: result.invoice.term,
      academicYear: result.invoice.academicYear,
      student: {
        name: `${learner.firstName} ${learner.lastName}`,
        admissionNumber: learner.admissionNumber,
        grade: learner.grade
      },
      school: {
        name: school?.name || PRODUCT_DISPLAY_NAME,
        logoUrl: school?.logoUrl || null,
        phone: school?.phone || null,
        email: school?.email || null,
        address: school?.address || null
      }
    };
    // ────────────────────────────────────────────────────────────────────────

    res.status(201).json({ success: true, data: result, receiptData });
  }

  /**
   * Cancel an invoice (SUPER_ADMIN / ADMIN only).
   * Wires up the previously-dead CANCELLED PaymentStatus.
   * Cannot cancel an invoice that has existing payments.
   */
  async cancelInvoice(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    const role = req.user!.role;

    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      throw new ApiError(403, 'Only ADMIN or SUPER_ADMIN can cancel invoices');
    }

    const invoice = await prisma.feeInvoice.findUnique({
      where: { id },
      include: { payments: true, learner: true }
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'CANCELLED') throw new ApiError(400, 'Invoice is already cancelled');
    if (invoice.payments.length > 0) {
      throw new ApiError(
        400,
        'Cannot cancel an invoice that has recorded payments. Reverse the payments first.'
      );
    }

    const cancelled = await prisma.feeInvoice.update({
      where: { id },
      data: { status: 'CANCELLED' as PaymentStatus }
    });

    logger.info(
      `[FeeController] Invoice ${invoice.invoiceNumber} cancelled by user ${req.user!.userId}. Reason: ${reason || 'not specified'}`
    );

    res.json({
      success: true,
      data: cancelled,
      message: `Invoice ${invoice.invoiceNumber} cancelled successfully`
    });
  }

  /**
   * Reverse a payment.
   * Updates invoice balance/status and archives the payment record.
   *
   * NOTE (Task 7 — P3): FeePayment.archivedBy is stored as String? (no FK
   * relation to User). The reversal actor's userId is already captured in
   * archivedBy and emitted to the audit log via the route middleware, so user
   * lookup can be performed via the AuditLog table if needed in future.
   */
  async reversePayment(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
      throw new ApiError(403, 'Only ADMIN or SUPER_ADMIN can reverse payments');
    }

    const payment = await prisma.feePayment.findUnique({
      where: { id },
      include: { invoice: true }
    });

    if (!payment) throw new ApiError(404, 'Payment record not found');
    if (payment.archived) throw new ApiError(400, 'Payment has already been reversed');

    const amount = Number(payment.amount);
    const invoiceId = payment.invoiceId;

    const [updatedPayment, updatedInvoice] = await prisma.$transaction(async (tx) => {
      // 1. Archive the payment
      const archived = await tx.feePayment.update({
        where: { id },
        data: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: userId,
          notes: payment.notes ? `${payment.notes} | Reversed: ${reason || 'Error correction'}` : `Reversed: ${reason || 'Error correction'}`
        }
      });

      // 2. Adjust invoice balance
      const freshInv = await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: { decrement: amount },
          balance: { increment: amount }
        }
      });

      // 3. Re-calculate status
      const balance = Number(freshInv.balance);
      const paid = Number(freshInv.paidAmount);
      let newStatus: PaymentStatus = 'PARTIAL';
      if (paid <= 0) newStatus = 'PENDING';
      if (balance <= 0) newStatus = paid < 0 ? 'OVERPAID' : 'PAID';

      const finalInv = await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { status: newStatus }
      });

      return [archived, finalInv];
    });

    logger.info(`[FeeController] Payment ${payment.receiptNumber} reversed by ${userId}. Reason: ${reason}`);

    res.json({
      success: true,
      data: { payment: updatedPayment, invoice: updatedInvoice },
      message: `Payment ${payment.receiptNumber} reversed successfully`
    });
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getPaymentStats(req: AuthRequest, res: Response) {
    const { academicYear, term, grade, startDate, endDate } = req.query;
    const invoiceWhere: any = {};
    const paymentWhere: any = {};

    if (academicYear) invoiceWhere.academicYear = parseInt(academicYear as string);
    if (term && term !== 'all') invoiceWhere.term = term;
    if (grade && grade !== 'all') invoiceWhere.learner = { grade: grade as string };

    if (startDate) {
      invoiceWhere.createdAt = { gte: new Date(startDate as string) };
      paymentWhere.paymentDate = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      invoiceWhere.createdAt = { ...invoiceWhere.createdAt, lte: end };
      paymentWhere.paymentDate = { ...paymentWhere.paymentDate, lte: end };
    }

    if (academicYear || (term && term !== 'all') || (grade && grade !== 'all')) {
      paymentWhere.invoice = {};
      if (academicYear) paymentWhere.invoice.academicYear = parseInt(academicYear as string);
      if (term && term !== 'all') paymentWhere.invoice.term = term;
      if (grade && grade !== 'all') paymentWhere.invoice.learner = { grade: grade as string };
    }

    const [totalInvoices, invoicesByStatus] = await Promise.all([
      prisma.feeInvoice.count({ where: invoiceWhere }),
      prisma.feeInvoice.groupBy({
        by: ['status'],
        where: invoiceWhere,
        _count: true,
        _sum: { totalAmount: true, paidAmount: true, balance: true, transportBilled: true, transportPaid: true, transportBalance: true }
      })
    ]);

    const totalExpected  = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.totalAmount || 0), 0);
    const totalCollected = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.paidAmount  || 0), 0);
    const totalOutstanding = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.balance   || 0), 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    const transportExpected  = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.transportBilled || 0), 0);
    const transportCollected = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.transportPaid   || 0), 0);
    const transportOutstanding = invoicesByStatus.reduce((acc, curr) => acc + Number(curr._sum.transportBalance || 0), 0);

    const paidInvoices    = invoicesByStatus.find(i => i.status === 'PAID')?._count    || 0;
    const partialInvoices = invoicesByStatus.find(i => i.status === 'PARTIAL')?._count || 0;
    const pendingInvoices = invoicesByStatus.find(i => i.status === 'PENDING')?._count || 0;
    const waivedInvoices  = invoicesByStatus.find(i => i.status === 'WAIVED')?._count  || 0;
    const cancelledInvoices = invoicesByStatus.find(i => i.status === 'CANCELLED')?._count || 0;
    const overdueInvoices = await prisma.feeInvoice.count({
      where: {
        ...invoiceWhere,
        status: { notIn: ['PAID', 'OVERPAID', 'CANCELLED', 'WAIVED'] },
        dueDate: { lt: new Date() }
      }
    });

    const paymentsByMethod = await prisma.feePayment.groupBy({
      by: ['paymentMethod'],
      where: paymentWhere,
      _count: true,
      _sum: { amount: true }
    });

    const paymentMethods = paymentsByMethod.map(p => ({
      method: p.paymentMethod,
      amount: Number(p._sum.amount || 0),
      count: p._count
    }));

    // Grade-wise breakdown (DB groupBy — no full table scan into JS)
    const gradeGroupRaw = await prisma.feeInvoice.groupBy({
      by: ['learnerId'] as any,
      where: invoiceWhere,
      _sum: { totalAmount: true, paidAmount: true, balance: true }
    });

    const learnerIds = gradeGroupRaw.map((r: any) => r.learnerId).filter(Boolean);
    const learnerGrades = learnerIds.length > 0
      ? await prisma.learner.findMany({
          where: { id: { in: learnerIds } },
          select: { id: true, grade: true }
        })
      : [];

    const gradeIdMap = new Map(learnerGrades.map(l => [l.id, l.grade || 'Unknown']));
    const gradeAgg: Record<string, { expected: number; collected: number; outstanding: number; studentIds: Set<string> }> = {};

    for (const row of gradeGroupRaw as any[]) {
      const g = gradeIdMap.get(row.learnerId) ?? 'Unknown';
      if (!gradeAgg[g]) gradeAgg[g] = { expected: 0, collected: 0, outstanding: 0, studentIds: new Set() };
      gradeAgg[g].studentIds.add(row.learnerId);
      gradeAgg[g].expected    += Number(row._sum.totalAmount || 0);
      gradeAgg[g].collected   += Number(row._sum.paidAmount  || 0);
      gradeAgg[g].outstanding += Number(row._sum.balance     || 0);
    }

    const gradeWiseCollection = Object.entries(gradeAgg).map(([g, gm]) => ({
      grade: g.replace(/_/g, ' '),
      studentCount: gm.studentIds.size,
      expected: gm.expected,
      collected: gm.collected,
      outstanding: gm.outstanding,
      collectionRate: gm.expected > 0 ? Math.round((gm.collected / gm.expected) * 100) : 0
    }));

    // Transport metrics
    const transportLearnerIds = learnerIds.length > 0
      ? await prisma.learner.findMany({
          where: { id: { in: learnerIds }, isTransportStudent: true },
          select: { id: true }
        })
      : [];
    const transportStudentCount = transportLearnerIds.length;

    res.json({
      success: true,
      data: {
        totalExpected, totalCollected, totalOutstanding, collectionRate,
        totalInvoices, paidInvoices, partialInvoices, pendingInvoices,
        waivedInvoices, cancelledInvoices, overdueInvoices,
        paymentMethods, gradeWiseCollection,
        transport: {
          studentCount: transportStudentCount,
          expected: transportExpected,
          collected: transportCollected,
          outstanding: transportOutstanding,
          collectionRate: transportExpected > 0
            ? Math.round((transportCollected / transportExpected) * 100)
            : 0
        }
      }
    });
  }

  /**
   * Bulk generate invoices.
   *
   * FIX: transport amount now uses resolveTransportAmount() per-learner instead
   * of the binary totalWithTransport/totalWithoutTransport pre-calculation, so
   * route-specific pricing is honoured for each student individually.
   */
  async bulkGenerateInvoices(req: AuthRequest, res: Response) {
    const { feeStructureId, term, academicYear, dueDate, grade, stream, scope } = req.body;
    const userId = req.user!.userId;
    const normalizedTerm = normalizeEnumValue(term) || term;
    const normalizedYear = Number(academicYear);
    const normalizedScope = String(scope || '').toUpperCase();

    if (!normalizedTerm || !normalizedYear || !dueDate) {
      throw new ApiError(400, 'term, academicYear and dueDate are required');
    }

    let learners = await prisma.learner.findMany({
      where: {
        status: 'ACTIVE',
        archived: false,
        ...(normalizedScope === 'WHOLE_SCHOOL'
          ? {}
          : { grade, stream: stream || undefined })
      }
    });

    if (learners.length === 0) {
      if (normalizedScope === 'WHOLE_SCHOOL') {
        throw new ApiError(400, 'No active learners found in the school');
      }
      throw new ApiError(400, 'No active learners found for selected grade/stream');
    }

    // Resolve fee structure per learner (whole school) or single provided structure.
    let structureByGrade = new Map<string, any>();

    if (normalizedScope === 'WHOLE_SCHOOL') {
      const structures = await prisma.feeStructure.findMany({
        where: {
          active: true,
          term: normalizedTerm,
          academicYear: normalizedYear
        },
        include: { feeItems: { include: { feeType: true } } } as any
      });

      for (const fs of structures) {
        if (fs.grade && !structureByGrade.has(fs.grade)) {
          structureByGrade.set(fs.grade, fs);
        }
      }

      learners = learners.filter((l) => structureByGrade.has(String(l.grade || '')));
      if (learners.length === 0) {
        throw new ApiError(400, 'No active learners have a matching active fee structure for the selected term/year');
      }
    } else {
      const feeStructure = await prisma.feeStructure.findUnique({
        where: { id: feeStructureId },
        include: { feeItems: { include: { feeType: true } } } as any
      });
      if (!feeStructure) throw new ApiError(404, 'Fee structure not found');
    }

    // Pre-fetch already-invoiced learners in one query
    const learnerIds = learners.map(l => l.id);
    const alreadyInvoiced = await prisma.feeInvoice.findMany({
      where: {
        learnerId: { in: learnerIds },
        term: normalizedTerm,
        academicYear: normalizedYear,
        ...(normalizedScope === 'WHOLE_SCHOOL' ? {} : { feeStructureId })
      },
      select: { learnerId: true }
    });
    const alreadyInvoicedSet = new Set(alreadyInvoiced.map(i => i.learnerId));
    const learnersToInvoice = learners.filter(l => !alreadyInvoicedSet.has(l.id));

    if (learnersToInvoice.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        message: 'All learners in this grade already have invoices for this period.'
      });
    }

    const prevCtx = getPreviousTermContext(normalizedTerm, normalizedYear);
    const carryForwardByLearner = new Map<string, number>();
    if (prevCtx) {
      const previousInvoices = await prisma.feeInvoice.findMany({
        where: {
          learnerId: { in: learnersToInvoice.map((l) => l.id) },
          term: prevCtx.term as any,
          academicYear: prevCtx.academicYear,
          archived: false,
          status: { not: 'CANCELLED' as PaymentStatus }
        },
        select: { learnerId: true, balance: true }
      });
      for (const inv of previousInvoices) {
        const current = carryForwardByLearner.get(inv.learnerId) || 0;
        // Use net prior-term balance so credits (negative balances) automatically reduce next-term billed amount.
        carryForwardByLearner.set(inv.learnerId, current + Number(inv.balance || 0));
      }
    }

    // Resolve amounts per learner so structure/transport are accurate for each record.
    const invoiceDrafts = await Promise.all(
      learnersToInvoice.map(async (learner) => {
        const resolvedStructure = normalizedScope === 'WHOLE_SCHOOL'
          ? structureByGrade.get(String(learner.grade || ''))
          : { id: feeStructureId };

        if (!resolvedStructure?.id) return null;
        const carryForwardAmount = Number(carryForwardByLearner.get(learner.id) || 0);
        const structure = normalizedScope === 'WHOLE_SCHOOL'
          ? resolvedStructure
          : await prisma.feeStructure.findUnique({
              where: { id: resolvedStructure.id },
              include: { feeItems: { include: { feeType: true } } } as any,
            });
        if (!structure) return null;
        const calculation = await calculateLearnerInvoice({
          learner,
          feeStructure: structure,
          term: normalizedTerm,
          academicYear: normalizedYear,
          carryForwardAmount,
        });

        return {
          learner,
          feeStructureId: resolvedStructure.id,
          calculation,
        };
      })
    );
    const validDrafts = invoiceDrafts.filter(Boolean) as Array<any>;

    if (validDrafts.length === 0) {
      throw new ApiError(400, 'No eligible learners found for invoice generation');
    }

    let results: any[];
    let lastError: any;

    for (let attempt = 1; attempt <= INVOICE_NUMBER_RETRY_COUNT; attempt++) {
      try {
        results = await prisma.$transaction(async (tx: any) => {
          const invoices: any[] = [];
          const maxResult = await tx.feeInvoice.aggregate({
            _max: { invoiceNumber: true },
            where: { academicYear }
          });
          let nextSequence = parseInvoiceNumber(maxResult._max.invoiceNumber as string | null) + 1;

          for (let idx = 0; idx < validDrafts.length; idx++) {
            const draft = validDrafts[idx];
            const learner = draft.learner;
            const invoiceNumber = `INV-${academicYear}-${String(nextSequence).padStart(6, '0')}`;
            nextSequence++;

            const invoice = await tx.feeInvoice.create({
              data: {
                invoiceNumber,
                learnerId: learner.id,
                feeStructureId: draft.feeStructureId,
                term: normalizedTerm,
                academicYear: normalizedYear,
                dueDate: new Date(dueDate),
                totalAmount: draft.calculation.totalAmount,
                paidAmount: 0,
                balance: draft.calculation.totalAmount,
                transportBilled: draft.calculation.transportAmount,
                transportPaid: 0,
                transportBalance: draft.calculation.transportAmount,
                grossAmount: draft.calculation.grossAmount,
                adjustmentAmount: draft.calculation.adjustmentAmount,
                sponsorAmount: draft.calculation.sponsorAmount,
                sponsorPaidAmount: 0,
                sponsorBalance: draft.calculation.sponsorAmount,
                studentAmount: draft.calculation.studentAmount,
                carryForwardAmount: draft.calculation.carryForwardAmount,
                calculationSnapshot: draft.calculation.calculationSnapshot,
                feeConfigurationId: draft.calculation.feeConfigurationId,
                status: draft.calculation.totalAmount === 0 && draft.calculation.sponsorAmount === 0 ? 'PAID' : 'PENDING',
                issuedBy: userId
              }
            });
            invoices.push(invoice);
          }

          return invoices;
        });
        break;
      } catch (error: any) {
        lastError = error;
        if (error?.code === 'P2002' && attempt < INVOICE_NUMBER_RETRY_COUNT) continue;
        throw error;
      }
    }

    if (!results!) throw lastError;

    setImmediate(async () => {
      logger.info(`[BulkCompliance] Starting background tasks for ${results.length} invoices...`);
      for (const inv of results) {
        try {
          await accountingService.postFeeInvoiceToLedger(inv);
          await complianceService.syncInvoiceToETIMS(inv.id);
        } catch (err) {
          logger.error(`[BulkCompliance] Failed for invoice ${inv.invoiceNumber}:`, err);
        }
      }
    });

    res.status(201).json({
      success: true,
      data: results,
      count: results.length,
      message: normalizedScope === 'WHOLE_SCHOOL'
        ? `Bulk invoices created for ${results.length} learners (whole school scope).`
        : `Bulk invoices created for ${results.length} learners.`
    });
  }

  /**
   * Reset invoices (Super Admin only — scoped to a specific academicYear + term).
   */
  async resetInvoices(req: AuthRequest, res: Response) {
    if (req.user!.role !== 'SUPER_ADMIN') throw new ApiError(403, 'Global reset restricted to SUPER_ADMIN');

    const { academicYear, term, confirmToken } = req.body;
    if (!academicYear || !term) throw new ApiError(400, 'academicYear and term are required');
    if (confirmToken !== 'CONFIRM_RESET') throw new ApiError(400, 'confirmToken must equal "CONFIRM_RESET"');

    const targetInvoices = await prisma.feeInvoice.findMany({
      where: { academicYear: parseInt(academicYear, 10), term },
      select: { id: true }
    });
    const invoiceIds = targetInvoices.map((i: any) => i.id);

    const [paymentsResult, invoicesResult] = await prisma.$transaction([
      prisma.feePayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }),
      prisma.feeInvoice.deleteMany({ where: { id: { in: invoiceIds } } })
    ]);

    res.json({
      success: true,
      message: `Reset complete for ${academicYear} ${term}. Deleted ${invoicesResult.count} invoices and ${paymentsResult.count} payments.`
    });
  }

  // ─── Reminders ─────────────────────────────────────────────────────────────

  async sendInvoiceReminder(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { channel } = req.body;

    const invoice = await prisma.feeInvoice.findUnique({ where: { id }, include: { learner: true } });
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const learner = invoice.learner;
    const contactPhone = learner.primaryContactPhone || learner.guardianPhone;
    if (!contactPhone) throw new ApiError(400, 'Student has no contact phone number');

    const message = `Reminder: Fee Invoice ${invoice.invoiceNumber} for ${learner.firstName} is outstanding. Balance: KES ${Number(invoice.balance).toLocaleString()}. Please clear by the due date.`;
    const results: any = {};

    if (channel === 'SMS' || channel === 'BOTH') {
      try {
        const smsResult = await SmsService.sendSms(contactPhone, message);
        results.sms = smsResult.success ? 'Sent' : `Failed: ${smsResult.error}`;
      } catch (e: any) {
        results.sms = `Error: ${e.message}`;
      }
    }

    if (channel === 'WHATSAPP' || channel === 'BOTH') {
      try {
        const waResult = await whatsappService.sendMessage({ to: contactPhone, message });
        results.whatsapp = waResult.success ? 'Sent' : `Failed: ${waResult.message}${waResult.error ? ` (${waResult.error})` : ''}`;
      } catch (e: any) {
        results.whatsapp = `Error: ${e.message}`;
      }
    }

    const allFailed =
      (channel === 'SMS'      && results.sms?.startsWith('Failed'))    ||
      (channel === 'WHATSAPP' && results.whatsapp?.startsWith('Failed')) ||
      (channel === 'BOTH'     && results.sms?.startsWith('Failed') && results.whatsapp?.startsWith('Failed'));

    if (allFailed) {
      const errorDetail = Object.entries(results)
        .filter(([, v]) => (v as string).startsWith('Failed') || (v as string).startsWith('Error'))
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('; ');
      return res.status(400).json({ success: false, message: `Reminder failed: ${errorDetail}`, data: results });
    }

    res.json({ success: true, data: results });
  }

  async bulkSendReminders(req: AuthRequest, res: Response) {
    const { invoiceIds, channel } = req.body;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) throw new ApiError(400, 'No invoices selected');

    const invoices = await prisma.feeInvoice.findMany({
      where: { id: { in: invoiceIds } },
      include: { learner: true }
    });

    setImmediate(async () => {
      const outcomes: Array<{ invoiceNumber: string; learnerId: string; sms?: string; whatsapp?: string; skipped?: string }> = [];

      for (const invoice of invoices) {
        const learner = invoice.learner;
        const contactPhone = learner.primaryContactPhone || learner.guardianPhone;

        if (!contactPhone) {
          outcomes.push({ invoiceNumber: invoice.invoiceNumber, learnerId: learner.id, skipped: 'No contact phone' });
          continue;
        }

        const outcome: typeof outcomes[number] = { invoiceNumber: invoice.invoiceNumber, learnerId: learner.id };
        const message = `Reminder: Fee Invoice ${invoice.invoiceNumber} for ${learner.firstName} is outstanding. Balance: KES ${Number(invoice.balance).toLocaleString()}. Thank you.`;

        if (channel === 'SMS' || channel === 'BOTH') {
          outcome.sms = await SmsService.sendSms(contactPhone, message)
            .then(r => r.success ? 'Sent' : `Failed: ${r.error}`)
            .catch(e => `Error: ${e.message}`);
        }
        if (channel === 'WHATSAPP' || channel === 'BOTH') {
          outcome.whatsapp = await whatsappService.sendMessage({ to: contactPhone, message })
            .then(r => r.success ? 'Sent' : `Failed: ${r.message}`)
            .catch(e => `Error: ${e.message}`);
        }

        outcomes.push(outcome);
        await new Promise(r => setTimeout(r, 500));
      }

      const failed = outcomes.filter(o =>
        (o.sms && !o.sms.startsWith('Sent')) ||
        (o.whatsapp && !o.whatsapp.startsWith('Sent')) ||
        o.skipped
      );
      if (failed.length > 0) {
        logger.warn(`[BulkReminders] ${failed.length}/${outcomes.length} reminders failed or skipped:`, JSON.stringify(failed));
      }
    });

    res.json({ success: true, message: `Reminder process started for ${invoices.length} invoices.` });
  }

  // ─── Export / Email ─────────────────────────────────────────────────────────

  async exportInvoices(req: AuthRequest, res: Response) {
    const { status, term, academicYear, grade, learnerId } = req.query;
    const where: any = {};

    if (status)      where.status = status;
    if (term)        where.term = term;
    if (academicYear) where.academicYear = parseInt(academicYear as string);
    if (learnerId)   where.learnerId = learnerId;
    if (grade)       where.learner = { grade };
    applyInvoiceInstitutionScope(req, where);

    const invoices = await prisma.feeInvoice.findMany({
      where,
      include: {
        learner: { select: { firstName: true, lastName: true, admissionNumber: true, grade: true, stream: true } },
        feeStructure: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const headers = ['Invoice Number','Student Name','Admission No','Grade','Stream','Fee Structure','Total Amount','Paid Amount','Balance','Status','Due Date'];
    const rows = invoices.map((inv: any) =>
      [
        inv.invoiceNumber,
        `${inv.learner?.firstName || ''} ${inv.learner?.lastName || ''}`,
        inv.learner?.admissionNumber || '',
        inv.learner?.grade || 'N/A',
        inv.learner?.stream || 'N/A',
        inv.feeStructure?.name || 'N/A',
        inv.totalAmount,
        inv.paidAmount,
        inv.balance,
        inv.status,
        inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    );

    const csvStr = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fee_invoices_report.csv');
    res.send(csvStr);
  }

  async emailStatement(req: AuthRequest, res: Response) {
    const { learnerId } = req.params;
    const { pdfBase64 } = req.body;

    if (!pdfBase64) throw new ApiError(400, 'PDF document is required');
    if (!pdfBase64.startsWith('data:application/pdf;base64,')) throw new ApiError(400, 'Invalid file type — only PDF documents are accepted');
    if (pdfBase64.length > 7 * 1024 * 1024) throw new ApiError(413, 'PDF file is too large — maximum size is 5 MB');

    const learner = await prisma.learner.findUnique({ where: { id: learnerId }, include: { parent: true } });
    if (!learner) throw new ApiError(404, 'Learner not found');

    const contactEmail = learner.guardianEmail || learner.parent?.email || (learner as any).email;
    if (!contactEmail) throw new ApiError(400, 'Student has no linked email address');

    const pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    const school = await prisma.school.findFirst({ select: { name: true } });

    await EmailService.sendFeeStatementEmail({
      to: contactEmail,
      schoolName: school?.name || 'School',
      parentName: learner.guardianName || learner.parent?.firstName || 'Parent/Guardian',
      learnerName: `${learner.firstName} ${learner.lastName}`,
      pdfBuffer
    });

    res.json({ success: true, message: 'Statement emailed successfully' });
  }

  async resetAllAccounting(req: AuthRequest, res: Response) {
    const { confirmToken } = req.body;
    if (confirmToken !== 'RESET_TOTAL_ACCOUNTING') {
      throw new ApiError(400, 'Invalid confirmation token for total reset');
    }

    logger.info('[SystemMaintenance] Starting Total Financial Reset...');

    try {
      await prisma.$transaction([
        // 1. Fee Relations
        prisma.feePayment.deleteMany({}),
        prisma.feeWaiver.deleteMany({}),
        prisma.feePledge.deleteMany({}),
        prisma.feeComment.deleteMany({}),
        prisma.feeInvoice.deleteMany({}),

        // 2. Ledger
        prisma.journalItem.deleteMany({}),
        prisma.journalEntry.deleteMany({}),

        // 3. Peripheral Financials
        prisma.expense.deleteMany({}),
        prisma.payrollRecord.deleteMany({}),
        prisma.bankStatementLine.deleteMany({}),
        prisma.bankStatement.deleteMany({})
      ]);

      logger.info('[SystemMaintenance] Total Reset Success.');
      res.json({ success: true, message: 'All financial data has been reset to zero successfully.' });
    } catch (error: any) {
      logger.error('[SystemMaintenance] Total Reset Failed:', error);
      throw new ApiError(500, `Reset failed: ${error.message}`);
    }
  }
}

export const feeController = new FeeController();
