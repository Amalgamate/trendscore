import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockConfiguration = {
  id: 'config-1',
  learnerId: 'learner-1',
  name: 'Scholarship',
  status: 'PENDING_APPROVAL',
  startTerm: 'TERM_1',
  startAcademicYear: 2026,
  endTerm: 'TERM_3',
  endAcademicYear: 2026,
  createdById: 'requester-1',
  approvedById: null,
  approvedAt: null,
  revokedById: null,
  revokedAt: null,
  adjustments: [],
};

const mockInvoice = (id: string, term: string) => ({
  id,
  invoiceNumber: `INV-${id}`,
  learnerId: 'learner-1',
  term,
  academicYear: 2026,
  revisionNumber: 0,
  totalAmount: 1000,
  balance: 1000,
  grossAmount: 1000,
  adjustmentAmount: 0,
  sponsorAmount: 0,
  sponsorPaidAmount: 0,
  sponsorBalance: 0,
  studentAmount: 1000,
  carryForwardAmount: 0,
  calculationSnapshot: {},
  feeConfigurationId: 'config-1',
  transportBilled: 0,
  transportBalance: 0,
  paidAmount: 0,
  archived: false,
  status: 'PENDING',
  learner: { id: 'learner-1', isTransportStudent: false },
  feeStructure: { id: 'structure-1', feeItems: [] },
});

const tx: any = {
  learnerFeeConfiguration: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  feeInvoice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  feeInvoiceRevision: { create: jest.fn() },
  termConfig: { findFirst: jest.fn() },
};

const mockPrisma: any = {
  learnerFeeConfiguration: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  feeStructure: { findUnique: jest.fn() },
  learner: { findUnique: jest.fn() },
  $transaction: jest.fn(async (callback: any) => callback(tx)),
};

jest.mock('../../src/config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../src/services/learnerFeeConfiguration.service', () => ({
  calculateLearnerInvoice: jest.fn(async ({ configuration }: any) => ({
    totalAmount: configuration ? 500 : 1000,
    grossAmount: 1000,
    adjustmentAmount: configuration ? 500 : 0,
    sponsorAmount: 0,
    sponsorBalance: 0,
    studentAmount: configuration ? 500 : 1000,
    carryForwardAmount: 0,
    transportAmount: 0,
    calculationSnapshot: { configurationId: configuration?.id || null },
    feeConfigurationId: configuration?.id || null,
  })),
}));
jest.mock('../../src/services/accounting.service', () => ({
  accountingService: {
    postFeeInvoiceRevisionToLedger: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'journal-revision-1' }),
  },
}));
jest.mock('../../src/services/notification.service', () => ({
  NotificationService: {
    notifyRoles: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    createNotification: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  },
  NotificationType: { WARNING: 'WARNING', APPROVAL: 'APPROVAL' },
}));

import { LearnerFeeConfigurationController } from '../../src/controllers/learnerFeeConfiguration.controller';
import { NotificationService } from '../../src/services/notification.service';
import { calculateLearnerInvoice } from '../../src/services/learnerFeeConfiguration.service';
import { accountingService } from '../../src/services/accounting.service';

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const request = (body: any = {}, userId = 'approver-1', role = 'HEAD_TEACHER') => ({
  params: { id: 'config-1', learnerId: 'learner-1' },
  body,
  user: { userId, role },
} as any);

describe('Learner fee configuration lifecycle controls', () => {
  const controller = new LearnerFeeConfigurationController();

  beforeEach(() => {
    jest.clearAllMocks();
    tx.learnerFeeConfiguration.findUnique.mockResolvedValue({ ...mockConfiguration });
    tx.learnerFeeConfiguration.findMany.mockResolvedValue([]);
    tx.learnerFeeConfiguration.updateMany.mockResolvedValue({ count: 1 });
    tx.feeInvoice.findMany.mockResolvedValue([]);
    tx.feeInvoice.findUnique.mockResolvedValue(null);
    tx.feeInvoice.updateMany.mockResolvedValue({ count: 1 });
    tx.feeInvoiceRevision.create.mockResolvedValue({ id: 'revision-1' });
    (accountingService.postFeeInvoiceRevisionToLedger as any).mockResolvedValue({ id: 'journal-revision-1' });
    tx.termConfig.findFirst.mockResolvedValue({ term: 'TERM_2', academicYear: 2026 });
    mockPrisma.learnerFeeConfiguration.findUnique.mockResolvedValue({ ...mockConfiguration });
    mockPrisma.learnerFeeConfiguration.create.mockResolvedValue({
      ...mockConfiguration,
      learner: { firstName: 'Amina', lastName: 'Learner', admissionNumber: 'ADM-1', grade: 'Grade 1' },
    });
  });

  it('does not allow editing an approved configuration', async () => {
    mockPrisma.learnerFeeConfiguration.findUnique.mockResolvedValue({ ...mockConfiguration, status: 'APPROVED' });

    await expect(controller.update(request({ name: 'Changed' }), response() as any)).rejects.toThrow(/immutable/i);

    expect(mockPrisma.learnerFeeConfiguration.update).not.toHaveBeenCalled();
  });

  it('rejects self-approval and configurations outside pending approval', async () => {
    tx.learnerFeeConfiguration.findUnique.mockResolvedValueOnce({ ...mockConfiguration, createdById: 'approver-1' });
    await expect(controller.approve(request({}, 'approver-1'), response() as any)).rejects.toThrow(/cannot approve.*submitted/i);
    expect(tx.learnerFeeConfiguration.updateMany).not.toHaveBeenCalled();

    tx.learnerFeeConfiguration.findUnique.mockResolvedValueOnce({ ...mockConfiguration, status: 'APPROVED' });
    await expect(controller.approve(request(), response() as any)).rejects.toThrow(/only pending/i);
    expect(tx.learnerFeeConfiguration.updateMany).not.toHaveBeenCalled();
  });

  it('notifies both school approver roles when a request is submitted', async () => {
    const res = response();
    await controller.create(request({
      learnerId: 'learner-1',
      name: 'Scholarship',
      status: 'PENDING_APPROVAL',
      startTerm: 'TERM_1',
      startAcademicYear: 2026,
      adjustments: [],
    }, 'requester-1', 'ACCOUNTANT'), res as any);

    expect(NotificationService.notifyRoles).toHaveBeenCalledWith(
      ['ADMIN', 'HEAD_TEACHER'],
      expect.objectContaining({ title: 'Fee configuration approval needed' }),
    );
  });

  it('rolls back configuration approval if an invoice revision cannot be applied', async () => {
    tx.learnerFeeConfiguration.findUnique
      .mockResolvedValueOnce({ ...mockConfiguration })
      .mockResolvedValueOnce({ ...mockConfiguration, status: 'APPROVED' });
    tx.feeInvoice.findMany.mockResolvedValue([mockInvoice('invoice-1', 'TERM_2')]);
    tx.feeInvoice.findUnique.mockResolvedValue(mockInvoice('invoice-1', 'TERM_2'));
    tx.feeInvoice.updateMany.mockResolvedValue({ count: 0 });

    await expect(controller.approve(request(), response() as any)).rejects.toThrow(/changed while/i);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.learnerFeeConfiguration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PENDING_APPROVAL' }),
    }));
    expect(tx.feeInvoiceRevision.create).toHaveBeenCalledTimes(1);
    expect(tx.feeInvoice.updateMany).toHaveBeenCalledTimes(1);
    expect(NotificationService.notifyRoles).not.toHaveBeenCalled();
  });

  it('posts the balanced AR/revenue delta inside the approval transaction', async () => {
    tx.learnerFeeConfiguration.findUnique
      .mockResolvedValueOnce({ ...mockConfiguration })
      .mockResolvedValueOnce({ ...mockConfiguration, status: 'APPROVED' });
    tx.feeInvoice.findMany.mockResolvedValue([mockInvoice('invoice-1', 'TERM_2')]);
    tx.feeInvoice.findUnique.mockResolvedValue(mockInvoice('invoice-1', 'TERM_2'));

    await controller.approve(request(), response() as any);

    expect(accountingService.postFeeInvoiceRevisionToLedger).toHaveBeenCalledWith(
      'INV-invoice-1',
      1,
      -500,
      tx,
      { oldTotalAmount: 1000, newTotalAmount: 500, oldTransportAmount: 0, newTransportAmount: 0 },
    );
    expect(NotificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'requester-1',
      title: 'Fee configuration approved',
      type: 'APPROVAL',
    }));
  });

  it('aborts the approval transaction if ledger posting fails', async () => {
    tx.learnerFeeConfiguration.findUnique
      .mockResolvedValueOnce({ ...mockConfiguration })
      .mockResolvedValueOnce({ ...mockConfiguration, status: 'APPROVED' });
    tx.feeInvoice.findMany.mockResolvedValue([mockInvoice('invoice-1', 'TERM_2')]);
    tx.feeInvoice.findUnique.mockResolvedValue(mockInvoice('invoice-1', 'TERM_2'));
    (accountingService.postFeeInvoiceRevisionToLedger as any).mockRejectedValueOnce(new Error('ledger unavailable'));

    await expect(controller.approve(request(), response() as any)).rejects.toThrow('ledger unavailable');
    expect(tx.learnerFeeConfiguration.updateMany).toHaveBeenCalled();
    expect(tx.feeInvoice.updateMany).toHaveBeenCalled();
    expect(accountingService.postFeeInvoiceRevisionToLedger).toHaveBeenCalledWith(
      'INV-invoice-1',
      1,
      -500,
      tx,
      { oldTotalAmount: 1000, newTotalAmount: 500, oldTransportAmount: 0, newTransportAmount: 0 },
    );
    expect(NotificationService.notifyRoles).not.toHaveBeenCalled();
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });

  it('revokes only future unpaid invoices and preserves current and past snapshots', async () => {
    tx.learnerFeeConfiguration.findUnique.mockResolvedValue({ ...mockConfiguration, status: 'APPROVED' });
    const past = mockInvoice('past-invoice', 'TERM_1');
    const current = mockInvoice('current-invoice', 'TERM_2');
    const future = mockInvoice('future-invoice', 'TERM_3');
    tx.feeInvoice.findMany.mockResolvedValue([past, current, future]);
    tx.feeInvoice.findUnique.mockImplementation(async ({ where }: any) =>
      [past, current, future].find((invoice) => invoice.id === where.id) || null);

    const res = response();
    await controller.revoke(request({}, 'admin-1', 'ADMIN'), res as any);

    expect(tx.termConfig.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, archived: false },
    }));
    expect(tx.feeInvoiceRevision.create).toHaveBeenCalledTimes(1);
    expect(tx.feeInvoiceRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ invoiceId: 'future-invoice', reason: expect.stringContaining('revoked') }),
    }));
    expect(tx.feeInvoice.updateMany).toHaveBeenCalledTimes(1);
    expect(calculateLearnerInvoice).toHaveBeenCalledWith(expect.objectContaining({
      term: 'TERM_3',
      configuration: null,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, revisedInvoices: 1 }));
    expect(NotificationService.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'requester-1',
      title: 'Fee configuration revoked',
      type: 'APPROVAL',
    }));
  });

  it('requires an active term before revocation and leaves the configuration unchanged', async () => {
    tx.learnerFeeConfiguration.findUnique.mockResolvedValue({ ...mockConfiguration, status: 'APPROVED' });
    tx.termConfig.findFirst.mockResolvedValue(null);

    await expect(controller.revoke(request(), response() as any)).rejects.toThrow(/active school term/i);

    expect(tx.learnerFeeConfiguration.updateMany).not.toHaveBeenCalled();
    expect(tx.feeInvoiceRevision.create).not.toHaveBeenCalled();
  });
});
