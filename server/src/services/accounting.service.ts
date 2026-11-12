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
        { code: '5300', name: 'Rent Expense', type: AccountType.EXPENSE },
        { code: '5400', name: 'Fee Waivers & Discounts', type: AccountType.EXPENSE },
        { code: '5500', name: 'M-Pesa Transaction Charges', type: AccountType.EXPENSE }
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
    }, client: any = prisma) {
        const totalDebit = data.items.reduce((sum, item) => sum + (item.debit || 0), 0);
        const totalCredit = data.items.reduce((sum, item) => sum + (item.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Unbalanced Journal Entry: Debits (${totalDebit}) do not equal Credits (${totalCredit})`);
        }

        return client.journalEntry.create({
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

    async postJournalEntry(entryId: string, client: any = prisma) {
        const entry = await client.journalEntry.findUnique({
            where: { id: entryId },
            include: { items: true }
        });

        if (!entry) throw new Error('Journal Entry not found');
        if (entry.status === 'POSTED') throw new Error('Entry already posted');

        return client.journalEntry.update({
            where: { id: entryId },
            data: { status: 'POSTED' }
        });
    }

    async getAccountByCode(code: string, client: any = prisma) {
        // Transaction-scoped reads must use the same connection/snapshot as the
        // journal writes. Do not use the process cache for those reads.
        if (client !== prisma) return client.account.findUnique({ where: { code } });
        if (this.accountByCodeCache.has(code)) {
            return this.accountByCodeCache.get(code);
        }
        const account = await prisma.account.findUnique({ where: { code } });
        if (account) this.accountByCodeCache.set(code, account);
        return account;
    }

    async getJournalByCode(code: string, client: any = prisma) {
        if (client !== prisma) return client.journal.findUnique({ where: { code } });
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
     * Cr: Transport Revenue (4100) for transport portion
     * Cr: Tuition Revenue (4000) for tuition portion
     */
    async postFeeInvoiceToLedger(invoice: any, client: any = prisma): Promise<any> {
        if (client === prisma) {
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            return prisma.$transaction(
                (tx) => this.postFeeInvoiceToLedger(invoice, tx),
                { isolationLevel: 'Serializable' },
            );
        }

        const totalAmount = Number(invoice.totalAmount || 0) + Number(invoice.sponsorAmount || 0);
        const invoiceNumber = invoice.invoiceNumber;
        const transportAmount = Math.min(Number(invoice.transportBilled || 0), totalAmount);
        const tuitionAmount = Math.max(0, totalAmount - transportAmount);

        let arAccount = await this.getAccountByCode('1100', client);
        let revenueAccount = await this.getAccountByCode('4000', client);
        let transportAccount = await this.getAccountByCode('4100', client);
        let salesJournal = await this.getJournalByCode('INV', client);

        if (!arAccount || !revenueAccount || !transportAccount || !salesJournal) {
            throw new Error(`Required accounting setup is missing for fee invoice ${invoiceNumber}.`);
        }

        const existingEntry = await client.journalEntry.findFirst({
            where: { journalId: salesJournal.id, reference: invoiceNumber },
            include: { items: true },
        });
        if (existingEntry?.status === 'DRAFT') return this.postJournalEntry(existingEntry.id, client);

        const postedInvoiceEntries = await client.journalEntry.findMany({
            where: {
                journalId: salesJournal.id,
                status: 'POSTED',
                OR: [
                    { reference: invoiceNumber },
                    { reference: { startsWith: `${invoiceNumber}-REV-` } },
                ],
            },
            include: { items: { include: { account: { select: { code: true } } } } },
        });
        if (postedInvoiceEntries.length > 0) {
            let previousReceivable = 0;
            let previousTransport = 0;
            let latestRevision = 0;
            for (const postedEntry of postedInvoiceEntries) {
                const revisionMatch = String(postedEntry.reference || '').match(/-REV-(\d+)$/);
                if (revisionMatch) latestRevision = Math.max(latestRevision, Number(revisionMatch[1]));
                for (const item of postedEntry.items) {
                    const debit = Number(item.debit || 0);
                    const credit = Number(item.credit || 0);
                    if (item.account.code === '1100') previousReceivable += debit - credit;
                    if (item.account.code === '4100') previousTransport += credit - debit;
                }
            }

            const nextReceivable = Number(totalAmount.toFixed(2));
            const nextTransport = Number(transportAmount.toFixed(2));
            if (Math.abs(previousReceivable - nextReceivable) > 0.01 || Math.abs(previousTransport - nextTransport) > 0.01) {
                return this.postFeeInvoiceRevisionToLedger(
                    invoiceNumber,
                    latestRevision + 1,
                    nextReceivable - previousReceivable,
                    client,
                    {
                        oldTotalAmount: previousReceivable,
                        newTotalAmount: nextReceivable,
                        oldTransportAmount: previousTransport,
                        newTransportAmount: nextTransport,
                    },
                );
            }
            return postedInvoiceEntries[0];
        }

        const entryDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
        const items: any[] = [
            { accountId: arAccount.id, debit: Number(totalAmount), label: `Fees Receivable: Invoice ${invoiceNumber}` }
        ];

        if (transportAmount > 0 && transportAccount) {
            items.push({
                accountId: transportAccount.id,
                credit: Number(transportAmount),
                label: `Transport Revenue: Invoice ${invoiceNumber}`
            });
        }

        if (tuitionAmount > 0) {
            items.push({
                accountId: revenueAccount.id,
                credit: Number(tuitionAmount),
                label: `Tuition Revenue: Invoice ${invoiceNumber}`
            });
        }

        // Fallback in case both were 0 or transportAccount missing
        if (items.length === 1) {
            items.push({
                accountId: revenueAccount.id,
                credit: Number(totalAmount),
                label: `Fee Revenue: Invoice ${invoiceNumber}`
            });
        }

        const entry = await this.createJournalEntry({
            journalId: salesJournal.id,
            reference: invoiceNumber,
            date: entryDate,
            items
        }, client);

        return this.postJournalEntry(entry.id, client);
    }

    async postFeeInvoiceRevisionToLedger(
        invoiceNumber: string,
        revisionNumber: number,
        delta: number,
        client: any = prisma,
        breakdown?: {
            oldTotalAmount: number;
            newTotalAmount: number;
            oldTransportAmount: number;
            newTransportAmount: number;
        },
    ) {
        const roundCurrency = (value: number) => Number(Number(value || 0).toFixed(2));
        const receivableDelta = roundCurrency(breakdown
            ? breakdown.newTotalAmount - breakdown.oldTotalAmount
            : delta);
        const transportDelta = breakdown
            ? roundCurrency(breakdown.newTransportAmount - breakdown.oldTransportAmount)
            : 0;
        const tuitionDelta = breakdown
            ? roundCurrency(receivableDelta - transportDelta)
            : receivableDelta;
        if (Math.abs(receivableDelta) < 0.01
            && Math.abs(transportDelta) < 0.01
            && Math.abs(tuitionDelta) < 0.01) return;
        if (Math.abs(receivableDelta - tuitionDelta - transportDelta) > 0.01) {
            throw new Error('Invoice revision ledger split does not balance to the accounts receivable change.');
        }
        const reference = `${invoiceNumber}-REV-${revisionNumber}`;
        // The deterministic reference makes retries idempotent. Serializing
        // the enclosing invoice transaction also prevents concurrent reposts.
        const existing = await client.journalEntry.findFirst({
            where: { reference },
            include: { items: true },
        });
        if (existing?.status === 'POSTED') return existing;
        if (existing?.status === 'DRAFT') return this.postJournalEntry(existing.id, client);

        let arAccount = await this.getAccountByCode('1100', client);
        let revenueAccount = await this.getAccountByCode('4000', client);
        let transportAccount = transportDelta ? await this.getAccountByCode('4100', client) : null;
        let salesJournal = await this.getJournalByCode('INV', client);
        if (!arAccount || !revenueAccount || (transportDelta && !transportAccount) || !salesJournal) {
            // Never initialize accounting setup through global Prisma while a
            // caller's transaction is open: that would escape atomicity.
            if (client !== prisma) throw new Error('Accounting setup is missing; initialize the chart of accounts before revising invoices.');
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            arAccount = await this.getAccountByCode('1100', client);
            revenueAccount = await this.getAccountByCode('4000', client);
            transportAccount = transportDelta ? await this.getAccountByCode('4100', client) : null;
            salesJournal = await this.getJournalByCode('INV', client);
        }
        if (!arAccount || !revenueAccount || (transportDelta && !transportAccount) || !salesJournal) {
            throw new Error('Required accounts receivable, fee revenue, transport revenue, or invoice journal could not be loaded.');
        }
        const items: { accountId: string; debit?: number; credit?: number; label: string }[] = [];
        if (receivableDelta > 0) {
            items.push({ accountId: arAccount.id, debit: receivableDelta, label: `Invoice revision increase: ${invoiceNumber}` });
        } else if (receivableDelta < 0) {
            items.push({ accountId: arAccount.id, credit: Math.abs(receivableDelta), label: `Invoice revision reduction: ${invoiceNumber}` });
        }
        if (tuitionDelta > 0) {
            items.push({ accountId: revenueAccount.id, credit: tuitionDelta, label: `Tuition revenue revision: ${invoiceNumber}` });
        } else if (tuitionDelta < 0) {
            items.push({ accountId: revenueAccount.id, debit: Math.abs(tuitionDelta), label: `Tuition revenue reduction: ${invoiceNumber}` });
        }
        if (transportDelta > 0 && transportAccount) {
            items.push({ accountId: transportAccount.id, credit: transportDelta, label: `Transport revenue revision: ${invoiceNumber}` });
        } else if (transportDelta < 0 && transportAccount) {
            items.push({ accountId: transportAccount.id, debit: Math.abs(transportDelta), label: `Transport revenue reduction: ${invoiceNumber}` });
        }
        const entry = await this.createJournalEntry({
            journalId: salesJournal.id,
            reference,
            date: new Date(),
            items,
        }, client);
        return this.postJournalEntry(entry.id, client);
    }

    /**
     * Reverse the posted invoice and its posted revisions as one balanced
     * cancellation entry. Pass an interactive transaction client when the
     * caller is cancelling the invoice so ledger and invoice status commit
     * atomically. The deterministic reference makes a repeated cancel safe.
     */
    async reverseFeeInvoiceLedger(invoiceNumber: string, client: any = prisma) {
        const reference = `${invoiceNumber}-CANCEL`;
        const existing = await client.journalEntry.findFirst({
            where: { reference },
            include: { items: true },
        });
        if (existing?.status === 'POSTED') return existing;
        if (existing?.status === 'DRAFT') return this.postJournalEntry(existing.id, client);

        const sourceEntries = await client.journalEntry.findMany({
            where: {
                status: 'POSTED',
                OR: [
                    { reference: invoiceNumber },
                    { reference: { startsWith: `${invoiceNumber}-REV-` } },
                ],
            },
            include: { items: true },
            orderBy: { date: 'asc' },
        });
        if (!sourceEntries.length) return null;

        const journalIds = [...new Set<string>(sourceEntries.map((entry: any) => String(entry.journalId)))];
        if (journalIds.length !== 1) {
            throw new Error(`Cannot cancel ${invoiceNumber}: its posted invoice entries span multiple journals.`);
        }

        const items = sourceEntries.flatMap((entry: any) => entry.items.map((item: any) => ({
            accountId: item.accountId,
            debit: Number(item.credit || 0),
            credit: Number(item.debit || 0),
            label: `Invoice cancellation reversal: ${invoiceNumber}`,
        })));
        const reversal = await this.createJournalEntry({
            journalId: journalIds[0],
            reference,
            date: new Date(),
            items,
        }, client);
        return this.postJournalEntry(reversal.id, client);
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
    async postFeePaymentToLedger(payment: any, method: string, client: any = prisma): Promise<any> {
        const { amount, receiptNumber } = payment;
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Fee payment ledger amount must be positive.');
        if (!String(receiptNumber || '').trim()) throw new Error('Fee payment receipt is required for ledger posting.');

        if (client === prisma) {
            const [asset, receivable, journal] = await Promise.all([
                this.getAccountByCode(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE'].includes(String(method).toUpperCase()) ? '1210' : '1200'),
                this.getAccountByCode('1100'),
                this.getJournalByCode(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE'].includes(String(method).toUpperCase()) ? 'BNK1' : 'CSH1'),
            ]);
            if (!asset || !receivable || !journal) {
                await this.ensureDefaultAccountingSetup();
                this.clearCache();
            }
            return prisma.$transaction(
                (tx) => this.postFeePaymentToLedger(payment, method, tx),
                { isolationLevel: 'Serializable' },
            );
        }

        // FIX: MPESA, BANK_TRANSFER, CARD, and CHEQUE all go to the bank account.
        // Only CASH and OTHER go to Cash in Hand.
        const bankMethods = new Set(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE']);
        const isBank = bankMethods.has(method?.toUpperCase?.() ?? method);

        const assetCode = isBank ? '1210' : '1200';
        const journalCode = isBank ? 'BNK1' : 'CSH1';

        const [assetAccount, arAccount, journal] = await Promise.all([
            this.getAccountByCode(assetCode, client),
            this.getAccountByCode('1100', client),
            this.getJournalByCode(journalCode, client),
        ]);

        if (!assetAccount || !arAccount || !journal) {
            throw new Error('Required fee payment accounts or journal are not configured; payment ledger posting was not completed.');
        }

        // Receipt numbers are unique payment references. Reuse a prior draft
        // (for example after a process interruption) and never create a second
        // ledger entry when a provider retries its callback.
        const existingEntry = await client.journalEntry.findFirst({
            where: { journalId: journal.id, reference: receiptNumber },
            include: { items: true },
        });
        if (existingEntry) {
            if (existingEntry.status === 'DRAFT') return this.postJournalEntry(existingEntry.id, client);
            return existingEntry;
        }

        const entryDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
        const entry = await this.createJournalEntry({
            journalId: journal.id,
            reference: receiptNumber,
            date: entryDate,
            items: [
                { accountId: assetAccount.id, debit: numericAmount, label: `Fee Payment Received: ${receiptNumber}` },
                { accountId: arAccount.id, credit: numericAmount, label: `Settlement: ${receiptNumber}` }
            ]
        }, client);

        return this.postJournalEntry(entry.id, client);
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
        paymentMethod?: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';
        vendorId?: string;
        reference?: string;
    }) {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Expense amount must be greater than zero.');
        }
        if (!data.description?.trim() || !data.category?.trim()) {
            throw new Error('Expense description and category are required.');
        }
        if (data.accountId === data.paymentAccountId) {
            throw new Error('Choose a separate expense account and payment account.');
        }

        const paymentMethod = data.paymentMethod || 'CASH';
        const expenseDate = data.date ? new Date(data.date) : new Date();
        if (Number.isNaN(expenseDate.getTime())) throw new Error('Expense date is invalid.');

        return prisma.$transaction(async (tx) => {
            const [expenseAccount, paymentAccount, journal, vendor] = await Promise.all([
                tx.account.findUnique({ where: { id: data.accountId } }),
                tx.account.findUnique({ where: { id: data.paymentAccountId } }),
                tx.journal.findUnique({ where: { code: 'MISC' } }),
                data.vendorId ? tx.vendor.findUnique({ where: { id: data.vendorId } }) : Promise.resolve(null),
            ]);

            if (!expenseAccount || !expenseAccount.isActive || expenseAccount.type !== AccountType.EXPENSE) {
                throw new Error('Choose an active expense account.');
            }
            if (!paymentAccount || !paymentAccount.isActive || paymentAccount.type !== AccountType.ASSET_CASH) {
                throw new Error('Choose an active cash or bank account for the payment.');
            }
            if (!journal || !journal.isActive) {
                throw new Error('The accounting journal is not configured. Initialize accounting and try again.');
            }
            if (data.vendorId && (!vendor || !vendor.isActive)) {
                throw new Error('Choose an active vendor or clear the vendor selection.');
            }

            const expense = await tx.expense.create({
                data: {
                    date: expenseDate,
                    amount,
                    description: data.description.trim(),
                    category: data.category.trim(),
                    vendorId: data.vendorId,
                    accountId: expenseAccount.id,
                    paymentMethod,
                    reference: data.reference?.trim() || null,
                    status: 'PAID',
                },
                include: { account: true, vendor: true },
            });

            const reference = data.reference?.trim() || `EXP-${expense.id.slice(0, 8)}`;
            const entry = await tx.journalEntry.create({
                data: {
                    journalId: journal.id,
                    reference,
                    date: expenseDate,
                    status: 'POSTED',
                    items: {
                        create: [
                            { accountId: expenseAccount.id, debit: amount, label: `Expense: ${data.description.trim()}` },
                            { accountId: paymentAccount.id, credit: amount, label: `Payment for: ${data.description.trim()}` },
                        ],
                    },
                },
            });

            if (!entry) throw new Error('Expense journal entry could not be posted.');
            return expense;
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

    /**
     * Post M-Pesa Transaction Charge to the Ledger
     *
     * Daraja STK Push transactions may incur a per-transaction charge. The
     * school bears this cost by default. The charge amount is configurable via
     * the MPESA_CHARGE_PER_TRANSACTION env var (default: 0 — many schools are
     * on a tariff where STK push is free).
     *
     * Entry:
     *   Dr: M-Pesa Transaction Charges 5500
     *   Cr: Main Bank Account 1210
     */
    async postMpesaCharge(paymentAmount: number, receiptNumber: string, client: any = prisma): Promise<void> {
        const charge = Number(process.env.MPESA_CHARGE_PER_TRANSACTION || 0);
        if (charge <= 0) return; // No charge configured — skip
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('M-Pesa fee payment amount must be positive.');
        if (!String(receiptNumber || '').trim()) throw new Error('M-Pesa receipt is required for charge posting.');

        if (client === prisma) {
            const [chargeAccount, bankAccount, journal] = await Promise.all([
                this.getAccountByCode('5500'), this.getAccountByCode('1210'), this.getJournalByCode('MISC'),
            ]);
            if (!chargeAccount || !bankAccount || !journal) {
                await this.ensureDefaultAccountingSetup();
                this.clearCache();
            }
            await prisma.$transaction(
                (tx) => this.postMpesaCharge(paymentAmount, receiptNumber, tx),
                { isolationLevel: 'Serializable' },
            );
            return;
        }

        const [chargeAccount, bankAccount, journal] = await Promise.all([
            this.getAccountByCode('5500', client),
            this.getAccountByCode('1210', client),
            this.getJournalByCode('MISC', client),
        ]);
        if (!chargeAccount || !bankAccount || !journal) {
            throw new Error('M-Pesa charge accounts or journal are not configured; charge posting was not completed.');
        }

        const reference = `MPESA-CHARGE/${receiptNumber}`;
        const existingEntry = await client.journalEntry.findFirst({
            where: { journalId: journal.id, reference },
            include: { items: true },
        });
        if (existingEntry) {
            if (existingEntry.status === 'DRAFT') await this.postJournalEntry(existingEntry.id, client);
            return;
        }
        const entry = await this.createJournalEntry({
            journalId: journal.id,
            reference,
            date: new Date(),
            items: [
                { accountId: chargeAccount.id, debit: charge, label: `M-Pesa transaction charge for KES ${paymentAmount} payment` },
                { accountId: bankAccount.id, credit: charge, label: 'Bank deduction: M-Pesa charge' },
            ],
        }, client);
        await this.postJournalEntry(entry.id, client);
    }

    /**
     * Post Refund Reversal to the Ledger
     *
     * When a refund is approved, the original payment's ledger entry must be
     * reversed. The original entry was:
     *   Dr Bank 1210 / Cr AR 1100
     *
     * The reversal entry is the mirror:
     *   Dr AR 1100 (reverses the original credit)
     *   Cr Bank 1210 (reverses the original debit)
     *
     * For cash refunds, Cr Cash in Hand 1200 instead.
     */
    /**
     * Post a payment reversal to the ledger when a payment is reversed
     * (archived) outside the refund workflow.
     *
     * This mirrors the original payment entry in reverse:
     *   Dr AR 1100  (restores the receivable that was settled)
     *   Cr Bank/Cash (reverses the asset that was debited)
     *
     * This ensures the ledger stays balanced even when a payment is reversed
     * directly rather than through the refund approval flow.
     */
    async postPaymentReversalToLedger(payment: any, method: string): Promise<void> {
        const { amount, receiptNumber } = payment;

        const bankMethods = new Set(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE']);
        const isBank = bankMethods.has(String(method).toUpperCase());
        const assetCode = isBank ? '1210' : '1200';
        const journalCode = isBank ? 'BNK1' : 'CSH1';

        let assetAccount = await this.getAccountByCode(assetCode);
        let arAccount = await this.getAccountByCode('1100');
        let journal = await this.getJournalByCode(journalCode);

        if (!assetAccount || !arAccount || !journal) {
            await this.ensureDefaultAccountingSetup();
            this.clearCache();
            assetAccount = await this.getAccountByCode(assetCode);
            arAccount = await this.getAccountByCode('1100');
            journal = await this.getJournalByCode(journalCode);
        }

        if (!assetAccount || !arAccount || !journal) {
            console.warn('[Accounting] Missing accounts/journal for payment reversal — skipping');
            return;
        }

        const reference = `REVERSAL/${receiptNumber}/${payment.id.slice(0, 8)}`;
        const entry = await this.createJournalEntry({
            journalId: journal.id,
            reference,
            date: new Date(),
            items: [
                { accountId: arAccount.id, debit: Number(amount), label: `Payment reversal: ${receiptNumber}` },
                { accountId: assetAccount.id, credit: Number(amount), label: `Reversal: ${receiptNumber}` },
            ],
        });

        await this.postJournalEntry(entry.id);
    }

    async postRefundToLedger(refund: any, originalMethod: string, client: any = prisma): Promise<void> {
        const { amount, receiptNumber } = refund;
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Refund ledger amount must be positive.');
        if (!String(receiptNumber || '').trim() || !String(refund.id || '').trim()) {
            throw new Error('Refund ID and payment receipt are required for ledger posting.');
        }

        if (client === prisma) {
            const bankMethods = new Set(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE']);
            const isBank = bankMethods.has(String(originalMethod).toUpperCase());
            const [assetAccount, arAccount, journal] = await Promise.all([
                this.getAccountByCode(isBank ? '1210' : '1200'),
                this.getAccountByCode('1100'),
                this.getJournalByCode(isBank ? 'BNK1' : 'CSH1'),
            ]);
            if (!assetAccount || !arAccount || !journal) {
                await this.ensureDefaultAccountingSetup();
                this.clearCache();
            }
            await prisma.$transaction(
                (tx) => this.postRefundToLedger(refund, originalMethod, tx),
                { isolationLevel: 'Serializable' },
            );
            return;
        }

        const bankMethods = new Set(['BANK_TRANSFER', 'MPESA', 'CARD', 'CHEQUE']);
        const isBank = bankMethods.has(String(originalMethod).toUpperCase());
        const assetCode = isBank ? '1210' : '1200';
        const journalCode = isBank ? 'BNK1' : 'CSH1';

        const [assetAccount, arAccount, journal] = await Promise.all([
            this.getAccountByCode(assetCode, client),
            this.getAccountByCode('1100', client),
            this.getJournalByCode(journalCode, client),
        ]);

        if (!assetAccount || !arAccount || !journal) {
            throw new Error('Refund accounts or journal are not configured; reversal posting was not completed.');
        }

        const reference = `REFUND/${receiptNumber}/${refund.id}`;
        const existingEntry = await client.journalEntry.findFirst({ where: { reference }, include: { items: true } });
        if (existingEntry?.status === 'POSTED') return;
        if (existingEntry) {
            await this.postJournalEntry(existingEntry.id, client);
            return;
        }
        const entry = await this.createJournalEntry({
            journalId: journal.id,
            reference,
            date: new Date(),
            items: [
                { accountId: arAccount.id, debit: numericAmount, label: `Refund reversal: ${receiptNumber}` },
                { accountId: assetAccount.id, credit: numericAmount, label: `Bank refund: ${receiptNumber}` },
            ],
        }, client);

        await this.postJournalEntry(entry.id, client);
    }
}

export const accountingService = new AccountingService();
