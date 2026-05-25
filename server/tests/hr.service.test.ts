/**
 * hr.service.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive unit tests for the HR & Payroll module.
 * Covers: TaxCalculator, HRService (payroll, leave, attendance, performance)
 * and end-to-end route smoke tests via Supertest.
 *
 * Run:  cd server && npx jest tests/hr.service.test.ts --verbose
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
// Keep mock typing permissive in this suite; we prioritize runtime behavior over strict mock generics.
type Mock = any;

// ─── Mocks: must be declared BEFORE any service imports ──────────────────────

jest.mock('../src/services/sms.service', () => ({
    SmsService: { sendSms: jest.fn(async () => ({ success: true })) }
}));

jest.mock('../src/services/accounting.service', () => ({
    accountingService: { postPayrollToLedger: jest.fn(async () => ({ id: 'ledger-entry-1' })) }
}));

jest.mock('../src/services/whatsapp.service', () => ({
    whatsappService: { sendMessage: jest.fn(async () => ({ success: true })) }
}));

jest.mock('../src/services/email-resend.service', () => ({
    EmailService: { sendWelcomeEmail: jest.fn(async () => undefined) }
}));

jest.mock('../src/services/redis-cache.service', () => {
    const store = new Map<string, { value: any; expiresAt: number | null }>();
    const now = () => Date.now();
    return {
        redisCacheService: {
            get: async (key: string) => {
                const e = store.get(key);
                if (!e) return null;
                if (e.expiresAt && e.expiresAt <= now()) { store.delete(key); return null; }
                return e.value;
            },
            set: async (key: string, value: any, ttl?: number) => {
                store.set(key, { value, expiresAt: ttl ? now() + ttl * 1000 : null });
            },
            delete: async (key: string) => { store.delete(key); return true; },
            deleteByPrefix: async () => 0,
            clear: async () => undefined,
            destroy: async () => undefined
        }
    };
});

// ─── Prisma Mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
    user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
    },
    staffAllowance: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    staffDeduction: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    payrollRecord: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    leaveType: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    leaveRequest: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    staffAttendanceLog: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    performanceReview: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') return arg(mockPrisma);
        return Promise.all(arg);
    }),
};

jest.mock('../src/config/database', () => ({
    __esModule: true,
    default: mockPrisma,
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { TaxCalculator } from '../src/utils/tax.calculator';
import { HRService } from '../src/services/hr.service';
import { accountingService } from '../src/services/accounting.service';
import { SmsService } from '../src/services/sms.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'user-001';
const STAFF_PHONE = '0712000001';

const makeStaff = (overrides = {}) => ({
    id: STAFF_ID,
    firstName: 'Amina',
    lastName: 'Wanjiku',
    phone: STAFF_PHONE,
    basicSalary: 50000,
    housingLevyExempt: false,
    role: 'TEACHER',
    archived: false,
    status: 'ACTIVE',
    staffId: 'STF-001',
    bankName: 'Equity Bank',
    bankAccountNumber: '1234567890',
    bankAccountName: 'Amina Wanjiku',
    kraPin: 'A001234567B',
    nssfNumber: '1234567',
    shifNumber: '9876543',
    ...overrides
});

const makePayrollRecord = (overrides = {}) => ({
    id: 'pay-001',
    userId: STAFF_ID,
    month: 4,
    year: 2026,
    basicSalary: 50000,
    grossSalary: 55000,
    netSalary: 42000,
    allowances: { items: [{ id: 'a1', type: 'HOUSE', label: 'House Allowance', amount: 5000 }], total: 5000 },
    deductions: {
        paye: 6765,
        nssf: 2160,
        shif: 1512.5,
        housingLevy: 825,
        statutoryTotal: 11262.5,
        customItems: [],
        customTotal: 0,
        totalDeductions: 11262.5,
    },
    status: 'DRAFT',
    generatedBy: 'admin-001',
    workedDays: 0,
    workedMinutes: 0,
    user: makeStaff(),
    ...overrides
});

const makeLeaveType = (overrides = {}) => ({
    id: 'lt-001',
    name: 'Annual Leave',
    maxDays: 21,
    isActive: true,
    description: null,
    ...overrides
});

const makeLeaveRequest = (overrides = {}) => ({
    id: 'lr-001',
    userId: STAFF_ID,
    leaveTypeId: 'lt-001',
    startDate: new Date('2026-04-14T00:00:00.000Z'),
    endDate: new Date('2026-04-18T00:00:00.000Z'),  // Mon–Fri = 5 days
    reason: 'Family event',
    status: 'PENDING',
    createdAt: new Date(),
    user: { firstName: 'Amina', phone: STAFF_PHONE },
    leaveType: makeLeaveType(),
    ...overrides
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — TaxCalculator unit tests
// ══════════════════════════════════════════════════════════════════════════════

describe('TaxCalculator — 2024 KRA statutory deductions', () => {

    describe('PAYE', () => {
        it('should return 0 PAYE for salary ≤ 24,000', () => {
            expect(TaxCalculator.calculatePAYE(24000)).toBe(0);
        });

        it('should apply Tier 1 only (24k–32.3k bracket)', () => {
            // 30,000 gross, taxable after NSSF ~28,560
            // Tier1: 24000 * 10% = 2400
            // Remaining: 4560 * 25% = 1140 => raw = 3540 - 2400 relief = 1140
            const paye = TaxCalculator.calculatePAYE(28560);
            expect(paye).toBeGreaterThan(0);
            expect(paye).toBeLessThan(3000);
        });

        it('should apply multi-tier PAYE for mid-range salary', () => {
            // 55000 gross
            const paye = TaxCalculator.calculatePAYE(55000);
            // Tier1: 24000*10%=2400, Tier2: (32333-24000)*25%=2083.25
            // Tier3: (55000-32333)*30%=6800.1; total=11283.35
            // Less: 2400 relief = 8883.35; ±shif relief ignored for this test
            expect(paye).toBeGreaterThan(8000);
            expect(paye).toBeLessThan(12000);
        });

        it('should reduce PAYE by SHIF insurance relief (15%)', () => {
            const withRelief = TaxCalculator.calculatePAYE(55000, 1512.5);
            const withoutRelief = TaxCalculator.calculatePAYE(55000, 0);
            expect(withRelief).toBeLessThan(withoutRelief);
            expect(withoutRelief - withRelief).toBeCloseTo(1512.5 * 0.15, 1);
        });
    });

    describe('NSSF (Act 2013 — Tier I + Tier II)', () => {
        it('Tier I only for salary ≤ 7000: 6% × 7000 = 420', () => {
            expect(TaxCalculator.calculateNSSF(7000)).toBe(420);
        });

        it('Tier I + Tier II for salary in 7001–36000 range', () => {
            // gross = 20000: Tier1 = 420, Tier2 = (20000-7000)*6% = 780 => 1200
            expect(TaxCalculator.calculateNSSF(20000)).toBeCloseTo(1200, 1);
        });

        it('Tier I + Tier II capped at 36000: max = 420 + 1740 = 2160', () => {
            expect(TaxCalculator.calculateNSSF(50000)).toBeCloseTo(2160, 1);
            expect(TaxCalculator.calculateNSSF(100000)).toBeCloseTo(2160, 1);
        });
    });

    describe('SHIF (2.75% of gross, no cap)', () => {
        it('calculates correctly for 50000', () => {
            expect(TaxCalculator.calculateSHIF(50000)).toBeCloseTo(1375, 1);
        });

        it('calculates correctly for 120000', () => {
            expect(TaxCalculator.calculateSHIF(120000)).toBeCloseTo(3300, 1);
        });
    });

    describe('Housing Levy (1.5%)', () => {
        it('calculates correctly for 50000', () => {
            expect(TaxCalculator.calculateHousingLevy(50000)).toBeCloseTo(750, 1);
        });
    });

    describe('getBreakdown — full statutory deduction snapshot', () => {
        it('produces correct breakdown for 50000 gross salary', () => {
            const breakdown = TaxCalculator.getBreakdown(50000);

            // NSSF: 2160 (capped at Tier II max)
            expect(breakdown.nssf).toBeCloseTo(2160, 1);

            // SHIF: 50000 * 2.75% = 1375
            expect(breakdown.shif).toBeCloseTo(1375, 1);

            // Housing Levy: 50000 * 1.5% = 750
            expect(breakdown.housingLevy).toBeCloseTo(750, 1);

            // PAYE: taxable = 50000 - 2160 = 47840
            // Tier1: 2400, Tier2: 2083.25, Tier3: (47840-32333)*30% = 4652.1
            // Raw PAYE: 9135.35; - 2400 relief - (1375*15%=206.25 shif relief) = 6528.6 ±
            expect(breakdown.paye).toBeGreaterThan(6000);
            expect(breakdown.paye).toBeLessThan(8000);

            // Total deductions: paye + nssf + shif + housingLevy
            const expectedTotal = breakdown.paye + breakdown.nssf + breakdown.shif + breakdown.housingLevy;
            expect(breakdown.totalDeductions).toBeCloseTo(expectedTotal, 1);

            // Net salary must equal gross - totalDeductions
            expect(breakdown.netSalary).toBeCloseTo(50000 - breakdown.totalDeductions, 1);
        });

        it('returns 0 housing levy when exemptLevy = true', () => {
            const breakdown = TaxCalculator.getBreakdown(50000, { exemptLevy: true });
            expect(breakdown.housingLevy).toBe(0);
        });

        it('net salary is always positive for low salaries', () => {
            const breakdown = TaxCalculator.getBreakdown(20000);
            expect(breakdown.netSalary).toBeGreaterThan(0);
        });

        it('totalDeductions matches sum of all components', () => {
            const gross = 80000;
            const b = TaxCalculator.getBreakdown(gross);
            const sum = b.paye + b.nssf + b.shif + b.housingLevy;
            expect(b.totalDeductions).toBeCloseTo(sum, 1);
        });
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — HRService unit tests (Prisma mocked)
// ══════════════════════════════════════════════════════════════════════════════

describe('HRService', () => {
    let service: HRService;

    beforeEach(() => {
        service = new HRService();
        jest.clearAllMocks();
    });

    // ── 2.1 Staff Directory ────────────────────────────────────────────────────
    describe('getStaffDirectory', () => {
        it('returns staff list excluding PARENT and SUPER_ADMIN', async () => {
            (mockPrisma.user.findMany as Mock).mockResolvedValue([makeStaff()]);
            const result = await service.getStaffDirectory();
            expect(result).toHaveLength(1);
            expect((mockPrisma.user.findMany as Mock).mock.calls[0][0].where.role.notIn).toContain('PARENT');
        });
    });

    describe('updateStaffHRDetails', () => {
        it('updates payroll-relevant fields', async () => {
            const updated = makeStaff({ basicSalary: 60000, kraPin: 'B000111222C' });
            (mockPrisma.user.update as Mock).mockResolvedValue(updated);

            const result = await service.updateStaffHRDetails(STAFF_ID, {
                basicSalary: 60000,
                kraPin: 'B000111222C'
            });
            expect(result.basicSalary).toBe(60000);
        });
    });

    // ── 2.2 Allowances & Deductions ───────────────────────────────────────────
    describe('upsertAllowance', () => {
        it('creates a new allowance when no id provided', async () => {
            const allowance = { type: 'HOUSE', label: 'House Allowance', amount: 5000 };
            (mockPrisma.staffAllowance.create as Mock).mockResolvedValue({ id: 'a1', ...allowance });
            const result = await service.upsertAllowance(STAFF_ID, allowance);
            expect(mockPrisma.staffAllowance.create).toHaveBeenCalled();
            expect(result.amount).toBe(5000);
        });

        it('updates an existing allowance when id is provided', async () => {
            const allowance = { id: 'a1', type: 'TRAVEL', label: 'Travel', amount: 3000 };
            (mockPrisma.staffAllowance.update as Mock).mockResolvedValue(allowance);
            await service.upsertAllowance(STAFF_ID, allowance);
            expect(mockPrisma.staffAllowance.update).toHaveBeenCalled();
        });
    });

    describe('upsertDeduction', () => {
        it('creates a bounded loan deduction (3 months)', async () => {
            const ded = { type: 'LOAN', label: 'Bank Loan', amount: 10000, totalMonths: 3 };
            (mockPrisma.staffDeduction.create as Mock).mockResolvedValue({ id: 'd1', ...ded, monthsApplied: 0 });
            const result = await service.upsertDeduction(STAFF_ID, ded);
            expect(result.monthsApplied).toBe(0);
        });

        it('creates an indefinite SACCO deduction (totalMonths = 0)', async () => {
            const ded = { type: 'SACCO', label: 'SACCO', amount: 2000, totalMonths: 0 };
            (mockPrisma.staffDeduction.create as Mock).mockResolvedValue({ id: 'd2', ...ded, monthsApplied: 0 });
            await service.upsertDeduction(STAFF_ID, ded);
            expect(mockPrisma.staffDeduction.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ totalMonths: 0 }) })
            );
        });
    });

    // ── 2.3 Payroll Generation ────────────────────────────────────────────────
    describe('generateMonthlyPayroll', () => {
        const setupMocks = (gross = 55000, allowances = [{ id: 'a1', type: 'HOUSE', label: 'House', amount: 5000 }], deductions = []) => {
            (mockPrisma.user.findMany as Mock).mockResolvedValue([makeStaff({ basicSalary: 50000 })]);
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(null); // no existing record
            (mockPrisma.staffAllowance.findMany as Mock).mockResolvedValue(allowances);
            (mockPrisma.staffDeduction.findMany as Mock).mockResolvedValue(deductions);
            (mockPrisma.payrollRecord.create as Mock).mockImplementation(async ({ data }: any) => ({
                id: 'pay-001',
                ...data,
                user: makeStaff()
            }));
        };

        it('creates a DRAFT payroll record for each eligible staff member', async () => {
            setupMocks();
            const result = await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            expect(result.count).toBe(1);
            expect(mockPrisma.payrollRecord.create).toHaveBeenCalledTimes(1);
            const call = (mockPrisma.payrollRecord.create as Mock).mock.calls[0][0] as any;
            expect(call.data.status).toBe('DRAFT');
        });

        it('skips staff with no existing record (idempotent — returns existing)', async () => {
            (mockPrisma.user.findMany as Mock).mockResolvedValue([makeStaff()]);
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord()); // already exists
            const result = await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            expect(result.count).toBe(1);
            expect(mockPrisma.payrollRecord.create).not.toHaveBeenCalled();
        });

        it('calculates grossSalary = basicSalary + allowancesTotal', async () => {
            setupMocks();
            await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            const call = (mockPrisma.payrollRecord.create as Mock).mock.calls[0][0] as any;
            // basic 50000 + house 5000 = 55000
            expect(Number(call.data.grossSalary)).toBe(55000);
        });

        it('deductions JSON contains paye, nssf, shif, housingLevy keys', async () => {
            setupMocks();
            await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            const call = (mockPrisma.payrollRecord.create as Mock).mock.calls[0][0] as any;
            const deductions = call.data.deductions;
            expect(deductions).toHaveProperty('paye');
            expect(deductions).toHaveProperty('nssf');
            expect(deductions).toHaveProperty('shif');
            expect(deductions).toHaveProperty('housingLevy');
        });

        it('excludes custom deduction that has exhausted totalMonths', async () => {
            const exhaustedDeduction = { id: 'd1', type: 'LOAN', label: 'Loan', amount: 5000, totalMonths: 3, monthsApplied: 3, isActive: true };
            setupMocks(55000, [{ id: 'a1', type: 'HOUSE', label: 'House', amount: 5000 }], [exhaustedDeduction]);
            await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            const call = (mockPrisma.payrollRecord.create as Mock).mock.calls[0][0] as any;
            // exhausted deduction should not appear in customItems
            expect(call.data.deductions.customItems).toHaveLength(0);
        });

        it('increments monthsApplied for bounded custom deduction after generation', async () => {
            const boundedDed = { id: 'd1', type: 'LOAN', label: 'Loan', amount: 5000, totalMonths: 3, monthsApplied: 1, isActive: true };
            setupMocks(55000, [], [boundedDed]);
            (mockPrisma.staffDeduction.findUnique as Mock).mockResolvedValue(boundedDed);
            (mockPrisma.staffDeduction.update as Mock).mockResolvedValue({ ...boundedDed, monthsApplied: 2 });

            await service.generateMonthlyPayroll(4, 2026, 'admin-001');
            expect(mockPrisma.staffDeduction.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ monthsApplied: 2 }) })
            );
        });
    });

    // ── 2.4 Payroll Status Transitions ───────────────────────────────────────
    describe('confirmPayrollRecord', () => {
        it('transitions DRAFT → GENERATED and posts to accounting ledger', async () => {
            const draft = makePayrollRecord({ status: 'DRAFT' });
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(draft);
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue({ ...draft, status: 'GENERATED' });

            const result = await service.confirmPayrollRecord('pay-001');
            expect(result.status).toBe('GENERATED');
            expect(accountingService.postPayrollToLedger).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'pay-001' })
            );
        });

        it('throws if record is not in DRAFT status', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord({ status: 'GENERATED' }));
            await expect(service.confirmPayrollRecord('pay-001')).rejects.toThrow(/not in DRAFT/);
        });
    });

    describe('markPayrollPaid', () => {
        it('transitions GENERATED → PAID and sends SMS to staff', async () => {
            const generated = makePayrollRecord({ status: 'GENERATED' });
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(generated);
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue({ ...generated, status: 'PAID', paidAt: new Date() });

            const result = await service.markPayrollPaid('pay-001', 'EFT-REF-001');
            expect(result.status).toBe('PAID');

            // Give the async SMS fire-and-forget a tick
            await new Promise(r => setTimeout(r, 10));
            expect(SmsService.sendSms).toHaveBeenCalledWith(
                STAFF_PHONE,
                expect.stringContaining('KES')
            );
        });

        it('throws if record is already PAID', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord({ status: 'PAID' }));
            await expect(service.markPayrollPaid('pay-001')).rejects.toThrow(/already marked as PAID/);
        });

        it('throws if record is VOID', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord({ status: 'VOID' }));
            await expect(service.markPayrollPaid('pay-001')).rejects.toThrow(/VOID/);
        });
    });

    describe('voidPayrollRecord', () => {
        it('voids a DRAFT record with a valid reason', async () => {
            const draft = makePayrollRecord({ status: 'DRAFT' });
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(draft);
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue({ ...draft, status: 'VOID' });

            const result = await service.voidPayrollRecord('pay-001', 'admin-001', 'Incorrect allowances');
            expect(result.status).toBe('VOID');
        });

        it('voids a GENERATED record with a valid reason', async () => {
            const generated = makePayrollRecord({ status: 'GENERATED' });
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(generated);
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue({ ...generated, status: 'VOID' });

            const result = await service.voidPayrollRecord('pay-001', 'admin-001', 'Wrong month processed');
            expect(result.status).toBe('VOID');
        });

        it('throws when trying to void a PAID record', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord({ status: 'PAID' }));
            await expect(service.voidPayrollRecord('pay-001', 'admin-001', 'mistake')).rejects.toThrow(/PAID.*cannot be voided/i);
        });

        it('throws if reason is missing or too short', async () => {
            await expect(service.voidPayrollRecord('pay-001', 'admin-001', '')).rejects.toThrow(/reason is required/i);
        });

        it('throws if reason is undefined', async () => {
            await expect(service.voidPayrollRecord('pay-001', 'admin-001', undefined as any)).rejects.toThrow(/reason is required/i);
        });
    });

    describe('bulkConfirmPayroll', () => {
        it('confirms all DRAFT records and returns summary', async () => {
            const drafts = [makePayrollRecord({ id: 'p1' }), makePayrollRecord({ id: 'p2' })];
            (mockPrisma.payrollRecord.findMany as Mock).mockResolvedValue(drafts);
            (mockPrisma.payrollRecord.update as Mock).mockImplementation(async ({ where }: any) =>
                ({ ...makePayrollRecord({ id: where.id }), status: 'GENERATED' })
            );

            const result = await service.bulkConfirmPayroll(4, 2026);
            expect(result.total).toBe(2);
            expect(result.confirmed).toBe(2);
            expect(result.errors).toHaveLength(0);
            expect(accountingService.postPayrollToLedger).toHaveBeenCalledTimes(2);
        });

        it('captures per-record errors without stopping the batch', async () => {
            const drafts = [makePayrollRecord({ id: 'p1' }), makePayrollRecord({ id: 'p2' })];
            (mockPrisma.payrollRecord.findMany as Mock).mockResolvedValue(drafts);
            let callCount = 0;
            (mockPrisma.payrollRecord.update as Mock).mockImplementation(async () => {
                callCount++;
                if (callCount === 1) throw new Error('Ledger unavailable');
                return { ...makePayrollRecord({ id: 'p2' }), status: 'GENERATED' };
            });

            const result = await service.bulkConfirmPayroll(4, 2026);
            expect(result.total).toBe(2);
            expect(result.confirmed).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toMatch(/Ledger unavailable/);
        });
    });

    describe('getPayrollRecordById', () => {
        it('returns record with full user details for payslip', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord());
            const result = await service.getPayrollRecordById('pay-001');
            expect(result.id).toBe('pay-001');
            expect(result.user).toBeDefined();
        });

        it('throws if record not found', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(null);
            await expect(service.getPayrollRecordById('not-exist')).rejects.toThrow(/not found/i);
        });
    });

    // ── 2.5 Leave Management ──────────────────────────────────────────────────
    describe('submitLeaveRequest', () => {
        it('creates a PENDING leave request within balance', async () => {
            (mockPrisma.leaveType.findUnique as Mock).mockResolvedValue(makeLeaveType());
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]); // no prior leave
            (mockPrisma.leaveRequest.create as Mock).mockResolvedValue(makeLeaveRequest());

            const result = await service.submitLeaveRequest(STAFF_ID, {
                leaveTypeId: 'lt-001',
                startDate: '2026-04-14T00:00:00.000Z',
                endDate: '2026-04-18T00:00:00.000Z',
                reason: 'Family event'
            });

            expect(result.status).toBe('PENDING');
            expect(mockPrisma.leaveRequest.create).toHaveBeenCalled();
        });

        it('throws if requesting more days than balance remaining', async () => {
            // 21 days already used up
            const usedLeaves = Array.from({ length: 21 }, (_, i) => ({
                startDate: new Date(2026, 0, i * 1 + 1),
                endDate: new Date(2026, 0, i * 1 + 1),
                status: 'APPROVED'
            }));
            (mockPrisma.leaveType.findUnique as Mock).mockResolvedValue(makeLeaveType({ maxDays: 21 }));
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue(usedLeaves);

            await expect(service.submitLeaveRequest(STAFF_ID, {
                leaveTypeId: 'lt-001',
                startDate: '2026-04-14T00:00:00.000Z',
                endDate: '2026-04-18T00:00:00.000Z',
            })).rejects.toThrow(/Insufficient leave balance/);
        });

        it('throws if leaveTypeId is invalid', async () => {
            (mockPrisma.leaveType.findUnique as Mock).mockResolvedValue(null);
            await expect(service.submitLeaveRequest(STAFF_ID, {
                leaveTypeId: 'bad-id',
                startDate: '2026-04-14T00:00:00.000Z',
                endDate: '2026-04-15T00:00:00.000Z',
            })).rejects.toThrow(/Invalid leave type/);
        });
    });

    describe('approveLeaveRequest', () => {
        it('approves and sends SMS to staff', async () => {
            const pending = makeLeaveRequest({ status: 'PENDING' });
            (mockPrisma.leaveRequest.update as Mock).mockResolvedValue({ ...pending, status: 'APPROVED', approvedById: 'admin-001' });

            const result = await service.approveLeaveRequest('lr-001', 'admin-001', true);
            expect(result.status).toBe('APPROVED');
            await new Promise(r => setTimeout(r, 10));
            expect(SmsService.sendSms).toHaveBeenCalledWith(
                STAFF_PHONE,
                expect.stringContaining('APPROVED')
            );
        });

        it('rejects with a reason and sends rejection SMS', async () => {
            const pending = makeLeaveRequest({ status: 'PENDING' });
            (mockPrisma.leaveRequest.update as Mock).mockResolvedValue({ ...pending, status: 'REJECTED', rejectionReason: 'Staff shortage' });

            const result = await service.approveLeaveRequest('lr-001', 'admin-001', false, 'Staff shortage');
            expect(result.status).toBe('REJECTED');
            await new Promise(r => setTimeout(r, 10));
            expect(SmsService.sendSms).toHaveBeenCalledWith(
                STAFF_PHONE,
                expect.stringContaining('REJECTED')
            );
        });
    });

    describe('getLeaveBalance', () => {
        it('returns remaining days per leave type', async () => {
            const types = [makeLeaveType()];
            (mockPrisma.leaveType.findMany as Mock).mockResolvedValue(types);
            // 5 days already used
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([{
                startDate: new Date('2026-04-14'),
                endDate: new Date('2026-04-18'),
                status: 'APPROVED'
            }]);

            const balances = await service.getLeaveBalance(STAFF_ID, 2026);
            expect(balances).toHaveLength(1);
            expect(balances[0].usedDays).toBe(5);
            expect(balances[0].remainingDays).toBe(21 - 5);
        });

        it('returns maxDays as remaining when no leave taken', async () => {
            (mockPrisma.leaveType.findMany as Mock).mockResolvedValue([makeLeaveType()]);
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]);
            const balances = await service.getLeaveBalance(STAFF_ID, 2026);
            expect(balances[0].remainingDays).toBe(21);
        });
    });

    describe('createLeaveType / updateLeaveType / deleteLeaveType', () => {
        it('creates a new leave type', async () => {
            const lt = { name: 'Paternity', maxDays: 14 };
            (mockPrisma.leaveType.create as Mock).mockResolvedValue({ id: 'lt-new', ...lt, isActive: true });
            const result = await service.createLeaveType(lt);
            expect(result.name).toBe('Paternity');
            expect(result.maxDays).toBe(14);
        });

        it('updates an existing leave type maxDays', async () => {
            (mockPrisma.leaveType.update as Mock).mockResolvedValue({ ...makeLeaveType(), maxDays: 30 });
            const result = await service.updateLeaveType('lt-001', { maxDays: 30 });
            expect(result.maxDays).toBe(30);
        });

        it('soft-deletes (deactivates) a leave type', async () => {
            (mockPrisma.leaveType.update as Mock).mockResolvedValue({ ...makeLeaveType(), isActive: false });
            const result = await service.deleteLeaveType('lt-001');
            expect(result.isActive).toBe(false);
        });
    });

    // ── 2.6 Attendance ─────────────────────────────────────────────────────────
    describe('clockInStaff', () => {
        it('creates attendance log and auto-creates payroll record on first clock-in', async () => {
            const timestamp = new Date('2026-04-11T08:00:00.000Z');
            const attendanceRecord = {
                id: 'att-001', userId: STAFF_ID, date: new Date('2026-04-11'),
                clockInAt: timestamp, clockOutAt: null, source: 'web'
            };
            (mockPrisma.staffAttendanceLog.upsert as Mock).mockResolvedValue(attendanceRecord);
            (mockPrisma.user.findUnique as Mock).mockResolvedValue(makeStaff({ basicSalary: 50000 }));
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(null); // no payroll yet
            (mockPrisma.staffAllowance.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.staffDeduction.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.payrollRecord.create as Mock).mockResolvedValue(makePayrollRecord());

            const result = await service.clockInStaff(STAFF_ID, { timestamp });
            expect(result.attendance.clockInAt).toEqual(timestamp);
            expect(result.payrollCreated).toBe(true);
        });

        it('does not create payroll if it already exists for the month', async () => {
            const timestamp = new Date('2026-04-11T08:00:00.000Z');
            (mockPrisma.staffAttendanceLog.upsert as Mock).mockResolvedValue({ clockInAt: timestamp });
            (mockPrisma.user.findUnique as Mock).mockResolvedValue(makeStaff());
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord()); // already exists

            const result = await service.clockInStaff(STAFF_ID, { timestamp });
            expect(result.payrollCreated).toBe(false);
            expect(mockPrisma.payrollRecord.create).not.toHaveBeenCalled();
        });
    });

    describe('clockOutStaff', () => {
        it('records clock-out and updates workedMinutes on payroll', async () => {
            const clockIn = new Date('2026-04-11T08:00:00.000Z');
            const clockOut = new Date('2026-04-11T17:00:00.000Z'); // 9 hours = 540 minutes
            const attendance = {
                id: 'att-001', userId: STAFF_ID,
                date: new Date('2026-04-11'), clockInAt: clockIn, clockOutAt: null
            };
            (mockPrisma.staffAttendanceLog.findUnique as Mock).mockResolvedValue(attendance);
            (mockPrisma.staffAttendanceLog.update as Mock).mockResolvedValue({ ...attendance, clockOutAt: clockOut });
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord());
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue({ ...makePayrollRecord(), workedMinutes: 540, workedDays: 1 });

            const result = await service.clockOutStaff(STAFF_ID, { timestamp: clockOut });
            expect(result.workedMinutesDelta).toBe(540);
            expect(result.workedDaysIncremented).toBe(true);
        });

        it('throws if no clock-in record found for today', async () => {
            (mockPrisma.staffAttendanceLog.findUnique as Mock).mockResolvedValue(null);
            await expect(service.clockOutStaff(STAFF_ID, {})).rejects.toThrow(/No clock-in record/);
        });

        it('throws if clock-out is earlier than clock-in', async () => {
            const clockIn = new Date('2026-04-11T09:00:00.000Z');
            (mockPrisma.staffAttendanceLog.findUnique as Mock).mockResolvedValue({
                id: 'att-001', clockInAt: clockIn, clockOutAt: null
            });
            await expect(service.clockOutStaff(STAFF_ID, {
                timestamp: new Date('2026-04-11T07:00:00.000Z')
            })).rejects.toThrow(/earlier than clock-in/);
        });
    });

    // ── 2.7 Performance Reviews ───────────────────────────────────────────────
    describe('createPerformanceReview', () => {
        it('creates a review and returns with user and reviewer details', async () => {
            const review = {
                userId: STAFF_ID,
                reviewerId: 'admin-001',
                reviewDate: new Date(),
                periodStart: new Date('2026-01-01'),
                periodEnd: new Date('2026-03-31'),
                technicalRating: 4,
                behavioralRating: 4,
                collaborationRating: 3,
                overallRating: 3.67,
                goals: [{ goal: 'Complete CBC training', status: 'COMPLETED' }],
                status: 'COMPLETED'
            };
            const created = {
                id: 'rev-001', ...review,
                user: { firstName: 'Amina', lastName: 'Wanjiku', phone: STAFF_PHONE, email: 'amina@school.ac.ke' },
                reviewer: { firstName: 'Admin', lastName: 'User' }
            };
            (mockPrisma.performanceReview.create as Mock).mockResolvedValue(created);

            const result = await service.createPerformanceReview(review);
            expect(result.id).toBe('rev-001');
            expect(result.user.firstName).toBe('Amina');
        });
    });

    // ── 2.8 Dashboard Stats ───────────────────────────────────────────────────
    describe('getDashboardStats', () => {
        it('returns staffCount, pendingLeaveCount, payroll counts and recentRequests', async () => {
            (mockPrisma.user.count as Mock).mockResolvedValue(25);
            (mockPrisma.leaveRequest.count as Mock).mockResolvedValue(3);
            (mockPrisma.payrollRecord.count as Mock)
                .mockResolvedValueOnce(5)   // drafts
                .mockResolvedValueOnce(0);  // generated
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([
                makeLeaveRequest(), makeLeaveRequest({ id: 'lr-002' })
            ]);

            const stats = await service.getDashboardStats(4, 2026);
            expect(stats.staffCount).toBe(25);
            expect(stats.pendingLeaveCount).toBe(3);
            expect(stats.payrollDraftsCount).toBe(5);
            expect(stats.payrollGeneratedCount).toBe(0);
            expect(stats.recentRequests).toHaveLength(2);
        });
    });

    // ── 2.9 calcBusinessDaysInMonth (public helper) ───────────────────────────
    describe('calcBusinessDaysInMonth', () => {
        it('April 2026 should have 22 working days (Mon–Fri, no holidays factored)', () => {
            // April 2026: 1 Wed, 2 Thu, 3 Fri, 6 Mon, ... 30 Thu
            // Total weekdays = 22
            const days = service.calcBusinessDaysInMonth(4, 2026);
            expect(days).toBe(22);
        });

        it('February 2025 (non-leap) has 20 working days', () => {
            const days = service.calcBusinessDaysInMonth(2, 2025);
            expect(days).toBe(20);
        });
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Tax calculation accuracy spot-checks
// ══════════════════════════════════════════════════════════════════════════════

describe('TaxCalculator — payslip accuracy verification', () => {
    /**
     * Spot-check a known KRA calculation:
     *   Gross = KES 80,000
     *   NSSF  = 2,160 (capped Tier II)
     *   Taxable = 80,000 - 2,160 = 77,840
     *   PAYE:
     *     Tier1: 24,000 × 10% = 2,400
     *     Tier2: (32,333 - 24,000) × 25% = 2,083.25
     *     Tier3: (77,840 - 32,333) × 30% = 13,652.1
     *     Raw PAYE: 18,135.35
     *     Less personal relief: 2,400 → 15,735.35
     *     Less SHIF relief: 80,000 × 2.75% × 15% = 330 → ~15,405
     *   SHIF: 80,000 × 2.75% = 2,200
     *   Housing Levy: 80,000 × 1.5% = 1,200
     *   Total Deductions: ±21,000
     *   Net: ±59,000
     */
    it('gross 80,000 — all components within expected KRA ranges', () => {
        const b = TaxCalculator.getBreakdown(80000);

        expect(b.nssf).toBe(2160);
        expect(b.shif).toBeCloseTo(2200, 0);
        expect(b.housingLevy).toBeCloseTo(1200, 0);
        expect(b.paye).toBeGreaterThan(14000);
        expect(b.paye).toBeLessThan(17000);
        expect(b.totalDeductions).toBeGreaterThan(19000);
        expect(b.totalDeductions).toBeLessThan(23000);
        expect(b.netSalary).toBeGreaterThan(57000);
        expect(b.netSalary).toBeLessThan(62000);
    });

    it('minimum wage scenario (15,000) — PAYE should be 0', () => {
        const b = TaxCalculator.getBreakdown(15000);
        // Taxable = 15000 - NSSF (480) = 14520 < 24000 → PAYE = 0
        expect(b.paye).toBe(0);
        expect(b.netSalary).toBeGreaterThan(0);
    });

    it('high earner (300,000) — all tiers applied', () => {
        const b = TaxCalculator.getBreakdown(300000);
        expect(b.nssf).toBe(2160); // still capped
        expect(b.paye).toBeGreaterThan(70000);
        expect(b.shif).toBeCloseTo(8250, 0);
        expect(b.housingLevy).toBeCloseTo(4500, 0);
        expect(b.netSalary).toBeGreaterThan(200000);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Route / API integration smoke tests
// ══════════════════════════════════════════════════════════════════════════════

describe('HR Routes — API smoke tests', () => {
    let app: any;
    let hrRoutes: any;
    let request: any;
    let jwtToken: string;

    const ADMIN_USER = {
        userId: 'admin-test-001',
        email: 'admin@test.com',
        role: 'ADMIN',
        schoolId: 'school-001'
    };

    beforeAll(async () => {
        jest.setTimeout(20000);
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-jwt-secret';
        process.env.JWT_EXPIRES_IN = '1h';
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
        process.env.JWT_REFRESH_EXPIRES_IN = '7d';

        // Dynamically import after mocks
        const express = (await import('express')).default;
        request = (await import('supertest')).default;
        hrRoutes = (await import('../src/routes/hr.routes')).default;
        const jwt = await import('jsonwebtoken');

        // Mint a valid JWT for ADMIN
        jwtToken = jwt.sign(ADMIN_USER, process.env.JWT_SECRET!, { expiresIn: '1h' });

        app = express();
        app.use(express.json());
        app.use('/api/hr', hrRoutes);
    });

    // Helper — creates request with auth header
    const authReq = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
        (request(app) as any)[method](url).set('Authorization', `Bearer ${jwtToken}`);

    describe('GET /api/hr/dashboard', () => {
        it('returns 200 with live stats shape', async () => {
            (mockPrisma.user.count as Mock).mockResolvedValue(10);
            (mockPrisma.leaveRequest.count as Mock).mockResolvedValue(2);
            (mockPrisma.payrollRecord.count as Mock).mockResolvedValue(0);
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]);

            const res = await authReq('get', '/api/hr/dashboard?month=4&year=2026').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('staffCount');
            expect(res.body.data).toHaveProperty('pendingLeaveCount');
            expect(res.body.data).toHaveProperty('payrollDraftsCount');
        });
    });

    describe('GET /api/hr/staff', () => {
        it('returns staff directory', async () => {
            (mockPrisma.user.findMany as Mock).mockResolvedValue([makeStaff()]);
            const res = await authReq('get', '/api/hr/staff').expect(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('POST /api/hr/payroll/generate', () => {
        it('returns 200 with generated payroll count', async () => {
            (mockPrisma.user.findMany as Mock).mockResolvedValue([makeStaff({ basicSalary: 50000 })]);
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(null);
            (mockPrisma.staffAllowance.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.staffDeduction.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.payrollRecord.create as Mock).mockResolvedValue(makePayrollRecord());

            const res = await authReq('post', '/api/hr/payroll/generate')
                .send({ month: 4, year: 2026 }).expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.count).toBe(1);
        });
    });

    describe('GET /api/hr/payroll', () => {
        it('returns payroll records for the month', async () => {
            (mockPrisma.payrollRecord.findMany as Mock).mockResolvedValue([makePayrollRecord()]);
            const res = await authReq('get', '/api/hr/payroll?month=4&year=2026').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });

    describe('GET /api/hr/payroll/:id — payslip', () => {
        it('returns single payroll record with user details', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord());
            const res = await authReq('get', '/api/hr/payroll/pay-001').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('deductions');
            expect(res.body.data).toHaveProperty('allowances');
            expect(res.body.data.user).toHaveProperty('kraPin');
        });
    });

    describe('PUT /api/hr/payroll/void/:id', () => {
        it('voids a DRAFT record with reason', async () => {
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord({ status: 'DRAFT' }));
            (mockPrisma.payrollRecord.update as Mock).mockResolvedValue(makePayrollRecord({ status: 'VOID' }));

            const res = await authReq('put', '/api/hr/payroll/void/pay-001')
                .send({ reason: 'Test void reason' }).expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('VOID');
        });

        it('returns 400 if reason is missing', async () => {
            const res = await authReq('put', '/api/hr/payroll/void/pay-001')
                .send({ reason: 'hi' }) // too short — schema min 5 chars
                .expect(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/hr/leave/types', () => {
        it('returns active leave types', async () => {
            (mockPrisma.leaveType.findMany as Mock).mockResolvedValue([makeLeaveType()]);
            const res = await authReq('get', '/api/hr/leave/types').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data[0].maxDays).toBe(21);
        });
    });

    describe('POST /api/hr/leave/apply', () => {
        it('accepts a valid leave application with date strings (not datetime)', async () => {
            (mockPrisma.leaveType.findUnique as Mock).mockResolvedValue(makeLeaveType());
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.leaveRequest.create as Mock).mockResolvedValue(makeLeaveRequest());

            const res = await authReq('post', '/api/hr/leave/apply')
                .send({
                    leaveTypeId: 'lt-001',
                    startDate: '2026-04-14',   // ← date-only string (the key bug we fixed)
                    endDate: '2026-04-18',
                    reason: 'Family event'
                }).expect(201);
            expect(res.body.success).toBe(true);
        });

        it('accepts ISO datetime strings too', async () => {
            (mockPrisma.leaveType.findUnique as Mock).mockResolvedValue(makeLeaveType());
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]);
            (mockPrisma.leaveRequest.create as Mock).mockResolvedValue(makeLeaveRequest());

            const res = await authReq('post', '/api/hr/leave/apply')
                .send({
                    leaveTypeId: 'lt-001',
                    startDate: '2026-04-14T00:00:00.000Z',
                    endDate: '2026-04-18T00:00:00.000Z',
                }).expect(201);
            expect(res.body.success).toBe(true);
        });

        it('returns 400 when startDate is missing', async () => {
            const res = await authReq('post', '/api/hr/leave/apply')
                .send({ leaveTypeId: 'lt-001', endDate: '2026-04-18' })
                .expect(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/hr/leave/balance/:userId', () => {
        it('returns leave balance per type', async () => {
            (mockPrisma.leaveType.findMany as Mock).mockResolvedValue([makeLeaveType()]);
            (mockPrisma.leaveRequest.findMany as Mock).mockResolvedValue([]);

            const res = await authReq('get', `/api/hr/leave/balance/${STAFF_ID}?year=2026`).expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data[0]).toHaveProperty('remainingDays');
            expect(res.body.data[0].remainingDays).toBe(21);
        });
    });

    describe('POST /api/hr/attendance/clock-in', () => {
        it('records clock-in successfully', async () => {
            const ts = new Date();
            (mockPrisma.staffAttendanceLog.upsert as Mock).mockResolvedValue({ clockInAt: ts, source: 'web' });
            (mockPrisma.user.findUnique as Mock).mockResolvedValue(makeStaff({ basicSalary: 0 })); // no payroll auto-create
            (mockPrisma.payrollRecord.findUnique as Mock).mockResolvedValue(makePayrollRecord());

            const res = await authReq('post', '/api/hr/attendance/clock-in')
                .send({ timestamp: ts.toISOString() }).expect(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/hr/performance', () => {
        it('returns performance reviews', async () => {
            (mockPrisma.performanceReview.findMany as Mock).mockResolvedValue([{
                id: 'rev-001',
                userId: STAFF_ID,
                overallRating: 3.67,
                user: makeStaff(),
                reviewer: { firstName: 'Admin', lastName: 'U' }
            }]);

            const res = await authReq('get', '/api/hr/performance').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });
});
