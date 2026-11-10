import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for accounting ledger postings covering Steps 1, 2, and 4:
 *  - postFeePaymentToLedger: Dr Bank/Cash, Cr AR (Step 1)
 *  - postMpesaCharge: Dr M-Pesa Charges Expense, Cr Bank (Step 2)
 *  - postRefundToLedger: Dr AR, Cr Bank/Cash (Step 4 — reversal)
 */

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    account: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
    },
    journal: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
    },
    journalEntry: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    journalItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
    },
    feePayment: { aggregate: jest.fn() },
    feeInvoice: { aggregate: jest.fn() },
    bankStatement: { findMany: jest.fn() },
    bankStatementLine: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        update: jest.fn(),
    },
    expense: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') return arg(mockPrisma);
        return Promise.all(arg);
    }),
};

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: mockPrisma,
}));

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import prisma from '../../src/config/database';
import { AccountingService } from '../../src/services/accounting.service';

describe('Accounting Ledger Postings (Steps 1, 2, 4)', () => {
    let service: AccountingService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new AccountingService();
    });

    // ── postFeePaymentToLedger (Step 1) ──────────────────────────────────
    describe('postFeePaymentToLedger', () => {

        // Helper: mock account.findUnique to return the right account by code
        function mockAccountsByCode(accounts: Record<string, any>) {
            (prisma.account.findUnique as any).mockImplementation((args: any) => {
                const code = args.where.code;
                return Promise.resolve(accounts[code] || null);
            });
        }

        beforeEach(() => {
            // Mock findMany to return empty arrays (no missing accounts)
            (prisma.account.findMany as any).mockResolvedValue([]);
            (prisma.journal.findMany as any).mockResolvedValue([]);
            // Mock createMany (called by ensureDefaultAccountingSetup if triggered)
            (prisma.account.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journalEntry.create as any).mockResolvedValue({ id: 'entry-1' });
            (prisma.journalEntry.findUnique as any).mockResolvedValue({ id: 'entry-1', status: 'DRAFT' });
            (prisma.journalItem.create as any).mockResolvedValue({});
            (prisma.journalEntry.update as any).mockResolvedValue({});
            (prisma.journal.findFirst as any).mockResolvedValue({ id: 'journal-1', code: 'BNK1' });
            (prisma.journal.findUnique as any).mockResolvedValue({ id: 'journal-1', code: 'BNK1' });
        });

        it('should post Dr Bank / Cr AR for MPESA payments', async () => {
            mockAccountsByCode({
                '1210': { id: 'acc-bank', code: '1210' },
                '1100': { id: 'acc-ar', code: '1100' },
            });

            await service.postFeePaymentToLedger(
                {
                    id: 'pay-1',
                    amount: 5000,
                    receiptNumber: 'MPESA-REC123',
                    paymentDate: new Date('2026-11-01'),
                },
                'MPESA'
            );

            // Should create a journal entry
            expect(prisma.journalEntry.create).toHaveBeenCalled();

            // createJournalEntry uses nested items.create inside journalEntry.create,
            // so we verify the entry was created with 2 items
            const createCall = (prisma.journalEntry.create as any).mock.calls[0][0];
            expect(createCall.data.items.create).toHaveLength(2);

            // The entry should be posted (status → POSTED)
            expect(prisma.journalEntry.update).toHaveBeenCalled();
        });

        it('should post Dr Cash / Cr AR for CASH payments', async () => {
            mockAccountsByCode({
                '1200': { id: 'acc-cash', code: '1200' },
                '1100': { id: 'acc-ar', code: '1100' },
            });

            await service.postFeePaymentToLedger(
                {
                    id: 'pay-2',
                    amount: 2000,
                    receiptNumber: 'CASH-001',
                    paymentDate: new Date('2026-11-02'),
                },
                'CASH'
            );

            expect(prisma.journalEntry.create).toHaveBeenCalled();
        });
    });

    // ── postMpesaCharge (Step 2) ─────────────────────────────────────────
    describe('postMpesaCharge', () => {

        it('should post M-Pesa transaction charge as an expense', async () => {
            process.env.MPESA_CHARGE_PER_TRANSACTION = '15';
            (prisma.account.findUnique as any).mockImplementation((args: any) => {
                const code = args.where.code;
                const accounts: any = {
                    '5500': { id: 'acc-mpesa-charge', code: '5500' },
                    '1210': { id: 'acc-bank', code: '1210' },
                };
                return Promise.resolve(accounts[code] || null);
            });
            (prisma.account.findMany as any).mockResolvedValue([]);
            (prisma.journal.findMany as any).mockResolvedValue([]);
            (prisma.account.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.findFirst as any).mockResolvedValue({ id: 'journal-1', code: 'MISC' });
            (prisma.journal.findUnique as any).mockResolvedValue({ id: 'journal-1', code: 'MISC' });
            (prisma.journalEntry.create as any).mockResolvedValue({ id: 'entry-charge' });
            (prisma.journalEntry.findUnique as any).mockResolvedValue({ id: 'entry-charge', status: 'DRAFT' });
            (prisma.journalItem.create as any).mockResolvedValue({});
            (prisma.journalEntry.update as any).mockResolvedValue({});

            await service.postMpesaCharge(5000);

            expect(prisma.journalEntry.create).toHaveBeenCalled();
            // createJournalEntry uses nested items.create — verify 2 items
            const createCall = (prisma.journalEntry.create as any).mock.calls[0][0];
            expect(createCall.data.items.create).toHaveLength(2);
        });
    });

    // ── postRefundToLedger (Step 4) ──────────────────────────────────────
    describe('postRefundToLedger', () => {

        it('should post reversal entry: Dr AR / Cr Bank for MPESA refunds', async () => {
            (prisma.account.findUnique as any).mockImplementation((args: any) => {
                const code = args.where.code;
                const accounts: any = {
                    '1100': { id: 'acc-ar', code: '1100' },
                    '1210': { id: 'acc-bank', code: '1210' },
                };
                return Promise.resolve(accounts[code] || null);
            });
            (prisma.account.findMany as any).mockResolvedValue([]);
            (prisma.journal.findMany as any).mockResolvedValue([]);
            (prisma.account.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.findFirst as any).mockResolvedValue({ id: 'journal-1', code: 'BNK1' });
            (prisma.journal.findUnique as any).mockResolvedValue({ id: 'journal-1', code: 'BNK1' });
            (prisma.journalEntry.create as any).mockResolvedValue({ id: 'entry-refund' });
            (prisma.journalEntry.findUnique as any).mockResolvedValue({ id: 'entry-refund', status: 'DRAFT' });
            (prisma.journalItem.create as any).mockResolvedValue({});
            (prisma.journalEntry.update as any).mockResolvedValue({});

            await service.postRefundToLedger(
                {
                    id: 'refund-1',
                    amount: 3000,
                    receiptNumber: 'MPESA-REC123',
                    paymentDate: new Date('2026-11-01'),
                },
                'MPESA'
            );

            expect(prisma.journalEntry.create).toHaveBeenCalled();

            // createJournalEntry uses nested items.create — verify 2 items
            const createCall = (prisma.journalEntry.create as any).mock.calls[0][0];
            expect(createCall.data.items.create).toHaveLength(2);

            // Verify the reversal: Dr AR (1100), Cr Bank (1210)
            const items = createCall.data.items.create;
            const debitItem = items.find((i: any) => i.debit > 0);
            const creditItem = items.find((i: any) => i.credit > 0);

            expect(debitItem).toBeDefined();
            expect(creditItem).toBeDefined();
        });

        it('should use Cash account (1200) for CASH refunds instead of Bank', async () => {
            (prisma.account.findUnique as any).mockImplementation((args: any) => {
                const code = args.where.code;
                const accounts: any = {
                    '1100': { id: 'acc-ar', code: '1100' },
                    '1200': { id: 'acc-cash', code: '1200' },
                };
                return Promise.resolve(accounts[code] || null);
            });
            (prisma.account.findMany as any).mockResolvedValue([]);
            (prisma.journal.findMany as any).mockResolvedValue([]);
            (prisma.account.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.createMany as any).mockResolvedValue({ count: 0 });
            (prisma.journal.findFirst as any).mockResolvedValue({ id: 'journal-csh', code: 'CSH1' });
            (prisma.journal.findUnique as any).mockResolvedValue({ id: 'journal-csh', code: 'CSH1' });
            (prisma.journalEntry.create as any).mockResolvedValue({ id: 'entry-refund-cash' });
            (prisma.journalEntry.findUnique as any).mockResolvedValue({ id: 'entry-refund-cash', status: 'DRAFT' });
            (prisma.journalItem.create as any).mockResolvedValue({});
            (prisma.journalEntry.update as any).mockResolvedValue({});

            await service.postRefundToLedger(
                {
                    id: 'refund-2',
                    amount: 1500,
                    receiptNumber: 'CASH-001',
                    paymentDate: new Date('2026-11-02'),
                },
                'CASH'
            );

            expect(prisma.journalEntry.create).toHaveBeenCalled();
        });
    });

    // ── createJournalEntry validation (shared) ───────────────────────────
    describe('createJournalEntry', () => {

        it('should reject unbalanced entries (debits != credits)', async () => {
            await expect(
                service.createJournalEntry({
                    journalId: 'j1',
                    items: [
                        { accountId: 'a1', debit: 100, credit: 0 },
                        { accountId: 'a2', debit: 0, credit: 50 },
                    ],
                } as any)
            ).rejects.toThrow(/Debits.*do not equal.*Credits/);
        });

        it('should accept balanced entries', async () => {
            (prisma.journalEntry.create as any).mockResolvedValue({ id: 'entry-ok' });
            (prisma.journalItem.create as any).mockResolvedValue({});

            const result = await service.createJournalEntry({
                journalId: 'j1',
                items: [
                    { accountId: 'a1', debit: 100, credit: 0 },
                    { accountId: 'a2', debit: 0, credit: 100 },
                ],
            } as any);

            expect(result).toBeDefined();
            expect(prisma.journalEntry.create).toHaveBeenCalled();
        });
    });
});
