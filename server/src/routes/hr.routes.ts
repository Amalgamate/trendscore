import { Router } from 'express';
import { z } from 'zod';
import { hrController } from '../controllers/hr.controller';
import { authenticate } from '../middleware/auth.middleware';
import { auditLog, requireRole } from '../middleware/permissions.middleware';
import { validate } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/enhanced-rateLimit.middleware';

const router = Router();

const ROLE_HR_ADMIN = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'] as const;

// ── Validation schemas ───────────────────────────────────────────────────────

const leaveRequestSchema = z.object({
    leaveTypeId: z.string().min(1),
    startDate: z.string().min(8),
    endDate: z.string().min(8),
    reason: z.string().max(1000).optional()
});

const performanceSchema = z.object({
    userId: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    technicalRating: z.number().min(1).max(5),
    behavioralRating: z.number().min(1).max(5),
    collaborationRating: z.number().min(1).max(5),
    overallRating: z.number().min(1).max(5),
    comments: z.string().max(1000).optional(),
    goals: z.array(z.any()).optional(),
    status: z.string().optional()
});

const allowanceSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['HOUSE', 'TRAVEL', 'MEDICAL', 'COMMUTER', 'OTHER']),
    label: z.string().min(1).max(100),
    amount: z.number().min(0),
    isActive: z.boolean().optional()
});

const deductionSchema = z.object({
    id: z.string().optional(),
    type: z.enum(['LOAN', 'SACCO', 'ADVANCE', 'UNIFORM', 'OTHER']),
    label: z.string().min(1).max(100),
    amount: z.number().min(0),
    isRecurring: z.boolean().optional(),
    totalMonths: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
});

const voidPayrollSchema = z.object({
    reason: z.string().min(5, 'Reason must be at least 5 characters').max(500)
});

const attendanceLocationPayloadBodySchema = z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyMeters: z.number().min(0).max(100000).optional(),
    capturedAt: z.string().datetime().optional(),
    timestamp: z.string().datetime().optional(),
    source: z.string().min(1).max(50).optional(),
    metadata: z.record(z.unknown()).optional().nullable()
}).refine(
    (data) => (data.latitude === undefined) === (data.longitude === undefined),
    {
        message: 'latitude and longitude must be provided together',
        path: ['longitude']
    }
).refine(
    (data) => data.accuracyMeters === undefined || data.latitude !== undefined,
    {
        message: 'accuracyMeters requires latitude and longitude',
        path: ['accuracyMeters']
    }
);

const attendanceLocationPayloadSchema = z.preprocess(
    (value) => (value === undefined || value === null ? {} : value),
    attendanceLocationPayloadBodySchema
);

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get(
    '/dashboard',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 120 }),
    hrController.getDashboardStats
);

// ── Attendance ───────────────────────────────────────────────────────────────

router.post(
    '/attendance/clock-in',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 60 }),
    validate(attendanceLocationPayloadSchema),
    auditLog('STAFF_CLOCK_IN'),
    hrController.clockIn
);

router.post(
    '/attendance/clock-out',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 60 }),
    validate(attendanceLocationPayloadSchema),
    auditLog('STAFF_CLOCK_OUT'),
    hrController.clockOut
);

router.get(
    '/attendance/today',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 120 }),
    hrController.getTodayClockIn
);

// ── Staff Directory ──────────────────────────────────────────────────────────

router.get(
    '/staff',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getStaffDirectory
);

router.put(
    '/staff/:userId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    auditLog('UPDATE_STAFF_HR'),
    hrController.updateStaffHR
);

// ── Allowances ───────────────────────────────────────────────────────────────

router.get(
    '/allowances/:userId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getStaffAllowances
);

router.post(
    '/allowances/:userId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(allowanceSchema),
    auditLog('UPSERT_STAFF_ALLOWANCE'),
    hrController.upsertAllowance
);

router.delete(
    '/allowances/:userId/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('DELETE_STAFF_ALLOWANCE'),
    hrController.deleteAllowance
);

// ── Custom Deductions ────────────────────────────────────────────────────────

router.get(
    '/deductions/:userId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getStaffDeductions
);

router.post(
    '/deductions/:userId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(deductionSchema),
    auditLog('UPSERT_STAFF_DEDUCTION'),
    hrController.upsertDeduction
);

router.delete(
    '/deductions/:userId/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('DELETE_STAFF_DEDUCTION'),
    hrController.deleteDeduction
);

// ── Leave ────────────────────────────────────────────────────────────────────

router.get(
    '/leave/types',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getLeaveTypes
);

router.post(
    '/leave/apply',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(leaveRequestSchema),
    auditLog('SUBMIT_LEAVE_REQUEST'),
    hrController.submitLeave
);

router.get(
    '/leave/requests',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getLeaveRequests
);

router.put(
    '/leave/approve/:requestId',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    auditLog('APPROVE_LEAVE'),
    hrController.approveLeave
);

// ── Leave Type CRUD ─────────────────────────────────────────────────────────────────

const leaveTypeSchema = z.object({
    name: z.string().min(1).max(100),
    maxDays: z.coerce.number().int().min(1).max(365),
    description: z.string().max(300).optional()
});

router.post(
    '/leave/types',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    validate(leaveTypeSchema),
    auditLog('CREATE_LEAVE_TYPE'),
    hrController.createLeaveType
);

router.put(
    '/leave/types/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('UPDATE_LEAVE_TYPE'),
    hrController.updateLeaveType
);

router.delete(
    '/leave/types/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('DELETE_LEAVE_TYPE'),
    hrController.deleteLeaveType
);

// Leave balance per staff member
router.get(
    '/leave/balance/:userId',
    authenticate,
    rateLimit({ windowMs: 60_000, maxRequests: 60 }),
    hrController.getLeaveBalance
);

// ── Attendance Report ──────────────────────────────────────────────────────────────

router.get(
    '/attendance/report',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    hrController.getAttendanceReport
);

// ── Payroll ──────────────────────────────────────────────────────────────────

router.post(
    '/payroll/generate',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    auditLog('GENERATE_PAYROLL'),
    hrController.generatePayroll
);

router.get(
    '/payroll',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getPayroll
);

/**
 * @route   GET /api/hr/payroll/:id
 * @desc    Fetch a single payroll record with full staff details for payslip rendering
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.get(
    '/payroll/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getPayslip
);

router.put(
    '/payroll/confirm/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('CONFIRM_PAYROLL'),
    hrController.confirmPayroll
);

/**
 * @route   POST /api/hr/payroll/bulk-confirm
 * @desc    Confirm all DRAFT payroll records for a given month/year
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
    '/payroll/bulk-confirm',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 5 }),
    auditLog('BULK_CONFIRM_PAYROLL'),
    hrController.bulkConfirmPayroll
);

/**
 * @route   PUT /api/hr/payroll/pay/:id
 * @desc    Mark a single payroll record as PAID and send SMS notification
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.put(
    '/payroll/pay/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 20 }),
    auditLog('MARK_PAYROLL_PAID'),
    hrController.markPayrollPaid
);

/**
 * @route   POST /api/hr/payroll/bulk-pay
 * @desc    Mark all GENERATED records for a month/year as PAID and send SMS notifications
 * @access  ADMIN, SUPER_ADMIN, ACCOUNTANT
 */
router.post(
    '/payroll/bulk-pay',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 5 }),
    auditLog('BULK_MARK_PAYROLL_PAID'),
    hrController.bulkMarkPaid
);

/**
 * @route   PUT /api/hr/payroll/void/:id
 * @desc    Void a DRAFT or GENERATED payroll record (requires a reason)
 * @access  ADMIN, SUPER_ADMIN
 */
router.put(
    '/payroll/void/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 10 }),
    validate(voidPayrollSchema),
    auditLog('VOID_PAYROLL'),
    hrController.voidPayroll
);

// ── Performance ──────────────────────────────────────────────────────────────

router.get(
    '/performance',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 100 }),
    hrController.getPerformance
);

router.post(
    '/performance',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(performanceSchema),
    auditLog('CREATE_PERFORMANCE_EVALUATION'),
    hrController.createPerformance
);

router.put(
    '/performance/:id',
    authenticate,
    requireRole([...ROLE_HR_ADMIN]),
    rateLimit({ windowMs: 60_000, maxRequests: 30 }),
    validate(performanceSchema),
    auditLog('UPDATE_PERFORMANCE_EVALUATION'),
    hrController.updatePerformance
);

export default router;


