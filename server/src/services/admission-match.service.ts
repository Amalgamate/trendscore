import prisma from '../config/database';
import { normalizePhone, applyPaymentToInvoice, parkAsUnmatched } from './payment-resolver.service';
import { accountingService } from './accounting.service';
import { overpaymentCreditService } from './overpayment-credit.service';
import messageService from './message.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import logger from '../utils/logger';

/**
 * Admission Number Matching Service
 *
 * When a parent pays via M-Pesa paybill (organic C2B), they enter the child's
 * admission number as the AccountReference. This service parses that reference,
 * finds the matching learner, and auto-applies the payment to their oldest
 * outstanding invoice.
 *
 * Matching strategy:
 *  1. Exact match on Learner.admissionNumber
 *  2. If no exact match, try case-insensitive trimmed match
 *  3. If still no match, park as unmatched for admin resolution
 *
 * If the matched learner has no outstanding invoice, the payment is parked as
 * unmatched so finance staff can assign it manually.
 */
class AdmissionMatchService {
    /**
     * Attempt to match an organic C2B payment to a learner using the
     * AccountReference field (admission number).
     *
     * @returns the outcome: 'applied' | 'unmatched'
     */
    async matchAndApply(params: {
        accountReference: string;
        rawPhone: string;
        amount: number;
        receipt: string;
        transactionDate?: Date;
        rawPayload: object;
    }): Promise<{ outcome: 'applied' | 'unmatched'; detail?: string; learnerId?: string }> {
        const { accountReference, rawPhone, amount, receipt, rawPayload } = params;
        const phone = normalizePhone(rawPhone);

        // ── 1. Parse admission number from AccountReference ───────────────────
        // Daraja AccountReference can be up to 12 chars. Parents sometimes add
        // prefixes or extra characters. We try exact match first, then a
        // trimmed/alphanumeric-only match.
        const ref = String(accountReference || '').trim();
        const refClean = ref.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        if (!ref) {
            logger.warn(`[AdmissionMatch] Empty AccountReference for receipt ${receipt}`);
            await parkAsUnmatched({
                phone, amount, receipt, rawPayload,
                note: 'No AccountReference provided in C2B payment',
            });
            return { outcome: 'unmatched', detail: 'No AccountReference' };
        }

        // ── 2. Find learner by admission number ──────────────────────────────
        let learner = await prisma.learner.findFirst({
            where: {
                admissionNumber: ref,
                archived: false,
                status: 'ACTIVE',
            },
            select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        });

        // Fallback: case-insensitive, alphanumeric-only match
        // Prisma doesn't support case-insensitive comparison on all databases,
        // so we fetch all active learners and match in code. This is fine for
        // schools with up to a few thousand learners — the query is indexed
        // on status+archived and only returns admissionNumber.
        if (!learner && refClean) {
            const allLearners = await prisma.learner.findMany({
                where: {
                    archived: false,
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                },
            });

            learner = allLearners.find(l =>
                l.admissionNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === refClean
            ) || null;
        }

        if (!learner) {
            logger.info(`[AdmissionMatch] No learner matched admission number "${ref}" for receipt ${receipt}`);
            await parkAsUnmatched({
                phone, amount, receipt, rawPayload,
                note: `No learner found with admission number "${ref}"`,
            });
            return { outcome: 'unmatched', detail: `Admission number "${ref}" not found` };
        }

        logger.info(
            `[AdmissionMatch] Matched admission "${ref}" to learner ${learner.firstName} ${learner.lastName} (${learner.id})`
        );

        // ── 3. Apply payment to the learner's oldest outstanding invoice ────
        const result = await applyPaymentToInvoice({
            learnerId: learner.id,
            amount,
            receipt,
            phone,
        });

        if (!result.success) {
            // Matched learner but no outstanding invoice — park for manual resolution
            await parkAsUnmatched({
                phone, amount, receipt, rawPayload,
                note: `Matched learner ${learner.admissionNumber} (${learner.firstName} ${learner.lastName}) but no outstanding invoice`,
            });
            return {
                outcome: 'unmatched',
                detail: 'No outstanding invoice for matched learner',
                learnerId: learner.id,
            };
        }

        // ── 4. Post to ledger + detect overpayment ──────────────────────────
        // The applyPaymentToInvoice function creates the FeePayment and updates
        // the invoice, but doesn't post to the ledger or detect overpayments.
        // We need to find the created payment and do that here.
        if (result.invoiceId) {
            try {
                const payment = await prisma.feePayment.findFirst({
                    where: {
                        invoiceId: result.invoiceId,
                        receiptNumber: `MPESA-${receipt}`,
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, amount: true, paymentDate: true },
                });

                if (payment) {
                    await accountingService.postFeePaymentToLedger(
                        {
                            id: payment.id,
                            amount: Number(payment.amount),
                            receiptNumber: `MPESA-${receipt}`,
                            paymentDate: payment.paymentDate || new Date(),
                        },
                        'MPESA'
                    );

                    await overpaymentCreditService.detectAndPostOverpayment(
                        result.invoiceId,
                        payment.id
                    );

                    // Record M-Pesa transaction charge
                    await accountingService.postMpesaCharge(amount);
                }
            } catch (err: any) {
                logger.error('[AdmissionMatch] Ledger/overpayment posting error:', err?.message ?? err);
            }
        }

        return {
            outcome: 'applied',
            detail: `Applied to invoice ${result.invoiceNumber}`,
            learnerId: learner.id,
        };
    }
}

export const admissionMatchService = new AdmissionMatchService();
