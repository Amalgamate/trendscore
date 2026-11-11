import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    feeInvoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    feePayment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    learner: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    journalEntry: {
        findFirst: jest.fn(),
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
        (mockPrisma.$transaction as any).mockImplementation((fn: any) => fn(mockPrisma));
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
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', amount: 12000, archived: false });
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
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue(null);

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
            expect(mockAccountingService.postJournalEntry).toHaveBeenCalledWith('entry-1', mockPrisma);
        });

        it('should fail the caller transaction if held-credit ledger posting cannot complete', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', amount: 7000, archived: false });
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

            await expect(overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1'))
                .rejects.toThrow('Overpayment accounts or journal are not configured');
        });

        it('attributes only this payment’s incremental overpayment and uses the full payment ID as the journal reference', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({ id: 'pay-123456789', invoiceId: 'inv-1', amount: 3000, archived: false });
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1', invoiceNumber: 'INV-001', status: 'OVERPAID', totalAmount: 8000, paidAmount: 15000, balance: -7000,
            });
            mockAccountingService.getAccountByCode.mockResolvedValue({ id: 'account' });
            mockAccountingService.getJournalByCode.mockResolvedValue({ id: 'journal-1' });
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue(null);
            mockAccountingService.createJournalEntry.mockResolvedValue({ id: 'entry-1' });
            mockAccountingService.postJournalEntry.mockResolvedValue({});

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-123456789');

            expect(excess).toBe(3000);
            expect(mockAccountingService.createJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
                reference: 'OVERPAY/INV-001/pay-123456789',
                items: expect.arrayContaining([expect.objectContaining({ debit: 3000 }), expect.objectContaining({ credit: 3000 })]),
            }), mockPrisma);
        });

        it('does not create a duplicate journal entry when the same payment is replayed', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1', amount: 2000, archived: false });
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1', invoiceNumber: 'INV-001', status: 'OVERPAID', totalAmount: 5000, paidAmount: 7000,
            });
            mockAccountingService.getAccountByCode.mockResolvedValue({ id: 'account' });
            mockAccountingService.getJournalByCode.mockResolvedValue({ id: 'journal-1' });
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'existing-entry', status: 'POSTED' });

            const excess = await overpaymentCreditService.detectAndPostOverpayment('inv-1', 'pay-1');

            expect(excess).toBe(2000);
            expect(mockAccountingService.createJournalEntry).not.toHaveBeenCalled();
        });
    });

    describe('allocateCredit', () => {
        const makeInvoice = (overrides: any = {}) => ({
            id: 'source', invoiceNumber: 'INV-S', status: 'OVERPAID', archived: false,
            totalAmount: 100, paidAmount: 150, balance: -50,
            learner: { parentId: 'parent-1', familyLinks: [], firstName: 'Source', lastName: 'Learner' },
            ...overrides,
        });

        const makeTarget = (overrides: any = {}) => ({
            id: 'target', invoiceNumber: 'INV-T', status: 'PARTIAL', archived: false,
            totalAmount: 100, paidAmount: 20, balance: 80, transportBalance: 0, transportPaid: 0, sponsorBalance: 0,
            learner: { parentId: 'parent-1', familyLinks: [], firstName: 'Target', lastName: 'Learner' },
            ...overrides,
        });

        it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])('rejects invalid allocation amount %s before opening a transaction', async (amount) => {
            await expect(overpaymentCreditService.allocateCredit('source', 'target', amount, 'user-1'))
                .rejects.toThrow('Enter a credit allocation greater than zero.');
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('rejects unrelated learners when no verified active family is shared', async () => {
            (mockPrisma.feeInvoice.findUnique as any)
                .mockResolvedValueOnce(makeInvoice())
                .mockResolvedValueOnce(makeTarget({ learner: { parentId: 'parent-2', familyLinks: [] } }));

            await expect(overpaymentCreditService.allocateCredit('source', 'target', 10, 'user-1'))
                .rejects.toThrow('Credit can only be allocated between learners linked to the same parent or active family account.');
            expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
        });

        it('allows a verified shared family account when parent IDs are not linked', async () => {
            (mockPrisma.feeInvoice.findUnique as any)
                .mockResolvedValueOnce(makeInvoice({ learner: { parentId: null, familyLinks: [{ familyAccountId: 'family-1' }] } }))
                .mockResolvedValueOnce(makeTarget({ learner: { parentId: null, familyLinks: [{ familyAccountId: 'family-1' }] } }))
                .mockResolvedValueOnce({ status: 'OVERPAID' })
                .mockResolvedValueOnce({ status: 'PARTIAL' });
            (mockPrisma.feeInvoice.updateMany as any).mockResolvedValue({ count: 1 });
            (mockPrisma.feePayment.create as any).mockResolvedValue({ id: 'credit-payment-1' });
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'already-posted', status: 'POSTED' });

            const result = await overpaymentCreditService.allocateCredit('source', 'target', 10, 'user-1');

            expect(result.success).toBe(true);
            expect(mockPrisma.feeInvoice.updateMany).toHaveBeenCalledTimes(2);
            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['available credit', makeInvoice(), makeTarget(), 51],
            ['target balance', makeInvoice(), makeTarget({ balance: 9 }), 10],
        ])('rejects allocations exceeding %s without making updates', async (_name, source, target, amount) => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValueOnce(source).mockResolvedValueOnce(target);

            await expect(overpaymentCreditService.allocateCredit('source', 'target', amount, 'user-1')).rejects.toThrow();
            expect(mockPrisma.feeInvoice.updateMany).not.toHaveBeenCalled();
        });

        it('uses transactional conditional source and target updates for an allocation', async () => {
            (mockPrisma.feeInvoice.findUnique as any)
                .mockResolvedValueOnce(makeInvoice())
                .mockResolvedValueOnce(makeTarget())
                .mockResolvedValueOnce({ status: 'OVERPAID' })
                .mockResolvedValueOnce({ status: 'PARTIAL' });
            (mockPrisma.feeInvoice.updateMany as any).mockResolvedValue({ count: 1 });
            (mockPrisma.feePayment.create as any).mockResolvedValue({ id: 'credit-payment-2' });
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'already-posted', status: 'POSTED' });

            const result = await overpaymentCreditService.allocateCredit('source', 'target', 10, 'user-1');

            expect(result.allocatedAmount).toBe(10);
            expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
            expect(mockPrisma.feeInvoice.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
                where: expect.objectContaining({ id: 'source', paidAmount: { gte: 110 } }),
            }));
            expect(mockPrisma.feeInvoice.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
                where: expect.objectContaining({ id: 'target', balance: { gte: 10 } }),
            }));
        });

        it('applies credit to tuition first then transport and records transport sub-ledger amounts', async () => {
            (mockPrisma.feeInvoice.findUnique as any)
                .mockResolvedValueOnce(makeInvoice())
                .mockResolvedValueOnce(makeTarget({ balance: 5, transportBalance: 75 }))
                .mockResolvedValueOnce({ status: 'OVERPAID' })
                .mockResolvedValueOnce({ status: 'PARTIAL' });
            (mockPrisma.feeInvoice.updateMany as any).mockResolvedValue({ count: 1 });
            (mockPrisma.feePayment.create as any).mockResolvedValue({ id: 'credit-payment-3' });
            (mockPrisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'already-posted', status: 'POSTED' });

            await overpaymentCreditService.allocateCredit('source', 'target', 10, 'user-1');

            expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ amount: 10, transportAmount: 5 }),
            }));
            expect(mockPrisma.feeInvoice.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
                where: expect.objectContaining({ balance: { gte: 5 }, transportBalance: { gte: 5 } }),
                data: expect.objectContaining({
                    balance: { decrement: 5 }, transportPaid: { increment: 5 }, transportBalance: { decrement: 5 },
                }),
            }));
        });

        it('rejects a failed conditional claim rather than silently clipping or spending stale credit', async () => {
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValueOnce(makeInvoice()).mockResolvedValueOnce(makeTarget());
            (mockPrisma.feeInvoice.updateMany as any).mockResolvedValue({ count: 0 });

            await expect(overpaymentCreditService.allocateCredit('source', 'target', 10, 'user-1'))
                .rejects.toThrow('Available source credit changed. Refresh and try again.');
            expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
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
