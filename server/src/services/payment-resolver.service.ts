/**
 * Payment Resolver Service
 * 
 * Handles Daraja C2B payments and routes verified receipts to learner invoices.
 * Attempts to match the paying phone number to a registered learner/parent,
 * then auto-applies the payment to their oldest outstanding invoice.
 * 
 * If matching is ambiguous (multiple children) or fails (unknown number),
 * the payment is parked in the UnmatchedPayment queue for admin resolution.
 * 
 * FIXES APPLIED:
 *  Bug 2 — OVERPAID status now set when paidAmount > totalAmount in all paths.
 *  Bug 4 — Transport fields (transportPaid / transportBalance) now updated via
 *           applyAmountToInvoiceFields() helper, matching fee.controller.ts logic.
 */

import prisma from '../config/database';
import messageService from './message.service';
import { PaymentStatus } from '@prisma/client';
import { PRODUCT_DISPLAY_NAME } from '../config/productIdentity';
import { accountingService } from './accounting.service';
import { overpaymentCreditService } from './overpayment-credit.service';

// ─── Phone normalisation ────────────────────────────────────────────────────
export function normalizePhone(raw: string): string {
    let phone = String(raw).trim().replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    if (phone.startsWith('+')) phone = phone.slice(1);
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (!phone.startsWith('254')) phone = '254' + phone;
    return phone;
}

// ─── Shared allocation helper ───────────────────────────────────────────────
/**
 * FIX (Bug 4): Tuition-first allocation that also updates transport fields.
 * Matches the logic used in fee.controller.ts::recordPayment().
 * Must be called inside a prisma.$transaction if atomicity is needed.
 */
export async function applyAmountToInvoiceFields(
    tx: any,
    invoiceId: string,
    amount: number
): Promise<void> {
    const inv = await tx.feeInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

    // `balance` is the total learner balance (tuition + transport); transport
    // is also tracked as a component in `transportBalance`. Treat it as a
    // subset so collections don't count transport twice.
    const totalBal = Math.max(0, Number(inv.balance));
    const transportBal = Number(inv.transportBalance);
    const tuitionBal = Math.max(0, totalBal - transportBal);

    let tuitionChunk: number;
    let transportChunk: number;

    if (amount <= tuitionBal) {
        tuitionChunk   = amount;
        transportChunk = 0;
    } else {
        tuitionChunk   = tuitionBal;
        transportChunk = Math.min(amount - tuitionBal, transportBal);
    }

    await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: {
            paidAmount:       { increment: amount },
            balance:          { decrement: Math.min(amount, totalBal) },
            transportPaid:    { increment: transportChunk },
            transportBalance: { decrement: transportChunk }
        }
    });
}

// ─── Status resolver ────────────────────────────────────────────────────────
/**
 * FIX (Bug 2): Correct 4-branch status logic, identical to fee.controller.ts.
 */
export function resolveInvoiceStatus(inv: {
    paidAmount: any;
    totalAmount: any;
    balance: any;
    sponsorBalance?: any;
    sponsorPaidAmount?: any;
}): PaymentStatus {
    const paid  = Number(inv.paidAmount);
    const total = Number(inv.totalAmount);
    const bal   = Number(inv.balance);

    if (paid > total)  return 'OVERPAID';
    if (bal <= 0 && Number(inv.sponsorBalance || 0) <= 0) return 'PAID';
    if (paid > 0 || Number(inv.sponsorPaidAmount || 0) > 0) return 'PARTIAL';
    return 'PENDING';
}

// ─── Payment application ────────────────────────────────────────────────────
/**
 * Applies a payment to the oldest PENDING/PARTIAL invoice of a given learner.
 * Creates FeePayment, updates invoice balance + transport + status, sends SMS.
 */
export async function applyPaymentToInvoice(params: {
    learnerId: string;
    amount: number;
    receipt: string;
    phone: string;
    transactionDate?: Date;
}): Promise<{ success: boolean; invoiceId?: string; invoiceNumber?: string }> {
    const { learnerId, amount, receipt, phone, transactionDate } = params;

    // Find oldest unpaid invoice
    const invoice = await prisma.feeInvoice.findFirst({
        where: {
            learnerId,
            status: { in: ['PENDING', 'PARTIAL'] },
            archived: false
        },
        orderBy: { dueDate: 'asc' },
        include: { learner: true }
    });

    if (!invoice) {
        console.warn(`[PaymentResolver] No pending invoice for learner ${learnerId}`);
        return { success: false };
    }

    // A Daraja receipt is globally unique. Never treat a duplicate receipt as
    // success for a different learner or invoice.
    const receiptNumber = `MPESA-${receipt}`;
    const existingPayment = await prisma.feePayment.findUnique({ where: { receiptNumber } });
    if (existingPayment) {
        const existingInvoice = await prisma.feeInvoice.findUnique({
            where: { id: existingPayment.invoiceId },
            select: { id: true, learnerId: true, invoiceNumber: true },
        });
        if (existingInvoice?.learnerId !== learnerId) {
            throw new Error(`M-Pesa receipt ${receipt} is already linked to a different learner.`);
        }
        return { success: true, invoiceId: existingInvoice.id, invoiceNumber: existingInvoice.invoiceNumber };
    }

    await accountingService.ensureDefaultAccountingSetup();
    const systemUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

    let updatedInvoice: any;

    try {
        await prisma.$transaction(async (tx) => {
            const duplicate = await tx.feePayment.findUnique({ where: { receiptNumber } });
            if (duplicate) {
                if (duplicate.invoiceId !== invoice.id) {
                    throw new Error(`M-Pesa receipt ${receipt} is already linked to a different invoice.`);
                }
                updatedInvoice = await tx.feeInvoice.findUnique({ where: { id: invoice.id } });
                return;
            }
            // Create payment record — catch duplicate receipt on P2002
            await tx.feePayment.create({
                data: {
                    invoiceId: invoice.id,
                    amount,
                    paymentMethod: 'MPESA',
                    receiptNumber,
                    referenceNumber: receipt,
                    notes: `Auto-matched Buy Goods Till payment from ${phone}`,
                    recordedBy: systemUser?.id || '',
                    ...(transactionDate ? { paymentDate: transactionDate } : {}),
                }
            });

            // FIX Bug 4: tuition-first allocation including transport fields
            await applyAmountToInvoiceFields(tx, invoice.id, amount);

            // FIX Bug 2: correct 4-branch status
            const fresh = await tx.feeInvoice.findUnique({ where: { id: invoice.id } });
            if (fresh) {
                const newStatus = resolveInvoiceStatus(fresh);
                updatedInvoice = await tx.feeInvoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus }
                });
            }

            const payment = await tx.feePayment.findUnique({ where: { receiptNumber } });
            if (!payment) throw new Error(`Payment ${receipt} was not persisted.`);
            await accountingService.postFeePaymentToLedger(payment, 'MPESA', tx);
            await overpaymentCreditService.detectAndPostOverpayment(invoice.id, payment.id, tx);
            await accountingService.postMpesaCharge(Number(payment.amount), receiptNumber, tx);
        }, { isolationLevel: 'Serializable' });
    } catch (err: any) {
        if (err?.code === 'P2002') {
            const duplicate = await prisma.feePayment.findUnique({ where: { receiptNumber } });
            if (duplicate?.invoiceId === invoice.id) {
                return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
            }
            throw new Error(`M-Pesa receipt ${receipt} is already linked to a different invoice.`);
        }
        throw err;
    }

    // Refresh for SMS balance
    const finalInv = updatedInvoice ?? await prisma.feeInvoice.findUnique({ where: { id: invoice.id } });

    // Send SMS receipt
    try {
        const school = await prisma.school.findFirst();
        const learner = invoice.learner;
        const name = learner ? `${learner.firstName} ${learner.lastName}` : 'your child';
        const msg = `Payment of KES ${amount.toLocaleString()} received for ${name} — Ref: ${invoice.invoiceNumber}. Receipt: ${receipt}. Balance: KES ${Math.max(0, Number(finalInv?.balance || 0)).toLocaleString()}. Thank you, ${school?.name || PRODUCT_DISPLAY_NAME}.`;

        await messageService.createAndDispatchMessage({
            senderId: 'system',
            senderType: 'ADMIN',
            recipientType: 'INDIVIDUAL',
            recipients: [{ recipientPhone: phone }],
            body: msg,
            messageType: 'SMS'
        });
    } catch (notifErr) {
        console.error('[PaymentResolver] SMS notification error:', notifErr);
    }

    return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}

// ─── Park unmatched ─────────────────────────────────────────────────────────
export async function parkAsUnmatched(params: {
    phone: string;
    amount: number;
    receipt: string;
    rawPayload: object;
    note?: string;
}): Promise<void> {
    const { phone, amount, receipt, rawPayload, note } = params;
    await prisma.unmatchedPayment.upsert({
        where: { receiptNo: receipt },
        update: {},   // Already parked — do not overwrite
        create: {
            phone,
            amount,
            receiptNo: receipt,
            rawPayload,
            note: note || null
        }
    });
    console.log(`[PaymentResolver] Parked unmatched payment: ${receipt} from ${phone}`);
}
