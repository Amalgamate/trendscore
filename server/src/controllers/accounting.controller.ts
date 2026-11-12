import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { accountingService } from '../services/accounting.service';

export class AccountingController {
    /**
     * Chart of Accounts
     */
    async getAccounts(req: AuthRequest, res: Response) {
        try {
            const includeBalances = req.query.balances === 'true';
            const accounts = await accountingService.getAccounts(includeBalances);
            res.json({ success: true, data: accounts });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }

    async createAccount(req: AuthRequest, res: Response) {
        try {
            const account = await accountingService.createAccount(req.body);
            res.status(201).json({ success: true, message: 'Account created', data: account });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getJournals(req: AuthRequest, res: Response) {
        try {
            const journals = await accountingService.getJournals();
            res.json({ success: true, data: journals });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getJournalEntries(req: AuthRequest, res: Response) {
        try {
            const { journalId, status, startDate, endDate, term, academicYear } = req.query;
            const parsedYear = academicYear ? parseInt(academicYear as string, 10) : undefined;
            const entries = await accountingService.getJournalEntries({
                journalId: journalId as string,
                status: status as string,
                startDate: startDate ? new Date(startDate as string) : undefined,
                endDate: endDate ? new Date(endDate as string) : undefined,
                term: term as string,
                academicYear: parsedYear
            });
            res.json({ success: true, data: entries });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Journal Operations
     */
    async createJournalEntry(req: AuthRequest, res: Response) {
        try {
            const entry = await accountingService.createJournalEntry(req.body);
            res.status(201).json({ success: true, message: 'Journal entry created', data: entry });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async postJournalEntry(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const posted = await accountingService.postJournalEntry(id);
            res.json({ success: true, message: 'Journal entry posted', data: posted });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    /**
     * Reports
     */
    async getTrialBalance(req: AuthRequest, res: Response) {
        try {
            const { startDate, endDate } = req.query;
            const report = await accountingService.getFinancialReport(
                new Date(startDate as string),
                new Date(endDate as string)
            );
            res.json({ success: true, data: report });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getVendors(req: AuthRequest, res: Response) {
        try {
            const vendors = await accountingService.getVendors();
            res.json({ success: true, data: vendors });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getExpenses(req: AuthRequest, res: Response) {
        try {
            const expenses = await accountingService.getExpenses();
            res.json({ success: true, data: expenses });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createVendor(req: AuthRequest, res: Response) {
        try {
            const vendor = await accountingService.createVendor(req.body);
            res.status(201).json({ success: true, message: 'Vendor created', data: vendor });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async recordExpense(req: AuthRequest, res: Response) {
        try {
            const expense = await accountingService.recordExpense(req.body);
            res.status(201).json({ success: true, message: 'Expense recorded and posted to ledger', data: expense });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    async getDashboardStats(req: AuthRequest, res: Response) {
        try {
            const stats = await accountingService.getDashboardStats();
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Initialization
     */
    async initializeCoA(req: AuthRequest, res: Response) {
        try {
            await accountingService.initializeDefaultCoA();
            res.json({ success: true, message: 'Default Chart of Accounts initialized' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export const accountingController = new AccountingController();
