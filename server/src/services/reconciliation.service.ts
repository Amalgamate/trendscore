import prisma from '../config/database';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

export class ReconciliationInputError extends Error {
    statusCode = 400;
}

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
            throw new ReconciliationInputError('No rows to import — the statement appears to be empty');
        }
        if (!importedById?.trim()) throw new ReconciliationInputError('Your user session is missing; sign in again before importing.');

        // Validate the complete file before creating a statement header, so a
        // malformed row can never leave a partial import behind.
        const normalizedRows = rows.map((row, index) => this.validateImportRow(row, index));
        const openingBalance = startingBalance ?? 0;
        const closingBalance = endingBalance ?? 0;
        if (!Number.isFinite(openingBalance) || !Number.isFinite(closingBalance)) {
            throw new ReconciliationInputError('Opening and closing balances must be valid numbers.');
        }

        logger.info(`[Reconciliation] Importing ${rows.length} M-Pesa statement rows`);
        const accountId = await this.getMpesaBankAccountId();

        const results: ImportResult = {
            statementId: '',
            totalRows: rows.length,
            autoMatched: 0,
            unmatched: 0,
            duplicates: 0,
            details: [],
        };

        const statementId = await prisma.$transaction(async (tx) => {
            const references = [...new Set(normalizedRows.map(row => row.receiptNo).filter((value): value is string => Boolean(value)))];
            const existing = references.length
                ? await tx.bankStatementLine.findMany({ where: { reference: { in: references } }, select: { reference: true } })
                : [];
            const existingReferences = new Set(existing.map(line => line.reference).filter((value): value is string => Boolean(value)));
            const seenInBatch = new Set<string>();
            const duplicateAt = normalizedRows.map((row) => {
                const duplicate = Boolean(row.receiptNo && (existingReferences.has(row.receiptNo) || seenInBatch.has(row.receiptNo)));
                if (row.receiptNo) seenInBatch.add(row.receiptNo);
                return duplicate;
            });
            const hasNewRows = duplicateAt.some(isDuplicate => !isDuplicate);
            if (!hasNewRows) return null;

            const statement = await tx.bankStatement.create({
                data: {
                    accountId,
                    dateRange: statementDate || new Date().toISOString().slice(0, 10),
                    startingBalance: openingBalance,
                    endingBalance: closingBalance,
                    status: 'IMPORTED',
                },
            });
            results.statementId = statement.id;

            for (let index = 0; index < normalizedRows.length; index++) {
                const row = normalizedRows[index];
                if (duplicateAt[index]) {
                    results.duplicates++;
                    results.details.push({
                        receiptNo: row.receiptNo,
                        amount: row.amount,
                        date: row.date.toISOString(),
                        status: 'DUPLICATE',
                        matchType: null,
                        matchedTo: null,
                        message: 'This receipt was already imported; no duplicate line was added.',
                    });
                    continue;
                }
                const detail = await this.processRow(tx, row, statement.id, importedById);
                if (detail.status === 'RECONCILED') results.autoMatched++;
                else results.unmatched++;
                results.details.push(detail);
            }

            return statement.id;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        // All rows were already present; report duplicates without creating an
        // empty statement header on a repeated file upload.
        if (!statementId) {
            for (const row of normalizedRows) {
                results.duplicates++;
                results.details.push({
                    receiptNo: row.receiptNo,
                    amount: row.amount,
                    date: row.date.toISOString(),
                    status: 'DUPLICATE',
                    matchType: null,
                    matchedTo: null,
                    message: 'This receipt was already imported; no duplicate line was added.',
                });
            }
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
    private validateImportRow(row: MpesaStatementRowInput, index: number): NormalizedStatementRow {
        const rowNumber = index + 1;
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            throw new ReconciliationInputError(`Row ${rowNumber} is invalid.`);
        }
        const amountIn = row.amount === undefined || row.amount === null || row.amount === '' ? 0 : Number(row.amount);
        const amountOut = row.paidOut === undefined || row.paidOut === null || row.paidOut === '' ? 0 : Number(row.paidOut);
        if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut) || amountOut < 0 || (amountIn !== 0 && amountOut > 0)) {
            throw new ReconciliationInputError(`Row ${rowNumber} must have one valid positive amount in or amount out.`);
        }
        const amount = amountOut > 0 ? -amountOut : amountIn;
        if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 9_999_999_999_999.99 || Math.round(Math.abs(amount) * 100) !== Math.abs(amount) * 100) {
            throw new ReconciliationInputError(`Row ${rowNumber} must have a non-zero amount with no more than two decimal places.`);
        }
        const date = row.date ? new Date(row.date) : null;
        if (!date || Number.isNaN(date.getTime())) throw new ReconciliationInputError(`Row ${rowNumber} needs a valid transaction date.`);
        if (row.description !== undefined && typeof row.description !== 'string') {
            throw new ReconciliationInputError(`Row ${rowNumber} description must be text.`);
        }
        const description = (row.description || '').trim();
        if (description.length > 2000) throw new ReconciliationInputError(`Row ${rowNumber} description is too long.`);
        const rawReference = row.receiptNo?.trim();
        if (rawReference && rawReference.length > 100) throw new ReconciliationInputError(`Row ${rowNumber} reference is too long.`);
        return {
            receiptNo: rawReference ? rawReference.toUpperCase() : null,
            amount,
            date,
            description,
        };
    }

    private async processRow(
        tx: Prisma.TransactionClient,
        row: NormalizedStatementRow,
        statementId: string,
        importedById: string,
    ): Promise<RowDetail> {
        const { receiptNo, amount: transactionAmount, date, description } = row;

        // Create the statement line
        const line = await tx.bankStatementLine.create({
            data: {
                statementId,
                date,
                description,
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
                date: date.toISOString(),
                status: 'UNRECONCILED',
                matchType: null,
                matchedTo: null,
                statementLineId: line.id,
                message: 'No receipt number in statement row — manual match required',
            };
        }

        // Try matching against MpesaTransaction
        const mpesaTx = await tx.mpesaTransaction.findFirst({
            where: {
                OR: [
                    { transactionId: receiptNo },
                    { externalId: receiptNo },
                ],
            },
        });

        if (mpesaTx) {
            const matchAmount = Number(mpesaTx.amount);
            const expectedType = transactionAmount < 0 ? 'PAYOUT' : 'COLLECTION';
            if (mpesaTx.status === 'SUCCESS' && mpesaTx.type === expectedType && Math.abs(matchAmount - Math.abs(transactionAmount)) < 0.01) {
                const matched = await this.recordMatch(tx, line.id, 'MPESA_TRANSACTION', mpesaTx.id, importedById);
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: date.toISOString(),
                    status: matched ? 'RECONCILED' : 'UNRECONCILED',
                    matchType: matched ? 'MPESA_TRANSACTION' : null,
                    matchedTo: matched ? mpesaTx.id : null,
                    statementLineId: line.id,
                    message: matched ? `Matched to M-Pesa transaction (${mpesaTx.type}, ${mpesaTx.status})` : 'This transaction is already matched to another statement line.',
                };
            } else {
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: date.toISOString(),
                    status: 'UNRECONCILED',
                    matchType: null,
                    matchedTo: null,
                    statementLineId: line.id,
                    message: `Amount mismatch: statement ${transactionAmount} vs DB ${matchAmount}`,
                };
            }
        }

        // Try matching against FeePayment (referenceNumber = raw receipt)
        const feePayment = transactionAmount > 0 ? await tx.feePayment.findFirst({
            where: {
                archived: false,
                OR: [
                    { referenceNumber: receiptNo },
                    { receiptNumber: `MPESA-${receiptNo}` },
                    { receiptNumber: receiptNo },
                ],
            },
        }) : null;

        if (feePayment) {
            const payAmount = Number(feePayment.amount);
            if (Math.abs(payAmount - transactionAmount) < 0.01) {
                const matched = await this.recordMatch(tx, line.id, 'FEE_PAYMENT', feePayment.id, importedById);
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: date.toISOString(),
                    status: matched ? 'RECONCILED' : 'UNRECONCILED',
                    matchType: matched ? 'FEE_PAYMENT' : null,
                    matchedTo: matched ? feePayment.id : null,
                    statementLineId: line.id,
                    message: matched ? `Matched to fee payment (receipt ${feePayment.receiptNumber})` : 'This payment is already matched to another statement line.',
                };
            } else {
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: date.toISOString(),
                    status: 'UNRECONCILED',
                    matchType: null,
                    matchedTo: null,
                    statementLineId: line.id,
                    message: `Amount mismatch: statement ${transactionAmount} vs payment ${payAmount}`,
                };
            }
        }

        // Try matching against UnmatchedPayment (organic paybill payments)
        const unmatchedPay = transactionAmount > 0 ? await tx.unmatchedPayment.findFirst({ where: { receiptNo, status: 'PENDING' } }) : null;

        if (unmatchedPay) {
            const unmatchedAmount = Number(unmatchedPay.amount);
            if (Math.abs(unmatchedAmount - transactionAmount) < 0.01) {
                const matched = await this.recordMatch(tx, line.id, 'UNMATCHED_PAYMENT', unmatchedPay.id, importedById);
                return {
                    receiptNo,
                    amount: transactionAmount,
                    date: date.toISOString(),
                    status: matched ? 'RECONCILED' : 'UNRECONCILED',
                    matchType: matched ? 'UNMATCHED_PAYMENT' : null,
                    matchedTo: matched ? unmatchedPay.id : null,
                    statementLineId: line.id,
                    message: matched ? `Matched to unmatched payment (status: ${unmatchedPay.status})` : 'This unmatched payment is already linked to another statement line.',
                };
            }
        }

        return {
            receiptNo,
            amount: transactionAmount,
            date: date.toISOString(),
            status: 'UNRECONCILED',
            matchType: null,
            matchedTo: null,
            statementLineId: line.id,
            message: 'No matching record found — manual reconciliation required',
        };
    }

    private async recordMatch(
        tx: Prisma.TransactionClient,
        statementLineId: string,
        matchType: string,
        matchedId: string,
        actorId: string,
        note?: string,
    ): Promise<boolean> {
        const existing = await tx.bankStatementLine.findFirst({ where: { matchType, matchedId } });
        if (existing) return false;

        const reconciledAt = new Date();
        const claimed = await tx.bankStatementLine.updateMany({
            where: { id: statementLineId, status: 'UNRECONCILED' },
            data: { status: 'RECONCILED', matchType, matchedId, reconciledById: actorId, reconciledAt, reconciliationNote: note || null },
        });
        if (claimed.count !== 1) throw new ReconciliationInputError('This statement line was reconciled by another user. Refresh and try again.');

        await tx.bankStatementMatchEvent.create({
            data: { statementLineId, action: 'MATCH', matchType, matchedId, actorId, note: note || null },
        });
        return true;
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
        matchType: 'MPESA_TRANSACTION' | 'FEE_PAYMENT' | 'UNMATCHED_PAYMENT' | 'JOURNAL_ITEM' | 'MANUAL';
        matchedId?: string;
        note?: string;
        reconciledBy: string;
    }): Promise<{ success: boolean; message: string }> {
        const { statementLineId, matchType, matchedId, note, reconciledBy } = params;
        const supportedTypes = ['MPESA_TRANSACTION', 'FEE_PAYMENT', 'UNMATCHED_PAYMENT', 'JOURNAL_ITEM', 'MANUAL'];
        if (!supportedTypes.includes(matchType)) throw new ReconciliationInputError('Choose a supported match type.');
        if (matchType === 'MANUAL') {
            if (matchedId) throw new ReconciliationInputError('Manual reconciliation does not accept a target ID.');
            if (!note?.trim()) throw new ReconciliationInputError('Add a note explaining the manual match.');
        } else if (!matchedId?.trim()) {
            throw new ReconciliationInputError('Select a target record for this match type.');
        }
        if (!reconciledBy?.trim()) throw new ReconciliationInputError('Your user session is missing; sign in again.');
        if (note && note.length > 1000) throw new ReconciliationInputError('Reconciliation note is too long.');

        await prisma.$transaction(async (tx) => {
            const line = await tx.bankStatementLine.findUnique({ where: { id: statementLineId }, include: { statement: { select: { accountId: true } } } });
            if (!line) throw new ReconciliationInputError('Statement line not found');
            if (line.status !== 'UNRECONCILED') throw new ReconciliationInputError('This line is already reconciled');

            let targetAmount: number | null = null;
            if (matchType === 'MPESA_TRANSACTION') {
                const target = await tx.mpesaTransaction.findUnique({ where: { id: matchedId } });
                if (!target) throw new ReconciliationInputError(`Referenced ${matchType} record not found.`);
                const expectedType = Number(line.amount) < 0 ? 'PAYOUT' : 'COLLECTION';
                if (target.status !== 'SUCCESS' || target.type !== expectedType) {
                    throw new ReconciliationInputError('Choose a successful M-Pesa transaction with the same direction as this statement line.');
                }
                targetAmount = Number(target.amount);
            } else if (matchType === 'FEE_PAYMENT') {
                const target = await tx.feePayment.findUnique({ where: { id: matchedId } });
                if (!target || target.archived) throw new ReconciliationInputError('Fee payment was not found or is no longer active.');
                if (Number(line.amount) <= 0) throw new ReconciliationInputError('A fee payment can only match money received into the account.');
                targetAmount = Number(target.amount);
            } else if (matchType === 'UNMATCHED_PAYMENT') {
                const target = await tx.unmatchedPayment.findUnique({ where: { id: matchedId } });
                if (!target || target.status !== 'PENDING') throw new ReconciliationInputError('Choose an unresolved M-Pesa payment.');
                if (Number(line.amount) <= 0) throw new ReconciliationInputError('An unmatched payment can only match money received into the account.');
                targetAmount = Number(target.amount);
            } else if (matchType === 'JOURNAL_ITEM') {
                const target = await tx.journalItem.findUnique({ where: { id: matchedId }, include: { entry: true } });
                if (!target || target.entry.status !== 'POSTED') throw new ReconciliationInputError('Choose a journal item from a posted entry.');
                if (target.accountId !== line.statement.accountId) throw new ReconciliationInputError('Choose a journal item from this statement’s bank account.');
                targetAmount = Math.max(Number(target.debit), Number(target.credit));
            }

            if (targetAmount !== null && (!Number.isFinite(targetAmount) || Math.abs(targetAmount - Math.abs(Number(line.amount))) >= 0.01)) {
                throw new ReconciliationInputError('The target amount does not match this statement line.');
            }

            if (matchedId) {
                const alreadyUsed = await tx.bankStatementLine.findFirst({ where: { matchType, matchedId } });
                if (alreadyUsed) throw new ReconciliationInputError('That target is already matched to another statement line.');
            }

            const claimed = await tx.bankStatementLine.updateMany({
                where: { id: statementLineId, status: 'UNRECONCILED' },
                data: {
                    status: 'RECONCILED',
                    matchType,
                    matchedId: matchedId || null,
                    reconciledById: reconciledBy,
                    reconciledAt: new Date(),
                    reconciliationNote: note?.trim() || null,
                    journalItemId: matchType === 'JOURNAL_ITEM' ? matchedId : null,
                },
            });
            if (claimed.count !== 1) throw new ReconciliationInputError('This statement line was reconciled by another user. Refresh and try again.');
            await tx.bankStatementMatchEvent.create({
                data: { statementLineId, action: 'MATCH', matchType, matchedId: matchedId || null, actorId: reconciledBy, note: note?.trim() || null },
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
        if (!userId?.trim()) throw new ReconciliationInputError('Your user session is missing; sign in again.');
        await prisma.$transaction(async (tx) => {
            const line = await tx.bankStatementLine.findUnique({ where: { id: statementLineId } });
            if (!line) throw new ReconciliationInputError('Statement line not found');
            if (line.status !== 'RECONCILED') throw new ReconciliationInputError('This line is not reconciled — nothing to undo');
            if (!line.matchType || (line.matchType !== 'MANUAL' && !line.matchedId)) {
                throw new ReconciliationInputError('This historical match has no recorded target and cannot be safely undone.');
            }

            const updated = await tx.bankStatementLine.updateMany({
                where: {
                    id: statementLineId,
                    status: 'RECONCILED',
                    matchType: line.matchType,
                    matchedId: line.matchedId,
                },
                data: {
                    status: 'UNRECONCILED',
                    matchType: null,
                    matchedId: null,
                    reconciledById: null,
                    reconciledAt: null,
                    reconciliationNote: null,
                    journalItemId: null,
                },
            });
            if (updated.count !== 1) throw new ReconciliationInputError('This match changed while you were viewing it. Refresh and try again.');
            await tx.bankStatementMatchEvent.create({
                data: {
                    statementLineId,
                    action: 'UNMATCH',
                    matchType: line.matchType,
                    matchedId: line.matchedId,
                    actorId: userId,
                    note: line.reconciliationNote || undefined,
                },
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
        if (line.status !== 'UNRECONCILED') throw new ReconciliationInputError('Only unmatched statement lines can be matched.');

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
                status: 'SUCCESS',
                type: Number(line.amount) < 0 ? 'PAYOUT' : 'COLLECTION',
            },
            take: 5,
        });

        for (const tx of mpesaTxs) {
            const alreadyMatched = await prisma.bankStatementLine.findFirst({
                where: { matchType: 'MPESA_TRANSACTION', matchedId: tx.id },
                select: { id: true },
            });
            if (alreadyMatched) continue;
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
        const payments = Number(line.amount) > 0 ? await prisma.feePayment.findMany({
            where: {
                amount: { gte: amount - 1, lte: amount + 1 },
                paymentDate: { gte: startDate, lte: endDate },
                archived: false,
            },
            include: {
                invoice: { select: { invoiceNumber: true, learner: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
            },
            take: 5,
        }) : [];

        for (const p of payments) {
            const alreadyMatched = await prisma.bankStatementLine.findFirst({
                where: { matchType: 'FEE_PAYMENT', matchedId: p.id },
                select: { id: true },
            });
            if (alreadyMatched) continue;
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

        const unmatchedPayments = Number(line.amount) > 0 ? await prisma.unmatchedPayment.findMany({
            where: {
                amount: { gte: amount - 1, lte: amount + 1 },
                transactionDate: { gte: startDate, lte: endDate },
                status: 'PENDING',
            },
            take: 5,
        }) : [];
        for (const payment of unmatchedPayments) {
            const alreadyMatched = await prisma.bankStatementLine.findFirst({
                where: { matchType: 'UNMATCHED_PAYMENT', matchedId: payment.id },
                select: { id: true },
            });
            if (alreadyMatched) continue;
            suggestions.push({
                matchType: 'UNMATCHED_PAYMENT',
                matchedId: payment.id,
                receiptNo: payment.receiptNo,
                amount: Number(payment.amount),
                date: payment.transactionDate,
                description: `Unresolved M-Pesa payment from ${payment.phone}`,
                confidence: this.calculateConfidence(amount, Number(payment.amount), lineDate, payment.transactionDate),
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
    amount?: number | string;
    paidOut?: number | string;
    description?: string;
    balance?: number;
}

interface NormalizedStatementRow {
    receiptNo: string | null;
    date: Date;
    amount: number;
    description: string;
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
