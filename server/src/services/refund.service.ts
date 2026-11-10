import prisma from '../config/database';
import { mpesaService } from './mpesa.service';
import { accountingService } from './accounting.service';
import { approvalEngineService } from './approvalEngine.service';
import messageService from './message.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import logger from '../utils/logger';
import { ApprovalModule, ApprovalRequestType } from '@prisma/client';

/**
 * Refund Service
 *
 * Implements the refund workflow:
 *  1. Finance staff (ACCOUNTANT/ADMIN) submits a refund request
 *  2. Only school owner (SUPER_ADMIN) can approve
 *  3. Submitter cannot self-approve (guard)
 *  4. On approval: invoice correction + ledger reversal + B2C return
 *  5. If B2C unavailable: mark as MANUAL for cash/cheque processing
 *
 * Ledger reversal entry:
 *   Dr Accounts Receivable 1100 (reverses original Cr AR)
 *   Cr Bank 1210 (reverses original Dr Bank)
 *
 * Invoice correction:
 *   - Archival/reversal of the FeePayment
 *   - Invoice balance incremented, status re-evaluated
 */
class RefundService {

    /**
     * Submit a refund request.
     *
     * Creates a PENDING Refund record and a linked ApprovalRequest
     * of type PAYMENT_REVERSAL routed to SUPER_ADMIN for approval.
     */
    async submitRefund(params: {
        paymentId: string;
        reason: string;
        submittedById: string;
        schoolId: string;
        method?: 'B2C' | 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
        notes?: string;
    }): Promise<{ refundId: string; approvalRequestId?: string }> {
        const { paymentId, reason, submittedById, schoolId, notes } = params;
        const method = params.method || 'B2C';

        // ── 1. Validate the payment exists and is not archived ───────────────
        const payment = await prisma.feePayment.findUnique({
            where: { id: paymentId },
            include: { invoice: { include: { learner: true } } },
        });

        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.archived) {
            throw new Error('This payment has already been reversed — cannot refund');
        }

        // ── 2. Check for existing pending refund on this payment ─────────────
        const existingRefund = await prisma.refund.findFirst({
            where: {
                paymentId,
                status: { in: ['PENDING', 'APPROVED'] },
            },
        });

        if (existingRefund) {
            throw new Error(
                `A ${existingRefund.status} refund already exists for this payment (ID: ${existingRefund.id})`
            );
        }

        const amount = Number(payment.amount);
        const invoice = payment.invoice;
        const learner = invoice?.learner;

        // ── 3. Create the Refund record ──────────────────────────────────────
        const refund = await prisma.refund.create({
            data: {
                paymentId,
                invoiceId: payment.invoiceId,
                learnerId: learner?.id || null,
                amount,
                reason,
                method: method as any,
                status: 'PENDING',
                submittedById,
                submittedAt: new Date(),
                notes: notes || null,
            },
        });

        // ── 4. Create linked ApprovalRequest ────────────────────────────────
        // The approval request routes to SUPER_ADMIN (school owner) only.
        // The approval hook will fire when it's approved.
        let approvalRequestId: string | undefined;

        try {
            const approvalRequest = await approvalEngineService.submitRequest({
                workflowModule: 'FEES' as ApprovalModule,
                requestType: 'PAYMENT_REVERSAL' as ApprovalRequestType,
                requestedById: submittedById,
                schoolId,
                metadata: {
                    refundId: refund.id,
                    paymentId,
                    invoiceId: payment.invoiceId,
                    learnerId: learner?.id,
                    amount,
                    reason,
                    method,
                },
                comments: reason,
            });

            approvalRequestId = approvalRequest.id;

            // Link the approval request back to the refund
            await prisma.refund.update({
                where: { id: refund.id },
                data: { approvalRequestId },
            });
        } catch (err: any) {
            // If the approval engine fails (e.g., no workflow configured),
            // the refund remains PENDING and can be approved directly via
            // the refund API as a fallback.
            logger.warn(
                `[Refund] Approval engine submission failed for refund ${refund.id}: ${err?.message}. ` +
                'Refund remains PENDING — can be approved directly via refund API.'
            );
        }

        logger.info(
            `[Refund] Refund ${refund.id} submitted by ${submittedById} for KES ${amount} ` +
            `(payment ${paymentId}, method ${method})`
        );

        return { refundId: refund.id, approvalRequestId };
    }

    /**
     * Approve a refund request.
     *
     * Only SUPER_ADMIN (school owner) can approve.
     * The submitter cannot self-approve.
     *
     * On approval:
     *  1. Archive the FeePayment (reverse it)
     *  2. Correct the invoice balance + status
     *  3. Post ledger reversal entry
     *  4. Initiate B2C disbursement (if method = B2C)
     */
    async approveRefund(params: {
        refundId: string;
        approverId: string;
        approverRole: string;
        comment?: string;
    }): Promise<{ success: boolean; b2cInitiated?: boolean; message: string }> {
        const { refundId, approverId, approverRole, comment } = params;

        // ── 1. Permission guard: only SUPER_ADMIN ────────────────────────────
        if (approverRole !== 'SUPER_ADMIN') {
            throw new Error('Only the school owner (SUPER_ADMIN) can approve refunds');
        }

        const refund = await prisma.refund.findUnique({
            where: { id: refundId },
            include: {
                payment: { include: { invoice: true } },
            },
        });

        if (!refund) {
            throw new Error('Refund not found');
        }

        if (refund.status !== 'PENDING') {
            throw new Error(`Refund is already ${refund.status} — cannot approve`);
        }

        // ── 2. Submitter cannot self-approve ────────────────────────────────
        if (refund.submittedById === approverId) {
            throw new Error('You cannot approve a refund you submitted — ask another owner');
        }

        const payment = refund.payment;
        const invoice = refund.payment?.invoice;
        const amount = Number(refund.amount);

        if (!payment || !invoice) {
            throw new Error('Linked payment or invoice not found — data integrity error');
        }

        // ── 3. Archive the FeePayment + correct invoice ─────────────────────
        await prisma.$transaction(async (tx) => {
            // Archive the payment
            await tx.feePayment.update({
                where: { id: payment.id },
                data: {
                    archived: true,
                    archivedAt: new Date(),
                    archivedBy: approverId,
                    notes: payment.notes
                        ? `${payment.notes} | Refunded: ${refund.reason}`
                        : `Refunded: ${refund.reason}`,
                },
            });

            // Correct invoice balance
            await tx.feeInvoice.update({
                where: { id: invoice.id },
                data: {
                    paidAmount: { decrement: amount },
                    balance: { increment: amount },
                },
            });

            // Re-evaluate invoice status
            const fresh = await tx.feeInvoice.findUnique({ where: { id: invoice.id } });
            if (fresh) {
                const paid = Number(fresh.paidAmount);
                const total = Number(fresh.totalAmount);
                const bal = Number(fresh.balance);
                let newStatus = fresh.status;
                if (paid > total) newStatus = 'OVERPAID' as any;
                else if (bal <= 0) newStatus = 'PAID' as any;
                else if (paid > 0) newStatus = 'PARTIAL' as any;
                else newStatus = 'PENDING' as any;

                await tx.feeInvoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus },
                });
            }
        });

        // ── 4. Post ledger reversal ──────────────────────────────────────────
        try {
            await accountingService.postRefundToLedger({
                id: refund.id,
                amount,
                receiptNumber: payment.receiptNumber,
                paymentDate: payment.paymentDate,
            }, payment.paymentMethod);
        } catch (ledgerErr: any) {
            logger.error(`[Refund] Ledger reversal failed for refund ${refund.id}:`, ledgerErr?.message);
            // Don't block — the invoice is already corrected. Ledger can be
            // reconciled manually if this fails.
        }

        // ── 5. Mark refund as APPROVED ──────────────────────────────────────
        await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'APPROVED',
                approvedById: approverId,
                approvedAt: new Date(),
                notes: comment ? `${refund.notes || ''} | Approved: ${comment}` : refund.notes,
            },
        });

        logger.info(`[Refund] Refund ${refundId} approved by ${approverId}`);

        // ── 6. Initiate B2C disbursement (if applicable) ─────────────────────
        if (refund.method === 'B2C') {
            try {
                const b2cResult = await this.initiateB2cDisbursement(refund, invoice);
                return {
                    success: true,
                    b2cInitiated: b2cResult.initiated,
                    message: b2cResult.initiated
                        ? 'Refund approved. B2C disbursement initiated.'
                        : `Refund approved. B2C not available: ${b2cResult.reason}. Process manually.`,
                };
            } catch (err: any) {
                logger.error(`[Refund] B2C disbursement failed for refund ${refundId}:`, err?.message);
                // Mark as MANUAL — the refund is approved, but disbursement
                // needs to be done manually
                await prisma.refund.update({
                    where: { id: refundId },
                    data: {
                        status: 'MANUAL' as any,
                        b2cFailureReason: err?.message || 'B2C initiation failed',
                    },
                });
                return {
                    success: true,
                    b2cInitiated: false,
                    message: `Refund approved but B2C failed: ${err?.message}. Marked for manual processing.`,
                };
            }
        }

        // Manual refund methods (CASH, CHEQUE, BANK_TRANSFER)
        await prisma.refund.update({
            where: { id: refundId },
            data: { status: 'MANUAL' as any },
        });

        return {
            success: true,
            message: `Refund approved. Process via ${refund.method}.`,
        };
    }

    /**
     * Reject a refund request.
     * Only SUPER_ADMIN can reject.
     */
    async rejectRefund(params: {
        refundId: string;
        rejectorId: string;
        rejectorRole: string;
        reason: string;
    }): Promise<{ success: boolean }> {
        const { refundId, rejectorId, rejectorRole, reason } = params;

        if (rejectorRole !== 'SUPER_ADMIN') {
            throw new Error('Only the school owner (SUPER_ADMIN) can reject refunds');
        }

        const refund = await prisma.refund.findUnique({ where: { id: refundId } });

        if (!refund) throw new Error('Refund not found');
        if (refund.status !== 'PENDING') {
            throw new Error(`Refund is already ${refund.status} — cannot reject`);
        }

        await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'REJECTED' as any,
                approvedById: rejectorId,
                approvedAt: new Date(),
                b2cFailureReason: reason,
            },
        });

        logger.info(`[Refund] Refund ${refundId} rejected by ${rejectorId}: ${reason}`);
        return { success: true };
    }

    /**
     * Initiate B2C disbursement for an approved refund.
     * Looks up the parent's phone number from the learner record.
     */
    private async initiateB2cDisbursement(
        refund: any,
        invoice: any,
    ): Promise<{ initiated: boolean; reason?: string }> {
        // Get the parent's phone number from the learner
        let phoneNumber: string | undefined;

        if (invoice?.learnerId) {
            const learner = await prisma.learner.findUnique({
                where: { id: invoice.learnerId },
                select: {
                    fatherPhone: true,
                    motherPhone: true,
                    guardianPhone: true,
                    primaryContactPhone: true,
                    parent: { select: { phone: true } },
                },
            });

            if (learner) {
                phoneNumber = learner.fatherPhone || learner.motherPhone ||
                    learner.guardianPhone || learner.primaryContactPhone ||
                    learner.parent?.phone || undefined;
            }
        }

        // Fall back to the M-Pesa transaction phone
        if (!phoneNumber && refund.paymentId) {
            const mpesaTx = await prisma.mpesaTransaction.findFirst({
                where: { transactionId: refund.payment.referenceNumber },
                select: { phoneNumber: true },
            });
            phoneNumber = mpesaTx?.phoneNumber || undefined;
        }

        if (!phoneNumber) {
            return { initiated: false, reason: 'No phone number found for the parent' };
        }

        const result = await mpesaService.initiatePayout({
            phoneNumber,
            amount: Number(refund.amount),
            reason: `Refund: ${refund.reason}`,
            refundId: refund.id,
            commandId: 'BusinessPayment',
        });

        if (result.success && result.conversationId) {
            await prisma.refund.update({
                where: { id: refund.id },
                data: {
                    b2cConversationId: result.conversationId,
                    status: 'APPROVED', // stays APPROVED until B2C result callback
                },
            });

            // Notify the parent
            try {
                await messageService.createAndDispatchMessage({
                    senderId: 'system',
                    senderType: 'ADMIN',
                    recipientType: 'INDIVIDUAL',
                    recipients: [{ recipientPhone: phoneNumber }],
                    body: `Refund of KES ${Number(refund.amount).toLocaleString()} has been approved and is being sent to your M-Pesa account. Reason: ${refund.reason}. ${PRODUCT_DISPLAY_NAME}.`,
                    messageType: 'SMS',
                });
            } catch (smsErr: any) {
                logger.warn('[Refund] SMS notification failed:', smsErr?.message);
            }

            return { initiated: true };
        }

        return { initiated: false, reason: result.message || 'B2C request failed' };
    }

    /**
     * Mark a refund as DISBURSED (called by B2C result callback or manually).
     */
    async markDisbursed(refundId: string, b2cTransactionId?: string): Promise<void> {
        await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'DISBURSED' as any,
                b2cTransactionId,
                disbursedAt: new Date(),
            },
        });
        logger.info(`[Refund] Refund ${refundId} disbursed. B2C receipt: ${b2cTransactionId || 'N/A'}`);
    }

    /**
     * Mark a refund as FAILED (called by B2C result callback on failure).
     */
    async markFailed(refundId: string, failureReason: string): Promise<void> {
        await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'FAILED' as any,
                b2cFailureReason: failureReason,
            },
        });
        logger.warn(`[Refund] Refund ${refundId} B2C disbursement failed: ${failureReason}`);
    }

    /**
     * List refunds with optional status filter.
     */
    async listRefunds(filters: {
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, page = 1, limit = 50 } = filters;
        const skip = (page - 1) * limit;

        const where = status ? { status: status as any } : {};

        const [records, total] = await Promise.all([
            prisma.refund.findMany({
                where,
                include: {
                    payment: { select: { receiptNumber: true, paymentMethod: true, paymentDate: true } },
                    invoice: { select: { invoiceNumber: true, learner: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.refund.count({ where }),
        ]);

        return { data: records, total, page, pages: Math.ceil(total / limit) };
    }

    /**
     * Get a single refund by ID.
     */
    async getRefund(refundId: string) {
        return prisma.refund.findUnique({
            where: { id: refundId },
            include: {
                payment: { select: { receiptNumber: true, paymentMethod: true, paymentDate: true, amount: true } },
                invoice: { select: { invoiceNumber: true, learner: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
            },
        });
    }
}

export const refundService = new RefundService();
