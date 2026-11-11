import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPrisma = { classEnrollment: { findFirst: jest.fn<() => Promise<any>>() } };
jest.mock('../../src/config/database', () => ({ __esModule: true, default: mockPrisma }));
const mockParentAccess = { canAccessLearner: jest.fn<() => Promise<boolean>>() };
jest.mock('../../src/services/parent-access.service', () => ({ parentAccessService: mockParentAccess }));

import { assertCanAccessInvoicePayment, assertCanViewFeeRecord } from '../../src/services/finance-access.service';

const request = (role: string, userId = 'user-1') => ({ user: { role, userId } }) as any;
const record = { id: 'invoice-1', learnerId: 'learner-1' };

describe('finance record access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.classEnrollment.findFirst.mockResolvedValue(null);
    mockParentAccess.canAccessLearner.mockResolvedValue(false);
  });

  it('lets school leaders and finance leads view school fee records', async () => {
    await expect(assertCanViewFeeRecord(request('ADMIN'), record)).resolves.toBeUndefined();
    await expect(assertCanViewFeeRecord(request('HEAD_TEACHER'), record)).resolves.toBeUndefined();
    await expect(assertCanViewFeeRecord(request('ACCOUNTANT'), record)).resolves.toBeUndefined();
    expect(mockPrisma.classEnrollment.findFirst).not.toHaveBeenCalled();
  });

  it('limits teachers to learners in an active assigned class', async () => {
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    await expect(assertCanViewFeeRecord(request('TEACHER'), record)).resolves.toBeUndefined();
    mockPrisma.classEnrollment.findFirst.mockResolvedValue(null);
    await expect(assertCanViewFeeRecord(request('TEACHER'), record)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('limits parent fee information and M-Pesa payments to linked learners', async () => {
    mockParentAccess.canAccessLearner.mockResolvedValue(true);
    await expect(assertCanViewFeeRecord(request('PARENT'), record)).resolves.toBeUndefined();
    await expect(assertCanAccessInvoicePayment(request('PARENT'), record)).resolves.toBeUndefined();
    mockParentAccess.canAccessLearner.mockResolvedValue(false);
    await expect(assertCanViewFeeRecord(request('PARENT'), record)).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCanAccessInvoicePayment(request('PARENT'), record)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows the receptionist payment task but not school-wide fee reporting', async () => {
    const cashierRequest = { ...request('RECEPTIONIST'), path: '/fees/cashier/learners/learner-1/invoices' };
    await expect(assertCanViewFeeRecord(cashierRequest, record)).resolves.toBeUndefined();
    await expect(assertCanViewFeeRecord(request('RECEPTIONIST'), record)).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCanAccessInvoicePayment(request('RECEPTIONIST'), record)).resolves.toBeUndefined();
    expect(mockPrisma.classEnrollment.findFirst).not.toHaveBeenCalled();
  });
});
