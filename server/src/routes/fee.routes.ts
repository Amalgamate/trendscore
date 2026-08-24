/**
 * Fee Management Routes
 * Handles fee structures, invoices, payments, waivers, comments, and pledges.
 *
 * Changes vs previous version:
 *  - Added PATCH /invoices/:id/cancel (wires up the previously-dead CANCELLED status)
 *  - All waiver routes consolidated here (removed stray import block at the bottom)
 *  - Comments & Pledges routes kept after payment routes for readability
 *
 * FIX (Task 3 — P2): Added PATCH /invoices/:id route to update dueDate /
 *   totalAmount before any payment is recorded. Guarded by updateInvoiceSchema.
 *
 * FIX (Task 5 — P2): Added bulkGenerateInvoicesSchema Zod validation on
 *   POST /invoices/bulk (was previously unvalidated).
 *
 * FIX (Task 6 — P3): Changed DELETE /invoices/reset → POST /invoices/reset.
 *   The DELETE pattern clashed with DELETE /invoices/:id if the router ever
 *   processed routes in a different order. POST makes the intent explicit and
 *   avoids the ambiguity entirely.
 *
 * FIX (Bug High): processPaymentSchema: amount changed from .min(0) to
 *   .positive() — zero-amount payments were previously accepted, creating empty
 *   FeePayment records and polluting the ledger.
 */

import { Router } from 'express';
import { FeeController } from '../controllers/fee.controller';
import { feeWaiverController } from '../controllers/feeWaiver.controller';
import { feeCommentsController } from '../controllers/feeComments.controller';
import { learnerFeeConfigurationController } from '../controllers/learnerFeeConfiguration.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAnyPermission, requirePermission, requireRole, ResourceAccessControl, auditLog } from '../middleware/permissions.middleware';
import { requireSchoolContext } from '../middleware/school.middleware';
import { asyncHandler } from '../utils/async.util';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { z } from 'zod';

import feeTypeRoutes from './feeType.routes';

const router = Router();
const feeController = new FeeController();

// ─── Validation Schemas ────────────────────────────────────────────────────

const feeStructureItemSchema = z.object({
  feeTypeId: z.string().min(1),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  mandatory: z.boolean().optional()
});

const createFeeStructureSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  grade: z.string().optional(),
  term: z.string().optional(),
  academicYear: z.number().int().min(2000),
  mandatory: z.boolean().optional(),
  active: z.boolean().optional(),
  feeItems: z.array(feeStructureItemSchema).min(1)
});

const updateFeeStructureSchema = createFeeStructureSchema.partial();

// FIX (Bug High): amount must be positive — .min(0) allowed zero-amount
// payments that pollute the ledger without changing invoice status.
const processPaymentSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  learnerId: z.string().min(1).optional(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MPESA', 'CARD', 'OTHER']),
  paymentDate: z.string().min(1).optional(),
  referenceNumber: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  payerType: z.enum(['STUDENT', 'SPONSOR']).optional(),
  allocatedTuition: z.number().nonnegative().optional(),
  allocatedTransport: z.number().nonnegative().optional()
}).superRefine((data, ctx) => {
  if (!data.invoiceId && !data.learnerId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Either invoiceId or learnerId must be provided' });
  }
  if (data.allocatedTuition !== undefined && data.allocatedTransport !== undefined) {
    if (data.allocatedTuition + data.allocatedTransport > data.amount + 0.01) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Allocated amounts cannot exceed total payment amount' });
    }
  }
});

const markInvoicePaidSchema = z.object({
  paymentDate: z.string().min(1, 'paymentDate is required'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MPESA', 'CARD', 'OTHER']).default('OTHER'),
  referenceNumber: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

const bulkMarkInvoicesPaidSchema = markInvoicePaidSchema.extend({
  invoiceIds: z.array(z.string().min(1)).min(1, 'Select at least one invoice').max(500, 'Bulk mark paid is limited to 500 invoices at a time')
});

// FIX (Task 3 — P2): Validation for PATCH /invoices/:id
// At least one of dueDate or totalAmount must be supplied.
const updateInvoiceSchema = z.object({
  dueDate: z.string().optional(),
  totalAmount: z.number().positive().optional()
}).refine(
  (data) => data.dueDate !== undefined || data.totalAmount !== undefined,
  { message: 'Provide at least one field to update: dueDate or totalAmount' }
);

// FIX (Task 5 — P2): Validation for POST /invoices/bulk (was previously missing)
const bulkGenerateInvoicesSchema = z.object({
  feeStructureId: z.string().optional(),
  term: z.string().min(1, 'term is required'),
  academicYear: z.number().int().min(2000, 'academicYear must be a valid year'),
  dueDate: z.string().min(1, 'dueDate is required'),
  grade: z.string().optional(),
  stream: z.string().optional(),
  scope: z.enum(['GRADE_STREAM', 'WHOLE_SCHOOL']).optional()
}).superRefine((data, ctx) => {
  const scope = data.scope || 'GRADE_STREAM';
  if (scope === 'WHOLE_SCHOOL') return;
  if (!data.feeStructureId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'feeStructureId is required for grade/stream bulk generation' });
  }
  if (!data.grade) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'grade is required for grade/stream bulk generation' });
  }
});

const createWaiverSchema = z.object({
  invoiceId: z.string().min(1),
  amountWaived: z.union([z.string(), z.number()]).transform((v) => typeof v === 'string' ? parseFloat(v) : v),
  reason: z.string().min(5).max(500),
  waiverCategory: z.enum(['HARDSHIP', 'DISABILITY', 'SCHOLARSHIP', 'OTHER']).optional()
});

const rejectWaiverSchema = z.object({
  rejectionReason: z.string().min(5).max(500)
});

const cancelInvoiceSchema = z.object({
  reason: z.string().max(500).optional()
});

const feeAdjustmentSchema = z.object({
  feeTypeId: z.string().min(1),
  mode: z.enum([
    'STANDARD', 'EXEMPT', 'FIXED_STUDENT_AMOUNT', 'PERCENT_DISCOUNT',
    'FIXED_DISCOUNT', 'SPONSOR_FULL', 'SPONSOR_FIXED', 'SPONSOR_PERCENT',
    'CUSTOM_AMOUNT', 'EXCLUDE'
  ]),
  value: z.union([z.string(), z.number()]).optional(),
  included: z.boolean().optional(),
});

const feeConfigurationSchema = z.object({
  learnerId: z.string().min(1),
  name: z.string().min(2).max(120),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL']).optional(),
  startTerm: z.enum(['TERM_1', 'TERM_2', 'TERM_3']),
  startAcademicYear: z.number().int().min(2000),
  endTerm: z.enum(['TERM_1', 'TERM_2', 'TERM_3']).nullable().optional(),
  endAcademicYear: z.number().int().min(2000).nullable().optional(),
  fullExemption: z.boolean().optional(),
  sponsorName: z.string().max(150).nullable().optional(),
  sponsorReference: z.string().max(150).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  adjustments: z.array(feeAdjustmentSchema),
});

// ─── Global Middleware ─────────────────────────────────────────────────────

router.use(authenticate, requireSchoolContext);

// ─── Fee Types ─────────────────────────────────────────────────────────────

router.use('/types', rateLimit({ windowMs: 60_000, maxRequests: 50 }), feeTypeRoutes);

// ─── Fee Structures ────────────────────────────────────────────────────────

router.get(
  '/structures',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeController.getAllFeeStructures.bind(feeController))
);

router.post(
  '/structures',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createFeeStructureSchema),
  auditLog('CREATE_FEE_STRUCTURE'),
  asyncHandler(feeController.createFeeStructure.bind(feeController))
);

router.put(
  '/structures/:id',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(updateFeeStructureSchema),
  auditLog('UPDATE_FEE_STRUCTURE'),
  asyncHandler(feeController.updateFeeStructure.bind(feeController))
);

router.delete(
  '/structures/:id',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  auditLog('DELETE_FEE_STRUCTURE'),
  asyncHandler(feeController.deleteFeeStructure.bind(feeController))
);

// ─── Learner Fee Configurations ─────────────────────────────────────────────

router.get(
  '/configurations/learner/:learnerId',
  requirePermission('FEE_MANAGEMENT'),
  asyncHandler(learnerFeeConfigurationController.list.bind(learnerFeeConfigurationController))
);

router.post(
  '/configurations',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  validate(feeConfigurationSchema),
  auditLog('CREATE_LEARNER_FEE_CONFIGURATION'),
  asyncHandler(learnerFeeConfigurationController.create.bind(learnerFeeConfigurationController))
);

router.patch(
  '/configurations/:id',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  validate(feeConfigurationSchema.partial()),
  auditLog('UPDATE_LEARNER_FEE_CONFIGURATION'),
  asyncHandler(learnerFeeConfigurationController.update.bind(learnerFeeConfigurationController))
);

router.patch(
  '/configurations/:id/approve',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('APPROVE_LEARNER_FEE_CONFIGURATION'),
  asyncHandler(learnerFeeConfigurationController.approve.bind(learnerFeeConfigurationController))
);

router.patch(
  '/configurations/:id/revoke',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('REVOKE_LEARNER_FEE_CONFIGURATION'),
  asyncHandler(learnerFeeConfigurationController.revoke.bind(learnerFeeConfigurationController))
);

router.post(
  '/configurations/preview',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  asyncHandler(learnerFeeConfigurationController.preview.bind(learnerFeeConfigurationController))
);

// ─── Invoices ──────────────────────────────────────────────────────────────

router.get(
  '/invoices',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeController.getAllInvoices.bind(feeController))
);

router.get(
  '/invoices/aggregates',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeController.getInvoiceAggregates.bind(feeController))
);

router.get(
  '/invoices/export',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('EXPORT_INVOICES'),
  asyncHandler(feeController.exportInvoices.bind(feeController))
);

router.get(
  '/invoices/learner/:learnerId',
  requireAnyPermission(['FEE_MANAGEMENT', 'VIEW_OWN_BALANCE']),
  ResourceAccessControl.canAccessLearner(),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeController.getLearnerInvoices.bind(feeController))
);

router.post(
  '/invoices/learner/:learnerId/email',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('EMAIL_FEE_STATEMENT'),
  asyncHandler(feeController.emailStatement.bind(feeController))
);

router.post(
  '/invoices',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('CREATE_INVOICE'),
  asyncHandler(feeController.createInvoice.bind(feeController))
);

/**
 * @route   POST /api/fees/invoices/bulk
 * @desc    Bulk generate invoices for a whole grade/stream.
 *          FIX (Task 5 — P2): Zod validation now applied (was previously missing).
 */
router.post(
  '/invoices/bulk',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(bulkGenerateInvoicesSchema),
  auditLog('BULK_CREATE_INVOICES'),
  asyncHandler(feeController.bulkGenerateInvoices.bind(feeController))
);

router.post(
  '/invoices/mark-paid/bulk',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  validate(bulkMarkInvoicesPaidSchema),
  auditLog('BULK_MARK_INVOICES_PAID'),
  asyncHandler(feeController.bulkMarkInvoicesPaid.bind(feeController))
);

router.post(
  '/invoices/:id/mark-paid',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(markInvoicePaidSchema),
  auditLog('MARK_INVOICE_PAID'),
  asyncHandler(feeController.markInvoicePaid.bind(feeController))
);

/**
 * @route   PATCH /api/fees/invoices/:id
 * @desc    Edit dueDate or totalAmount before any payment is recorded.
 *          FIX (Task 3 — P2): New route. Controller guards paidAmount === 0.
 */
router.patch(
  '/invoices/:id',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(updateInvoiceSchema),
  auditLog('UPDATE_INVOICE'),
  asyncHandler(feeController.updateInvoice.bind(feeController))
);

router.post(
  '/invoices/:id/revise-configuration',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  auditLog('REVISE_INVOICE_FROM_FEE_CONFIGURATION'),
  asyncHandler(feeController.reviseInvoiceFromConfiguration.bind(feeController))
);

/**
 * @route   PATCH /api/fees/invoices/:id/cancel
 * @desc    Cancel an invoice (sets status → CANCELLED). Admin/Super Admin only.
 */
router.patch(
  '/invoices/:id/cancel',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(cancelInvoiceSchema),
  auditLog('CANCEL_INVOICE'),
  asyncHandler(feeController.cancelInvoice.bind(feeController))
);

/**
 * @route   POST /api/fees/invoices/reset
 * @desc    Reset all invoices for a given academicYear + term (SUPER_ADMIN only).
 */
router.post(
  '/invoices/reset',
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('RESET_INVOICES'),
  asyncHandler(feeController.resetInvoices.bind(feeController))
);

router.post(
  '/maintenance/reset-all',
  requireRole(['SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 3 }),
  auditLog('TOTAL_ACCOUNTING_RESET'),
  asyncHandler(feeController.resetAllAccounting.bind(feeController))
);

router.post(
  '/invoices/:id/remind',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(feeController.sendInvoiceReminder.bind(feeController))
);

router.post(
  '/invoices/remind/bulk',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  asyncHandler(feeController.bulkSendReminders.bind(feeController))
);

// ─── Comments & Pledges ────────────────────────────────────────────────────

router.get(
  '/pledges',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeCommentsController.listPledges.bind(feeCommentsController))
);

router.post(
  '/pledges/reminders/run',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 5 }),
  auditLog('RUN_FEE_PLEDGE_REMINDERS'),
  asyncHandler(feeCommentsController.runPledgeReminderCheck.bind(feeCommentsController))
);

router.get(
  '/invoices/:id/comments',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeCommentsController.listComments.bind(feeCommentsController))
);

router.post(
  '/invoices/:id/comments',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  auditLog('ADD_FEE_COMMENT'),
  asyncHandler(feeCommentsController.addComment.bind(feeCommentsController))
);

router.post(
  '/invoices/:id/pledges',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  auditLog('RECORD_FEE_PLEDGE'),
  asyncHandler(feeCommentsController.addPledge.bind(feeCommentsController))
);

router.patch(
  '/pledges/:pledgeId/cancel',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('CANCEL_FEE_PLEDGE'),
  asyncHandler(feeCommentsController.cancelPledge.bind(feeCommentsController))
);

router.patch(
  '/pledges/:pledgeId/fulfil',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('FULFIL_FEE_PLEDGE'),
  asyncHandler(feeCommentsController.fulfilPledge.bind(feeCommentsController))
);

// ─── Payments ──────────────────────────────────────────────────────────────

router.post(
  '/payments',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(processPaymentSchema),
  auditLog('RECORD_PAYMENT'),
  asyncHandler(feeController.recordPayment.bind(feeController))
);

// ─── Stats ─────────────────────────────────────────────────────────────────

router.patch(
  '/payments/:id/reverse',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('REVERSE_PAYMENT'),
  asyncHandler(feeController.reversePayment.bind(feeController))
);

router.get(
  '/stats',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(feeController.getPaymentStats.bind(feeController))
);

// ─── Fee Waivers ───────────────────────────────────────────────────────────

router.post(
  '/waivers',
  requireRole(['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  validate(createWaiverSchema),
  auditLog('CREATE_FEE_WAIVER'),
  asyncHandler(feeWaiverController.createWaiver.bind(feeWaiverController))
);

router.get(
  '/waivers',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 50 }),
  asyncHandler(feeWaiverController.listWaivers.bind(feeWaiverController))
);

router.get(
  '/waivers/:id',
  requirePermission('FEE_MANAGEMENT'),
  rateLimit({ windowMs: 60_000, maxRequests: 100 }),
  asyncHandler(feeWaiverController.getWaiverById.bind(feeWaiverController))
);

router.patch(
  '/waivers/:id/approve',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('APPROVE_FEE_WAIVER'),
  asyncHandler(feeWaiverController.approveWaiver.bind(feeWaiverController))
);

router.patch(
  '/waivers/:id/reject',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  validate(rejectWaiverSchema),
  auditLog('REJECT_FEE_WAIVER'),
  asyncHandler(feeWaiverController.rejectWaiver.bind(feeWaiverController))
);

router.delete(
  '/waivers/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  rateLimit({ windowMs: 60_000, maxRequests: 20 }),
  auditLog('DELETE_FEE_WAIVER'),
  asyncHandler(feeWaiverController.deleteWaiver.bind(feeWaiverController))
);

export default router;
