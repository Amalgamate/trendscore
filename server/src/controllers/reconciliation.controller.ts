import { Request, Response } from 'express';
import { reconciliationService } from '../services/reconciliation.service';
import logger from '../utils/logger';

/**
 * Bank Reconciliation Controller — M-Pesa Statement Import + Matching
 *
 * Endpoints:
 *  POST   /reconciliation/import          — Import M-Pesa statement (CSV upload or JSON)
 *  GET    /reconciliation/statements       — List imported statements
 *  GET    /reconciliation/statements/:id   — Statement detail with lines
 *  POST   /reconciliation/lines/:id/reconcile   — Manually reconcile a line
 *  POST   /reconciliation/lines/:id/unreconcile — Undo reconciliation
 *  GET    /reconciliation/lines/:id/suggest-matches — Get suggested matches
 *  GET    /reconciliation/dashboard        — Reconciliation dashboard summary
 */

// ── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse an M-Pesa statement CSV file content into structured rows.
 *
 * Handles common M-Pesa statement column variations:
 *  - Safaricom M-Pesa portal export
 *  - Daraja portal export
 *  - Generic bank statement format
 */
function parseMpesaCsv(csvContent: string): any[] {
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Find the header row (may not be line 0 if there's a title block)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        if (lines[i].toLowerCase().includes('receipt') || lines[i].toLowerCase().includes('completion time')) {
            headerIdx = i;
            break;
        }
    }

    const headers = parseCsvLine(lines[headerIdx]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

    const rows: any[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < 2) continue;

        const obj: any = {};
        for (let j = 0; j < headers.length && j < values.length; j++) {
            obj[headers[j]] = values[j]?.trim();
        }

        // Normalize fields across different column naming conventions
        const row = {
            receiptNo: obj.receipt_no || obj.receiptno || obj.receipt_number || obj.transaction_id || obj.transactionid || obj.ref || obj.reference || null,
            date: obj.completion_time || obj.time || obj.date || obj.transaction_date || obj.posting_date || null,
            amount: parseAmount(obj.paid_in || obj.credit || obj.amount || obj.deposit),
            paidOut: parseAmount(obj.paid_out || obj.debit || obj.withdrawal),
            description: obj.other_party_info || obj.details || obj.description || obj.narrative || obj.particulars || '',
            balance: parseAmount(obj.balance || obj.running_balance),
        };

        // Skip rows that are completely empty
        if (!row.receiptNo && !row.amount && !row.paidOut && !row.description) continue;

        rows.push(row);
    }

    return rows;
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function parseAmount(val: string | undefined): number | undefined {
    if (!val) return undefined;
    // Remove commas, spaces, currency symbols
    const cleaned = val.replace(/[,\sKESKes]/g, '').replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
}

// ── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /reconciliation/import
 *
 * Accepts either:
 *  - multipart/form-data with a CSV file upload (field: "file")
 *  - application/json with pre-parsed rows in body.rows
 */
export const importStatement = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId || (req as any).user?.id;
        let rows: any[] = [];

        // Check if a file was uploaded
        const file = (req as any).file;
        if (file) {
            const content = file.buffer.toString('utf-8');
            rows = parseMpesaCsv(content);

            if (rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid rows found in the uploaded CSV. Please check the file format.',
                });
            }
        } else if (req.body.rows && Array.isArray(req.body.rows)) {
            // Pre-parsed JSON rows
            rows = req.body.rows;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Please upload a CSV file or provide rows in the request body',
            });
        }

        const result = await reconciliationService.importStatement({
            rows,
            importedById: userId,
            statementDate: req.body.statementDate,
            startingBalance: req.body.startingBalance ? Number(req.body.startingBalance) : undefined,
            endingBalance: req.body.endingBalance ? Number(req.body.endingBalance) : undefined,
        });

        res.status(201).json({
            success: true,
            message: `Imported ${result.totalRows} rows: ${result.autoMatched} matched, ${result.unmatched} unmatched, ${result.duplicates} duplicates`,
            data: result,
        });
    } catch (error: any) {
        logger.error('[Reconciliation] Import error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /reconciliation/statements
 */
export const listStatements = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;

        const result = await reconciliationService.listStatements(page, limit);
        res.json({ success: true, ...result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /reconciliation/statements/:id
 */
export const getStatementDetail = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const status = req.query.status as string | undefined;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;

        const result = await reconciliationService.getStatementDetail(id, { status, page, limit });
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /reconciliation/lines/:id/reconcile
 */
export const manualReconcile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { matchType, matchedId, note } = req.body;
        const userId = (req as any).user?.userId || (req as any).user?.id;

        if (!matchType) {
            return res.status(400).json({
                success: false,
                message: 'matchType is required (MPESA_TRANSACTION | FEE_PAYMENT | UNMATCHED_PAYMENT | MANUAL)',
            });
        }

        const result = await reconciliationService.manualReconcile({
            statementLineId: id,
            matchType,
            matchedId,
            note,
            reconciledBy: userId,
        });

        res.json({ success: true, message: result.message });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /reconciliation/lines/:id/unreconcile
 */
export const unreconcileLine = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId || (req as any).user?.id;

        const result = await reconciliationService.unreconcile(id, userId);
        res.json({ success: true, message: 'Line un-reconciled', data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /reconciliation/lines/:id/suggest-matches
 */
export const suggestMatches = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await reconciliationService.suggestMatches(id);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /reconciliation/dashboard
 */
export const getDashboard = async (_req: Request, res: Response) => {
    try {
        const result = await reconciliationService.getDashboard();
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
