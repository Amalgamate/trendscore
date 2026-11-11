import prisma from '../config/database';
import { mpesaService } from './mpesa.service';
import { parentAccessService } from './parent-access.service';
import { accountingService } from './accounting.service';
import { approvalEngineService } from './approvalEngine.service';
import messageService from './message.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import logger from '../utils/logger';
import { ApprovalModule, ApprovalRequestType } from '@prisma/client';
import { NotificationService, NotificationType } from './notification.service';

async function sendRefundNotice(userId: string, title: string, message: string, link = '/app/fees-refunds'): Promise<void> {
    try {
        await NotificationService.createNotification({ userId, title, message, type: NotificationType.APPROVAL, link });
    } catch (error: any) {
        logger.warn(`[Refund] Could not send in-app notice to ${userId}: ${error?.message}`);
    }
}

/**
 * Refund Service
 *
 * Implements the refund workflow:
 *  1. Finance staff or a parent linked to the learner submits a refund request
 *  2. School ADMIN or HEAD_TEACHER can approve
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
     * of type PAYMENT_REVERSAL for leadership approval.
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
        const cleanReason = String(reason || '').trim();
        if (cleanReason.length < 5 || cleanReason.length > 500) {
            throw new Error('Add a refund reason between 5 and 500 characters.');
        }
        if (params.method && !['B2C', 'CASH', 'CHEQUE', 'BANK_TRANSFER'].includes(params.method)) {
            throw new Error('Choose a supported refund method.');
        }

        // ── 1. Validate the payment exists and is not archived ───────────────
        const payment = await prisma.feePayment.findUnique({
            where: { id: paymentId },
            include: { invoice: { include: { learner: true } } },
        });

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Default M-Pesa refunds to Daraja B2C, but never send cash, bank, or
        // cheque payments through the B2C payout rail by accident.
        const method = params.method || (String(payment.paymentMethod).toUpperCase() === 'MPESA' ? 'B2C' : 'CASH');

        const submitter = await prisma.user.findUnique({ where: { id: submittedById }, select: { role: true } });
        if (submitter?.role === 'PARENT' && !(await parentAccessService.canAccessLearner(submittedById, payment.invoice.learnerId))) {
            throw new Error('You can request a refund only for a payment linked to your child.');
        }

        if (payment.archived) {
            throw new Error('This payment has already been reversed — cannot refund');
        }

        const amount = Number(payment.amount);
        const invoice = payment.invoice;
        const learner = invoice?.learner;
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('This payment has no refundable amount.');

        // Check and create in a serializable transaction to prevent two callers
        // from opening duplicate active refund requests for the same payment.
        const refund = await prisma.$transaction(async (tx) => {
            const existingRefund = await tx.refund.findFirst({
                where: { paymentId, status: { in: ['PENDING', 'APPROVED'] } },
            });
            if (existingRefund) {
                throw new Error(`A ${existingRefund.status} refund already exists for this payment.`);
            }
            return tx.refund.create({
                data: {
                    paymentId,
                    invoiceId: payment.invoiceId,
                    learnerId: learner?.id || null,
                    amount,
                    reason: cleanReason,
                    method: method as any,
                    status: 'PENDING',
                    submittedById,
                    submittedAt: new Date(),
                    notes: notes || null,
                },
            });
        }, { isolationLevel: 'Serializable' });

        // ── 4. Create linked ApprovalRequest ────────────────────────────────
        // The approval request routes to school leadership.
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
                    reason: cleanReason,
                    method,
                },
                comments: cleanReason,
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
            NotificationService.notifyRoles(['ADMIN', 'HEAD_TEACHER'], {
                title: 'Refund request needs review',
                message: `A refund request for KES ${amount.toLocaleString()} is waiting for school review.`,
                type: NotificationType.APPROVAL,
                link: '/app/fees-refunds',
                metadata: { refundId: refund.id, event: 'REFUND_PENDING_REVIEW' },
            }).catch((notifyError: any) => logger.warn(`[Refund] Could not notify approvers: ${notifyError?.message}`));
        }

        const submitterLink = submitter?.role === 'PARENT' ? '/app/parent-portal-fees' : '/app/fees-refunds';
        await sendRefundNotice(submittedById, 'Refund request received', 'Your request has been sent for review. You can check its status from your fee information.', submitterLink);

        logger.info(
            `[Refund] Refund ${refund.id} submitted by ${submittedById} for KES ${amount} ` +
            `(payment ${paymentId}, method ${method})`
        );

        return { refundId: refund.id, approvalRequestId };
    }

    /**
     * Approve a refund request.
     *
     * Only the school admin or head teacher can approve.
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
        notifySubmitter?: boolean;
    }): Promise<{ success: boolean; b2cInitiated?: boolean; message: string }> {
        const { refundId, approverId, approverRole, comment } = params;

        // ── 1. Permission guard: school leadership only ──────────────────────
        if (!['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(approverRole)) {
            throw new Error('Only the school admin or head teacher can approve refunds');
        }

        const refund = await prisma.refund.findUnique({
            where: { id: refundId },
            include: {
                payment: { include: { invoice: true } },
                submittedBy: { select: { role: true } },
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
            throw new Error('You cannot approve a refund you submitted. Ask another approver.');
        }

        const payment = refund.payment;
        const invoice = refund.payment?.invoice;
        const amount = Number(refund.amount);

        if (!payment || !invoice) {
            throw new Error('Linked payment or invoice not found — data integrity error');
        }

        // ── 3. Archive the FeePayment, correct invoice, and claim the refund ─
        await prisma.$transaction(async (tx) => {
            const claimed = await tx.refund.updateMany({
                where: { id: refund.id, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    approvedById: approverId,
                    approvedAt: new Date(),
                    notes: comment ? `${refund.notes || ''} | Approved: ${comment}` : refund.notes,
                },
            });
            if (claimed.count !== 1) throw new Error('This refund was already actioned. Refresh the request list.');

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
            // Ledger posting belongs to this transaction. If it fails, the
            // refund claim, payment archive, and invoice correction all roll
            // back together instead of leaving financial state out of sync.
            await accountingService.postRefundToLedger({
                id: refund.id,
                amount,
                receiptNumber: payment.receiptNumber,
                paymentDate: payment.paymentDate,
            }, payment.paymentMethod, tx);
        }, { isolationLevel: 'Serializable' });

        // Keep the approval inbox in sync even when this direct endpoint is used
        // as a fallback. The approval-engine path already has an action record.
        if (refund.approvalRequestId) {
            await prisma.approvalRequest.updateMany({
                where: { id: refund.approvalRequestId, status: 'PENDING' },
                data: { status: 'APPROVED' },
            });
            const action = await prisma.approvalAction.findFirst({ where: { requestId: refund.approvalRequestId, approverId } });
            if (!action) await prisma.approvalAction.create({
                data: { requestId: refund.approvalRequestId, stepNumber: 1, approverId, action: 'APPROVE', comment: comment || 'Approved through refund review.' },
            });
        }

        if (params.notifySubmitter !== false) {
            const link = refund.submittedBy?.role === 'PARENT' ? '/app/parent-portal-fees' : '/app/fees-refunds';
            await sendRefundNotice(refund.submittedById, 'Refund approved', 'Your refund request was approved. The school will update its payment or payout status as processing continues.', link);
        }

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
     * Only the school admin or head teacher can reject.
     */
    async rejectRefund(params: {
        refundId: string;
        rejectorId: string;
        rejectorRole: string;
        reason: string;
    }): Promise<{ success: boolean }> {
        const { refundId, rejectorId, rejectorRole, reason } = params;

        if (!['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(rejectorRole)) {
            throw new Error('Only the school admin or head teacher can reject refunds');
        }

        const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { submittedBy: { select: { role: true } } } });

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

        if (refund.approvalRequestId) {
            await prisma.approvalRequest.updateMany({
                where: { id: refund.approvalRequestId, status: 'PENDING' },
                data: { status: 'REJECTED' },
            });
            const action = await prisma.approvalAction.findFirst({ where: { requestId: refund.approvalRequestId, approverId: rejectorId } });
            if (!action) await prisma.approvalAction.create({
                data: { requestId: refund.approvalRequestId, stepNumber: 1, approverId: rejectorId, action: 'REJECT', comment: reason },
            });
        }

        const link = refund.submittedBy?.role === 'PARENT' ? '/app/parent-portal-fees' : '/app/fees-refunds';
        await sendRefundNotice(refund.submittedById, 'Refund request declined', `The school declined your refund request. Reason: ${reason}`, link);

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
        const refund = await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'DISBURSED' as any,
                b2cTransactionId,
                disbursedAt: new Date(),
            },
            include: { submittedBy: { select: { role: true } } },
        });
        const link = refund.submittedBy?.role === 'PARENT' ? '/app/parent-portal-fees' : '/app/fees-refunds';
        await sendRefundNotice(refund.submittedById, 'Refund paid', 'The school has confirmed that your refund payout was completed.', link);
        logger.info(`[Refund] Refund ${refundId} disbursed. B2C receipt: ${b2cTransactionId || 'N/A'}`);
    }

    /**
     * Mark a refund as FAILED (called by B2C result callback on failure).
     */
    async markFailed(refundId: string, failureReason: string): Promise<void> {
        const refund = await prisma.refund.update({
            where: { id: refundId },
            data: {
                status: 'FAILED' as any,
                b2cFailureReason: failureReason,
            },
            include: { submittedBy: { select: { role: true } } },
        });
        const link = refund.submittedBy?.role === 'PARENT' ? '/app/parent-portal-fees' : '/app/fees-refunds';
        await sendRefundNotice(refund.submittedById, 'Refund payout needs attention', 'The M-Pesa refund payout did not complete. The school has been asked to review and follow up.', link);
        logger.warn(`[Refund] Refund ${refundId} B2C disbursement failed: ${failureReason}`);
    }

    /**
     * List refunds with optional status filter.
     */
    async listRefunds(filters: {
        status?: string;
        page?: number;
        limit?: number;
        learnerIds?: string[];
    }) {
        const { status, page = 1, limit = 50, learnerIds } = filters;
        const skip = (page - 1) * limit;

        const where: any = status ? { status: status as any } : {};
        if (learnerIds) where.learnerId = { in: learnerIds };

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
    async getRefund(refundId: string, learnerIds?: string[]) {
        return prisma.refund.findUnique({
            where: { id: refundId, ...(learnerIds ? { learnerId: { in: learnerIds } } : {}) },
            include: {
                payment: { select: { receiptNumber: true, paymentMethod: true, paymentDate: true, amount: true } },
                invoice: { select: { invoiceNumber: true, learner: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
            },
        });
    }
}

export const refundService = new RefundService();
