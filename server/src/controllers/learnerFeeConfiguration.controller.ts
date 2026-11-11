import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { calculateLearnerInvoice } from '../services/learnerFeeConfiguration.service';
import { accountingService } from '../services/accounting.service';
import { NotificationService, NotificationType } from '../services/notification.service';

export class LearnerFeeConfigurationController {
  private periodRank(term: any, academicYear: number) {
    const termIndex: Record<string, number> = { TERM_1: 1, TERM_2: 2, TERM_3: 3 };
    return Number(academicYear) * 3 + (termIndex[String(term)] || 0);
  }

  private async reviseUnpaidInvoicesForConfiguration(
    configuration: any,
    userId: string,
    reason: string,
    client: any = prisma,
    options: { fromPeriodRank?: number; useCurrentApprovedConfiguration?: boolean } = {},
  ) {
    if (configuration.status !== 'APPROVED' && !options.useCurrentApprovedConfiguration) return 0;

    const start = this.periodRank(configuration.startTerm, configuration.startAcademicYear);
    const end = configuration.endTerm && configuration.endAcademicYear
      ? this.periodRank(configuration.endTerm, configuration.endAcademicYear)
      : Number.POSITIVE_INFINITY;

    const invoices = await client.feeInvoice.findMany({
      where: {
        learnerId: configuration.learnerId,
        archived: false,
        status: { not: 'CANCELLED' },
        paidAmount: 0,
        sponsorPaidAmount: 0,
      },
      include: {
        learner: true,
        feeStructure: { include: { feeItems: { include: { feeType: true } } } },
      },
    });

    let revised = 0;
    for (const invoiceSummary of invoices) {
      const invoiceRank = this.periodRank(invoiceSummary.term, invoiceSummary.academicYear);
      if (invoiceRank < start || invoiceRank > end) continue;
      if (options.fromPeriodRank !== undefined && invoiceRank < options.fromPeriodRank) continue;

      // Re-read within the same transaction so a payment posted after the
      // initial candidate scan prevents the invoice from being revised.
      const invoice = await client.feeInvoice.findUnique({
        where: { id: invoiceSummary.id },
        include: {
          learner: true,
          feeStructure: { include: { feeItems: { include: { feeType: true } } } },
        },
      });
      if (!invoice || invoice.archived || invoice.status === 'CANCELLED'
        || Number(invoice.paidAmount) > 0 || Number(invoice.sponsorPaidAmount || 0) > 0) continue;

      const calculation = await calculateLearnerInvoice({
        learner: invoice.learner,
        feeStructure: invoice.feeStructure,
        term: invoice.term,
        academicYear: invoice.academicYear,
        includeTransport: Number(invoice.transportBilled) > 0 || invoice.learner.isTransportStudent,
        carryForwardAmount: Number(invoice.carryForwardAmount || 0),
        client,
        configuration: options.useCurrentApprovedConfiguration ? null : configuration,
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

      await client.feeInvoiceRevision.create({
        data: {
          invoiceId: invoice.id,
          revisionNumber,
          reason,
          previousSnapshot,
          revisedSnapshot: { ...calculation, revisionNumber },
          revisedById: userId,
        },
      });
      const updated = await client.feeInvoice.updateMany({
        where: {
          id: invoice.id,
          archived: false,
          status: { not: 'CANCELLED' },
          paidAmount: 0,
          sponsorPaidAmount: 0,
          revisionNumber: invoice.revisionNumber,
        },
        data: {
          totalAmount: calculation.totalAmount,
          balance: calculation.totalAmount,
          grossAmount: calculation.grossAmount,
          adjustmentAmount: calculation.adjustmentAmount,
          sponsorAmount: calculation.sponsorAmount,
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
      });
      if (updated.count !== 1) {
        throw new ApiError(409, `Invoice ${invoice.invoiceNumber} changed while the fee configuration was being applied. Retry the action.`);
      }
      const previousLedgerTotal = Number(invoice.totalAmount) + Number(invoice.sponsorAmount || 0);
      const revisedLedgerTotal = Number(calculation.totalAmount) + Number(calculation.sponsorAmount || 0);
      const previousTransport = Math.min(Number(invoice.transportBilled || 0), previousLedgerTotal);
      const revisedTransport = Math.min(Number(calculation.transportAmount || 0), revisedLedgerTotal);
      await accountingService.postFeeInvoiceRevisionToLedger(
        invoice.invoiceNumber,
        revisionNumber,
        revisedLedgerTotal - previousLedgerTotal,
        client,
        {
          oldTotalAmount: previousLedgerTotal,
          newTotalAmount: revisedLedgerTotal,
          oldTransportAmount: previousTransport,
          newTransportAmount: revisedTransport,
        },
      );
      revised += 1;
    }
    return revised;
  }

  private async notifyPendingApproval(configuration: any) {
    if (configuration.status !== 'PENDING_APPROVAL') return;

    const learner = configuration.learner || {};
    const learnerName = [learner.firstName, learner.lastName]
      .filter(Boolean)
      .join(' ')
      || learner.name
      || 'Learner';

    // Deep-link to the learner's financials tab so the approver lands directly
    // on the fee configuration panel. The format is understood by both the bell
    // click handler and the NotificationCenter router.
    const deepLink = `/app/learner-profile?learnerId=${configuration.learnerId}&tab=financials`;

    try {
      await NotificationService.notifyRoles(['ADMIN', 'HEAD_TEACHER'], {
        title: 'Fee configuration approval needed',
        message: `${learnerName} has a fee configuration waiting for approval.`,
        type: NotificationType.WARNING,
        link: deepLink,
        showAsPopup: true,
        metadata: {
          kind: 'FEE_CONFIGURATION_APPROVAL',
          configurationId: configuration.id,
          learnerId: configuration.learnerId,
          learnerName,
          admissionNumber: learner.admissionNumber || null,
          grade: learner.grade || null,
          submittedAt: configuration.createdAt,
        },
      });
    } catch (error) {
      console.error('[LearnerFeeConfiguration] Failed to send approval notification:', error);
    }
  }

  private async notifyConfigurationSubmitter(configuration: any, action: 'approved' | 'revoked') {
    if (!configuration.createdById) return;
    const title = action === 'approved' ? 'Fee configuration approved' : 'Fee configuration revoked';
    const message = action === 'approved'
      ? `${configuration.name} was approved. Any eligible unpaid invoices have been updated.`
      : `${configuration.name} was revoked. Future unpaid invoices were recalculated; existing payment history was preserved.`;
    try {
      await NotificationService.createNotification({
        userId: configuration.createdById,
        title,
        message,
        type: NotificationType.APPROVAL,
        link: `/app/learner-profile?learnerId=${configuration.learnerId}&tab=financials`,
      });
    } catch (error) {
      // Notifications are best-effort and occur only after the financial
      // transaction commits; a notification outage must not undo ledger work.
      console.warn(`[FeeConfiguration] Could not notify submitter after ${action}:`, error);
    }
  }

  async list(req: AuthRequest, res: Response) {
    const data = await prisma.learnerFeeConfiguration.findMany({
      where: { learnerId: req.params.learnerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data });
  }

  async create(req: AuthRequest, res: Response) {
    const scholarshipType = String(req.body.scholarshipType || 'NONE').toUpperCase();
    // Keep fullExemption in sync so the legacy calculation path also works
    const fullExemption = scholarshipType === 'FULL' ? true : (req.body.fullExemption ?? false);
    const data = await prisma.learnerFeeConfiguration.create({
      data: {
        ...req.body,
        scholarshipType,
        scholarshipAmount: req.body.scholarshipAmount !== undefined ? req.body.scholarshipAmount : null,
        fullExemption,
        status: req.body.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'DRAFT',
        createdById: req.user!.userId,
      },
      include: { learner: true },
    });
    await this.notifyPendingApproval(data);
    res.status(201).json({ success: true, data });
  }

  async update(req: AuthRequest, res: Response) {
    const existing = await prisma.learnerFeeConfiguration.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Fee configuration not found');
    if (existing.status === 'APPROVED') {
      throw new ApiError(409, 'Approved fee configurations are immutable. Create a new configuration and submit it for approval.');
    }
    if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
      throw new ApiError(409, 'Only draft or pending fee configurations can be edited. Create a new configuration instead.');
    }
    const scholarshipType = req.body.scholarshipType
      ? String(req.body.scholarshipType).toUpperCase()
      : String((existing as any).scholarshipType || 'NONE').toUpperCase();
    const fullExemption = scholarshipType === 'FULL' ? true : (req.body.fullExemption ?? (existing as any).fullExemption ?? false);
    const data = await prisma.learnerFeeConfiguration.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        scholarshipType,
        scholarshipAmount: req.body.scholarshipAmount !== undefined ? req.body.scholarshipAmount : (existing as any).scholarshipAmount,
        fullExemption,
        status: existing.status,
      },
      include: { learner: true },
    });
    const revisedInvoices = await this.reviseUnpaidInvoicesForConfiguration(
      data,
      req.user!.userId,
      `Fee setup amended: ${data.name}`
    );
    await this.notifyPendingApproval(data);
    res.json({ success: true, data, revisedInvoices });
  }

  async approve(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { data, revisedInvoices } = await prisma.$transaction(async (tx) => {
      const configuration = await tx.learnerFeeConfiguration.findUnique({ where: { id: req.params.id } });
      if (!configuration) throw new ApiError(404, 'Fee configuration not found');
      if (configuration.status !== 'PENDING_APPROVAL') {
        throw new ApiError(409, `Only pending fee configurations can be approved (current status: ${configuration.status}).`);
      }
      if (configuration.createdById === userId) {
        throw new ApiError(403, 'You cannot approve a fee configuration you submitted. Ask another approver.');
      }

      const approved = await tx.learnerFeeConfiguration.findMany({
        where: { learnerId: configuration.learnerId, status: 'APPROVED', id: { not: configuration.id } },
      });
      const start = this.periodRank(configuration.startTerm, configuration.startAcademicYear);
      const end = configuration.endTerm && configuration.endAcademicYear
        ? this.periodRank(configuration.endTerm, configuration.endAcademicYear)
        : Number.POSITIVE_INFINITY;
      const overlaps = approved.some((item) => {
        const itemStart = this.periodRank(item.startTerm, item.startAcademicYear);
        const itemEnd = item.endTerm && item.endAcademicYear
          ? this.periodRank(item.endTerm, item.endAcademicYear)
          : Number.POSITIVE_INFINITY;
        return start <= itemEnd && end >= itemStart;
      });
      if (overlaps) {
        throw new ApiError(400, 'This period overlaps another approved fee configuration. Revoke the previous configuration first.');
      }

      const claimed = await tx.learnerFeeConfiguration.updateMany({
        where: { id: configuration.id, status: 'PENDING_APPROVAL', createdById: { not: userId } },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
          revokedById: null,
          revokedAt: null,
        },
      });
      if (claimed.count !== 1) throw new ApiError(409, 'This fee configuration was already actioned. Refresh and try again.');

      const data = await tx.learnerFeeConfiguration.findUnique({ where: { id: configuration.id } });
      if (!data) throw new ApiError(500, 'Approved fee configuration could not be reloaded inside the transaction.');
      const revisedInvoices = await this.reviseUnpaidInvoicesForConfiguration(
        data,
        userId,
        `Fee configuration approved: ${data.name}`,
        tx,
      );
      return { data, revisedInvoices };
    }, { isolationLevel: 'Serializable' });
    await this.notifyConfigurationSubmitter(data, 'approved');
    res.json({ success: true, data, revisedInvoices, message: 'Fee configuration approved' });
  }

  async revoke(req: AuthRequest, res: Response) {
    const userId = req.user!.userId;
    const { data, revisedInvoices } = await prisma.$transaction(async (tx) => {
      const configuration = await tx.learnerFeeConfiguration.findUnique({ where: { id: req.params.id } });
      if (!configuration) throw new ApiError(404, 'Fee configuration not found');
      if (configuration.status !== 'APPROVED') {
        throw new ApiError(409, `Only approved fee configurations can be revoked (current status: ${configuration.status}).`);
      }
      const activeTerm = await tx.termConfig.findFirst({
        where: { isActive: true, archived: false },
        select: { term: true, academicYear: true },
      });
      if (!activeTerm) throw new ApiError(409, 'Set an active school term before revoking this configuration so future invoices can be identified safely.');

      const revoked = await tx.learnerFeeConfiguration.updateMany({
        where: { id: configuration.id, status: 'APPROVED' },
        data: { status: 'REVOKED', revokedById: userId, revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new ApiError(409, 'This fee configuration was already actioned. Refresh and try again.');

      const data = await tx.learnerFeeConfiguration.findUnique({ where: { id: configuration.id } });
      if (!data) throw new ApiError(500, 'Revoked fee configuration could not be reloaded inside the transaction.');
      const revisedInvoices = await this.reviseUnpaidInvoicesForConfiguration(
        data,
        userId,
        `Fee configuration revoked: ${data.name}`,
        tx,
        {
          fromPeriodRank: this.periodRank(activeTerm.term, activeTerm.academicYear) + 1,
          useCurrentApprovedConfiguration: true,
        },
      );
      return { data, revisedInvoices };
    }, { isolationLevel: 'Serializable' });
    await this.notifyConfigurationSubmitter(data, 'revoked');
    res.json({ success: true, data, revisedInvoices, message: `Fee configuration revoked. ${revisedInvoices} future unpaid invoice(s) were recalculated; current and past invoice snapshots were preserved.` });
  }

  async destroy(req: AuthRequest, res: Response) {
    const configuration = await prisma.learnerFeeConfiguration.findUnique({ where: { id: req.params.id } });
    if (!configuration) throw new ApiError(404, 'Fee configuration not found');
    // Only non-approved configs can be deleted. Approved ones must be revoked first
    // to preserve the audit trail of what scholarships were active.
    if (configuration.status === 'APPROVED') {
      throw new ApiError(
        400,
        'This configuration has been approved. Revoke it first before deleting.'
      );
    }
    await prisma.learnerFeeConfiguration.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Fee configuration deleted' });
  }

  async preview(req: AuthRequest, res: Response) {
    const { learnerId, feeStructureId, term, academicYear, configuration } = req.body;
    const [learner, feeStructure] = await Promise.all([
      prisma.learner.findUnique({ where: { id: learnerId } }),
      prisma.feeStructure.findUnique({
        where: { id: feeStructureId },
        include: { feeItems: { include: { feeType: true } } },
      }),
    ]);
    if (!learner || !feeStructure) throw new ApiError(404, 'Learner or fee structure not found');
    const data = await calculateLearnerInvoice({
      learner,
      feeStructure,
      term,
      academicYear,
      carryForwardAmount: 0,
      configuration,
    });
    res.json({ success: true, data });
  }
}

export const learnerFeeConfigurationController = new LearnerFeeConfigurationController();
