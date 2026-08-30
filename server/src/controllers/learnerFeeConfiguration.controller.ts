import { Response } from 'express';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';
import { AuthRequest } from '../middleware/permissions.middleware';
import { calculateLearnerInvoice } from '../services/learnerFeeConfiguration.service';
import { NotificationService, NotificationType } from '../services/notification.service';

export class LearnerFeeConfigurationController {
  private periodRank(term: any, academicYear: number) {
    const termIndex: Record<string, number> = { TERM_1: 1, TERM_2: 2, TERM_3: 3 };
    return Number(academicYear) * 3 + (termIndex[String(term)] || 0);
  }

  private async reviseUnpaidInvoicesForConfiguration(configuration: any, userId: string, reason: string) {
    if (configuration.status !== 'APPROVED') return 0;

    const start = this.periodRank(configuration.startTerm, configuration.startAcademicYear);
    const end = configuration.endTerm && configuration.endAcademicYear
      ? this.periodRank(configuration.endTerm, configuration.endAcademicYear)
      : Number.POSITIVE_INFINITY;

    const invoices = await prisma.feeInvoice.findMany({
      where: {
        learnerId: configuration.learnerId,
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
    for (const invoice of invoices) {
      const invoiceRank = this.periodRank(invoice.term, invoice.academicYear);
      if (invoiceRank < start || invoiceRank > end) continue;

      const calculation = await calculateLearnerInvoice({
        learner: invoice.learner,
        feeStructure: invoice.feeStructure,
        term: invoice.term,
        academicYear: invoice.academicYear,
        includeTransport: Number(invoice.transportBilled) > 0 || invoice.learner.isTransportStudent,
        carryForwardAmount: Number(invoice.carryForwardAmount || 0),
        configuration,
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

      await prisma.$transaction(async (tx) => {
        await tx.feeInvoiceRevision.create({
          data: {
            invoiceId: invoice.id,
            revisionNumber,
            reason,
            previousSnapshot,
            revisedSnapshot: { ...calculation, revisionNumber },
            revisedById: userId,
          },
        });
        await tx.feeInvoice.update({
          where: { id: invoice.id },
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
      });
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

    try {
      await NotificationService.notifyRoles(['ADMIN', 'SUPER_ADMIN'], {
        title: 'Fee configuration approval needed',
        message: `${learnerName} has a fee configuration waiting for approval.`,
        type: NotificationType.WARNING,
        link: '/finance/fees',
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
        status: existing.status === 'APPROVED' ? 'APPROVED' : req.body.status,
      },
      include: { learner: true },
    });
    const revisedInvoices = await this.reviseUnpaidInvoicesForConfiguration(
      data,
      req.user!.userId,
      `Fee setup amended: ${data.name}`
    );
    if (existing.status !== 'PENDING_APPROVAL') {
      await this.notifyPendingApproval(data);
    }
    res.json({ success: true, data, revisedInvoices });
  }

  async approve(req: AuthRequest, res: Response) {
    const configuration = await prisma.learnerFeeConfiguration.findUnique({ where: { id: req.params.id } });
    if (!configuration) throw new ApiError(404, 'Fee configuration not found');
    const approved = await prisma.learnerFeeConfiguration.findMany({
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
    const data = await prisma.learnerFeeConfiguration.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedById: req.user!.userId,
        approvedAt: new Date(),
        revokedById: null,
        revokedAt: null,
      },
    });
    res.json({ success: true, data, message: 'Fee configuration approved' });
  }

  async revoke(req: AuthRequest, res: Response) {
    const data = await prisma.learnerFeeConfiguration.update({
      where: { id: req.params.id },
      data: {
        status: 'REVOKED',
        revokedById: req.user!.userId,
        revokedAt: new Date(),
      },
    });
    res.json({ success: true, data, message: 'Fee configuration revoked' });
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
