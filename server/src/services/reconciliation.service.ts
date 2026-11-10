import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Bank Reconciliation Service — M-Pesa Statement Import + Matching
 *
 * Flow:
 *  1. Finance staff upload an M-Pesa statement CSV (exported from the M-Pesa
 *     portal or Daraja portal).
 *  2. Each statement row is parsed into a MpesaStatementRow record.
 *  3. Auto-matching: each row is matched against existing MpesaTransaction
 *     records (by receipt number / transaction ID) and FeePayment records
 *     (by receiptNumber / referenceNumber).
 *  4. Matched rows are marked RECONCILED; unmatched rows are UNRECONCILED.
 *  5. Finance staff can manually match unmatched rows.
 *
 * Matching keys:
 *  - M-Pesa receipt number (e.g. "ABC123XYZ") is the primary matching key.
 *  - The FeePayment.referenceNumber stores the raw M-Pesa receipt.
 *  - The FeePayment.receiptNumber is prefixed: "MPESA-{receipt}".
 *  - The MpesaTransaction.transactionId stores the raw M-Pesa receipt.
 */
class ReconciliationService {

    /**
     * Import an M-Pesa statement from parsed CSV rows.
     *
     * Expected CSV columns (case-insensitive):
     *  - Receipt No / ReceiptNo / receipt_number
     *  - Completion Time / Time / transactionDate
     *  - Paid In / Credit / amount
     *  - Paid Out / Debit / paidOut (for B2C payouts)
     *  - Other Party Info / Details / description
     *  - Transaction Id / transactionId (optional, may be same as receipt)
     *  - Balance (optional, running balance from statement)
     *
     * Returns the import summary + auto-match results.
     */
    async importStatement(params: {
        rows: MpesaStatementRowInput[];
        importedById: string;
        statementDate?: string;
        startingBalance?: number;
        endingBalance?: number;
    }): Promise<ImportResult> {
        const { rows, importedById, statementDate, startingBalance, endingBalance } = params;

        if (!rows || rows.length === 0) {
            throw new Error('No rows to import — the statement appears to be empty');
        }

        logger.info(`[Reconciliation] Importing ${rows.length} M-Pesa statement rows`);

        // Create a BankStatement record to group this import
        const statement = await prisma.bankStatement.create({
            data: {
                accountId: await this.getMpesaBankAccountId(),
                dateRange: statementDate || new Date().toISOString().slice(0, 10),
                startingBalance: startingBalance || 0,
                endingBalance: endingBalance || 0,
                status: 'IMPORTED',
            },
        });

        const results: ImportResult = {
            statementId: statement.id,
            totalRows: rows.length,
            autoMatched: 0,
            unmatched: 0,
            duplicates: 0,
            details: [],
        };

        for (const row of rows) {
            const detail = await this.processRow(row, statement.id, importedById);

            if (detail.status === 'DUPLICATE') {
                results.duplicates++;
            } else if (detail.status === 'RECONCILED') {
                results.autoMatched++;
            } else {
                results.unmatched++;
            }

            results.details.push(detail);
        }

        logger.info(
            `[Reconciliation] Import complete: ${results.autoMatched} matched, ` +
            `${results.unmatched} unmatched, ${results.duplicates} duplicates`
        );

        return results;
    }

    /**
     * Process a single statement row — attempt auto-match against
     * MpesaTransaction and FeePayment records.
     */
    private async processRow(
        row: MpesaStatementRowInput,
        statementId: string,
        importedById: string,
    ): Promise<RowDetail> {
        const receiptNo = row.receiptNo?.trim().toUpperCase();
        const amount = Number(row.amount) || 0;
        const isPayout = row.paidOut && Number(row.paidOut) > 0;
        const transactionAmount = isPayout ? Number(row.paidOut) : amount;

        // Check for duplicate import (same receipt + statement already imported)
        if (receiptNo) {
            const existing = await prisma.bankStatementLine.findFirst({
                where: {
                    reference: receiptNo,
                    description: { contains: row.description || '' },
                },
            });

            if (existing) {
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'DUPLICATE',
                    matchType: null,
                    matchedTo: null,
                    message: 'This receipt was already imported in a previous statement',
                };
            }
        }

        // Create the statement line
        const line = await prisma.bankStatementLine.create({
            data: {
                statementId,
                date: row.date ? new Date(row.date) : new Date(),
                description: row.description || '',
                amount: transactionAmount,
                reference: receiptNo || null,
                status: 'UNRECONCILED',
            },
        });

        // ── Auto-match attempt ────────────────────────────────────────────
        if (!receiptNo) {
            // No receipt number — can't auto-match
            return {
                receiptNo: null,
                amount: transactionAmount,
                date: row.date,
                status: 'UNRECONCILED',
                matchType: null,
                matchedTo: null,
                statementLineId: line.id,
                message: 'No receipt number in statement row — manual match required',
            };
        }

        // Try matching against MpesaTransaction
        const mpesaTx = await prisma.mpesaTransaction.findFirst({
            where: {
                OR: [
                    { transactionId: receiptNo },
                    { externalId: receiptNo },
                ],
            },
        });

        if (mpesaTx) {
            const matchAmount = Number(mpesaTx.amount);
            if (Math.abs(matchAmount - transactionAmount) < 0.01) {
                await prisma.bankStatementLine.update({
                    where: { id: line.id },
                    data: { status: 'RECONCILED' },
                });

                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'RECONCILED',
                    matchType: 'MPESA_TRANSACTION',
                    matchedTo: mpesaTx.id,
                    statementLineId: line.id,
                    message: `Matched to M-Pesa transaction (${mpesaTx.type}, ${mpesaTx.status})`,
                };
            } else {
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'UNRECONCILED',
                    matchType: null,
                    matchedTo: null,
                    statementLineId: line.id,
                    message: `Amount mismatch: statement ${transactionAmount} vs DB ${matchAmount}`,
                };
            }
        }

        // Try matching against FeePayment (referenceNumber = raw receipt)
        const feePayment = await prisma.feePayment.findFirst({
            where: {
                OR: [
                    { referenceNumber: receiptNo },
                    { receiptNumber: `MPESA-${receiptNo}` },
                    { receiptNumber: receiptNo },
                ],
            },
        });

        if (feePayment) {
            const payAmount = Number(feePayment.amount);
            if (Math.abs(payAmount - transactionAmount) < 0.01) {
                await prisma.bankStatementLine.update({
                    where: { id: line.id },
                    data: { status: 'RECONCILED' },
                });

                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'RECONCILED',
                    matchType: 'FEE_PAYMENT',
                    matchedTo: feePayment.id,
                    statementLineId: line.id,
                    message: `Matched to fee payment (receipt ${feePayment.receiptNumber})`,
                };
            } else {
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'UNRECONCILED',
                    matchType: null,
                    matchedTo: null,
                    statementLineId: line.id,
                    message: `Amount mismatch: statement ${transactionAmount} vs payment ${payAmount}`,
                };
            }
        }

        // Try matching against UnmatchedPayment (organic paybill payments)
        const unmatchedPay = await prisma.unmatchedPayment.findFirst({
            where: { receiptNo },
        });

        if (unmatchedPay) {
            const unmatchedAmount = Number(unmatchedPay.amount);
            if (Math.abs(unmatchedAmount - transactionAmount) < 0.01) {
                await prisma.bankStatementLine.update({
                    where: { id: line.id },
                    data: { status: 'RECONCILED' },
                });

                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: row.date,
                    status: 'RECONCILED',
                    matchType: 'UNMATCHED_PAYMENT',
                    matchedTo: unmatchedPay.id,
                    statementLineId: line.id,
                    message: `Matched to unmatched payment (status: ${unmatchedPay.status})`,
                };
            }
        }

        return {
            receiptNo,
            amount: transactionAmount,
            date: row.date,
            status: 'UNRECONCILED',
            matchType: null,
            matchedTo: null,
            statementLineId: line.id,
            message: 'No matching record found — manual reconciliation required',
        };
    }

    /**
     * Get the M-Pesa bank account ID from the ledger.
     * Falls back to creating one if it doesn't exist.
     */
    private async getMpesaBankAccountId(): Promise<string> {
        // Account 1210 = Bank (M-Pesa Trust Account)
        const account = await prisma.account.findFirst({
            where: { code: '1210' },
        });

        if (account) return account.id;

        // If no account 1210, fall back to any CASH/BANK account
        const fallback = await prisma.account.findFirst({
            where: {
                OR: [
                    { code: '1200' },
                    { name: { contains: 'M-Pesa', mode: 'insensitive' } },
                    { name: { contains: 'Bank', mode: 'insensitive' } },
                ],
            },
        });

        if (fallback) return fallback.id;

        // Last resort: create a basic account
        const created = await prisma.account.create({
            data: {
                code: '1210',
                name: 'M-Pesa Trust Account',
                type: 'ASSET_CASH',
            },
        });

        logger.info(`[Reconciliation] Created fallback M-Pesa bank account (id: ${created.id})`);
        return created.id;
    }

    /**
     * List imported statements with their reconciliation summary.
     */
    async listStatements(page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [statements, total] = await Promise.all([
            prisma.bankStatement.findMany({
                include: {
                    _count: {
                        select: {
                            lines: {
                                where: { status: 'UNRECONCILED' },
                            },
                        },
                    },
                    lines: {
                        select: {
                            id: true,
                            status: true,
                            amount: true,
                        },
                        take: 1, // just to get count via aggregate
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.bankStatement.count(),
        ]);

        // Compute summary stats per statement
        const data = await Promise.all(
            statements.map(async (s) => {
                const lineStats = await prisma.bankStatementLine.groupBy({
                    by: ['status'],
                    where: { statementId: s.id },
                    _count: true,
                    _sum: { amount: true },
                });

                const totalLines = lineStats.reduce((sum, l) => sum + l._count, 0);
                const reconciled = lineStats.find(l => l.status === 'RECONCILED')?._count || 0;
                const unreconciled = lineStats.find(l => l.status === 'UNRECONCILED')?._count || 0;
                const reconciledAmount = lineStats.find(l => l.status === 'RECONCILED')?._sum.amount || 0;
                const unreconciledAmount = lineStats.find(l => l.status === 'UNRECONCILED')?._sum.amount || 0;

                return {
                    id: s.id,
                    dateRange: s.dateRange,
                    startingBalance: Number(s.startingBalance),
                    endingBalance: Number(s.endingBalance),
                    status: s.status,
                    createdAt: s.createdAt,
                    totalLines,
                    reconciled,
                    unreconciled,
                    reconciledAmount: Number(reconciledAmount),
                    unreconciledAmount: Number(unreconciledAmount),
                };
            })
        );

        return { data, total, page, pages: Math.ceil(total / limit) };
    }

    /**
     * Get a single statement with its lines (paginated, with filter).
     */
    async getStatementDetail(statementId: string, filter?: {
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, page = 1, limit = 50 } = filter || {};
        const skip = (page - 1) * limit;

        const where: any = { statementId };
        if (status) where.status = status;

        const statement = await prisma.bankStatement.findUnique({
            where: { id: statementId },
        });

        if (!statement) throw new Error('Statement not found');

        const [lines, total] = await Promise.all([
            prisma.bankStatementLine.findMany({
                where,
                orderBy: { date: 'asc' },
                skip,
                take: limit,
            }),
            prisma.bankStatementLine.count({ where }),
        ]);

        return {
            statement: {
                ...statement,
                startingBalance: Number(statement.startingBalance),
                endingBalance: Number(statement.endingBalance),
            },
            lines: lines.map(l => ({
                ...l,
                amount: Number(l.amount),
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }

    /**
     * Manually reconcile a statement line to a specific record.
     *
     * matchType: 'MPESA_TRANSACTION' | 'FEE_PAYMENT' | 'UNMATCHED_PAYMENT' | 'MANUAL'
     */
    async manualReconcile(params: {
        statementLineId: string;
        matchType: 'MPESA_TRANSACTION' | 'FEE_PAYMENT' | 'UNMATCHED_PAYMENT' | 'MANUAL';
        matchedId?: string;
        note?: string;
        reconciledBy: string;
    }): Promise<{ success: boolean; message: string }> {
        const { statementLineId, matchType, matchedId, note, reconciledBy } = params;

        const line = await prisma.bankStatementLine.findUnique({
            where: { id: statementLineId },
        });

        if (!line) throw new Error('Statement line not found');

        if (line.status === 'RECONCILED') {
            throw new Error('This line is already reconciled');
        }

        // Verify the matched record exists (for non-MANUAL types)
        if (matchType !== 'MANUAL' && matchedId) {
            let exists = false;
            if (matchType === 'MPESA_TRANSACTION') {
                exists = !!(await prisma.mpesaTransaction.findUnique({ where: { id: matchedId } }));
            } else if (matchType === 'FEE_PAYMENT') {
                exists = !!(await prisma.feePayment.findUnique({ where: { id: matchedId } }));
            } else if (matchType === 'UNMATCHED_PAYMENT') {
                exists = !!(await prisma.unmatchedPayment.findUnique({ where: { id: matchedId } }));
            }

            if (!exists) {
                throw new Error(`Referenced ${matchType} record not found (ID: ${matchedId})`);
            }
        }

        await prisma.bankStatementLine.update({
            where: { id: statementLineId },
            data: {
                status: 'RECONCILED',
                description: note
                    ? `${line.description} | Reconciled: ${note}`
                    : `${line.description} | Manually reconciled by ${reconciledBy}`,
            },
        });

        logger.info(
            `[Reconciliation] Line ${statementLineId} manually reconciled ` +
            `to ${matchType}${matchedId ? ` (${matchedId})` : ''} by ${reconciledBy}`
        );

        return { success: true, message: 'Statement line reconciled' };
    }

    /**
     * Undo a reconciliation (un-reconcile a line).
     */
    async unreconcile(statementLineId: string, userId: string): Promise<{ success: boolean }> {
        const line = await prisma.bankStatementLine.findUnique({
            where: { id: statementLineId },
        });

        if (!line) throw new Error('Statement line not found');
        if (line.status !== 'RECONCILED') {
            throw new Error('This line is not reconciled — nothing to undo');
        }

        await prisma.bankStatementLine.update({
            where: { id: statementLineId },
            data: { status: 'UNRECONCILED' },
        });

        logger.info(`[Reconciliation] Line ${statementLineId} un-reconciled by ${userId}`);
        return { success: true };
    }

    /**
     * Get reconciliation dashboard summary.
     */
    async getDashboard() {
        const [totalStatements, totalLines, reconciledLines, unreconciledLines, unreconciledAmount] =
            await Promise.all([
                prisma.bankStatement.count(),
                prisma.bankStatementLine.count(),
                prisma.bankStatementLine.count({ where: { status: 'RECONCILED' } }),
                prisma.bankStatementLine.count({ where: { status: 'UNRECONCILED' } }),
                prisma.bankStatementLine.aggregate({
                    where: { status: 'UNRECONCILED' },
                    _sum: { amount: true },
                }),
            ]);

        // Recent unreconciled items (top 10)
        const recentUnreconciled = await prisma.bankStatementLine.findMany({
            where: { status: 'UNRECONCILED' },
            include: { statement: { select: { dateRange: true, createdAt: true } } },
            orderBy: { date: 'desc' },
            take: 10,
        });

        return {
            totalStatements,
            totalLines,
            reconciledLines,
            unreconciledLines,
            unreconciledAmount: Number(unreconciledAmount._sum.amount) || 0,
            reconciliationRate: totalLines > 0
                ? Math.round((reconciledLines / totalLines) * 100)
                : 0,
            recentUnreconciled: recentUnreconciled.map(l => ({
                ...l,
                amount: Number(l.amount),
            })),
        };
    }

    /**
     * Suggest potential matches for an unreconciled statement line.
     * Searches by amount proximity and date proximity.
     */
    async suggestMatches(statementLineId: string) {
        const line = await prisma.bankStatementLine.findUnique({
            where: { id: statementLineId },
        });

        if (!line) throw new Error('Statement line not found');

        const amount = Math.abs(Number(line.amount));
        const lineDate = new Date(line.date);
        const startDate = new Date(lineDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(lineDate);
        endDate.setDate(endDate.getDate() + 3);

        const suggestions: any[] = [];

        // Search MpesaTransaction by amount + date
        const mpesaTxs = await prisma.mpesaTransaction.findMany({
            where: {
                amount: { gte: amount - 1, lte: amount + 1 },
                createdAt: { gte: startDate, lte: endDate },
            },
            take: 5,
        });

        for (const tx of mpesaTxs) {
            suggestions.push({
                matchType: 'MPESA_TRANSACTION',
                matchedId: tx.id,
                receiptNo: tx.transactionId,
                amount: Number(tx.amount),
                date: tx.createdAt,
                description: `M-Pesa ${tx.type} — ${tx.status}`,
                confidence: this.calculateConfidence(amount, Number(tx.amount), lineDate, tx.createdAt),
            });
        }

        // Search FeePayment by amount + date
        const payments = await prisma.feePayment.findMany({
            where: {
                amount: { gte: amount - 1, lte: amount + 1 },
                paymentDate: { gte: startDate, lte: endDate },
                archived: false,
            },
            include: {
                invoice: { select: { invoiceNumber: true, learner: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
            },
            take: 5,
        });

        for (const p of payments) {
            suggestions.push({
                matchType: 'FEE_PAYMENT',
                matchedId: p.id,
                receiptNo: p.referenceNumber || p.receiptNumber,
                amount: Number(p.amount),
                date: p.paymentDate,
                description: `Fee payment — ${p.invoice?.learner?.firstName} ${p.invoice?.learner?.lastName} (${p.invoice?.invoiceNumber})`,
                confidence: this.calculateConfidence(amount, Number(p.amount), lineDate, p.paymentDate),
            });
        }

        // Sort by confidence descending
        suggestions.sort((a, b) => b.confidence - a.confidence);

        return { line: { ...line, amount: Number(line.amount) }, suggestions };
    }

    private calculateConfidence(amount1: number, amount2: number, date1: Date, date2: Date): number {
        const amountDiff = Math.abs(amount1 - amount2);
        const dateDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24); // days

        let score = 100;
        score -= amountDiff * 10; // -10 per unit difference
        score -= dateDiff * 5; // -5 per day difference
        return Math.max(0, Math.min(100, Math.round(score)));
    }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MpesaStatementRowInput {
    receiptNo?: string;
    date?: string;
    amount?: number;
    paidOut?: number;
    description?: string;
    balance?: number;
}

export interface RowDetail {
    receiptNo: string | null;
    amount: number;
    date?: string;
    status: 'RECONCILED' | 'UNRECONCILED' | 'DUPLICATE';
    matchType: 'MPESA_TRANSACTION' | 'FEE_PAYMENT' | 'UNMATCHED_PAYMENT' | null;
    matchedTo: string | null;
    statementLineId?: string;
    message: string;
}

export interface ImportResult {
    statementId: string;
    totalRows: number;
    autoMatched: number;
    unmatched: number;
    duplicates: number;
    details: RowDetail[];
}

export const reconciliationService = new ReconciliationService();
