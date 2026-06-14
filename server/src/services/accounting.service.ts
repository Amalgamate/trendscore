import prisma from '../config/database';
import { JournalType, AccountType, Term } from '@prisma/client';
import { configService } from './config.service';

export class AccountingService {
    private accountByCodeCache = new Map<string, any>();
    private journalByCodeCache = new Map<string, any>();

    private defaultAccounts = [
        { code: '1000', name: 'Fixed Assets', type: AccountType.ASSET_NON_CURRENT },
        { code: '1100', name: 'Accounts Receivable (Fees)', type: AccountType.ASSET_RECEIVABLE },
        { code: '1200', name: 'Cash in Hand', type: AccountType.ASSET_CASH },
        { code: '1210', name: 'Main Bank Account', type: AccountType.ASSET_CASH },
        { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY_PAYABLE },
        { code: '2100', name: 'Tuition Deposits', type: AccountType.LIABILITY_CURRENT },
        { code: '2110', name: 'Salaries Payable', type: AccountType.LIABILITY_CURRENT },
        { code: '3000', name: 'Retained Earnings', type: AccountType.EQUITY },
        { code: '4000', name: 'Tuition Fees Income', type: AccountType.REVENUE },
        { code: '4100', name: 'Transport Fees Income', type: AccountType.REVENUE },
        { code: '4200', name: 'Extracurricular Income', type: AccountType.REVENUE },
        { code: '5000', name: 'Salaries Expense', type: AccountType.EXPENSE },
        { code: '5100', name: 'Electricity Expense', type: AccountType.EXPENSE },
        { code: '5200', name: 'Water Expense', type: AccountType.EXPENSE },
        { code: '5300', name: 'Rent Expense', type: AccountType.EXPENSE }
    ];

    private defaultJournals = [
        { code: 'INV', name: 'Customer Invoices (Sales)', type: 'SALES' as JournalType },
        { code: 'BILL', name: 'Vendor Bills (Purchases)', type: 'PURCHASE' as JournalType },
        { code: 'CSH1', name: 'Cash', type: 'CASH' as JournalType },
        { code: 'BNK1', name: 'Bank', type: 'BANK' as JournalType },
        { code: 'MISC', name: 'Miscellaneous Operations', type: 'GENERAL' as JournalType }
    ];

    async initializeDefaultCoA() {
        const existing = await prisma.account.findFirst();
        if (existing) return;

        return await prisma.$transaction([
            prisma.account.createMany({ data: this.defaultAccounts }),
            prisma.journal.createMany({ data: this.defaultJournals })
        ]);
    }

    async ensureDefaultAccountingSetup() {
        const [existingAccounts, existingJournals] = await Promise.all([
            prisma.account.findMany({ where: { code: { in: this.defaultAccounts.map(acc => acc.code) } } }),
            prisma.journal.findMany({ where: { code: { in: this.defaultJournals.map(journal => journal.code) } } })
        ]);

        const missingAccounts = this.defaultAccounts.filter(acc => !existingAccounts.some(existing => existing.code === acc.code));
        const missingJournals = this.defaultJournals.filter(journal => !existingJournals.some(existing => existing.code === journal.code));

        if (!missingAccounts.length && !missingJournals.length) return;

        await prisma.$transaction([
            missingAccounts.length ? prisma.account.createMany({ data: missingAccounts }) : Promise.resolve(),
            missingJournals.length ? prisma.journal.createMany({ data: missingJournals }) : Promise.resolve()
        ].filter(Boolean) as any);
    }

    async getAccounts(includeBalances = false) {
        let accounts = await prisma.account.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' }
        });

        if (!accounts.length) {
            await this.ensureDefaultAccountingSetup();
            accounts = await prisma.account.findMany({
                where: { isActive: true },
                orderBy: { code: 'asc' }
            });
        }

        if (!includeBalances) return accounts;

        const items = await prisma.journalItem.findMany({
            where: { entry: { status: 'POSTED' } }
        });

        return accounts.map(acc => {
            const accItems = items.filter(i => i.accountId === acc.id);
            const debits = accItems.reduce((sum, i) => sum + Number(i.debit), 0);
            const credits = accItems.reduce((sum, i) => sum + Number(i.credit), 0);
            const isDebitNormal = acc.type.startsWith('ASSET') || acc.type === 'EXPENSE';
            const balance = isDebitNormal ? debits - credits : credits - debits;
            return { ...acc, balance };
        });
    }

    async createAccount(data: { code: string; name: string; type: AccountType; parentId?: string }) {
        return prisma.account.create({ data });
    }

    async getJournals() {
        let journals = await prisma.journal.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' }
        });

        if (!journals.length) {
            await this.ensureDefaultAccountingSetup();
            journals = await prisma.journal.findMany({
                where: { isActive: true },
                orderBy: { code: 'asc' }
            });
        }

        return journals;
    }

    async getJournalEntries(filters?: { journalId?: string; status?: string; startDate?: Date; endDate?: Date; term?: string; academicYear?: number }) {
        let startDate = filters?.startDate;
        let endDate = filters?.endDate;

        if (filters?.term && filters?.academicYear) {
            try {
                const termConfig = await configService.getTermConfig({
                    term: filters.term as Term,
                    academicYear: filters.academicYear
                });
                startDate = termConfig.startDate;
                endDate = termConfig.endDate;
            } catch (error) {
                console.warn(`[Accounting] Could not load term dates for ${filters.term} ${filters.academicYear}:`, error);
            }
        }

        return prisma.journalEntry.findMany({
            where: {
                journalId: filters?.journalId,
                status: filters?.status,
                date: { gte: startDate, lte: endDate }
            },
            include: {
                journal: true,
                items: { include: { account: true } }
            },
            orderBy: { date: 'desc' }
        });
    }

    async createJournalEntry(data: {
        date?: Date;
        reference?: string;
        journalId: string;
        items: {
            accountId: string;
            debit?: number;
            credit?: number;
            label?: string;
        }[];
    }) {
        const totalDebit = data.items.reduce((sum, item) => sum + (item.debit || 0), 0);
        const totalCredit = data.items.reduce((sum, item) => sum + (item.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal Entry: Debits (${totalDebit}) do not equal Credits (${totalCredit})`);
        }

        return prisma.journalEntry.create({
            data: {
                date: data.date || new Date(),
                reference: data.reference,
                journalId: data.journalId,
                status: 'DRAFT',
                items: {
                    create: data.items.map(item => ({
                        accountId: item.accountId,
                        debit: item.debit || 0,
                        credit: item.credit || 0,
                        label: item.label
                    }))
                }
            },
            include: { items: { include: { account: true } } }
        });
    }

    async postJournalEntry(entryId: string) {
        const entry = await prisma.journalEntry.findUnique({
            where: { id: entryId },
            include: { items: true }
        });

        if (!entry) throw new Error('Journal Entry not found');
        if (entry.status === 'POSTED') throw new Error('Entry already posted');

        return prisma.journalEntry.update({
            where: { id: entryId },
            data: { status: 'POSTED' }
        });
    }

    async getAccountByCode(code: string) {
        if (this.accountByCodeCache.has(code)) {
            return this.accountByCodeCache.get(code);
        }
        const account = await prisma.account.findUnique({ where: { code } });
        if (account) this.accountByCodeCache.set(code, account);
        return account;
    }

    async getJournalByCode(code: string) {
        if (this.journalByCodeCache.has(code)) {
            return this.journalByCodeCache.get(code);
        }
        const journal = await prisma.journal.findUnique({ where: { code } });
        if (journal) this.journalByCodeCache.set(code, journal);
        return journal;
    }

    /**
     * Clear accounting caches.
     * Call this after any account/journal create, update, or deactivation so
     * the in-process singleton cache does not serve stale entries indefinitely.
     */
    clearCache() {
        this.accountByCodeCache.clear();
        this.journalByCodeCache.clear();
    }

    /**
     * Automatic Ledger Posting: Fee Invoice
     * Dr: Accounts Receivable (1100)
     * Cr: Tuition Revenue (4000)
     */
    async postFeeInvoiceToLedger(invoice: any) {
        const totalAmount = Number(invoice.totalAmount || 0) + Number(invoice.sponsorAmount || 0);
        const invoiceNumber = invoice.invoiceNumber;

        let arAccount = await this.getAccountByCode('1100');
        let revenueAccount = await this.getAccountByCode('4000');
        let salesJournal = await this.getJournalByCode('INV');

        if (!arAccount || !revenueAccount || !salesJournal) {
            console.warn(`[Accounting] Missing setup for fee invoice — initializing defaults.`);
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            arAccount = await this.getAccountByCode('1100');
            revenueAccount = await this.getAccountByCode('4000');
            salesJournal = await this.getJournalByCode('INV');
        }

        if (!arAccount || !revenueAccount || !salesJournal) {
            console.warn(`[Accounting] Still missing required accounts/journal. Skipping auto-post.`);
            return;
        }

        const entryDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
        const entry = await this.createJournalEntry({
            journalId: salesJournal.id,
            reference: invoiceNumber,
            date: entryDate,
            items: [
                { accountId: arAccount.id, debit: Number(totalAmount), label: `Fees Receivable: Invoice ${invoiceNumber}` },
                { accountId: revenueAccount.id, credit: Number(totalAmount), label: `Tuition Revenue: Invoice ${invoiceNumber}` }
            ]
        });

        return this.postJournalEntry(entry.id);
    }

    async postFeeInvoiceRevisionToLedger(invoiceNumber: string, revisionNumber: number, delta: number) {
        const amount = Math.abs(Number(delta || 0));
        if (amount < 0.01) return;
        let arAccount = await this.getAccountByCode('1100');
        let revenueAccount = await this.getAccountByCode('4000');
        let salesJournal = await this.getJournalByCode('INV');
        if (!arAccount || !revenueAccount || !salesJournal) {
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            arAccount = await this.getAccountByCode('1100');
            revenueAccount = await this.getAccountByCode('4000');
            salesJournal = await this.getJournalByCode('INV');
        }
        if (!arAccount || !revenueAccount || !salesJournal) return;
        const increase = delta > 0;
        const reference = `${invoiceNumber}-REV-${revisionNumber}`;
        const entry = await this.createJournalEntry({
            journalId: salesJournal.id,
            reference,
            date: new Date(),
            items: increase
                ? [
                    { accountId: arAccount.id, debit: amount, label: `Invoice revision increase: ${invoiceNumber}` },
                    { accountId: revenueAccount.id, credit: amount, label: `Fee revenue revision: ${invoiceNumber}` },
                ]
                : [
                    { accountId: revenueAccount.id, debit: amount, label: `Fee revenue reduction: ${invoiceNumber}` },
                    { accountId: arAccount.id, credit: amount, label: `Invoice revision reduction: ${invoiceNumber}` },
                ],
        });
        return this.postJournalEntry(entry.id);
    }

    /**
     * Automatic Ledger Posting: Fee Payment
     * Dr: Bank (1210) or Cash (1200)
     * Cr: Accounts Receivable (1100)
     *
     * FIX (Bug Medium): M-Pesa payments now correctly post to the Main Bank
     * Account (1210) instead of Cash in Hand (1200). M-Pesa settlements are
     * received into the school's bank account, not petty cash.
     *
     * Mapping:
     *   BANK_TRANSFER → 1210 Main Bank Account  / BNK1 journal
     *   MPESA         → 1210 Main Bank Account  / BNK1 journal  (was wrongly 1200/CSH1)
     *   CARD          → 1210 Main Bank Account  / BNK1 journal
     *   CASH          → 1200 Cash in Hand       / CSH1 journal
     *   CHEQUE        → 1210 Main Bank Account  / BNK1 journal
     *   OTHER         → 1200 Cash in Hand       / CSH1 journal
     */
    async postFeePaymentToLedger(payment: any, method: string) {
        const { amount, receiptNumber } = payment;

        // FIX: MPESA, BANK_TRANSFER, CARD, and CHEQUE all go to the bank account.
        // Only CASH and OTHER go to Cash in Hand.
        const bankMethods = new Set(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE']);
        const isBank = bankMethods.has(method?.toUpperCase?.() ?? method);

        const assetCode = isBank ? '1210' : '1200';
        const journalCode = isBank ? 'BNK1' : 'CSH1';

        let assetAccount = await this.getAccountByCode(assetCode);
        let arAccount = await this.getAccountByCode('1100');
        let journal = await this.getJournalByCode(journalCode);

        if (!assetAccount || !arAccount || !journal) {
            console.warn(`[Accounting] Missing setup for fee payment — initializing defaults.`);
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            assetAccount = await this.getAccountByCode(assetCode);
            arAccount = await this.getAccountByCode('1100');
            journal = await this.getJournalByCode(journalCode);
        }

        if (!assetAccount || !arAccount || !journal) {
            console.warn(`[Accounting] Still missing required accounts/journal. Skipping payment post.`);
            return;
        }

        const entryDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
        const entry = await this.createJournalEntry({
            journalId: journal.id,
            reference: receiptNumber,
            date: entryDate,
            items: [
                { accountId: assetAccount.id, debit: Number(amount), label: `Fee Payment Received: ${receiptNumber}` },
                { accountId: arAccount.id, credit: Number(amount), label: `Settlement: ${receiptNumber}` }
            ]
        });

        return this.postJournalEntry(entry.id);
    }

    /**
     * Automatic Ledger Posting: Fee Waiver
     * Dr: Fee Waivers (5400)
     * Cr: Accounts Receivable (1100)
     */
    async postFeeWaiverToLedger(waiver: any) {
        const { amountWaived, id } = waiver;
        const invoiceNumber = waiver.invoice?.invoiceNumber || 'N/A';

        let arAccount = await this.getAccountByCode('1100');
        let waiverAccount = await this.getAccountByCode('5400');
        let miscJournal = await this.getJournalByCode('MISC');

        if (!arAccount || !waiverAccount || !miscJournal) {
            console.warn(`[Accounting] Missing setup for fee waiver. Ensuring defaults.`);

            if (!waiverAccount) {
                await prisma.account.upsert({
                    where: { code: '5400' },
                    update: {},
                    create: { code: '5400', name: 'Fee Waivers & Discounts', type: AccountType.EXPENSE }
                });
            }

            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            arAccount = await this.getAccountByCode('1100');
            waiverAccount = await this.getAccountByCode('5400');
            miscJournal = await this.getJournalByCode('MISC');
        }

        if (!arAccount || !waiverAccount || !miscJournal) {
            console.warn(`[Accounting] Still missing required accounts/journal for waiver. Skipping auto-post.`);
            return;
        }

        const entry = await this.createJournalEntry({
            journalId: miscJournal.id,
            reference: `WAV/${id.slice(0, 8)}`,
            date: new Date(),
            items: [
                { accountId: waiverAccount.id, debit: Number(amountWaived), label: `Fee Waiver Approved: Inv ${invoiceNumber}` },
                { accountId: arAccount.id, credit: Number(amountWaived), label: `Receivable Reduction: Inv ${invoiceNumber}` }
            ]
        });

        return this.postJournalEntry(entry.id);
    }

    /**
     * Automatic Ledger Posting: Payroll Record
     *
     * Entry 1 — Payroll accrual:
     *   Dr: Salaries Expense  5000
     *   Cr: Salaries Payable  2110
     *
     * Entry 2 — Payroll disbursement:
     *   Dr: Salaries Payable  2110
     *   Cr: Main Bank Account 1210
     */
    async postPayrollToLedger(payroll: any) {
        const { netSalary, payrollNumber, month, year } = payroll;
        const ref = payrollNumber || `PAY/${year}/${month}`;

        let expenseAccount = await this.getAccountByCode('5000');
        let payableAccount = await this.getAccountByCode('2110');
        let bankAccount    = await this.getAccountByCode('1210');
        let journal        = await this.getJournalByCode('MISC');

        if (!expenseAccount || !payableAccount || !bankAccount || !journal) {
            console.warn(`[Accounting] Missing payroll setup. Initializing defaults.`);
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            expenseAccount = await this.getAccountByCode('5000');
            payableAccount = await this.getAccountByCode('2110');
            bankAccount    = await this.getAccountByCode('1210');
            journal        = await this.getJournalByCode('MISC');
        }

        if (!expenseAccount || !payableAccount || !bankAccount || !journal) {
            console.warn(`[Accounting] Still missing required payroll accounts/journal. Skipping auto-post.`);
            return;
        }

        const amount = Number(netSalary);

        const accrualEntry = await this.createJournalEntry({
            journalId: journal.id,
            reference: `${ref}/ACCRUAL`,
            date: new Date(),
            items: [
                { accountId: expenseAccount.id, debit: amount, label: `Payroll Expense for ${month}/${year}` },
                { accountId: payableAccount.id, credit: amount, label: `Salaries Payable for ${month}/${year}` }
            ]
        });
        await this.postJournalEntry(accrualEntry.id);

        const disbursementEntry = await this.createJournalEntry({
            journalId: journal.id,
            reference: `${ref}/DISBURSEMENT`,
            date: new Date(),
            items: [
                { accountId: payableAccount.id, debit: amount, label: `Salary Disbursement for ${month}/${year}` },
                { accountId: bankAccount.id,    credit: amount, label: `Bank Payment: Payroll ${month}/${year}` }
            ]
        });
        return this.postJournalEntry(disbursementEntry.id);
    }

    async getVendors() {
        return prisma.vendor.findMany({ orderBy: { name: 'asc' } });
    }

    async getExpenses() {
        return prisma.expense.findMany({
            include: { account: true, vendor: true },
            orderBy: { date: 'desc' }
        });
    }

    async createVendor(data: { name: string; email?: string; phone?: string; address?: string }) {
        return prisma.vendor.create({ data });
    }

    async recordExpense(data: {
        date?: Date;
        amount: number;
        description: string;
        category: string;
        accountId: string;
        paymentAccountId: string;
        vendorId?: string;
        reference?: string;
    }) {
        const expense = await prisma.expense.create({
            data: {
                date: data.date || new Date(),
                amount: data.amount,
                description: data.description,
                category: data.category,
                vendorId: data.vendorId,
                accountId: data.accountId,
                reference: data.reference,
                status: 'PAID'
            }
        });

        const journal = await this.getJournalByCode('MISC');
        if (journal) {
            const entry = await this.createJournalEntry({
                journalId: journal.id,
                reference: data.reference || `EXP-${expense.id.slice(0, 8)}`,
                date: data.date || new Date(),
                items: [
                    { accountId: data.accountId, debit: Number(data.amount), label: `Expense: ${data.description}` },
                    { accountId: data.paymentAccountId, credit: Number(data.amount), label: `Payment for: ${data.description}` }
                ]
            });
            await this.postJournalEntry(entry.id);
        }

        return expense;
    }

    async getBankStatements(accountId?: string) {
        return prisma.bankStatement.findMany({
            where: { accountId: accountId || undefined },
            include: { lines: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async importBankStatement(data: {
        accountId: string;
        startingBalance: number;
        endingBalance: number;
        lines: { date: Date; description: string; amount: number; reference?: string }[];
    }) {
        return prisma.bankStatement.create({
            data: {
                accountId: data.accountId,
                startingBalance: data.startingBalance,
                endingBalance: data.endingBalance,
                lines: {
                    create: data.lines.map(line => ({
                        date: line.date,
                        description: line.description,
                        amount: line.amount,
                        reference: line.reference
                    }))
                }
            },
            include: { lines: true }
        });
    }

    async reconcileStatementLine(lineId: string, journalItemId: string) {
        return prisma.bankStatementLine.update({
            where: { id: lineId },
            data: { journalItemId, status: 'RECONCILED' }
        });
    }

    async suggestMatches(lineId: string) {
        const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId } });
        if (!line) throw new Error('Statement line not found');

        const startDate = new Date(line.date);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(line.date);
        endDate.setDate(endDate.getDate() + 7);

        const amount = Math.abs(Number(line.amount));

        return prisma.journalItem.findMany({
            where: {
                bankStatementLine: { is: null },
                OR: [{ debit: amount }, { credit: amount }],
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: 'POSTED'
                }
            },
            include: { entry: true, account: true }
        });
    }

    async getFinancialReport(startDate: Date, endDate: Date) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const accountsWithBalance = await prisma.account.findMany({
            include: {
                journalItems: {
                    where: {
                        entry: {
                            status: 'POSTED',
                            date: { lte: end }
                        }
                    },
                    include: { entry: { select: { date: true } } }
                }
            }
        });

        const trialBalance = accountsWithBalance.map(acc => {
            const isPL = acc.type === 'REVENUE' || acc.type === 'EXPENSE';

            const relevantItems = acc.journalItems.filter(item => {
                if (isPL) {
                    return item.entry.date >= startDate && item.entry.date <= end;
                }
                return true;
            });

            const debits = relevantItems.reduce((sum, item) => sum + Number(item.debit), 0);
            const credits = relevantItems.reduce((sum, item) => sum + Number(item.credit), 0);
            const isDebitNormal = acc.type.startsWith('ASSET') || acc.type === 'EXPENSE';

            return {
                code: acc.code,
                name: acc.name,
                type: acc.type,
                balance: isDebitNormal ? debits - credits : credits - debits
            };
        });

        const income = trialBalance.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.balance, 0);
        const expenses = trialBalance.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.balance, 0);
        const netProfit = income - expenses;

        const nonCurrentAssets = trialBalance.filter(a => a.type === 'ASSET_NON_CURRENT').reduce((sum, a) => sum + a.balance, 0);
        const currentAssets = trialBalance.filter(a => ['ASSET_RECEIVABLE', 'ASSET_CASH'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0);
        const totalAssets = nonCurrentAssets + currentAssets;

        const currentLiabilities = trialBalance.filter(a => ['LIABILITY_PAYABLE', 'LIABILITY_CURRENT'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0);
        const nonCurrentLiabilities = trialBalance.filter(a => a.type === 'LIABILITY_NON_CURRENT').reduce((sum, a) => sum + a.balance, 0);
        const totalLiabilities = currentLiabilities + nonCurrentLiabilities;

        const equity = trialBalance.filter(a => a.type === 'EQUITY').reduce((sum, a) => sum + a.balance, 0);

        return {
            trialBalance,
            profitLoss: { totalIncome: income, totalExpenses: expenses, netProfit },
            balanceSheet: {
                assets: { nonCurrent: nonCurrentAssets, current: currentAssets, total: totalAssets },
                liabilities: { current: currentLiabilities, nonCurrent: nonCurrentLiabilities, total: totalLiabilities },
                equity: { retainedEarnings: equity, currentYearProfit: netProfit, total: equity + netProfit },
                totalLiabilitiesAndEquity: totalLiabilities + equity + netProfit
            }
        };
    }

    async getDashboardStats() {
        const now = new Date();
        const report = await this.getFinancialReport(new Date(now.getFullYear(), 0, 1), now);
        const accounts = await this.getAccounts(true) as Array<{ type: AccountType; balance?: number }>;

        const cashOnHand = accounts
            .filter(acc => acc.type === AccountType.ASSET_CASH)
            .reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
        const accountsReceivable = accounts
            .filter(acc => acc.type === AccountType.ASSET_RECEIVABLE)
            .reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
        const accountsPayable = accounts
            .filter(acc => acc.type === AccountType.LIABILITY_PAYABLE)
            .reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            feesCollectedResult,
            overdueInvoicesResult,
            unreconciledLinesResult,
            recentEntries,
            bankStatements,
        ] = await Promise.all([
            prisma.feePayment.aggregate({ _sum: { amount: true } }),
            prisma.feeInvoice.aggregate({
                where: {
                    archived: false,
                    balance: { gt: 0 },
                    dueDate: { lt: today }
                },
                _sum: { balance: true }
            }),
            prisma.bankStatementLine.aggregate({
                where: { status: 'UNRECONCILED' },
                _sum: { amount: true },
                _count: true
            }),
            prisma.journalEntry.findMany({
                where: { status: 'POSTED' },
                take: 5,
                orderBy: { date: 'desc' },
                include: { journal: true, items: { include: { account: true } } }
            }),
            prisma.bankStatement.findMany({
                orderBy: { updatedAt: 'desc' },
                include: { account: true },
            }),
        ]);

        const feesCollected = Number(feesCollectedResult._sum.amount || 0);
        const overdueBalance = Number(overdueInvoicesResult._sum.balance || 0);
        const pendingReconciliation = Math.abs(Number(unreconciledLinesResult._sum.amount || 0));
        const latestStatementByAccount = new Map<string, typeof bankStatements[number]>();
        bankStatements.forEach((statement) => {
            if (!latestStatementByAccount.has(statement.accountId)) {
                latestStatementByAccount.set(statement.accountId, statement);
            }
        });
        const bankAccounts = accounts
            .filter(acc => acc.type === AccountType.ASSET_CASH)
            .map((account: any) => {
                const latestStatement = latestStatementByAccount.get(account.id);
                return {
                    id: account.id,
                    name: account.name,
                    bankName: account.name,
                    accountNumber: account.code,
                    balance: Number(account.balance || 0),
                    lastReconciled: latestStatement?.updatedAt || null,
                    statementStatus: latestStatement?.status || 'NO_STATEMENT',
                };
            });

        return {
            cashActual: cashOnHand,
            cashOnHand,
            accountsReceivable,
            accountsPayable,
            feesCollected,
            netProfit: report.profitLoss.netProfit,
            overdueBalance,
            pendingReconciliation,
            pendingReconciliationCount: unreconciledLinesResult._count,
            bankAccounts,
            recentEntries: recentEntries.map(e => {
                const totalDebit = e.items.reduce((sum, item) => sum + Number(item.debit || 0), 0);
                const totalCredit = e.items.reduce((sum, item) => sum + Number(item.credit || 0), 0);
                const amount = Math.max(totalDebit, totalCredit);

                const entryType = e.journal.type === 'SALES'
                    ? 'INCOME'
                    : ['CASH', 'BANK'].includes(e.journal.type)
                        ? 'RECEIPT'
                        : 'EXPENSE';

                return {
                    id: e.id,
                    date: e.date,
                    description: e.reference || e.items[0]?.label || e.journal.name || 'Journal Entry',
                    type: entryType,
                    amount,
                    status: e.status
                };
            })
        };
    }
}

export const accountingService = new AccountingService();
