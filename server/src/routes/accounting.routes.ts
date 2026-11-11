import { Router } from 'express';
import { z } from 'zod';
import { accountingController } from '../controllers/accounting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { auditLog, requireRole } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

const ROLE_FINANCE_ACCESS = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] as const;

// Validation schemas
const createAccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['ASSET_NON_CURRENT', 'ASSET_RECEIVABLE', 'ASSET_CASH', 'ASSET_CURRENT', 'LIABILITY_PAYABLE', 'LIABILITY_CURRENT', 'LIABILITY_NON_CURRENT', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().optional()
});

const createJournalEntrySchema = z.object({
  // Accept both full ISO datetime and bare date strings (YYYY-MM-DD)
  date: z.string().optional(),
  reference: z.string().optional(),
  journalId: z.string().min(1),
  items: z.array(z.object({
    accountId: z.string().min(1),
    debit: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
    label: z.string().optional()
  })).min(2, 'A journal entry requires at least 2 line items')
});

const createVendorSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  address: z.string().max(500).optional()
});

const recordExpenseSchema = z.object({
  vendorId: z.string().min(1).optional(),
  amount: z.number().finite().positive('Expense amount must be greater than zero'),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  date: z.string().datetime().optional(),
  accountId: z.string().min(1),
  paymentAccountId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER']).optional(),
  reference: z.string().trim().max(150).optional()
});

// ============================================
// CHART OF ACCOUNTS & JOURNALS
// ============================================

/**
 * @route   GET /api/accounting/accounts
 * @desc    Get chart of accounts
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/accounts',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  accountingController.getAccounts
);

/**
 * @route   POST /api/accounting/accounts
 * @desc    Create new account
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/accounts',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  validate(createAccountSchema),
  auditLog('CREATE_ACCOUNT'),
  accountingController.createAccount
);

/**
 * @route   GET /api/accounting/journals
 * @desc    Get all journals
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/journals',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  accountingController.getJournals
);

/**
 * @route   POST /api/accounting/initialize
 * @desc    Initialize chart of accounts
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/initialize',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('INITIALIZE_CHART_OF_ACCOUNTS'),
  accountingController.initializeCoA
);

// ============================================
// JOURNAL ENTRIES
// ============================================

/**
 * @route   POST /api/accounting/entries
 * @desc    Create journal entry
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/entries',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createJournalEntrySchema),
  auditLog('CREATE_JOURNAL_ENTRY'),
  accountingController.createJournalEntry
);

/**
 * @route   PUT /api/accounting/entries/:id/post
 * @desc    Post journal entry (commit)
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.put(
  '/entries/:id/post',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('POST_JOURNAL_ENTRY'),
  accountingController.postJournalEntry
);

/**
 * @route   GET /api/accounting/entries
 * @desc    Get journal entries with filters
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/entries',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  accountingController.getJournalEntries
);

// ============================================
// ACCOUNTING REPORTS
// ============================================

/**
 * @route   GET /api/accounting/reports/trial-balance
 * @desc    Get trial balance report
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/reports/trial-balance',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
    accountingController.getTrialBalance
);

/**
 * @route   GET /api/accounting/dashboard-stats
 * @desc    Get dashboard metrics (Cash, AR, AP, Net Profit)
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/dashboard-stats',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  accountingController.getDashboardStats
);

// ============================================
// VENDOR & EXPENSE MANAGEMENT
// ============================================

/**
 * @route   GET /api/accounting/vendors
 * @desc    Get all vendors
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/vendors',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  accountingController.getVendors
);

/**
 * @route   POST /api/accounting/vendors
 * @desc    Create vendor
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/vendors',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createVendorSchema),
  auditLog('CREATE_VENDOR'),
  accountingController.createVendor
);

/**
 * @route   GET /api/accounting/expenses
 * @desc    Get all recorded expenses
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/expenses',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  accountingController.getExpenses
);

/**
 * @route   POST /api/accounting/expenses
 * @desc    Record expense
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/expenses',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(recordExpenseSchema),
  auditLog('RECORD_EXPENSE'),
  accountingController.recordExpense
);

// ============================================
// BANK & RECONCILIATION
// ============================================

/**
 * @route   GET /api/accounting/bank-statements
 * @desc    Get bank statements
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/bank-statements',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  accountingController.getBankStatements
);

/**
 * @route   POST /api/accounting/bank-statements/import
 * @desc    Import bank statement (CSV/OFX)
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/bank-statements/import',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('IMPORT_BANK_STATEMENT'),
  accountingController.importBankStatement
);

/**
 * @route   POST /api/accounting/bank-statements/reconcile
 * @desc    Reconcile bank entry
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
  '/bank-statements/reconcile',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('RECONCILE_BANK_ENTRY'),
  accountingController.reconcileLine
);

/**
 * @route   GET /api/accounting/bank-statements/:lineId/suggest-matches
 * @desc    Get suggested journal matches for a bank line
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
  '/bank-statements/:lineId/suggest-matches',
  authenticate,
  requireRole([...ROLE_FINANCE_ACCESS]),
  accountingController.suggestMatches
);

export default router;


