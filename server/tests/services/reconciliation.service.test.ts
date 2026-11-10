import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    bankStatement: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
    },
    bankStatementLine: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
    },
    mpesaTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    feePayment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    unmatchedPayment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    account: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
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

import { reconciliationService } from '../../src/services/reconciliation.service';

describe('ReconciliationService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── importStatement ──────────────────────────────────────────────────
    describe('importStatement', () => {

        beforeEach(() => {
            (mockPrisma.account.findFirst as any).mockResolvedValue({ id: 'acc-1', code: '1210' });
            (mockPrisma.bankStatement.create as any).mockResolvedValue({ id: 'stmt-1' });
            (mockPrisma.bankStatementLine.findFirst as any).mockResolvedValue(null); // no duplicates
            (mockPrisma.bankStatementLine.create as any).mockResolvedValue({ id: 'line-1' });
        });

        it('should reject empty rows', async () => {
            await expect(
                reconciliationService.importStatement({
                    rows: [],
                    importedById: 'user-1',
                })
            ).rejects.toThrow(/empty/);
        });

        it('should auto-match a row to an existing MpesaTransaction by receipt number', async () => {
            (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue({
                id: 'mpesa-tx-1',
                transactionId: 'ABC123',
                amount: 5000,
                type: 'COLLECTION',
                status: 'SUCCESS',
            });
            (mockPrisma.bankStatementLine.update as any).mockResolvedValue({});

            const result = await reconciliationService.importStatement({
                rows: [{
                    receiptNo: 'ABC123',
                    date: '2026-11-01T10:00:00',
                    amount: 5000,
                    description: 'Payment from 254712345678',
                }],
                importedById: 'user-1',
            });

            expect(result.totalRows).toBe(1);
            expect(result.autoMatched).toBe(1);
            expect(result.unmatched).toBe(0);
            expect(result.details[0].status).toBe('RECONCILED');
            expect(result.details[0].matchType).toBe('MPESA_TRANSACTION');
        });

        it('should auto-match a row to an existing FeePayment by referenceNumber', async () => {
            (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue(null);
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue({
                id: 'pay-1',
                receiptNumber: 'MPESA-DEF456',
                amount: 3000,
            });
            (mockPrisma.bankStatementLine.update as any).mockResolvedValue({});

            const result = await reconciliationService.importStatement({
                rows: [{
                    receiptNo: 'DEF456',
                    date: '2026-11-02T14:00:00',
                    amount: 3000,
                    description: 'Fee payment',
                }],
                importedById: 'user-1',
            });

            expect(result.autoMatched).toBe(1);
            expect(result.details[0].matchType).toBe('FEE_PAYMENT');
        });

        it('should mark as UNRECONCILED when no matching record is found', async () => {
            (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue(null);
            (mockPrisma.feePayment.findFirst as any).mockResolvedValue(null);
            (mockPrisma.unmatchedPayment.findFirst as any).mockResolvedValue(null);

            const result = await reconciliationService.importStatement({
                rows: [{
                    receiptNo: 'XYZ999',
                    date: '2026-11-03T09:00:00',
                    amount: 1500,
                    description: 'Unknown payment',
                }],
                importedById: 'user-1',
            });

            expect(result.unmatched).toBe(1);
            expect(result.details[0].status).toBe('UNRECONCILED');
            expect(result.details[0].message).toContain('manual reconciliation required');
        });

        it('should detect duplicate imports (same receipt already exists)', async () => {
            (mockPrisma.bankStatementLine.findFirst as any).mockResolvedValue({
                id: 'existing-line',
                reference: 'DUP001',
            });

            const result = await reconciliationService.importStatement({
                rows: [{
                    receiptNo: 'DUP001',
                    date: '2026-11-01',
                    amount: 1000,
                    description: 'Duplicate',
                }],
                importedById: 'user-1',
            });

            expect(result.duplicates).toBe(1);
            expect(result.details[0].status).toBe('DUPLICATE');
        });

        it('should flag amount mismatch as UNRECONCILED', async () => {
            (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue({
                id: 'tx-1',
                transactionId: 'MISMATCH',
                amount: 5000,
                type: 'COLLECTION',
                status: 'SUCCESS',
            });

            const result = await reconciliationService.importStatement({
                rows: [{
                    receiptNo: 'MISMATCH',
                    date: '2026-11-01',
                    amount: 3000, // different amount
                    description: 'Amount mismatch test',
                }],
                importedById: 'user-1',
            });

            expect(result.unmatched).toBe(1);
            expect(result.details[0].status).toBe('UNRECONCILED');
            expect(result.details[0].message).toContain('Amount mismatch');
        });
    });

    // ── manualReconcile ──────────────────────────────────────────────────
    describe('manualReconcile', () => {

        it('should reject if line is already reconciled', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                status: 'RECONCILED',
            });

            await expect(
                reconciliationService.manualReconcile({
                    statementLineId: 'line-1',
                    matchType: 'MANUAL',
                    reconciledBy: 'user-1',
                })
            ).rejects.toThrow(/already reconciled/);
        });

        it('should reject if line does not exist', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue(null);

            await expect(
                reconciliationService.manualReconcile({
                    statementLineId: 'nonexistent',
                    matchType: 'MANUAL',
                    reconciledBy: 'user-1',
                })
            ).rejects.toThrow('Statement line not found');
        });

        it('should verify FEE_PAYMENT match exists before reconciling', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                status: 'UNRECONCILED',
                description: 'Test',
            });
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue(null); // not found

            await expect(
                reconciliationService.manualReconcile({
                    statementLineId: 'line-1',
                    matchType: 'FEE_PAYMENT',
                    matchedId: 'pay-missing',
                    reconciledBy: 'user-1',
                })
            ).rejects.toThrow(/not found/);
        });

        it('should reconcile line to MANUAL type without requiring a matchedId', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                status: 'UNRECONCILED',
                description: 'Manual entry',
            });
            (mockPrisma.bankStatementLine.update as any).mockResolvedValue({});

            const result = await reconciliationService.manualReconcile({
                statementLineId: 'line-1',
                matchType: 'MANUAL',
                note: 'Cash deposit verified at bank',
                reconciledBy: 'user-1',
            });

            expect(result.success).toBe(true);
            expect(mockPrisma.bankStatementLine.update).toHaveBeenCalled();
        });
    });

    // ── unreconcile ──────────────────────────────────────────────────────
    describe('unreconcile', () => {

        it('should revert a RECONCILED line to UNRECONCILED', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                status: 'RECONCILED',
            });
            (mockPrisma.bankStatementLine.update as any).mockResolvedValue({});

            const result = await reconciliationService.unreconcile('line-1', 'user-1');
            expect(result.success).toBe(true);

            const call = (mockPrisma.bankStatementLine.update as any).mock.calls[0][0];
            expect(call.data.status).toBe('UNRECONCILED');
        });

        it('should reject if line is not reconciled', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                status: 'UNRECONCILED',
            });

            await expect(
                reconciliationService.unreconcile('line-1', 'user-1')
            ).rejects.toThrow(/not reconciled/);
        });
    });

    // ── getDashboard ─────────────────────────────────────────────────────
    describe('getDashboard', () => {

        it('should return reconciliation summary stats', async () => {
            (mockPrisma.bankStatement.count as any).mockResolvedValue(5);
            (mockPrisma.bankStatementLine.count as any)
                .mockResolvedValueOnce(100)  // totalLines
                .mockResolvedValueOnce(80)   // reconciledLines
                .mockResolvedValueOnce(20);  // unreconciledLines
            (mockPrisma.bankStatementLine.aggregate as any).mockResolvedValue({
                _sum: { amount: 75000 },
            });
            (mockPrisma.bankStatementLine.findMany as any).mockResolvedValue([]);

            const result = await reconciliationService.getDashboard();

            expect(result.totalStatements).toBe(5);
            expect(result.totalLines).toBe(100);
            expect(result.reconciledLines).toBe(80);
            expect(result.unreconciledLines).toBe(20);
            expect(result.reconciliationRate).toBe(80);
            expect(result.unreconciledAmount).toBe(75000);
        });

        it('should handle zero lines (division by zero guard)', async () => {
            (mockPrisma.bankStatement.count as any).mockResolvedValue(0);
            (mockPrisma.bankStatementLine.count as any).mockResolvedValue(0);
            (mockPrisma.bankStatementLine.aggregate as any).mockResolvedValue({
                _sum: { amount: null },
            });
            (mockPrisma.bankStatementLine.findMany as any).mockResolvedValue([]);

            const result = await reconciliationService.getDashboard();

            expect(result.reconciliationRate).toBe(0);
            expect(result.unreconciledAmount).toBe(0);
        });
    });

    // ── suggestMatches ───────────────────────────────────────────────────
    describe('suggestMatches', () => {

        it('should return sorted suggestions by confidence', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue({
                id: 'line-1',
                amount: 5000,
                date: new Date('2026-11-01'),
            });
            (mockPrisma.mpesaTransaction.findMany as any).mockResolvedValue([
                { id: 'tx-1', transactionId: 'REC1', amount: 5000, createdAt: new Date('2026-11-01'), type: 'COLLECTION', status: 'SUCCESS' },
                { id: 'tx-2', transactionId: 'REC2', amount: 5000, createdAt: new Date('2026-11-03'), type: 'COLLECTION', status: 'SUCCESS' },
            ]);
            (mockPrisma.feePayment.findMany as any).mockResolvedValue([]);

            const result = await reconciliationService.suggestMatches('line-1');

            expect(result.suggestions).toHaveLength(2);
            // The first suggestion (same date) should have higher confidence
            expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(result.suggestions[1].confidence);
        });

        it('should reject if line does not exist', async () => {
            (mockPrisma.bankStatementLine.findUnique as any).mockResolvedValue(null);

            await expect(
                reconciliationService.suggestMatches('nonexistent')
            ).rejects.toThrow('Statement line not found');
        });
    });
});
