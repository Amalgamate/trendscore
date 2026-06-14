/**
 * Fee Service
 *
 * Canonical transport-amount resolution lives here and is shared by both
 * auto-generation (on admission) and the fee controller's createInvoice /
 * bulkGenerateInvoices paths.
 *
 * FIX: The previous split between fee.service.ts (route-based transport) and
 * fee.controller.ts (fee-structure-item-based transport) meant the same learner
 * could get different totals depending on which code path ran. Both paths now
 * call resolveTransportAmount() from this file so the logic is a single
 * source of truth.
 */

import prisma from '../config/database';
import { calculateLearnerInvoice } from './learnerFeeConfiguration.service';
import { configService } from './config.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { whatsappService } from './whatsapp.service';
import { accountingService } from './accounting.service';

const SKIP_FEE_NOTIFICATIONS = process.env.SKIP_FEE_NOTIFICATIONS === 'true' || process.env.NODE_ENV === 'test';

const INVOICE_NUMBER_RETRY_COUNT = 3;

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
      if (error?.code === 'P2002' && attempt < INVOICE_NUMBER_RETRY_COUNT) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Canonical transport amount resolver.
 *
 * Strategy (priority order):
 *  1. If the fee structure already has a TRANSPORT fee-type line item, use that
 *     amount — this is the standard case for manually-created structures.
 *  2. Otherwise, if the learner has an active TransportAssignment with a route,
 *     use the route's amount — this covers route-specific pricing.
 *  3. Fallback: return 0 (no transport charged).
 *
 * The hardcoded 4500 fallback that existed in the old service has been removed;
 * transport fees should always come from a persisted data source.
 */
export async function resolveTransportAmount(
  learnerId: string,
  feeStructureItems: Array<{ amount: number | string; feeType?: { code: string } }>
): Promise<number> {
  // Strategy 1: fee structure has a TRANSPORT line item
  const structureTransportItem = feeStructureItems.find(
    (i) => i.feeType?.code === 'TRANSPORT'
  );
  if (structureTransportItem) {
    return Number(structureTransportItem.amount);
  }

  // Strategy 2: learner has an active transport route assignment
  const assignment = await prisma.transportAssignment.findFirst({
    where: { passengerId: learnerId, archived: false },
    include: { route: true }
  });

  if (assignment?.route && Number(assignment.route.amount) > 0) {
    return Number(assignment.route.amount);
  }

  // Strategy 3: no transport fee found
  return 0;
}

export class FeeService {
  /**
   * Automatically generate an invoice for a learner based on their grade and the active term.
   * Called when a learner is admitted or when the onboarding workflow triggers it.
   */
  async generateInvoiceForLearner(learnerId: string): Promise<any> {
    console.log(`[FeeService] Attempting to generate invoice for learner: ${learnerId}`);

    try {
      // 1. Fetch learner details
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        include: { parent: true }
      });

      if (!learner) {
        console.error(`[FeeService] Learner not found: ${learnerId}`);
        return { success: false, error: 'Learner not found' };
      }

      if (learner.status !== 'ACTIVE' || learner.archived) {
        console.log(`[FeeService] Learner ${learner.admissionNumber} is not active. Skipping.`);
        return { success: false, error: 'Learner is not active' };
      }

      // 2. Determine active term
      const activeTermConfig = await configService.getActiveTermConfig();
      if (!activeTermConfig) {
        const errorMsg =
          'No active term configuration found. Please set a term as active in Settings.';
        console.warn(`[FeeService] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      const { term, academicYear } = activeTermConfig;
      console.log(`[FeeService] Active Period: ${term} ${academicYear}`);

      // 3. Find matching fee structure for this grade + term
      const feeStructure = await prisma.feeStructure.findFirst({
        where: {
          academicYear,
          term: term as any,
          grade: learner.grade as any,
          active: true
        },
        include: {
          feeItems: { include: { feeType: true } }
        }
      });

      if (!feeStructure) {
        const errorMsg = `No matching fee structure found for ${learner.grade.replace('_', ' ')} (${term.replace('_', ' ')} ${academicYear})`;
        console.warn(`[FeeService] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // 4. Check for existing invoice (idempotent)
      const existingInvoice = await prisma.feeInvoice.findFirst({
        where: { learnerId, feeStructureId: feeStructure.id, term: term as any, academicYear }
      });
      if (existingInvoice) {
        return { success: true, invoice: existingInvoice, created: false };
      }

      // Carry forward previous-term net balance (positive = outstanding, negative = credit/overpaid)
      const getPreviousTermContext = (
        currentTerm: 'TERM_1' | 'TERM_2' | 'TERM_3',
        currentYear: number
      ): { term: 'TERM_1' | 'TERM_2' | 'TERM_3'; academicYear: number } | null => {
        if (currentTerm === 'TERM_2') return { term: 'TERM_1', academicYear: currentYear };
        if (currentTerm === 'TERM_3') return { term: 'TERM_2', academicYear: currentYear };
        return { term: 'TERM_3', academicYear: currentYear - 1 };
      };

      const prevCtx = getPreviousTermContext(term as any, Number(academicYear));
      let carryForwardAmount = 0;
      if (prevCtx) {
        const previousInvoices = await prisma.feeInvoice.findMany({
          where: {
            learnerId,
            term: prevCtx.term as any,
            academicYear: prevCtx.academicYear,
            archived: false,
            status: { not: 'CANCELLED' as any }
          },
          select: { balance: true }
        });
        carryForwardAmount = previousInvoices.reduce(
          (sum, inv) => sum + Number(inv.balance || 0),
          0
        );
      }
      const calculation = await calculateLearnerInvoice({
        learner,
        feeStructure,
        term,
        academicYear,
        carryForwardAmount,
      });

      // 6. Due date = 14 days from today
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      // 7. Create invoice
      const newInvoice = await createInvoiceWithSafeNumber(
        prisma,
        {
          learnerId,
          feeStructureId: feeStructure.id,
          term,
          academicYear,
          dueDate,
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
          issuedBy: 'SYSTEM'
        },
        { learner: true }
      );

      // 8. Post to accounting ledger (best-effort)
      try {
        await accountingService.postFeeInvoiceToLedger(newInvoice);
      } catch (ledgerError: any) {
        console.warn(
          `[FeeService] Failed to post invoice to ledger: ${ledgerError?.message || ledgerError}`
        );
      }

      // 9. Notifications (best-effort — never blocks invoice creation)
      if (!SKIP_FEE_NOTIFICATIONS && learner.parent && learner.parent.phone) {
        const parentPhone = learner.parent.phone;
        const parentName = `${learner.parent.firstName} ${learner.parent.lastName}`;
        const learnerName = `${learner.firstName} ${learner.lastName}`;
        const school = await prisma.school.findFirst();
        const schoolName = school?.name || 'School';

        await Promise.allSettled([
          SmsService.sendFeeInvoiceNotification({
            parentPhone,
            parentName,
            learnerName,
            invoiceNumber: newInvoice.invoiceNumber,
            term: `${term.replace('_', ' ')} ${academicYear}`,
            amount: calculation.totalAmount,
            dueDate: dueDate.toLocaleDateString()
          }),
          whatsappService.sendFeeReminder({
            parentPhone,
            parentName,
            learnerName,
            amountDue: calculation.totalAmount,
            dueDate: dueDate.toLocaleDateString()
          }),
          ...(learner.parent.email
            ? [
                EmailService.sendFeeInvoiceEmail({
                  to: learner.parent.email,
                  schoolName,
                  parentName,
                  learnerName,
                  invoiceNumber: newInvoice.invoiceNumber,
                  term: `${term.replace('_', ' ')} ${academicYear}`,
                  amount: calculation.totalAmount,
                  dueDate: dueDate.toLocaleDateString(),
                  feeItems: (calculation.calculationSnapshot.lineItems || []).map((item: any) => ({
                    name: item.name,
                    amount: Number(item.studentAmount)
                  }))
                })
              ]
            : [])
        ]);
      }

      return { success: true, invoice: newInvoice, created: true };
    } catch (error: any) {
      console.error(`[FeeService] Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export const feeService = new FeeService();
