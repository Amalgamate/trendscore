import { fetchWithAuth } from './core';

export const mpesaAPI = {
    /** Start an invoice-bound STK Push collection. */
    initiatePayment: (data) =>
        fetchWithAuth('/mpesa/initiate', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Check provider state; only the callback-confirmed state is final. */
    checkPaymentStatus: (checkoutRequestId, invoiceId) =>
        fetchWithAuth(`/mpesa/status/${encodeURIComponent(checkoutRequestId)}/${encodeURIComponent(invoiceId)}`),

    // ── Unmatched Payments (Buy Goods Till queue) ─────────────────────────

    /** Count of PENDING unmatched payments — for badge display */
    getUnmatchedCount: () =>
        fetchWithAuth('/mpesa/unmatched/count'),

    /** List unmatched payments with optional status filter */
    getUnmatchedPayments: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return fetchWithAuth(`/mpesa/unmatched${qs ? '?' + qs : ''}`);
    },

    /** Admin assigns an unmatched payment to a specific learner + invoice */
    resolveUnmatchedPayment: (id, learnerId, invoiceId) =>
        fetchWithAuth(`/mpesa/unmatched/${id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({ learnerId, invoiceId })
        }),

    /** Admin dismisses an unmatched payment (e.g. wrong till, test payment) */
    dismissUnmatchedPayment: (id, note = '') =>
        fetchWithAuth(`/mpesa/unmatched/${id}/dismiss`, {
            method: 'PUT',
            body: JSON.stringify({ note })
        }),

    // ── Payouts ───────────────────────────────────────────────────────────
    bulkPayout: (payrollRecordIds) =>
        fetchWithAuth('/mpesa/payout/bulk', {
            method: 'POST',
            body: JSON.stringify({ payrollRecordIds })
        }),
};
