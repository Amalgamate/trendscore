import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPrisma = {
  mpesaCallback: { create: jest.fn() },
  mpesaTransaction: { findFirst: jest.fn(), update: jest.fn() },
  feePayment: { create: jest.fn(), findUnique: jest.fn() },
  feeInvoice: { findUnique: jest.fn(), update: jest.fn() },
  user: { findFirst: jest.fn() },
  school: { findFirst: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../../src/config/database', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../src/services/mpesa.service', () => ({ mpesaService: { initiatePayout: jest.fn(), queryStatus: jest.fn() } }));
jest.mock('../../src/services/message.service', () => ({ __esModule: true, default: { createAndDispatchMessage: jest.fn() } }));
jest.mock('../../src/services/payment-resolver.service', () => ({ applyToSpecificInvoice: jest.fn(), applyAmountToInvoiceFields: jest.fn(), resolveInvoiceStatus: jest.fn() }));
jest.mock('../../src/services/admission-match.service', () => ({ admissionMatchService: { matchAndApply: jest.fn() } }));
jest.mock('../../src/config/productIdentity', () => ({ PRODUCT_DISPLAY_NAME: 'TrendSCORE' }));
jest.mock('../../src/services/lms-marketplace.service', () => ({ LMSMarketplaceService: { completeByCheckoutRequestId: jest.fn() } }));
jest.mock('../../src/services/accounting.service', () => ({ accountingService: { postFeePaymentToLedger: jest.fn(), postMpesaCharge: jest.fn() } }));
jest.mock('../../src/services/overpayment-credit.service', () => ({ overpaymentCreditService: { detectAndPostOverpayment: jest.fn() } }));
jest.mock('../../src/services/finance-access.service', () => ({ assertCanAccessInvoicePayment: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { handleCallback, handleC2bConfirmation } from '../../src/controllers/mpesa.controller';
import { accountingService } from '../../src/services/accounting.service';
import messageService from '../../src/services/message.service';
import { admissionMatchService } from '../../src/services/admission-match.service';

const response = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });

describe('Daraja STK callback validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue({ id: 'txn-1', type: 'COLLECTION', invoiceId: 'invoice-1', amount: 500 });
  });

  it('keeps a successful callback pending when amount or receipt is missing', async () => {
    const res = response();
    await handleCallback({ body: { Body: { stkCallback: { CheckoutRequestID: 'checkout-1', ResultCode: 0, ResultDesc: 'Success' } } } } as any, res as any);

    expect(mockPrisma.mpesaCallback.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.mpesaTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'txn-1' },
      data: expect.objectContaining({ resultDesc: expect.stringContaining('review required') }),
    }));
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('does not process an STK callback against a non-collection transaction', async () => {
    (mockPrisma.mpesaTransaction.findFirst as any).mockResolvedValue({ id: 'txn-payout', type: 'PAYOUT', invoiceId: null });
    const res = response();
    await handleCallback({ body: { Body: { stkCallback: { CheckoutRequestID: 'checkout-2', ResultCode: 0, ResultDesc: 'Success' } } } } as any, res as any);

    expect(mockPrisma.mpesaTransaction.update).not.toHaveBeenCalled();
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('keeps a successful callback pending when the provider amount differs from the requested amount', async () => {
    const res = response();
    await handleCallback({ body: { Body: { stkCallback: {
      CheckoutRequestID: 'checkout-3',
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: { Item: [
        { Name: 'Amount', Value: 450 },
        { Name: 'MpesaReceiptNumber', Value: 'QWE123' },
        { Name: 'PhoneNumber', Value: 254700000000 },
      ] },
    } } } } as any, res as any);

    expect(mockPrisma.mpesaTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'txn-1' },
      data: expect.objectContaining({ resultDesc: expect.stringContaining('expected 500, received 450') }),
    }));
    expect(mockPrisma.feePayment.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('retries ledger posting for a duplicate receipt without sending a second SMS receipt', async () => {
    (mockPrisma.feePayment.create as any).mockRejectedValue({ code: 'P2002' });
    (mockPrisma.feePayment.findUnique as any).mockResolvedValue({
      id: 'payment-1', amount: 500, receiptNumber: 'MPESA-ABC123', paymentDate: new Date(),
    });
    (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({ id: 'invoice-1', invoiceNumber: 'INV-1' });
    (mockPrisma.user.findFirst as any).mockResolvedValue({ id: 'system-user' });
    (mockPrisma.school.findFirst as any).mockResolvedValue({ name: 'Test School' });

    const res = response();
    await handleCallback({ body: { Body: { stkCallback: {
      CheckoutRequestID: 'checkout-4',
      ResultCode: 0,
      ResultDesc: 'Success',
      CallbackMetadata: { Item: [
        { Name: 'Amount', Value: 500 },
        { Name: 'MpesaReceiptNumber', Value: 'ABC123' },
        { Name: 'PhoneNumber', Value: 254700000000 },
      ] },
    } } } } as any, res as any);

    expect(accountingService.postFeePaymentToLedger).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment-1' }), 'MPESA');
    expect(accountingService.postMpesaCharge).toHaveBeenCalledWith(500, 'MPESA-ABC123');
    expect(messageService.createAndDispatchMessage).not.toHaveBeenCalled();
  });
});

describe('Daraja C2B confirmation validation', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it.each([
    ['negative amount', { TransID: 'C2B-1', TransAmount: '-10', TransactionType: 'Pay Bill Online' }],
    ['non-numeric amount', { TransID: 'C2B-2', TransAmount: 'KES 100', TransactionType: 'Customer Buy Goods' }],
    ['non-C2B transaction type', { TransID: 'C2B-3', TransAmount: '100', TransactionType: 'B2C Payment' }],
    ['missing transaction type', { TransID: 'C2B-4', TransAmount: '100' }],
  ])('does not match or stage a %s', async (_caseName, payload) => {
    const res = response();
    await handleC2bConfirmation({ body: payload } as any, res as any);
    expect(admissionMatchService.matchAndApply).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('passes a valid positive Pay Bill confirmation to the admission matcher', async () => {
    (admissionMatchService.matchAndApply as any).mockResolvedValue({ outcome: 'unmatched' });
    const res = response();
    await handleC2bConfirmation({ body: {
      TransID: 'C2B-VALID', TransAmount: '100.00', MSISDN: '254700000000',
      BillRefNumber: 'ADM-100', TransactionType: 'Customer Pay Bill Online',
    } } as any, res as any);
    expect(admissionMatchService.matchAndApply).toHaveBeenCalledWith(expect.objectContaining({
      receipt: 'C2B-VALID', amount: 100, accountReference: 'ADM-100',
    }));
  });
});
