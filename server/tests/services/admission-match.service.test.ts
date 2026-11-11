import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    learner: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    feePayment: {
        findFirst: jest.fn(),
    },
    unmatchedPayment: {
        create: jest.fn(),
    },
    feeInvoice: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: mockPrisma,
}));

// ── Mock payment-resolver functions ─────────────────────────────────────────
const mockApplyPaymentToInvoice = jest.fn() as any;
const mockParkAsUnmatched = jest.fn() as any;

jest.mock('../../src/services/payment-resolver.service', () => ({
    normalizePhone: jest.fn((phone: string) => {
        // Basic normalization: strip non-digits, prepend 254
        let p = phone.replace(/\D/g, '');
        if (p.startsWith('0')) p = '254' + p.slice(1);
        if (p.startsWith('7') && p.length === 9) p = '254' + p;
        return p;
    }),
    applyPaymentToInvoice: mockApplyPaymentToInvoice,
    parkAsUnmatched: mockParkAsUnmatched,
}));

jest.mock('../../src/services/accounting.service', () => ({
    accountingService: {
        postFeePaymentToLedger: jest.fn(),
        postMpesaCharge: jest.fn(),
    },
}));

jest.mock('../../src/services/overpayment-credit.service', () => ({
    overpaymentCreditService: {
        detectAndPostOverpayment: jest.fn(),
    },
}));

jest.mock('../../src/services/message.service', () => ({
    __esModule: true,
    default: { createAndDispatchMessage: jest.fn() },
}));

jest.mock('../../src/config/productIdentity', () => ({
    PRODUCT_DISPLAY_NAME: 'TrendSCORE',
}));

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { admissionMatchService } from '../../src/services/admission-match.service';

describe('AdmissionMatchService (Daraja Connector — Step 3)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('matchAndApply', () => {

        const baseParams = {
            accountReference: 'ADM001',
            rawPhone: '0712345678',
            amount: 5000,
            receipt: 'REC123',
            rawPayload: { test: true },
        };

        it('should park as unmatched when AccountReference is empty', async () => {
            mockParkAsUnmatched.mockResolvedValue({});

            const result = await admissionMatchService.matchAndApply({
                ...baseParams,
                accountReference: '',
            });

            expect(result.outcome).toBe('unmatched');
            expect(result.detail).toContain('No AccountReference');
            expect(mockParkAsUnmatched).toHaveBeenCalled();
        });

        it('should match by exact admission number and apply payment', async () => {
            (mockPrisma.learner.findFirst as any).mockResolvedValue({
                id: 'learner-1',
                firstName: 'John',
                lastName: 'Doe',
                admissionNumber: 'ADM001',
            });
            mockApplyPaymentToInvoice.mockResolvedValue({
                success: true,
                invoiceId: 'inv-1',
                invoiceNumber: 'INV-001',
            });
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue({
                id: 'pay-1',
                amount: 5000,
                paymentDate: new Date(),
            });

            const result = await admissionMatchService.matchAndApply(baseParams);

            expect(result.outcome).toBe('applied');
            expect(result.learnerId).toBe('learner-1');
            expect(result.detail).toContain('INV-001');
        });

        it('should use case-insensitive fallback match when exact match fails', async () => {
            // First query (exact) returns null
            (mockPrisma.learner.findFirst as any).mockResolvedValue(null);
            // Fallback query returns all active learners, we match in code
            (mockPrisma.learner.findMany as any).mockResolvedValue([
                { id: 'l1', firstName: 'A', lastName: 'B', admissionNumber: 'adm-001' },
                { id: 'l2', firstName: 'C', lastName: 'D', admissionNumber: 'adm-002' },
            ]);
            mockApplyPaymentToInvoice.mockResolvedValue({
                success: true,
                invoiceId: 'inv-2',
                invoiceNumber: 'INV-002',
            });
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue({
                id: 'pay-2', amount: 5000, paymentDate: new Date(),
            });

            const result = await admissionMatchService.matchAndApply({
                ...baseParams,
                accountReference: 'ADM-001', // has hyphen, should match 'adm-001' after cleaning
            });

            expect(result.outcome).toBe('applied');
            expect(result.learnerId).toBe('l1');
        });

        it('should park as unmatched when no learner matches the admission number', async () => {
            (mockPrisma.learner.findFirst as any).mockResolvedValue(null);
            (mockPrisma.learner.findMany as any).mockResolvedValue([
                { id: 'l1', admissionNumber: 'ADM999' },
            ]);
            mockParkAsUnmatched.mockResolvedValue({});

            const result = await admissionMatchService.matchAndApply({
                ...baseParams,
                accountReference: 'NONEXISTENT',
            });

            expect(result.outcome).toBe('unmatched');
            expect(result.detail).toContain('not found');
            expect(mockParkAsUnmatched).toHaveBeenCalled();
        });

        it('should park as unmatched when learner has no outstanding invoice', async () => {
            (mockPrisma.learner.findFirst as any).mockResolvedValue({
                id: 'learner-1',
                firstName: 'John',
                lastName: 'Doe',
                admissionNumber: 'ADM001',
            });
            mockApplyPaymentToInvoice.mockResolvedValue({
                success: false,
            });
            mockParkAsUnmatched.mockResolvedValue({});

            const result = await admissionMatchService.matchAndApply(baseParams);

            expect(result.outcome).toBe('unmatched');
            expect(result.detail).toContain('No outstanding invoice');
            expect(result.learnerId).toBe('learner-1');
        });

        it('should post to ledger and detect overpayment after successful application', async () => {
            (mockPrisma.learner.findFirst as any).mockResolvedValue({
                id: 'learner-1',
                firstName: 'John',
                lastName: 'Doe',
                admissionNumber: 'ADM001',
            });
            mockApplyPaymentToInvoice.mockResolvedValue({
                success: true,
                invoiceId: 'inv-1',
                invoiceNumber: 'INV-001',
            });
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue({
                id: 'pay-1',
                amount: 5000,
                paymentDate: new Date(),
            });

            const { accountingService } = require('../../src/services/accounting.service');
            const { overpaymentCreditService } = require('../../src/services/overpayment-credit.service');

            await admissionMatchService.matchAndApply(baseParams);

            // Verify ledger posting was called
            expect(accountingService.postFeePaymentToLedger).toHaveBeenCalled();
            // Verify M-Pesa charge was recorded
            expect(accountingService.postMpesaCharge).toHaveBeenCalledWith(5000, 'MPESA-REC123');
            // Verify overpayment detection was called
            expect(overpaymentCreditService.detectAndPostOverpayment).toHaveBeenCalledWith('inv-1', 'pay-1');
        });

        it('should not throw if ledger posting fails (non-blocking)', async () => {
            (mockPrisma.learner.findFirst as any).mockResolvedValue({
                id: 'learner-1',
                firstName: 'John',
                lastName: 'Doe',
                admissionNumber: 'ADM001',
            });
            mockApplyPaymentToInvoice.mockResolvedValue({
                success: true,
                invoiceId: 'inv-1',
                invoiceNumber: 'INV-001',
            });
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue(null); // payment not found

            // Should not throw — just logs error
            const result = await admissionMatchService.matchAndApply(baseParams);
            expect(result.outcome).toBe('applied');
        });
    });
});
