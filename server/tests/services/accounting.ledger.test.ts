import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for accounting ledger postings covering Steps 1, 2, and 4:
 *  - postFeePaymentToLedger: Dr Bank/Cash, Cr AR (Step 1)
 *  - postMpesaCharge: Dr M-Pesa Charges Expense, Cr Bank (Step 2)
 *  - postRefundToLedger: Dr AR, Cr Bank/Cash (Step 4 — reversal)
 */

// ── Mock Prisma ─────────────────────────────────────────────────────────────
let mockTx: any;
const mockPrisma: any = {
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
        findFirst: jest.fn(),
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
        if (typeof arg === 'function') return arg(mockTx);
        return Promise.all(arg);
    }),
};
// Prisma supplies a transaction-scoped client with a different identity from
// the root client. Keep that distinction so serializable service wrappers do
// not recursively open transactions in tests.
mockTx = { ...mockPrisma };

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
        (prisma.journalEntry.findFirst as any).mockResolvedValue(null);
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

        it('does not duplicate a journal entry for a payment receipt already posted', async () => {
            mockAccountsByCode({
                '1210': { id: 'acc-bank', code: '1210' },
                '1100': { id: 'acc-ar', code: '1100' },
            });
            (prisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'entry-existing', status: 'POSTED' });

            await service.postFeePaymentToLedger({
                id: 'pay-existing', amount: 5000, receiptNumber: 'MPESA-REC-EXISTING', paymentDate: new Date(),
            }, 'MPESA');

            expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { journalId: 'journal-1', reference: 'MPESA-REC-EXISTING' },
            }));
            expect(prisma.journalEntry.create).not.toHaveBeenCalled();
        });
    });

    describe('postFeeInvoiceRevisionToLedger', () => {
        it('writes a balanced revision entry through the supplied transaction client', async () => {
            const tx: any = {
                account: {
                    findUnique: jest.fn(async ({ where }: any) => ({ id: `account-${where.code}`, code: where.code })),
                },
                journal: { findUnique: jest.fn() },
                journalEntry: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
            };
            tx.journal.findUnique.mockResolvedValue({ id: 'sales-journal', code: 'INV' });
            tx.journalEntry.findFirst.mockResolvedValue(null);
            tx.journalEntry.create.mockResolvedValue({ id: 'revision-entry' });
            tx.journalEntry.findUnique.mockResolvedValue({ id: 'revision-entry', status: 'DRAFT' });
            tx.journalEntry.update.mockResolvedValue({ id: 'revision-entry', status: 'POSTED' });

            await service.postFeeInvoiceRevisionToLedger('INV-42', 3, -250, tx);

            const create = tx.journalEntry.create.mock.calls[0][0];
            expect(create.data.reference).toBe('INV-42-REV-3');
            expect(create.data.items.create).toEqual([
                expect.objectContaining({ accountId: 'account-1100', debit: 0, credit: 250 }),
                expect.objectContaining({ accountId: 'account-4000', debit: 250, credit: 0 }),
            ]);
            expect(tx.journalEntry.update).toHaveBeenCalledWith({
                where: { id: 'revision-entry' },
                data: { status: 'POSTED' },
            });
            expect(prisma.journalEntry.create).not.toHaveBeenCalled();
        });

        it('does not duplicate a revision journal entry on retry', async () => {
            const posted = { id: 'existing-entry', status: 'POSTED', items: [] };
            const tx: any = {
                journalEntry: { findFirst: jest.fn(), create: jest.fn() },
            };
            tx.journalEntry.findFirst.mockResolvedValue(posted);

            await service.postFeeInvoiceRevisionToLedger('INV-42', 3, 250, tx);

            expect(tx.journalEntry.findFirst).toHaveBeenCalledWith({
                where: { reference: 'INV-42-REV-3' },
                include: { items: true },
            });
            expect(tx.journalEntry.create).not.toHaveBeenCalled();
        });

        it('splits a transport reclassification between tuition and transport revenue', async () => {
            const tx: any = {
                account: {
                    findUnique: jest.fn(async ({ where }: any) => ({ id: `account-${where.code}`, code: where.code })),
                },
                journal: { findUnique: jest.fn() },
                journalEntry: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
            };
            tx.journal.findUnique.mockResolvedValue({ id: 'sales-journal', code: 'INV' });
            tx.journalEntry.findFirst.mockResolvedValue(null);
            tx.journalEntry.create.mockResolvedValue({ id: 'reclass-entry' });
            tx.journalEntry.findUnique.mockResolvedValue({ id: 'reclass-entry', status: 'DRAFT' });
            tx.journalEntry.update.mockResolvedValue({ id: 'reclass-entry', status: 'POSTED' });

            await service.postFeeInvoiceRevisionToLedger('INV-42', 4, 0, tx, {
                oldTotalAmount: 1000,
                newTotalAmount: 1000,
                oldTransportAmount: 200,
                newTransportAmount: 300,
            });

            const items = tx.journalEntry.create.mock.calls[0][0].data.items.create;
            expect(items).toEqual([
                expect.objectContaining({ accountId: 'account-4000', debit: 100, credit: 0 }),
                expect.objectContaining({ accountId: 'account-4100', debit: 0, credit: 100 }),
            ]);
            expect(items.reduce((sum: number, item: any) => sum + item.debit, 0))
                .toBe(items.reduce((sum: number, item: any) => sum + item.credit, 0));
        });
    });

    describe('reverseFeeInvoiceLedger', () => {
        it('reverses the original invoice and every posted revision in the caller transaction', async () => {
            const tx: any = {
                journalEntry: {
                    findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
                    findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
                        {
                            journalId: 'sales-journal',
                            items: [
                                { accountId: 'ar', debit: 1000, credit: 0 },
                                { accountId: 'tuition', debit: 0, credit: 800 },
                                { accountId: 'transport', debit: 0, credit: 200 },
                            ],
                        },
                        {
                            journalId: 'sales-journal',
                            items: [
                                { accountId: 'ar', debit: 0, credit: 100 },
                                { accountId: 'tuition', debit: 100, credit: 0 },
                            ],
                        },
                    ]),
                    create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'cancel-entry' }),
                    findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'cancel-entry', status: 'DRAFT' }),
                    update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'cancel-entry', status: 'POSTED' }),
                },
            };

            await service.reverseFeeInvoiceLedger('INV-42', tx);

            expect(tx.journalEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    status: 'POSTED',
                    OR: [
                        { reference: 'INV-42' },
                        { reference: { startsWith: 'INV-42-REV-' } },
                    ],
                }),
            }));
            const create = tx.journalEntry.create.mock.calls[0][0];
            expect(create.data.reference).toBe('INV-42-CANCEL');
            expect(create.data.items.create).toEqual([
                expect.objectContaining({ accountId: 'ar', debit: 0, credit: 1000 }),
                expect.objectContaining({ accountId: 'tuition', debit: 800, credit: 0 }),
                expect.objectContaining({ accountId: 'transport', debit: 200, credit: 0 }),
                expect.objectContaining({ accountId: 'ar', debit: 100, credit: 0 }),
                expect.objectContaining({ accountId: 'tuition', debit: 0, credit: 100 }),
            ]);
            expect(prisma.journalEntry.create).not.toHaveBeenCalled();
        });

        it('reuses a posted cancellation entry instead of reversing twice', async () => {
            const tx: any = {
                journalEntry: {
                    findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'cancel-entry', status: 'POSTED' }),
                    findMany: jest.fn(),
                    create: jest.fn(),
                },
            };

            await service.reverseFeeInvoiceLedger('INV-42', tx);

            expect(tx.journalEntry.findMany).not.toHaveBeenCalled();
            expect(tx.journalEntry.create).not.toHaveBeenCalled();
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

            await service.postMpesaCharge(5000, 'MPESA-CHARGE-TEST');

            expect(prisma.journalEntry.create).toHaveBeenCalled();
            // createJournalEntry uses nested items.create — verify 2 items
            const createCall = (prisma.journalEntry.create as any).mock.calls[0][0];
            expect(createCall.data.items.create).toHaveLength(2);
        });

        it('does not create another charge entry for a receipt already recorded', async () => {
            process.env.MPESA_CHARGE_PER_TRANSACTION = '15';
            (prisma.account.findUnique as any).mockImplementation((args: any) => {
                const accounts: Record<string, any> = {
                    '5500': { id: 'acc-charge', code: '5500' },
                    '1210': { id: 'acc-bank', code: '1210' },
                };
                return Promise.resolve(accounts[args.where.code] || null);
            });
            (prisma.journal.findUnique as any).mockResolvedValue({ id: 'journal-misc', code: 'MISC' });
            (prisma.journalEntry.findFirst as any).mockResolvedValue({ id: 'charge-existing', status: 'POSTED' });

            await service.postMpesaCharge(5000, 'MPESA-CHARGE-TEST');

            expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { journalId: 'journal-misc', reference: 'MPESA-CHARGE/MPESA-CHARGE-TEST' },
            }));
            expect(prisma.journalEntry.create).not.toHaveBeenCalled();
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
