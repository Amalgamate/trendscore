import { darajaService } from './daraja.service';

/**
 * M-Pesa service — Safaricom Daraja is the only supported provider.
 *
 * Kopo Kopo and IntaSend were removed (no school used them). Keep this class as
 * the single entry point so callers (fees, LMS marketplace, payroll) do not need
 * to know which provider sits behind it.
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
     * Not built yet: Daraja B2C has not been implemented. The old payout path
     * was Kopo Kopo only and has been removed with it.
     */
    async initiatePayout(_params: {
        phoneNumber: string;
        amount: number;
        staffId?: string;
        payrollRecordId?: string;
        reason?: string;
    }): Promise<{ success: boolean; message?: string }> {
        throw new Error('M-Pesa payouts are not available yet. Daraja B2C has not been built.');
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
