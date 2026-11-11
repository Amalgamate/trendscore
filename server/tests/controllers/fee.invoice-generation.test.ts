import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPrisma = {
  learner: { findMany: jest.fn() },
  feeStructure: { findMany: jest.fn(), findUnique: jest.fn() },
  feeInvoice: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockTransaction = {
  $queryRaw: jest.fn(),
  feeInvoice: { findMany: jest.fn(), create: jest.fn() },
};

jest.mock('../../src/config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../src/config/productIdentity', () => ({ PRODUCT_DISPLAY_NAME: 'TrendSCORE' }));
jest.mock('../../src/services/sms.service', () => ({ SmsService: { sendFeeInvoiceNotification: jest.fn() } }));
jest.mock('../../src/services/whatsapp.service', () => ({ whatsappService: { sendMessage: jest.fn() } }));
jest.mock('../../src/services/accounting.service', () => ({ accountingService: { postFeeInvoiceToLedger: jest.fn() } }));
jest.mock('../../src/services/overpayment-credit.service', () => ({ overpaymentCreditService: {} }));
jest.mock('../../src/services/compliance.service', () => ({ complianceService: { syncInvoiceToETIMS: jest.fn() } }));
jest.mock('../../src/services/email.service', () => ({ EmailService: {} }));
jest.mock('../../src/services/learnerFeeConfiguration.service', () => ({
  calculateLearnerInvoice: jest.fn<() => Promise<any>>().mockResolvedValue({
    totalAmount: 1000,
    grossAmount: 1000,
    adjustmentAmount: 0,
    sponsorAmount: 0,
    studentAmount: 1000,
    transportAmount: 0,
    carryForwardAmount: 0,
    calculationSnapshot: {},
    feeConfigurationId: null,
  }),
}));
jest.mock('../../src/services/parent-access.service', () => ({ parentAccessService: {} }));
jest.mock('../../src/services/school-notification-trigger.service', () => ({ SchoolNotificationTriggerService: {} }));
jest.mock('../../src/services/finance-access.service', () => ({ assertCanViewFeeRecord: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { FeeController } from '../../src/controllers/fee.controller';

describe('FeeController bulk invoice generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as any) = jest.fn(async (callback: any) => callback(mockTransaction));
    (mockPrisma.learner.findMany as any).mockResolvedValue([
      { id: 'learner-1', grade: 'Grade 1', isTransportStudent: false },
      { id: 'learner-2', grade: 'Grade 1', isTransportStudent: false },
    ]);
    (mockPrisma.feeStructure.findMany as any).mockResolvedValue([
      { id: 'structure-1', grade: 'Grade 1', feeItems: [] },
    ]);
    (mockPrisma.feeInvoice.findMany as any).mockResolvedValue([]);
    (mockTransaction.$queryRaw as any).mockResolvedValue([]);
    (mockTransaction.feeInvoice.findMany as any).mockImplementation(async (args: any) => {
      if (args.select?.invoiceNumber) return [{ invoiceNumber: 'INV-2026-000004' }];
      // Simulate another invoice request winning after this request's preflight.
      return [{ learnerId: 'learner-1' }];
    });
    (mockTransaction.feeInvoice.create as any).mockResolvedValue({ id: 'invoice-5', invoiceNumber: 'INV-2026-000005' });
  });

  it('rechecks active invoices inside the locked transaction and only creates missing invoices', async () => {
    const controller = new FeeController();
    const req = {
      body: { scope: 'WHOLE_SCHOOL', term: 'TERM_2', academicYear: 2026, dueDate: '2026-07-01' },
      user: { userId: 'accountant-1', role: 'ACCOUNTANT' },
    } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    await controller.bulkGenerateInvoices(req, res);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(mockTransaction.$queryRaw).toHaveBeenCalledTimes(1);
    const currentInvoiceQuery = (mockTransaction.feeInvoice.findMany as any).mock.calls.find((call: any[]) => call[0].select?.learnerId);
    expect(currentInvoiceQuery[0].where).toEqual(expect.objectContaining({
      archived: false,
      status: { not: 'CANCELLED' },
    }));
    expect(mockTransaction.feeInvoice.create).toHaveBeenCalledTimes(1);
    expect((mockTransaction.feeInvoice.create as any).mock.calls[0][0].data.learnerId).toBe('learner-2');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, count: 1 }));
  });
});
