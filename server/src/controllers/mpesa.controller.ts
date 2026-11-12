import { Request, Response } from 'express';
import { mpesaService } from '../services/mpesa.service';
import prisma from '../config/database';
import messageService from '../services/message.service';
import { applyAmountToInvoiceFields, resolveInvoiceStatus } from '../services/payment-resolver.service';
import { admissionMatchService } from '../services/admission-match.service';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { LMSMarketplaceService } from '../services/lms-marketplace.service';
import { accountingService } from '../services/accounting.service';
import { overpaymentCreditService } from '../services/overpayment-credit.service';
import type { AuthRequest } from '../middleware/permissions.middleware';
import { assertCanAccessInvoicePayment } from '../services/finance-access.service';

import logger from '../utils/logger';
export const initiatePayment = async (req: AuthRequest, res: Response) => {
    const { phoneNumber, amount, studentId, invoiceId } = req.body;
    const parsedAmount = Number(amount);

    if (!phoneNumber || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !invoiceId) {
        return res.status(400).json({ success: false, message: 'Choose a fee invoice and enter a valid amount and phone number.' });
    }

    // ── Provider on/off switch ──────────────────────────────────────────────
    // The school can disable M-Pesa collections from settings (CommunicationConfig.
    // mpesaEnabled). When disabled, STK push is rejected so parents are not
    // prompted to pay via a channel the school has turned off.
    try {
        const commConfig = await prisma.communicationConfig.findFirst();
        if (!commConfig || !commConfig.mpesaEnabled) {
            return res.status(403).json({
                success: false,
                message: 'M-Pesa collections are currently disabled. Please contact the school office to make a payment.'
            });
        }
    } catch (configErr: any) {
        logger.error('[MpesaInitiate] Could not verify school M-Pesa configuration:', configErr?.message);
        return res.status(503).json({
            success: false,
            message: 'We could not verify the school payment settings. Please try again shortly.'
        });
    }

    try {
        const invoice = await prisma.feeInvoice.findUnique({
            where: { id: String(invoiceId) },
            include: { learner: true },
        });
        if (!invoice || invoice.archived) {
            return res.status(404).json({ success: false, message: 'We could not find an active fee invoice for that payment.' });
        }
        if (invoice.status === 'CANCELLED' || invoice.status === 'PAID') {
            return res.status(400).json({ success: false, message: 'This invoice does not have a payment due.' });
        }
        const outstanding = Math.max(0, Number(invoice.balance || 0));
        if (parsedAmount > outstanding + 0.01) {
            return res.status(400).json({
                success: false,
                message: `Payment cannot exceed the outstanding invoice balance of KES ${outstanding.toLocaleString()}.`
            });
        }
        if (studentId && String(studentId) !== invoice.learnerId) {
            return res.status(400).json({ success: false, message: 'The learner and invoice do not match. Please choose the invoice again.' });
        }
        await assertCanAccessInvoicePayment(req, invoice);

        const result = await mpesaService.initiateStkPush({
            phoneNumber,
            amount: parsedAmount,
            studentId: invoice.learnerId,
            invoiceId: invoice.id,
        });

        if (result.success) {
            return res.json({ ...result, message: 'Payment request sent. Approve it on your M-Pesa phone to complete payment.' });
        } else {
            return res.status(502).json({ ...result, message: result.message || 'We could not send the M-Pesa request. Please try again or choose another payment method.' });
        }
    } catch (error: any) {
        logger.error('[MpesaInitiate] Payment request failed:', error?.message);
        return res.status(error?.statusCode || 500).json({
            success: false,
            message: error?.statusCode === 403
                ? 'This fee account is not linked to your family.'
                : error?.statusCode && error.statusCode < 500
                    ? error.message
                    : 'We could not start the M-Pesa request. Please try again or contact the school office.',
            code: error?.code,
        });
    }
};

/**
 * Query STK Status and Record Payment if COMPLETE
 */
export const queryStatus = async (req: AuthRequest, res: Response) => {
    const { checkoutRequestId, invoiceId } = req.params;

    try {
        const existing = await prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
        if (!existing || existing.type !== 'COLLECTION' || !existing.invoiceId || existing.invoiceId !== invoiceId) {
            return res.status(404).json({ success: false, message: 'We could not find a payment request for this invoice.' });
        }
        const invoice = await prisma.feeInvoice.findUnique({
            where: { id: existing.invoiceId },
            select: { id: true, learnerId: true, archived: true },
        });
        if (!invoice || invoice.archived) {
            return res.status(404).json({ success: false, message: 'The fee invoice for this payment is no longer available.' });
        }
        await assertCanAccessInvoicePayment(req, invoice);

        if (existing.status === 'SUCCESS') {
            return res.json({ success: true, status: 'COMPLETE', message: 'Payment received and added to the fee account.' });
        }
        if (existing.status === 'FAILED' || existing.status === 'CANCELLED') {
            return res.json({ success: true, status: 'FAILED', message: 'The M-Pesa request was not completed. You can try again or choose another payment method.' });
        }

        const result = await mpesaService.queryStatus(checkoutRequestId);
        const { state } = result;
        // Daraja's status query does not include the receipt details required
        // for a fee payment. Only the signed callback may post the payment.
        // Do not show success until that callback has committed the fee and
        // ledger entries.
        if (state === 'COMPLETE') {
            return res.json({
                success: true,
                status: 'PROCESSING',
                message: 'M-Pesa confirmed the request. We are waiting for the receipt to finish updating the school account.'
            });
        }

        return res.json({
            success: true,
            status: state,
            message: state === 'FAILED'
                ? 'The M-Pesa request was not completed. You can try again or choose another payment method.'
                : 'Your payment is still being confirmed. We will update the fee account when M-Pesa responds.',
        });
    } catch (error: any) {
        logger.error('[MpesaStatus] Error checking status:', error?.message);
        return res.status(error?.statusCode || 500).json({
            success: false,
            message: error?.statusCode === 403
                ? 'This fee account is not linked to your family.'
                : error?.statusCode && error.statusCode < 500
                    ? error.message
                    : 'We could not check this payment just now. Please try again shortly.',
            code: error?.code,
        });
    }
};

/**
 * Handle M-Pesa Callback (Public Endpoint)
 *  Handles Daraja STK Push callbacks only; the transaction pre-exists in the DB.
 *  Organic paybill/till payments are handled by handleC2bConfirmation below.
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
            const metadata = Array.isArray(stkCallback.CallbackMetadata.Item)
                ? stkCallback.CallbackMetadata.Item
                : [];
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

            if (transaction.type !== 'COLLECTION') {
                logger.warn(`[MpesaCallback] Ignored STK callback for non-collection transaction ${transaction.id}`);
                return res.json({ success: true });
            }

            if (isSuccess && (!Number.isFinite(amount) || amount <= 0 || !receipt)) {
                logger.error(`[MpesaCallback] Successful callback ${checkoutRequestId} is missing a valid amount or receipt; transaction left pending for review.`);
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: { resultCode, resultDesc: 'Successful callback missing amount or receipt; review required', metadata: { callback: req.body } },
                });
                return res.json({ success: true });
            }

            const requestedAmount = Number(transaction.amount);
            if (isSuccess && (!Number.isFinite(requestedAmount) || Math.abs(amount - requestedAmount) > 0.01)) {
                logger.error(`[MpesaCallback] Amount mismatch for ${checkoutRequestId}; transaction left pending for review.`);
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        resultCode,
                        resultDesc: `Provider amount mismatch; expected ${requestedAmount}, received ${amount}; review required`,
                        metadata: { callback: req.body, expectedAmount: requestedAmount, receivedAmount: amount, receipt, phone },
                    },
                });
                return res.json({ success: true });
            }

            if (isSuccess) {
                // If tied to a specific invoice, apply directly
                if (transaction.invoiceId) {
                    await accountingService.ensureDefaultAccountingSetup();
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

                            await accountingService.postFeePaymentToLedger(createdPayment, 'MPESA', tx);
                            await overpaymentCreditService.detectAndPostOverpayment(
                                transaction.invoiceId!,
                                createdPayment.id,
                                tx,
                            );
                            await accountingService.postMpesaCharge(amount, `MPESA-${receipt}`, tx);
                        }, { isolationLevel: 'Serializable' });
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
                    // Always resume every ledger leg from the persisted payment.
                    // This covers first delivery and provider retries. Any ledger
                    // failure escapes to the outer handler and returns 500, asking
                    // Daraja to retry rather than acknowledging incomplete books.
                    const recordedPayment = createdPaymentId
                        ? await prisma.feePayment.findUnique({ where: { id: createdPaymentId } })
                        : await prisma.feePayment.findUnique({ where: { receiptNumber: `MPESA-${receipt}` } });
                    if (!recordedPayment || recordedPayment.invoiceId !== transaction.invoiceId) {
                        throw new Error(`M-Pesa receipt ${receipt} is already linked to a different invoice.`);
                    }
                    if (isDuplicate && recordedPayment && !recordedPayment.archived) {
                        await accountingService.postFeePaymentToLedger(recordedPayment, 'MPESA');
                        await overpaymentCreditService.detectAndPostOverpayment(
                            transaction.invoiceId!,
                            recordedPayment.id,
                        );
                        await accountingService.postMpesaCharge(Number(recordedPayment.amount), `MPESA-${receipt}`);
                    }

                    if (!isDuplicate) {
                        // Avoid sending a second payment receipt when Daraja
                        // retries a callback already applied to the invoice.
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

                // Do not expose a completed state until the fee payment and
                // accounting legs have both been persisted successfully.
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
        // Never apply an uninitiated STK callback. Organic Till/Paybill payments
        // are handled separately by the verified Daraja C2B confirmation route.
        logger.error(`[MpesaCallback] No STK transaction found for ${checkoutRequestId}; requesting provider retry`);
        return res.status(500).json({ success: false, message: 'Payment request is not yet available for callback processing.' });

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
        await accountingService.ensureDefaultAccountingSetup();

        let updated: any;
        let createdPaymentId: string | null = null;
        const receiptNumber = `MPESA-${unmatched.receiptNo}`;
        try {
            await prisma.$transaction(async (tx) => {
                const createdPayment = await tx.feePayment.create({
                    data: {
                        invoiceId,
                        amount: unmatched.amount,
                        paymentMethod: 'MPESA',
                        receiptNumber,
                        referenceNumber: unmatched.receiptNo,
                        notes: `Manually assigned from unmatched payment queue (phone: ${unmatched.phone})`,
                        recordedBy: systemUser?.id || userId || '',
                        paymentDate: originalPaymentDate
                    }
                });
                createdPaymentId = createdPayment.id;

                await applyAmountToInvoiceFields(tx, invoiceId, Number(unmatched.amount));

                await accountingService.postFeePaymentToLedger({
                    id: createdPayment.id,
                    amount: Number(unmatched.amount),
                    receiptNumber,
                    paymentDate: originalPaymentDate
                }, 'MPESA', tx);
                await overpaymentCreditService.detectAndPostOverpayment(invoiceId, createdPayment.id, tx);
                await accountingService.postMpesaCharge(Number(unmatched.amount), receiptNumber, tx);

                await tx.unmatchedPayment.update({
                    where: { id },
                    data: {
                        status: 'RESOLVED',
                        resolvedLearnerId: learnerId,
                        resolvedInvoiceId: invoiceId,
                        resolvedBy: userId,
                        resolvedAt: new Date()
                    }
                });

                const fresh = await tx.feeInvoice.findUnique({ where: { id: invoiceId } });
                if (fresh) {
                    const newStatus = resolveInvoiceStatus(fresh);
                    updated = await tx.feeInvoice.update({
                        where: { id: invoiceId },
                        data: { status: newStatus }
                    });
                }
            }, { isolationLevel: 'Serializable' });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                logger.warn(`[ResolveUnmatched] Duplicate receipt ${unmatched.receiptNo} — already recorded.`);
                await prisma.$transaction(async (tx) => {
                    const existingPayment = await tx.feePayment.findUnique({ where: { receiptNumber } });
                    if (!existingPayment || existingPayment.invoiceId !== invoiceId) {
                        throw new Error('This M-Pesa receipt is already linked to a different invoice.');
                    }
                    createdPaymentId = existingPayment.id;
                    await accountingService.postFeePaymentToLedger(existingPayment, 'MPESA', tx);
                    await overpaymentCreditService.detectAndPostOverpayment(invoiceId, existingPayment.id, tx);
                    await accountingService.postMpesaCharge(Number(existingPayment.amount), receiptNumber, tx);
                    await tx.unmatchedPayment.update({
                        where: { id },
                        data: {
                            status: 'RESOLVED',
                            resolvedLearnerId: learnerId,
                            resolvedInvoiceId: invoiceId,
                            resolvedBy: userId,
                            resolvedAt: new Date()
                        }
                    });
                    updated = await tx.feeInvoice.findUnique({ where: { id: invoiceId } });
                }, { isolationLevel: 'Serializable' });
            } else {
                throw err;
            }
        }

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

    const normalizedTransactionType = transactionType.toUpperCase().replace(/[^A-Z]/g, '');
    const isSupportedC2bType = normalizedTransactionType.includes('PAYBILL') || normalizedTransactionType.includes('BUYGOODS');
    if (!receipt || !Number.isFinite(amount) || amount <= 0 || !isSupportedC2bType) {
        logger.warn('[C2BConfirm] Ignored invalid or unsupported C2B confirmation payload:', {
            receipt: Boolean(receipt),
            amount,
            transactionType,
        });
        return res.status(500).json({ success: false, message: 'The payment confirmation payload was incomplete.' });
    }

    logger.info(`[C2BConfirm] Receipt: ${receipt} | Amount: ${amount} | Phone: ${phone} | BillRef: ${billRefNumber}`);

    try {
        // Parse Daraja transaction time format (yyyyMMddHHmmss)
        let transactionDate: Date | undefined;
        if (transTime && typeof transTime === 'string') {
            // Daraja format: 20260110143000
            const t = transTime;
            if (t.length === 14) {
                transactionDate = new Date(Date.UTC(
                    Number(t.slice(0, 4)),
                    Number(t.slice(4, 6)) - 1,
                    Number(t.slice(6, 8)),
                    Number(t.slice(8, 10)),
                    Number(t.slice(10, 12)),
                    Number(t.slice(12, 14))
                ));
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
        logger.error('[C2BConfirm] Processing failed; requesting Daraja retry:', error.message);
        // Matching, unmatched-payment persistence, invoice application and
        // ledger posting must complete before acknowledging this callback.
        return res.status(500).json({ success: false, message: 'Payment confirmation could not be recorded.' });
    }

    return res.json({ success: true });
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
