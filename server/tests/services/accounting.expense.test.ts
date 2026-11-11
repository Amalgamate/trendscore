import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const tx = {
  account: { findUnique: jest.fn() },
  journal: { findUnique: jest.fn() },
  vendor: { findUnique: jest.fn() },
  expense: { create: jest.fn() },
  journalEntry: { create: jest.fn() },
};

const mockPrisma = {
  $transaction: jest.fn(async (callback: any) => callback(tx)),
  expense: { create: jest.fn() },
  journalEntry: { create: jest.fn() },
};

jest.mock('../../src/config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../src/utils/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/services/config.service', () => ({ configService: { getTermConfig: jest.fn() } }));

import { AccountingService } from '../../src/services/accounting.service';

describe('AccountingService.recordExpense', () => {
  const service = new AccountingService();
  const input = {
    amount: 2400,
    description: 'Repair classroom windows',
    category: 'Maintenance',
    accountId: 'expense-account',
    paymentAccountId: 'bank-account',
    paymentMethod: 'BANK_TRANSFER' as const,
    reference: 'BANK-REF-1902',
    vendorId: 'vendor-1',
    date: new Date('2026-11-11T09:30:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as any).mockImplementation(async (callback: any) => callback(tx));
    (tx.account.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === 'expense-account') return { id: 'expense-account', isActive: true, type: 'EXPENSE' };
      if (where.id === 'bank-account') return { id: 'bank-account', isActive: true, type: 'ASSET_CASH' };
      return null;
    });
    (tx.journal.findUnique as any).mockResolvedValue({ id: 'misc-journal', isActive: true });
    (tx.vendor.findUnique as any).mockResolvedValue({ id: 'vendor-1', isActive: true });
    (tx.expense.create as any).mockResolvedValue({ id: 'expense-123', ...input });
    (tx.journalEntry.create as any).mockResolvedValue({ id: 'journal-entry-1', status: 'POSTED' });
  });

  it('creates and posts the expense with a balanced journal entry in one transaction', async () => {
    await service.recordExpense(input);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.expense.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amount: 2400,
        paymentMethod: 'BANK_TRANSFER',
        reference: 'BANK-REF-1902',
        status: 'PAID',
      }),
      include: { account: true, vendor: true },
    }));
    expect(tx.journalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ journalId: 'misc-journal', reference: 'BANK-REF-1902', status: 'POSTED' }),
    }));
    const entryData = (tx.journalEntry.create as any).mock.calls[0][0].data;
    const items = entryData.items.create;
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(expect.objectContaining({ accountId: 'expense-account', debit: 2400 }));
    expect(items[1]).toEqual(expect.objectContaining({ accountId: 'bank-account', credit: 2400 }));
    expect(items.reduce((sum: number, item: any) => sum + item.debit, 0))
      .toBe(items.reduce((sum: number, item: any) => sum + item.credit, 0));
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
    expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects zero or invalid amounts before opening a transaction', async () => {
    await expect(service.recordExpense({ ...input, amount: 0 })).rejects.toThrow(/greater than zero/);
    await expect(service.recordExpense({ ...input, amount: Number.NaN })).rejects.toThrow(/greater than zero/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an active expense account and active cash or bank payment account', async () => {
    (tx.account.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === 'expense-account') return { id: 'expense-account', isActive: true, type: 'ASSET_CASH' };
      return { id: 'bank-account', isActive: true, type: 'ASSET_CASH' };
    });
    await expect(service.recordExpense(input)).rejects.toThrow(/active expense account/);
    expect(tx.expense.create).not.toHaveBeenCalled();

    (tx.account.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === 'expense-account') return { id: 'expense-account', isActive: true, type: 'EXPENSE' };
      return { id: 'bank-account', isActive: false, type: 'ASSET_CASH' };
    });
    await expect(service.recordExpense(input)).rejects.toThrow(/active cash or bank account/);
    expect(tx.expense.create).not.toHaveBeenCalled();
  });

  it('does not create a paid expense when the journal is missing', async () => {
    (tx.journal.findUnique as any).mockResolvedValue(null);

    await expect(service.recordExpense(input)).rejects.toThrow(/journal is not configured/);

    expect(tx.expense.create).not.toHaveBeenCalled();
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('propagates journal posting failure through the transaction so the expense rolls back', async () => {
    (tx.journalEntry.create as any).mockRejectedValue(new Error('database write failed'));

    await expect(service.recordExpense(input)).rejects.toThrow('database write failed');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.expense.create).toHaveBeenCalledTimes(1);
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it('rejects inactive vendors and prevents using the same account on both sides', async () => {
    (tx.vendor.findUnique as any).mockResolvedValue({ id: 'vendor-1', isActive: false });
    await expect(service.recordExpense(input)).rejects.toThrow(/active vendor/);
    expect(tx.expense.create).not.toHaveBeenCalled();

    await expect(service.recordExpense({ ...input, accountId: 'bank-account' })).rejects.toThrow(/separate expense account/);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
