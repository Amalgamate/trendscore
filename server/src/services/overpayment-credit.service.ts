import { accountingService } from './accounting.service';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import prisma from '../config/database';

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
     * Call after the FeePayment + invoice update, using the same transaction
     * client when the payment is still being committed. It computes the exact
     * excess (paidAmount - totalAmount) and posts the held credit atomically.
     *
     * @returns the excess amount posted, or 0 if no overpayment.
     */
    async detectAndPostOverpayment(invoiceId: string, paymentId: string, client: any = prisma): Promise<number> {
        const payment = await client.feePayment.findUnique({
            where: { id: paymentId },
            select: { id: true, invoiceId: true, amount: true, archived: true },
        });
        if (!payment || payment.archived || payment.invoiceId !== invoiceId) {
            logger.warn(`[Overpayment] Payment ${paymentId} is missing, archived, or linked to another invoice`);
            return 0;
        }

        const invoice = await client.feeInvoice.findUnique({
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
        const paymentAmount = Number(payment.amount);
        if (!Number.isFinite(paidAmount) || !Number.isFinite(totalAmount) || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            logger.warn(`[Overpayment] Invalid amount data for payment ${paymentId}`);
            return 0;
        }

        // Attribute only the additional excess created by this payment. A later
        // payment must not re-post the invoice's previously held credit.
        const excess = Math.max(0, paidAmount - totalAmount)
            - Math.max(0, paidAmount - paymentAmount - totalAmount);

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
        await this.postExcessToTuitionDeposits(invoice.invoiceNumber, excess, paymentId, client);

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
        client: any = prisma,
    ): Promise<void> {
        const [arAccount, depositsAccount, journal] = await Promise.all([
            accountingService.getAccountByCode('1100', client),
            accountingService.getAccountByCode('2100', client),
            accountingService.getJournalByCode('MISC', client),
        ]);

        if (!arAccount || !depositsAccount || !journal) {
            throw new Error('Overpayment accounts or journal are not configured; held-credit posting was not completed.');
        }

        // Full payment ID makes the posting idempotent per payment, including
        // callbacks/retries that replay after the ledger entry was committed.
        const reference = `OVERPAY/${invoiceNumber}/${paymentId}`;
        const existingEntry = await client.journalEntry.findFirst({
            where: { journalId: journal.id, reference },
        });
        if (existingEntry) {
            if (existingEntry.status === 'DRAFT') await accountingService.postJournalEntry(existingEntry.id, client);
            logger.info(`[Overpayment] Existing correction entry reused — ref ${reference}`);
            return;
        }

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
        }, client);

        await accountingService.postJournalEntry(entry.id, client);
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
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Enter a credit allocation greater than zero.');
        }

        const familySelect = {
            parentId: true,
            firstName: true,
            lastName: true,
            familyLinks: {
                where: { familyAccount: { status: 'ACTIVE' as const, archived: false } },
                select: { familyAccountId: true },
            },
        } as const;
        let sourceInvoice: any;
        let targetInvoice: any;
        const allocationAmount = amount;
        let updatedTarget: any;
        let createdPaymentId: string | null = null;

        // Retry serialization conflicts from simultaneous allocations. Both
        // invoice rows are re-read and conditionally updated in one transaction.
        let lastError: any;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const transactionResult = await prisma.$transaction(async (tx) => {
                    const [freshSource, freshTarget] = await Promise.all([
                        tx.feeInvoice.findUnique({ where: { id: sourceInvoiceId }, include: { learner: { select: familySelect } } }),
                        tx.feeInvoice.findUnique({ where: { id: targetInvoiceId }, include: { learner: { select: familySelect } } }),
                    ]);

                    if (!freshSource) throw new Error('Source invoice not found');
                    if (!freshTarget) throw new Error('Target invoice not found');
                    if (freshSource.status !== 'OVERPAID' || freshSource.archived) {
                        throw new Error('Source invoice has no available overpayment credit. Refresh and try again.');
                    }
                    if (['PAID', 'CANCELLED', 'WAIVED', 'OVERPAID'].includes(freshTarget.status) || freshTarget.archived) {
                        throw new Error('Target invoice has no outstanding balance. Refresh and choose another invoice.');
                    }

                    const sameParent = Boolean(freshSource.learner.parentId)
                        && freshSource.learner.parentId === freshTarget.learner.parentId;
                    const sourceFamilyIds = new Set((freshSource.learner.familyLinks || []).map((link: any) => link.familyAccountId));
                    const sameVerifiedFamily = (freshTarget.learner.familyLinks || []).some((link: any) => sourceFamilyIds.has(link.familyAccountId));
                    if (!sameParent && !sameVerifiedFamily) {
                        throw new Error('Credit can only be allocated between learners linked to the same parent or active family account.');
                    }

                    const availableCredit = Math.max(0, Number(freshSource.paidAmount) - Number(freshSource.totalAmount));
                    const targetTuitionBalance = Math.max(0, Number(freshTarget.balance));
                    const targetTransportBalance = Math.max(0, Number(freshTarget.transportBalance || 0));
                    const targetBalance = targetTuitionBalance + targetTransportBalance;
                    if (!Number.isFinite(availableCredit) || !Number.isFinite(targetBalance) || targetBalance <= 0) {
                        throw new Error('Source credit or target invoice balance is not valid. Refresh and try again.');
                    }
                    if (amount > availableCredit + 0.001) {
                        throw new Error(`Allocation amount KES ${amount.toFixed(2)} exceeds available credit KES ${availableCredit.toFixed(2)}.`);
                    }
                    if (amount > targetBalance + 0.001) {
                        throw new Error(`Allocation amount KES ${amount.toFixed(2)} exceeds the target outstanding balance KES ${targetBalance.toFixed(2)}.`);
                    }

                    // Match normal fee-payment allocation: apply to tuition first,
                    // then transport, and record both sub-ledgers on the invoice.
                    const tuitionChunk = Math.min(amount, targetTuitionBalance);
                    const transportChunk = amount - tuitionChunk;
                    const sourcePaid = Number(freshSource.paidAmount);
                    const sourceTotal = Number(freshSource.totalAmount);
                    const nextSourcePaid = sourcePaid - amount;
                    const nextSourceBalance = Number(freshSource.balance) + amount;
                    const sourceStatus = nextSourcePaid > sourceTotal ? 'OVERPAID'
                        : nextSourceBalance <= 0 ? 'PAID'
                            : nextSourcePaid > 0 ? 'PARTIAL' : 'PENDING';
                    const targetPaid = Number(freshTarget.paidAmount) + amount;
                    const nextTargetTuitionBalance = targetTuitionBalance - tuitionChunk;
                    const nextTargetTransportBalance = targetTransportBalance - transportChunk;
                    const targetStatus = targetPaid > Number(freshTarget.totalAmount) ? 'OVERPAID'
                        : nextTargetTuitionBalance <= 0 && nextTargetTransportBalance <= 0 && Number(freshTarget.sponsorBalance || 0) <= 0 ? 'PAID'
                            : targetPaid > 0 ? 'PARTIAL' : 'PENDING';

                    const sourceClaim = await tx.feeInvoice.updateMany({
                        where: {
                            id: sourceInvoiceId,
                            status: 'OVERPAID',
                            archived: false,
                            paidAmount: { gte: Number(freshSource.totalAmount) + amount },
                        },
                        data: {
                            paidAmount: { decrement: amount },
                            balance: { increment: amount },
                            status: sourceStatus as any,
                        },
                    });
                    if (sourceClaim.count !== 1) throw new Error('Available source credit changed. Refresh and try again.');

                    const targetClaim = await tx.feeInvoice.updateMany({
                        where: {
                            id: targetInvoiceId,
                            status: { in: ['PENDING', 'PARTIAL'] },
                            archived: false,
                            balance: { gte: tuitionChunk },
                            transportBalance: { gte: transportChunk },
                        },
                        data: {
                            paidAmount: { increment: amount },
                            balance: { decrement: tuitionChunk },
                            transportPaid: { increment: transportChunk },
                            transportBalance: { decrement: transportChunk },
                            status: targetStatus as any,
                        },
                    });
                    if (targetClaim.count !== 1) throw new Error('Target balance changed. Refresh and try again.');

                    const payment = await tx.feePayment.create({
                        data: {
                            invoiceId: targetInvoiceId,
                            amount,
                            transportAmount: transportChunk,
                            paymentMethod: 'OTHER',
                            receiptNumber: `CREDIT-${freshSource.invoiceNumber}-${randomUUID()}`,
                            referenceNumber: `ALLOC-${freshSource.invoiceNumber}`,
                            notes: `Credit allocation from overpaid invoice ${freshSource.invoiceNumber} (${freshSource.learner.firstName} ${freshSource.learner.lastName})`,
                            recordedBy: allocatedBy,
                            paymentDate: new Date(),
                        },
                    });

                    const [committedSource, committedTarget] = await Promise.all([
                        tx.feeInvoice.findUnique({ where: { id: sourceInvoiceId } }),
                        tx.feeInvoice.findUnique({ where: { id: targetInvoiceId } }),
                    ]);
                    return { source: freshSource, target: freshTarget, paymentId: payment.id, committedSource, committedTarget };
                }, { isolationLevel: 'Serializable' });

                sourceInvoice = transactionResult.source;
                targetInvoice = transactionResult.target;
                createdPaymentId = transactionResult.paymentId;
                updatedTarget = transactionResult.committedTarget;
                break;
            } catch (error: any) {
                lastError = error;
                if (error?.code === 'P2034' && attempt < 3) continue;
                throw error;
            }
        }
        if (!createdPaymentId) throw lastError || new Error('Credit allocation could not be completed.');

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

        const reference = `ALLOC/${sourceInvoiceNumber}/${targetInvoiceNumber}/${paymentId}`;
        const existingEntry = await prisma.journalEntry.findFirst({ where: { journalId: journal.id, reference } });
        if (existingEntry) {
            if (existingEntry.status === 'DRAFT') await accountingService.postJournalEntry(existingEntry.id);
            return;
        }
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
