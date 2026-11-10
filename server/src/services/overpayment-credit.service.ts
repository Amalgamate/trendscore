import prisma from '../config/database';
import { accountingService } from './accounting.service';
import logger from '../utils/logger';

/**
 * Overpayment Credit Service
 *
 * When an M-Pesa (or any) payment exceeds the invoice balance, the excess is
 * held as an unallocated credit in the "Tuition Deposits" liability account
 * (code 2100). Finance staff can later allocate the credit to a sibling's
 * invoice — the screen pre-selects the sibling with the biggest outstanding
 * balance, but staff can override.
 *
 * Ledger entries:
 *   On overpayment detection:
 *     Dr Bank 1210 (full payment amount)
 *     Cr AR 1100  (invoice portion)
 *     Cr Tuition Deposits 2100 (excess)
 *
 *   On credit allocation to a sibling:
 *     Dr Tuition Deposits 2100 (allocated amount)
 *     Cr AR 1100 (sibling invoice portion)
 */

class OverpaymentCreditService {
    /**
     * Detect whether a payment resulted in an OVERPAID invoice and, if so,
     * post the excess to the Tuition Deposits liability account.
     *
     * This is called after the FeePayment + invoice update have committed.
     * It reads the invoice to compute the exact excess (paidAmount - totalAmount)
     * and creates a separate journal entry for the held credit.
     *
     * @returns the excess amount posted, or 0 if no overpayment.
     */
    async detectAndPostOverpayment(invoiceId: string, paymentId: string): Promise<number> {
        const invoice = await prisma.feeInvoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                paidAmount: true,
                balance: true,
                status: true,
                learnerId: true,
            },
        });

        if (!invoice) {
            logger.warn(`[Overpayment] Invoice ${invoiceId} not found`);
            return 0;
        }

        if (invoice.status !== 'OVERPAID') {
            return 0;
        }

        const paidAmount = Number(invoice.paidAmount);
        const totalAmount = Number(invoice.totalAmount);
        const excess = paidAmount - totalAmount;

        if (excess <= 0.01) {
            // Not a real overpayment — might be a rounding artefact
            return 0;
        }

        logger.info(
            `[Overpayment] Invoice ${invoice.invoiceNumber} overpaid by KES ${excess.toFixed(2)} — posting to Tuition Deposits`
        );

        // Post: Dr Tuition Deposits 2100 (debit reduces the liability — but
        // actually we want to *credit* it to increase the liability, because
        // the school now owes the parent this excess).
        //
        // Correct double-entry for the excess portion:
        //   The original payment entry already debited Bank for the full amount
        //   and credited AR for the full amount. We need to split the credit:
        //   - AR should only be credited for the invoice portion
        //   - Tuition Deposits should be credited for the excess
        //
        // Since the ledger entry for the full payment was already posted by
        // postFeePaymentToLedger (Dr Bank, Cr AR — full amount), we now post
        // a correction entry to move the excess from AR to Tuition Deposits:
        //   Dr AR 1100 (excess — reduces the over-credited AR)
        //   Cr Tuition Deposits 2100 (excess — increases the held credit)
        try {
            await this.postExcessToTuitionDeposits(invoice.invoiceNumber, excess, paymentId);
        } catch (err: any) {
            logger.error(`[Overpayment] Failed to post excess to Tuition Deposits:`, err?.message ?? err);
        }

        return excess;
    }

    /**
     * Post the excess amount as a held credit in Tuition Deposits.
     * Correction entry: Dr AR 1100, Cr Tuition Deposits 2100.
     */
    private async postExcessToTuitionDeposits(
        invoiceNumber: string,
        excess: number,
        paymentId: string,
    ): Promise<void> {
        let arAccount = await accountingService.getAccountByCode('1100');
        let depositsAccount = await accountingService.getAccountByCode('2100');
        let journal = await accountingService.getJournalByCode('MISC');

        if (!arAccount || !depositsAccount || !journal) {
            logger.warn('[Overpayment] Missing accounts/journal — ensuring defaults');
            await accountingService.ensureDefaultAccountingSetup();
            accountingService.clearCache();
            arAccount = await accountingService.getAccountByCode('1100');
            depositsAccount = await accountingService.getAccountByCode('2100');
            journal = await accountingService.getJournalByCode('MISC');
        }

        if (!arAccount || !depositsAccount || !journal) {
            logger.error('[Overpayment] Still missing required accounts/journal — skipping');
            return;
        }

        const reference = `OVERPAY/${invoiceNumber}/${paymentId.slice(0, 8)}`;
        const entry = await accountingService.createJournalEntry({
            journalId: journal.id,
            reference,
            date: new Date(),
            items: [
                {
                    accountId: arAccount.id,
                    debit: Number(excess),
                    label: `Overpayment correction: excess from ${invoiceNumber}`,
                },
                {
                    accountId: depositsAccount.id,
                    credit: Number(excess),
                    label: `Held credit: overpayment on ${invoiceNumber}`,
                },
            ],
        });

        await accountingService.postJournalEntry(entry.id);
        logger.info(`[Overpayment] Posted excess KES ${excess.toFixed(2)} to Tuition Deposits — ref ${reference}`);
    }

    /**
     * Get all OVERPAID invoices that have unallocated credit.
     * Finance staff use this to see which overpayments need allocation.
     */
    async getOverpaidInvoices() {
        const invoices = await prisma.feeInvoice.findMany({
            where: {
                status: 'OVERPAID',
                archived: false,
            },
            include: {
                learner: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        parentId: true,
                    },
                },
                payments: {
                    orderBy: { paymentDate: 'desc' },
                    take: 5,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Compute the credit amount for each
        return invoices.map((inv) => ({
            ...inv,
            creditAmount: Math.max(0, Number(inv.paidAmount) - Number(inv.totalAmount)),
        }));
    }

    /**
     * Get sibling invoices for a learner — used when allocating overpayment
     * credit. Returns outstanding invoices for siblings (same parentId),
     * sorted by biggest balance first (pre-selection target).
     */
    async getSiblingInvoices(learnerId: string) {
        const learner = await prisma.learner.findUnique({
            where: { id: learnerId },
            select: { id: true, parentId: true, firstName: true, lastName: true },
        });

        if (!learner) {
            throw new Error('Learner not found');
        }

        if (!learner.parentId) {
            // No parent linked — no siblings to allocate to
            return { learner, siblings: [] };
        }

        // Find siblings: other learners with the same parentId
        const siblings = await prisma.learner.findMany({
            where: {
                parentId: learner.parentId,
                id: { not: learnerId },
                archived: false,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                grade: true,
            },
        });

        if (siblings.length === 0) {
            return { learner, siblings: [] };
        }

        // Get outstanding invoices for each sibling
        const siblingIds = siblings.map((s) => s.id);
        const invoices = await prisma.feeInvoice.findMany({
            where: {
                learnerId: { in: siblingIds },
                status: { in: ['PENDING', 'PARTIAL'] },
                archived: false,
            },
            include: {
                learner: {
                    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
                },
            },
            orderBy: { balance: 'desc' }, // biggest balance first
        });

        // Pre-select: the sibling invoice with the biggest balance is the
        // recommended allocation target.
        return {
            learner,
            siblings,
            siblingInvoices: invoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                learnerId: inv.learnerId,
                learnerName: `${inv.learner.firstName} ${inv.learner.lastName}`,
                admissionNumber: inv.learner.admissionNumber,
                totalAmount: Number(inv.totalAmount),
                paidAmount: Number(inv.paidAmount),
                balance: Number(inv.balance),
                term: inv.term,
                academicYear: inv.academicYear,
                isPreSelected: invoices[0]?.id === inv.id,
            })),
        };
    }

    /**
     * Allocate overpayment credit from one invoice to a sibling's invoice.
     *
     * @param sourceInvoiceId The OVERPAID invoice holding the credit
     * @param targetInvoiceId The sibling invoice to apply the credit to
     * @param amount The amount to allocate (must not exceed the credit)
     * @param allocatedBy The user ID of the finance staff member
     */
    async allocateCredit(
        sourceInvoiceId: string,
        targetInvoiceId: string,
        amount: number,
        allocatedBy: string,
    ) {
        const sourceInvoice = await prisma.feeInvoice.findUnique({
            where: { id: sourceInvoiceId },
            include: { learner: true },
        });

        if (!sourceInvoice) {
            throw new Error('Source invoice not found');
        }

        if (sourceInvoice.status !== 'OVERPAID') {
            throw new Error('Source invoice is not overpaid — no credit to allocate');
        }

        const creditAvailable = Math.max(0, Number(sourceInvoice.paidAmount) - Number(sourceInvoice.totalAmount));
        if (amount > creditAvailable + 0.01) {
            throw new Error(
                `Allocation amount KES ${amount.toFixed(2)} exceeds available credit KES ${creditAvailable.toFixed(2)}`
            );
        }

        const targetInvoice = await prisma.feeInvoice.findUnique({
            where: { id: targetInvoiceId },
            include: { learner: true },
        });

        if (!targetInvoice) {
            throw new Error('Target invoice not found');
        }

        if (targetInvoice.status === 'PAID' || targetInvoice.status === 'CANCELLED' || targetInvoice.status === 'WAIVED') {
            throw new Error('Target invoice is already settled');
        }

        // Verify siblings share a parent
        if (
            sourceInvoice.learner.parentId &&
            targetInvoice.learner.parentId &&
            sourceInvoice.learner.parentId !== targetInvoice.learner.parentId
        ) {
            throw new Error('Target invoice does not belong to a sibling — parents differ');
        }

        const allocationAmount = Math.min(amount, Number(targetInvoice.balance));

        logger.info(
            `[OverpaymentAlloc] Allocating KES ${allocationAmount.toFixed(2)} from invoice ${sourceInvoice.invoiceNumber} to ${targetInvoice.invoiceNumber}`
        );

        // ── 1. Create a FeePayment on the target invoice (credit transfer) ──
        let updatedTarget: any;
        let createdPaymentId: string | null = null;

        await prisma.$transaction(async (tx) => {
            const payment = await tx.feePayment.create({
                data: {
                    invoiceId: targetInvoiceId,
                    amount: allocationAmount,
                    paymentMethod: 'OTHER',
                    receiptNumber: `CREDIT-${sourceInvoice.invoiceNumber}-${Date.now()}`,
                    referenceNumber: `ALLOC-${sourceInvoice.invoiceNumber}`,
                    notes: `Credit allocation from overpaid invoice ${sourceInvoice.invoiceNumber} (${sourceInvoice.learner.firstName} ${sourceInvoice.learner.lastName})`,
                    recordedBy: allocatedBy,
                    paymentDate: new Date(),
                },
            });
            createdPaymentId = payment.id;

            // Apply to target invoice fields
            await tx.feeInvoice.update({
                where: { id: targetInvoiceId },
                data: {
                    paidAmount: { increment: allocationAmount },
                    balance: { decrement: allocationAmount },
                },
            });

            // Re-check target invoice status
            const freshTarget = await tx.feeInvoice.findUnique({ where: { id: targetInvoiceId } });
            if (freshTarget) {
                const paid = Number(freshTarget.paidAmount);
                const total = Number(freshTarget.totalAmount);
                const bal = Number(freshTarget.balance);
                let newStatus = freshTarget.status;
                if (paid > total) newStatus = 'OVERPAID' as any;
                else if (bal <= 0) newStatus = 'PAID' as any;
                else if (paid > 0) newStatus = 'PARTIAL' as any;

                updatedTarget = await tx.feeInvoice.update({
                    where: { id: targetInvoiceId },
                    data: { status: newStatus },
                });
            }
        });

        // ── 2. Reduce the source invoice's paidAmount (reverse the credit) ──
        await prisma.$transaction(async (tx) => {
            await tx.feeInvoice.update({
                where: { id: sourceInvoiceId },
                data: {
                    paidAmount: { decrement: allocationAmount },
                    balance: { increment: allocationAmount },
                },
            });

            // Re-check source invoice status — if paidAmount no longer exceeds
            // totalAmount, it reverts to PAID
            const freshSource = await tx.feeInvoice.findUnique({ where: { id: sourceInvoiceId } });
            if (freshSource) {
                const paid = Number(freshSource.paidAmount);
                const total = Number(freshSource.totalAmount);
                let newStatus = freshSource.status;
                if (paid > total) newStatus = 'OVERPAID' as any;
                else if (paid <= total && Number(freshSource.balance) <= 0) newStatus = 'PAID' as any;
                else if (paid > 0) newStatus = 'PARTIAL' as any;

                await tx.feeInvoice.update({
                    where: { id: sourceInvoiceId },
                    data: { status: newStatus },
                });
            }
        });

        // ── 3. Post ledger entry: Dr Tuition Deposits 2100, Cr AR 1100 ──
        // This reverses the held credit and applies it to the sibling's AR.
        if (createdPaymentId) {
            try {
                await this.postCreditAllocationToLedger(
                    sourceInvoice.invoiceNumber,
                    targetInvoice.invoiceNumber,
                    allocationAmount,
                    createdPaymentId,
                );
            } catch (ledgerErr: any) {
                logger.error('[OverpaymentAlloc] Ledger posting error:', ledgerErr?.message ?? ledgerErr);
            }
        }

        logger.info(
            `[OverpaymentAlloc] Allocated KES ${allocationAmount.toFixed(2)} from ${sourceInvoice.invoiceNumber} to ${targetInvoice.invoiceNumber}`
        );

        return {
            success: true,
            allocatedAmount: allocationAmount,
            sourceInvoiceStatus: (await prisma.feeInvoice.findUnique({ where: { id: sourceInvoiceId } }))?.status,
            targetInvoiceStatus: updatedTarget?.status,
        };
    }

    /**
     * Post the credit allocation to the ledger.
     * Dr Tuition Deposits 2100 (reduces the held credit)
     * Cr AR 1100 (applies credit to sibling's receivable)
     */
    private async postCreditAllocationToLedger(
        sourceInvoiceNumber: string,
        targetInvoiceNumber: string,
        amount: number,
        paymentId: string,
    ): Promise<void> {
        let depositsAccount = await accountingService.getAccountByCode('2100');
        let arAccount = await accountingService.getAccountByCode('1100');
        let journal = await accountingService.getJournalByCode('MISC');

        if (!depositsAccount || !arAccount || !journal) {
            await accountingService.ensureDefaultAccountingSetup();
            accountingService.clearCache();
            depositsAccount = await accountingService.getAccountByCode('2100');
            arAccount = await accountingService.getAccountByCode('1100');
            journal = await accountingService.getJournalByCode('MISC');
        }

        if (!depositsAccount || !arAccount || !journal) {
            logger.error('[OverpaymentAlloc] Missing accounts/journal — skipping ledger post');
            return;
        }

        const reference = `ALLOC/${sourceInvoiceNumber}/${targetInvoiceNumber}/${paymentId.slice(0, 8)}`;
        const entry = await accountingService.createJournalEntry({
            journalId: journal.id,
            reference,
            date: new Date(),
            items: [
                {
                    accountId: depositsAccount.id,
                    debit: Number(amount),
                    label: `Credit allocated from ${sourceInvoiceNumber} to ${targetInvoiceNumber}`,
                },
                {
                    accountId: arAccount.id,
                    credit: Number(amount),
                    label: `Credit applied to ${targetInvoiceNumber} from ${sourceInvoiceNumber}`,
                },
            ],
        });

        await accountingService.postJournalEntry(entry.id);
    }
}

export const overpaymentCreditService = new OverpaymentCreditService();
