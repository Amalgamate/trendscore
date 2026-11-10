import { darajaService } from './daraja.service';
import prisma from '../config/database';
import { MpesaStatus, MpesaTransactionType } from '@prisma/client';
import logger from '../utils/logger';

/**
 * M-Pesa service — Safaricom Daraja is the only supported provider.
 *
 * Kopo Kopo and IntaSend were removed (no school used them). Keep this class as
 * the single entry point so callers (fees, LMS marketplace, payroll, refunds)
 * do not need to know which provider sits behind it.
 */
class MpesaService {
    /**
     * Initiate STK Push
     */
    async initiateStkPush(params: {
        phoneNumber: string;
        amount: number;
        studentId?: string;
        invoiceId?: string;
        firstName?: string;
        lastName?: string;
    }) {
        return darajaService.initiateStkPush(params);
    }

    /**
     * Initiate Payout (B2C)
     *
     * Used for payroll salary disbursement and refund returns. Calls Daraja's
     * B2C API. The result arrives asynchronously at the B2C result URL — the
     * caller stores the ConversationID to match the result when it arrives.
     *
     * Requires the school to have B2C credentials configured (initiator name +
     * security credential in env vars). If not configured, returns a clear
     * error so callers can inform the user.
     */
    async initiatePayout(params: {
        phoneNumber: string;
        amount: number;
        staffId?: string;
        payrollRecordId?: string;
        reason?: string;
        refundId?: string;
        commandId?: string;
    }): Promise<{ success: boolean; message?: string; conversationId?: string }> {
        const result = await darajaService.initiateB2cPayout({
            phoneNumber: params.phoneNumber,
            amount: params.amount,
            occasion: params.reason || 'B2C Payout',
            commandId: params.commandId || 'BusinessPayment',
        });

        if (result.success) {
            // Track the payout as a PENDING MpesaTransaction so the B2C result
            // callback can match it back when the disbursement completes.
            try {
                await prisma.mpesaTransaction.create({
                    data: {
                        type: MpesaTransactionType.PAYOUT,
                        amount: params.amount,
                        phoneNumber: params.phoneNumber,
                        status: 'PENDING',
                        staffId: params.staffId,
                        payrollRecordId: params.payrollRecordId,
                        metadata: {
                            conversationId: result.conversationId,
                            originatorConversationId: result.originatorConversationId,
                            refundId: params.refundId,
                            reason: params.reason,
                        },
                    },
                });
            } catch (err: any) {
                logger.warn('[MpesaPayout] Failed to track B2C transaction:', err?.message);
            }
        }

        return result;
    }

    /**
     * Query STK Push status.
     *
     * Daraja's STK query confirms the outcome only; it does not return the
     * amount, receipt number or phone. Those arrive on the callback, so callers
     * must not record a payment from this result alone.
     */
    async queryStatus(checkoutRequestId: string): Promise<{
        success: boolean;
        state: 'COMPLETE' | 'FAILED' | 'PENDING';
        amount?: number;
        receipt?: string;
        phone?: string;
        raw: any;
    }> {
        const result = await darajaService.queryStkStatus(checkoutRequestId);
        const code = String(result.ResultCode);
        return {
            success: true,
            state: code === '0' ? 'COMPLETE' : (code === '1032' ? 'FAILED' : 'PENDING'),
            raw: result
        };
    }
}

export const mpesaService = new MpesaService();
