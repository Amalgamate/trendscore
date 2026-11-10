import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    feeInvoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
    feePayment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    learner: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: mockPrisma,
}));

// ── Mock accounting service ─────────────────────────────────────────────────
const mockAccountingService = {
    getAccountByCode: jest.fn() as any,
    getJournalByCode: jest.fn() as any,
    ensureDefaultAccountingSetup: jest.fn() as any,
    clearCache: jest.fn() as any,
    createJournalEntry: jest.fn() as any,
    postJournalEntry: jest.fn() as any,
};

jest.mock('../../src/services/accounting.service', () => ({
    accountingService: mockAccountingService,
}));

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import { overpaymentCreditService } from '../../src/services/overpayment-credit.service';

describe('OverpaymentCreditService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── detectAndPostOverpayment ─────────────────────────────────────────
    describe('detectAndPostOverpayment', () => {

        it('should return 0 for a non-OVERPAID invoice', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1',
                status: 'PAID',
                totalAmount: 10000,
                paidAmount: 10000,
            });

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1');
            expect(excess).toBe(0);
        });

        it('should return 0 if invoice does not exist', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue(null);

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-missing', 'pay-1');
            expect(excess).toBe(0);
        });

        it('should return 0 for tiny overpayment (< 0.01, rounding artefact)', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1',
                status: 'OVERPAID',
                totalAmount: 10000,
                paidAmount: 10000.005,
            });

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1');
            expect(excess).toBe(0);
        });

        it('should detect overpayment and post excess to Tuition Deposits', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1',
                invoiceNumber: 'INV-001',
                status: 'OVERPAID',
                totalAmount: 8000,
                paidAmount: 12000, // 4000 excess
                balance: -4000,
                learnerId: 'learner-1',
            });

            mockAccountingService.getAccountByCode
                .mockResolvedValueOnce({ id: 'ar-acc', code: '1100' })  // AR
                .mockResolvedValueOnce({ id: 'dep-acc', code: '2100' }); // Tuition Deposits
            mockAccountingService.getJournalByCode.mockResolvedValue({ id: 'journal-1', code: 'MISC' });
            mockAccountingService.createJournalEntry.mockResolvedValue({ id: 'entry-1' });
            mockAccountingService.postJournalEntry.mockResolvedValue({});

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1');

            expect(excess).toBe(4000);
            expect(mockAccountingService.createJournalEntry).toHaveBeenCalled();

            // Verify the journal entry items
            const entryCall = mockAccountingService.createJournalEntry.mock.calls[0][0] as any;
            const items = entryCall.items;
            expect(items).toHaveLength(2);

            // Dr AR 1100 (reduces over-credited AR)
            expect(items[0].accountId).toBe('ar-acc');
            expect(items[0].debit).toBe(4000);

            // Cr Tuition Deposits 2100 (increases held credit)
            expect(items[1].accountId).toBe('dep-acc');
            expect(items[1].credit).toBe(4000);

            // Entry should be posted
            expect(mockAccountingService.postJournalEntry).toHaveBeenCalledWith('entry-1');
        });

        it('should not throw if ledger posting fails (non-blocking)', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1',
                invoiceNumber: 'INV-002',
                status: 'OVERPAID',
                totalAmount: 5000,
                paidAmount: 7000, // 2000 excess
                balance: -2000,
                learnerId: 'learner-1',
            });

            mockAccountingService.getAccountByCode.mockResolvedValue(null); // accounts missing
            mockAccountingService.ensureDefaultAccountingSetup.mockResolvedValue({});
            mockAccountingService.getJournalByCode.mockResolvedValue(null); // still missing

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1');

            // Should still return the excess even though ledger posting failed
            expect(excess).toBe(2000);
        });
    });

    // ── getOverpaidInvoices ──────────────────────────────────────────────
    describe('getOverpaidInvoices', () => {
        it('should return OVERPAID invoices with computed creditAmount', async () => {
            (mockPrisma.feeInvoice.findMany as any).mockResolvedValue([
                {
                    id: 'inv-1',
                    invoiceNumber: 'INV-001',
                    totalAmount: 8000,
                    paidAmount: 12000,
                    status: 'OVERPAID',
                    learner: { id: 'l1', firstName: 'John', lastName: 'Doe', admissionNumber: 'ADM001' },
                    payments: [],
                },
            ]);

            const result = await overpaymentCreditService.getOverpaidInvoices();

            expect(result).toHaveLength(1);
            expect(result[0].creditAmount).toBe(4000);
        });
    });
});
