import { Request, Response } from 'express';
import { mpesaService } from '../services/mpesa.service';
import prisma from '../config/database';
import messageService from '../services/message.service';
import { resolveOrganicPayment, applyToSpecificInvoice, normalizePhone, applyAmountToInvoiceFields, resolveInvoiceStatus } from '../services/payment-resolver.service';
import { admissionMatchService } from '../services/admission-match.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { LMSMarketplaceService } from '../services/lms-marketplace.service';
import { accountingService } from '../services/accounting.service';
import { overpaymentCreditService } from '../services/overpayment-credit.service';

import logger from '../utils/logger';
export const initiatePayment = async (req: Request, res: Response) => {
    const { phoneNumber, amount, studentId, invoiceId } = req.body;

    if (!phoneNumber || !amount) {
        return res.status(400).json({ success: false, message: 'Phone number and amount are required' });
    }

    // ── Provider on/off switch ──────────────────────────────────────────────
    // The school can disable M-Pesa collections from settings (CommunicationConfig.
    // mpesaEnabled). When disabled, STK push is rejected so parents are not
    // prompted to pay via a channel the school has turned off.
    try {
        const commConfig = await prisma.communicationConfig.findFirst();
        if (commConfig && !commConfig.mpesaEnabled) {
            return res.status(403).json({
                success: false,
                message: 'M-Pesa collections are currently disabled. Please contact the school office to make a payment.'
            });
        }
    } catch (configErr: any) {
        logger.warn('[MpesaInitiate] Could not check mpesaEnabled setting — proceeding:', configErr?.message);
    }

    try {
        const result = await mpesaService.initiateStkPush({
            phoneNumber,
            amount,
            studentId,
            invoiceId
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Query STK Status and Record Payment if COMPLETE
 */
export const queryStatus = async (req: Request, res: Response) => {
    const { checkoutRequestId, invoiceId } = req.params;
    const userId = (req as any).user?.userId;

    try {
        const result = await mpesaService.queryStatus(checkoutRequestId);
        const { state, amount, receipt, phone } = result;

        // Daraja's status query confirms the outcome only; it returns no amount or
        // receipt. The payment is recorded when the callback arrives, so never
        // apply a payment from this result (it would create a KES 0 record).
        if (state === 'COMPLETE' && (!receipt || !Number(amount))) {
            return res.json({
                success: true,
                status: 'COMPLETE',
                message: 'Payment confirmed by M-Pesa. It will be recorded when the callback arrives.'
            });
        }

        if (state === 'COMPLETE') {
            // Check if already recorded
            const existing = await prisma.mpesaTransaction.findFirst({
                where: { checkoutRequestId }
            });

            if (existing?.status === 'SUCCESS') {
                return res.json({ success: true, status: 'COMPLETE', message: 'Payment already recorded' });
            }

            // Record as MpesaTransaction if not exists
            if (!existing) {
                await prisma.mpesaTransaction.create({
                    data: {
                        checkoutRequestId,
                        invoiceId,
                        amount: Number(amount || 0),
                        status: 'SUCCESS',
                        resultCode: 0,
                        resultDesc: 'Complete',
                        transactionId: receipt || ''
                    }
                });
            } else {
                await prisma.mpesaTransaction.update({
                    where: { id: existing.id },
                    data: { status: 'SUCCESS', transactionId: receipt || '' }
                });
            }

            // Apply to specific fee invoice
            const systemUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
            await applyToSpecificInvoice({
                invoiceId,
                amount: Number(amount || 0),
                receipt: receipt || '',
                phone: phone || '',
                recordedBy: systemUser?.id || userId || ''
            });

            return res.json({ success: true, status: 'COMPLETE', message: 'Payment verified and recorded' });
        }

        res.json({ success: true, status: state });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Handle M-Pesa Callback (Public Endpoint)
 *  Handles Daraja STK Push callbacks only; the transaction pre-exists in the DB.
 *  Organic paybill/till payments (Daraja C2B) are not built yet.
 */
export const handleCallback = async (req: Request, res: Response) => {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback || typeof stkCallback.CheckoutRequestID !== 'string' || !stkCallback.CheckoutRequestID) {
        // Daraja STK callbacks are the only payload this endpoint understands.
        // A missing CheckoutRequestID must never reach the lookup below: Prisma
        // drops an undefined filter and would return an arbitrary transaction.
        logger.warn('[MpesaCallback] Ignored payload that is not a valid Daraja STK callback');
        return res.json({ success: true });
    }
    const checkoutRequestId: string = stkCallback.CheckoutRequestID;

    logger.info(`[MpesaCallback] Daraja STK callback | ID: ${checkoutRequestId}`);

    try {
        // ── 1. Find the STK-initiated transaction ──────────────────────────────
        const transaction = await prisma.mpesaTransaction.findFirst({
            where: { checkoutRequestId }
        });

        // ── 2. Parse payload ────────────────────────────────────────────────────
        let isSuccess = false;
        let amount = 0;
        let receipt = '';
        let phone = '';
        let resultCode: any = null;
        let resultDesc: any = null;

        resultCode = stkCallback.ResultCode;
        resultDesc = stkCallback.ResultDesc;
        isSuccess = resultCode === 0;

        if (isSuccess && stkCallback.CallbackMetadata) {
            const metadata = stkCallback.CallbackMetadata.Item;
            amount = Number(metadata.find((i: any) => i.Name === 'Amount')?.Value ?? 0);
            receipt = metadata.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value ?? '';
            phone = String(metadata.find((i: any) => i.Name === 'PhoneNumber')?.Value ?? '');
        }

        // ── 3. STK-initiated flow (transaction exists) ────────────────────────
        if (transaction) {
            // Log raw callback
            await prisma.mpesaCallback.create({
                data: { transactionId: transaction.id, rawBody: req.body }
            });

            if (isSuccess) {
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'SUCCESS',
                        resultCode,
                        resultDesc,
                        transactionId: receipt || null,
                        phoneNumber: phone || null,
                        metadata: { amount, phone, receipt }
                    }
                });

                // If tied to a specific invoice, apply directly
                if (transaction.invoiceId) {
                    const systemUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

                    let updatedInvoice: any;
                    let createdPaymentId: string | null = null;
                    let isDuplicate = false;
                    try {
                        await prisma.$transaction(async (tx) => {
                            const createdPayment = await tx.feePayment.create({
                                data: {
                                    invoiceId: transaction.invoiceId!,
                                    amount,
                                    paymentMethod: 'MPESA',
                                    receiptNumber: `MPESA-${receipt}`,
                                    referenceNumber: receipt,
                                    notes: `M-Pesa STK Push via ${phone}`,
                                    recordedBy: systemUser?.id || '',
                                    paymentDate: new Date()
                                }
                            });
                            createdPaymentId = createdPayment.id;

                            await applyAmountToInvoiceFields(tx, transaction.invoiceId!, amount);

                            const fresh = await tx.feeInvoice.findUnique({ where: { id: transaction.invoiceId! } });
                            if (fresh) {
                                const newStatus = resolveInvoiceStatus(fresh);
                                updatedInvoice = await tx.feeInvoice.update({
                                    where: { id: transaction.invoiceId! },
                                    data: { status: newStatus }
                                });
                            }
                        });
                    } catch (err: any) {
                        if (err?.code === 'P2002') {
                            logger.warn(`[MpesaCallback] Duplicate receipt ${receipt} — already recorded.`);
                            isDuplicate = true;
                            updatedInvoice = await prisma.feeInvoice.findUnique({ where: { id: transaction.invoiceId! } });
                        } else {
                            throw err;
                        }
                    }

                    // ── Post M-Pesa payment to the accounting ledger ──────────────
                    // Manual payments in fee.controller.ts call this, but M-Pesa
                    // callbacks never did — meaning M-Pesa money showed on the
                    // learner's invoice but not in the school's books. Post only
                    // for non-duplicate payments so we don't double-post.
                    if (!isDuplicate && createdPaymentId) {
                        try {
                            await accountingService.postFeePaymentToLedger(
                                {
                                    id: createdPaymentId,
                                    amount,
                                    receiptNumber: `MPESA-${receipt}`,
                                    paymentDate: new Date()
                                },
                                'MPESA'
                            );
                        } catch (ledgerErr: any) {
                            logger.error('[MpesaCallback] Ledger posting error:', ledgerErr?.message ?? ledgerErr);
                        }

                        // ── Detect overpayment & post excess to Tuition Deposits ──
                        // If the payment exceeded the invoice total, the excess is
                        // held as a liability (Tuition Deposits 2100) for later
                        // allocation to a sibling invoice or refund.
                        try {
                            await overpaymentCreditService.detectAndPostOverpayment(
                                transaction.invoiceId!,
                                createdPaymentId
                            );
                        } catch (overpayErr: any) {
                            logger.error('[MpesaCallback] Overpayment detection error:', overpayErr?.message ?? overpayErr);
                        }

                        // ── Record M-Pesa transaction charge ──────────────────────
                        // The school can optionally record the per-transaction M-Pesa
                        // charge as an expense. The charge bearer setting determines
                        // whether the school absorbs the cost or passes it to the
                        // parent. By default the school bears the charge.
                        try {
                            await accountingService.postMpesaCharge(amount);
                        } catch (chargeErr: any) {
                            logger.error('[MpesaCallback] M-Pesa charge posting error:', chargeErr?.message ?? chargeErr);
                        }
                    }

                    // SMS receipt
                    try {
                        const school = await prisma.school.findFirst();
                        const msg = `Payment of KES ${amount.toLocaleString()} received. Invoice: ${updatedInvoice?.invoiceNumber}. Receipt: ${receipt}. Thank you, ${school?.name || PRODUCT_DISPLAY_NAME}.`;
                        await messageService.createAndDispatchMessage({
                            senderId: 'system',
                            senderType: 'ADMIN',
                            recipientType: 'INDIVIDUAL',
                            recipients: [{ recipientPhone: phone }],
                            body: msg,
                            messageType: 'SMS'
                        });
                    } catch (notifErr) {
                        logger.error('[MpesaCallback] SMS error:', notifErr);
                    }
                }

                // ── Marketplace hook: try to complete purchase if no invoiceId ────────
                // (Marketplace purchases don't have invoiceId, so this branch executes for them)
                if (!transaction.invoiceId && checkoutRequestId) {
                    try {
                        await LMSMarketplaceService.completeByCheckoutRequestId(
                            checkoutRequestId,
                            { success: true, resultCode, resultDesc, receipt }
                        );
                    } catch (err: any) {
                        logger.error('[MpesaCallback] Marketplace completion hook error (non-fatal):', err?.message ?? err);
                    }
                }

                logger.info(`[MpesaCallback] STK success: ${transaction.id} | receipt: ${receipt}`);
            } else {
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'FAILED', resultCode, resultDesc }
                });

                if (!transaction.invoiceId && checkoutRequestId) {
                    try {
                        await LMSMarketplaceService.completeByCheckoutRequestId(
                            checkoutRequestId,
                            { success: false, resultCode, resultDesc }
                        );
                    } catch (err: any) {
                        logger.error('[MpesaCallback] Marketplace completion hook error (non-fatal):', err?.message ?? err);
                    }
                }

                logger.info(`[MpesaCallback] STK failed: ${resultDesc}`);
            }

            return res.json({ success: true });
        }

        // ── 4. No matching STK transaction ─────────────────────────────────────
        // Kopo Kopo's organic Buy Goods webhook used to be resolved here. With it
        // removed, an STK callback we did not initiate is never applied to a
        // learner's invoice: anyone could post a forged "Success" payload.
        // Organic (paybill/till) payments will return through a verified Daraja
        // C2B confirmation endpoint, which has not been built yet.
        logger.warn(`[MpesaCallback] No STK transaction found for ${checkoutRequestId}; ignored`);

        return res.json({ success: true });

    } catch (error: any) {
        logger.error('[MpesaCallback] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ─── Unmatched Payments — list ───────────────────────────────────────────────
export const getUnmatchedPayments = async (req: Request, res: Response) => {
    try {
        const { status = 'PENDING', page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [records, total] = await Promise.all([
            prisma.unmatchedPayment.findMany({
                where: { status: status as any },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.unmatchedPayment.count({ where: { status: status as any } })
        ]);

        res.json({ success: true, data: records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Unmatched Payments — pending count ─────────────────────────────────────
export const getUnmatchedCount = async (req: Request, res: Response) => {
    try {
        const count = await prisma.unmatchedPayment.count({ where: { status: 'PENDING' } });
        res.json({ success: true, count });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Unmatched Payments — resolve ───────────────────────────────────────────
export const resolveUnmatchedPayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { learnerId, invoiceId } = req.body;
    const userId = (req as any).user?.id;

    if (!learnerId || !invoiceId) {
        return res.status(400).json({ success: false, message: 'learnerId and invoiceId are required' });
    }

    try {
        const unmatched = await prisma.unmatchedPayment.findUnique({ where: { id } });
        if (!unmatched || unmatched.status !== 'PENDING') {
            return res.status(404).json({ success: false, message: 'Unmatched payment not found or already resolved' });
        }

        // Verify the target invoice belongs to the learner
        const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, learnerId }, include: { learner: true } });
        if (!invoice) {
            return res.status(400).json({ success: false, message: 'Invoice does not belong to the specified learner' });
        }

        const systemUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

        // Use the original payment date, not the resolution date.
        // Previously the FeePayment defaulted to new Date(), which meant a
        // payment received on the 1st and resolved on the 15th appeared in
        // reports as if it arrived on the 15th — distorting monthly collection
        // figures and bank reconciliation.
        const originalPaymentDate = unmatched.transactionDate || unmatched.createdAt;

        let updated: any;
        let createdPaymentId: string | null = null;
        let isDuplicate = false;
        try {
            await prisma.$transaction(async (tx) => {
                const createdPayment = await tx.feePayment.create({
                    data: {
                        invoiceId,
                        amount: unmatched.amount,
                        paymentMethod: 'MPESA',
                        receiptNumber: `MPESA-${unmatched.receiptNo}`,
                        referenceNumber: unmatched.receiptNo,
                        notes: `Manually assigned from unmatched payment queue (phone: ${unmatched.phone})`,
                        recordedBy: systemUser?.id || userId || '',
                        paymentDate: originalPaymentDate
                    }
                });
                createdPaymentId = createdPayment.id;

                await applyAmountToInvoiceFields(tx, invoiceId, Number(unmatched.amount));

                const fresh = await tx.feeInvoice.findUnique({ where: { id: invoiceId } });
                if (fresh) {
                    const newStatus = resolveInvoiceStatus(fresh);
                    updated = await tx.feeInvoice.update({
                        where: { id: invoiceId },
                        data: { status: newStatus }
                    });
                }
            });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                logger.warn(`[ResolveUnmatched] Duplicate receipt ${unmatched.receiptNo} — already recorded.`);
                isDuplicate = true;
                updated = await prisma.feeInvoice.findUnique({ where: { id: invoiceId } });
            } else {
                throw err;
            }
        }

        // Post the resolved M-Pesa payment to the accounting ledger.
        if (!isDuplicate && createdPaymentId) {
            try {
                await accountingService.postFeePaymentToLedger(
                    {
                        id: createdPaymentId,
                        amount: Number(unmatched.amount),
                        receiptNumber: `MPESA-${unmatched.receiptNo}`,
                        paymentDate: originalPaymentDate
                    },
                    'MPESA'
                );
            } catch (ledgerErr: any) {
                logger.error('[ResolveUnmatched] Ledger posting error:', ledgerErr?.message ?? ledgerErr);
            }

            // Detect overpayment & post excess to Tuition Deposits
            try {
                await overpaymentCreditService.detectAndPostOverpayment(invoiceId, createdPaymentId);
            } catch (overpayErr: any) {
                logger.error('[ResolveUnmatched] Overpayment detection error:', overpayErr?.message ?? overpayErr);
            }

            // Record M-Pesa transaction charge
            try {
                await accountingService.postMpesaCharge(Number(unmatched.amount));
            } catch (chargeErr: any) {
                logger.error('[ResolveUnmatched] M-Pesa charge posting error:', chargeErr?.message ?? chargeErr);
            }
        }

        // Mark as resolved
        await prisma.unmatchedPayment.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolvedLearnerId: learnerId,
                resolvedInvoiceId: invoiceId,
                resolvedBy: userId,
                resolvedAt: new Date()
            }
        });

        // SMS receipt
        try {
            const school = await prisma.school.findFirst();
            const learner = invoice.learner;
            const name = learner ? `${learner.firstName} ${learner.lastName}` : 'your child';
            const msg = `Payment of KES ${Number(unmatched.amount).toLocaleString()} received for ${name}. Receipt: ${unmatched.receiptNo}. Balance: KES ${Math.max(0, Number(updated?.balance ?? 0)).toLocaleString()}. Thank you, ${school?.name || PRODUCT_DISPLAY_NAME}.`;
            await messageService.createAndDispatchMessage({
                senderId: 'system',
                senderType: 'ADMIN',
                recipientType: 'INDIVIDUAL',
                recipients: [{ recipientPhone: unmatched.phone }],
                body: msg,
                messageType: 'SMS'
            });
        } catch (e) {
            logger.error('[ResolveUnmatched] SMS error:', e);
        }

        res.json({ success: true, message: 'Payment resolved and applied to invoice' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Unmatched Payments — dismiss ───────────────────────────────────────────
export const dismissUnmatchedPayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;
    const userId = (req as any).user?.id;

    try {
        const unmatched = await prisma.unmatchedPayment.findUnique({ where: { id } });
        if (!unmatched || unmatched.status !== 'PENDING') {
            return res.status(404).json({ success: false, message: 'Payment not found or already actioned' });
        }

        await prisma.unmatchedPayment.update({
            where: { id },
            data: {
                status: 'DISMISSED',
                note: note || 'Dismissed by admin',
                resolvedBy: userId,
                resolvedAt: new Date()
            }
        });

        res.json({ success: true, message: 'Payment dismissed' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Initiate Bulk Payout
 */
export const initiateBulkPayout = async (req: Request, res: Response) => {
    const { payrollRecordIds } = req.body;

    if (!payrollRecordIds || !Array.isArray(payrollRecordIds)) {
        return res.status(400).json({ success: false, message: 'Array of payrollRecordIds is required' });
    }

    try {
        const records = await prisma.payrollRecord.findMany({
            where: { id: { in: payrollRecordIds } },
            include: { user: true }
        });

        const results = [];
        for (const record of records) {
            if (!record.user.phone) {
                results.push({ id: record.id, success: false, message: 'User has no phone number' });
                continue;
            }

            const payoutResult = await mpesaService.initiatePayout({
                phoneNumber: record.user.phone,
                amount: Number(record.netSalary),
                staffId: record.userId,
                payrollRecordId: record.id,
                reason: `Salary ${record.month}/${record.year}`,
                commandId: 'SalaryPayment',
            });

            results.push({ id: record.id, ...payoutResult });
        }

        res.json({ success: true, results });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── C2B Confirmation Handler ───────────────────────────────────────────────
/**
 * Handle Daraja C2B Confirmation (organic paybill/till payments).
 *
 * When a parent pays via M-Pesa paybill, Daraja posts the completed transaction
 * to this endpoint. The payload contains:
 *  - TransactionType (PayBill or BuyGoods)
 *  - TransID (M-Pesa receipt)
 *  - TransAmount
 *  - MSISDN (payer phone)
 *  - BillRefNumber (the AccountReference — admission number entered by parent)
 *  - TransTime
 *
 * The handler uses admissionMatchService to match the BillRefNumber to a
 * learner and auto-apply the payment. If no match is found, the payment is
 * parked in the unmatched queue.
 */
export const handleC2bConfirmation = async (req: Request, res: Response) => {
    const body = req.body;

    // Daraja C2B confirmation payloads are flat (not nested like STK callbacks)
    const receipt = body?.TransID || body?.transID || '';
    const amount = Number(body?.TransAmount || body?.transAmount || 0);
    const phone = String(body?.MSISDN || body?.msisdn || '');
    const billRefNumber = String(body?.BillRefNumber || body?.billRefNumber || '');
    const transTime = body?.TransTime || body?.transTime;
    const transactionType = body?.TransactionType || body?.transactionType || '';

    if (!receipt || !amount) {
        logger.warn('[C2BConfirm] Ignored invalid C2B confirmation payload:', body);
        return res.json({ success: true });
    }

    logger.info(`[C2BConfirm] Receipt: ${receipt} | Amount: ${amount} | Phone: ${phone} | BillRef: ${billRefNumber}`);

    try {
        // Parse Daraja transaction time format (yyyyMMddHHmmss)
        let transactionDate: Date | undefined;
        if (transTime && typeof transTime === 'string') {
            // Daraja format: 20260110143000
            const t = transTime;
            if (t.length === 14) {
                transactionDate = new Date(
                    Number(t.slice(0, 4)),
                    Number(t.slice(4, 6)) - 1,
                    Number(t.slice(6, 8)),
                    Number(t.slice(8, 10)),
                    Number(t.slice(10, 12)),
                    Number(t.slice(12, 14))
                );
            }
        }

        const result = await admissionMatchService.matchAndApply({
            accountReference: billRefNumber,
            rawPhone: phone,
            amount,
            receipt,
            transactionDate,
            rawPayload: body,
        });

        logger.info(`[C2BConfirm] Result: ${result.outcome} — ${result.detail || ''}`);
    } catch (error: any) {
        logger.error('[C2BConfirm] Error:', error.message);
        // Still return 200 to Daraja — failing to respond causes retries
    }

    // Always respond 200 to Daraja
    res.json({ success: true });
};

// ─── C2B Validation Handler ────────────────────────────────────────────────
/**
 * Handle Daraja C2B Validation (real-time account reference check).
 *
 * Daraja calls this BEFORE the payment is completed, giving us a chance to
 * validate the AccountReference (admission number). If we return
 * ResultCode = 0, the payment proceeds. If ResultCode = 1 (with a
 * ResultDesc), the payment is rejected and the parent sees the message.
 *
 * We accept all payments here (ResultCode = 0) because:
 *  1. Rejecting at validation means the parent's money never leaves — but they
 *     already entered the PIN and may panic if it fails.
 *  2. Even if the admission number doesn't match, we park the payment as
 *     unmatched and finance staff resolve it. This is better than rejecting
 *     and losing the payment entirely.
 *
 * The validation endpoint is still useful for logging — it records the
 * attempted payment before it completes, giving us an early warning of
 * payments that will need manual resolution.
 */
export const handleC2bValidation = async (req: Request, res: Response) => {
    const body = req.body;

    const billRefNumber = String(body?.BillRefNumber || body?.billRefNumber || '');
    const amount = Number(body?.TransAmount || body?.transAmount || 0);
    const phone = String(body?.MSISDN || body?.msisdn || '');

    logger.info(`[C2BValidate] Phone: ${phone} | Amount: ${amount} | BillRef: ${billRefNumber}`);

    // Accept all payments — unmatched ones are parked for manual resolution
    res.json({
        ResultCode: 0,
        ResultDesc: 'Accepted',
    });
};

// ─── B2C Result Handler ─────────────────────────────────────────────────────
/**
 * Handle Daraja B2C Result callback.
 *
 * When a B2C payout (salary or refund) completes, Daraja posts the result to
 * this endpoint. The payload contains:
 *  - Result.ResultType (0 = completed, 1 = failed)
 *  - Result.ResultCode (0 = success, other = failure)
 *  - Result.ResultDesc
 *  - Result.ConversationID
 *  - Result.OriginatorConversationID
 *  - Result.TransactionID (M-Pesa receipt for the B2C)
 *
 * The handler matches the ConversationID to the originating MpesaTransaction
 * record and updates its status. For refund disbursements, it marks the refund
 * as completed.
 */
export const handleB2cResult = async (req: Request, res: Response) => {
    const result = req.body?.Result;

    if (!result) {
        logger.warn('[B2CResult] Ignored payload without Result body');
        return res.json({ success: true });
    }

    const resultCode = result.ResultCode;
    const resultDesc = result.ResultDesc;
    const conversationId = result.ConversationID;
    const originatorConversationId = result.OriginatorConversationID;
    const transactionId = result.TransactionID;

    logger.info(`[B2CResult] ConvID: ${conversationId} | Code: ${resultCode} | Desc: ${resultDesc}`);

    try {
        // Find the originating MpesaTransaction by conversationId in metadata.
        // We fetch recent PENDING PAYOUT transactions and match by conversationId
        // stored in the metadata JSON field. Prisma's JSON filtering varies by
        // database, so we fetch a small window and match in code.
        const pendingPayouts = await prisma.mpesaTransaction.findMany({
            where: {
                type: 'PAYOUT' as any,
                status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
            take: 50, // reasonable window — payouts older than this are likely stuck
        });

        // Match by conversationId stored in metadata
        let matchingTx = null;
        for (const tx of pendingPayouts) {
            const meta = tx.metadata as any;
            if (meta?.conversationId === conversationId) {
                matchingTx = tx;
                break;
            }
        }

        if (matchingTx) {
            const isSuccess = resultCode === 0;
            await prisma.mpesaTransaction.update({
                where: { id: matchingTx.id },
                data: {
                    status: isSuccess ? 'SUCCESS' : 'FAILED',
                    resultCode,
                    resultDesc,
                    transactionId: transactionId || null,
                },
            });

            // If this was a refund payout, mark the refund as disbursed/failed
            const refundId = (matchingTx.metadata as any)?.refundId;
            if (refundId) {
                try {
                    // Import dynamically to avoid circular dependency
                    const { refundService } = await import('../services/refund.service');
                    if (isSuccess) {
                        await refundService.markDisbursed(refundId, transactionId);
                    } else {
                        await refundService.markFailed(refundId, resultDesc || 'B2C disbursement failed');
                    }
                } catch (err: any) {
                    logger.error(`[B2CResult] Failed to update refund ${refundId}:`, err?.message);
                }
            }

            // If this was a payroll payout, log it for finance staff to verify
            if (matchingTx.payrollRecordId && isSuccess) {
                logger.info(`[B2CResult] Payroll payout completed for record ${matchingTx.payrollRecordId} — receipt ${transactionId}`);
            }

            logger.info(`[B2CResult] Updated MpesaTransaction ${matchingTx.id} → ${isSuccess ? 'SUCCESS' : 'FAILED'}`);
        } else {
            logger.warn(`[B2CResult] No matching PENDING payout for conversation ${conversationId}`);
        }
    } catch (error: any) {
        logger.error('[B2CResult] Error:', error.message);
    }

    // Always 200 to Daraja
    res.json({ success: true });
};

// ─── B2C Timeout Handler ────────────────────────────────────────────────────
/**
 * Handle Daraja B2C Queue Timeout.
 *
 * If a B2C request sits in Daraja's queue too long without being processed,
 * a timeout notification is posted here. The originating payout remains in
 * PENDING status — finance staff should investigate and decide whether to
 * retry or cancel.
 */
export const handleB2cTimeout = async (req: Request, res: Response) => {
    const timeout = req.body;
    logger.warn('[B2CTimeout] B2C request timed out:', JSON.stringify(timeout));

    try {
        // Extract conversation ID from the timeout payload
        const conversationId = timeout?.ConversationID || timeout?.Result?.ConversationID;

        if (conversationId) {
            // Find the stuck PENDING payout
            const pendingPayouts = await prisma.mpesaTransaction.findMany({
                where: {
                    type: 'PAYOUT' as any,
                    status: 'PENDING',
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });

            let matchingTx = null;
            for (const tx of pendingPayouts) {
                const meta = tx.metadata as any;
                if (meta?.conversationId === conversationId) {
                    matchingTx = tx;
                    break;
                }
            }

            if (matchingTx) {
                // Mark the M-Pesa transaction as TIMEOUT
                await prisma.mpesaTransaction.update({
                    where: { id: matchingTx.id },
                    data: {
                        status: 'TIMEOUT' as any,
                        resultDesc: 'B2C request timed out in Daraja queue',
                    },
                });

                // If this was a refund payout, mark it for manual processing
                const refundId = (matchingTx.metadata as any)?.refundId;
                if (refundId) {
                    try {
                        const { refundService } = await import('../services/refund.service');
                        // Mark the refund as MANUAL so finance staff can process it
                        // outside of B2C. We don't use markFailed() because the
                        // B2C didn't actually fail — it timed out, meaning the
                        // money may or may not have been sent. Staff must verify.
                        await prisma.refund.update({
                            where: { id: refundId },
                            data: {
                                status: 'MANUAL' as any,
                                b2cFailureReason: 'B2C request timed out in Daraja queue — verify whether funds were disbursed before retrying.',
                            },
                        });
                        logger.warn(`[B2CTimeout] Refund ${refundId} marked MANUAL due to timeout`);
                    } catch (err: any) {
                        logger.error(`[B2CTimeout] Failed to update refund ${refundId}:`, err?.message);
                    }
                }

                logger.info(`[B2CTimeout] Updated MpesaTransaction ${matchingTx.id} → TIMEOUT`);
            } else {
                logger.warn(`[B2CTimeout] No matching PENDING payout for conversation ${conversationId}`);
            }
        }
    } catch (error: any) {
        logger.error('[B2CTimeout] Error:', error.message);
    }

    // Always 200 to Daraja
    res.json({ success: true });
};

// ─── Register C2B URLs (admin setup) ────────────────────────────────────────
/**
 * Register C2B confirmation and validation URLs with Daraja.
 *
 * This is a one-time setup call that tells Daraja where to post organic
 * paybill payments. Only SUPER_ADMIN can trigger it. The endpoint is also
 * called automatically on first deploy if C2B URLs are not yet registered.
 */
export const registerC2bUrls = async (req: Request, res: Response) => {
    try {
        const { darajaService } = await import('../services/daraja.service');
        const result = await darajaService.registerC2bUrls();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
