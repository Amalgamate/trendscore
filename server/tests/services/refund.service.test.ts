import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Mock Prisma ─────────────────────────────────────────────────────────────
const mockPrisma = {
    refund: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
    },
    feePayment: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    feeInvoice: {
        update: jest.fn(),
        findUnique: jest.fn(),
    },
    learner: {
        findUnique: jest.fn(),
    },
    mpesaTransaction: {
        findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: mockPrisma,
}));

// ── Mock dependent services ─────────────────────────────────────────────────
jest.mock('../../src/services/mpesa.service', () => ({
    mpesaService: {
        initiatePayout: jest.fn(),
    },
}));

jest.mock('../../src/services/accounting.service', () => ({
    accountingService: {
        postRefundToLedger: jest.fn(),
    },
}));

jest.mock('../../src/services/approvalEngine.service', () => ({
    approvalEngineService: {
        submitRequest: jest.fn(),
    },
}));

jest.mock('../../src/services/message.service', () => ({
    __esModule: true,
    default: {
        createAndDispatchMessage: jest.fn(),
    },
}));

jest.mock('../../src/config/productIdentity', () => ({
    PRODUCT_DISPLAY_NAME: 'TrendSCORE',
}));

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

// Import AFTER mocks are set up
import { refundService } from '../../src/services/refund.service';
import { mpesaService } from '../../src/services/mpesa.service';
import { accountingService } from '../../src/services/accounting.service';
import { approvalEngineService } from '../../src/services/approvalEngine.service';
import messageService from '../../src/services/message.service';

describe('RefundService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── submitRefund ─────────────────────────────────────────────────────
    describe('submitRefund', () => {

        it('should create a PENDING refund with B2C method by default', async () => {
            const mockPayment = {
                id: 'pay-1',
                invoiceId: 'inv-1',
                amount: 5000,
                archived: false,
                invoice: {
                    id: 'inv-1',
                    learner: { id: 'learner-1' },
                },
            };

            (mockPrisma.feePayment.findUnique as any).mockResolvedValue(mockPayment);
            (mockPrisma.refund.findFirst as any).mockResolvedValue(null);
            (mockPrisma.refund.create as any).mockResolvedValue({
                id: 'refund-1',
                amount: 5000,
            });
            (approvalEngineService.submitRequest as any).mockResolvedValue({ id: 'approval-1' });
            (mockPrisma.refund.update as any).mockResolvedValue({});

            const result = await refundService.submitRefund({
                paymentId: 'pay-1',
                reason: 'Duplicate payment',
                submittedById: 'user-finance',
                schoolId: 'school-1',
            });

            expect(result.refundId).toBe('refund-1');
            expect(result.approvalRequestId).toBe('approval-1');

            // Verify the refund was created with correct data
            const createCall = (mockPrisma.refund.create as any).mock.calls[0][0];
            expect(createCall.data.status).toBe('PENDING');
            expect(createCall.data.method).toBe('B2C');
            expect(createCall.data.submittedById).toBe('user-finance');
        });

        it('should reject if payment is already archived (reversed)', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({
                id: 'pay-1',
                archived: true,
            });

            await expect(
                refundService.submitRefund({
                    paymentId: 'pay-1',
                    reason: 'Test',
                    submittedById: 'user-1',
                    schoolId: 'school-1',
                })
            ).rejects.toThrow(/already been reversed/);
        });

        it('should reject if payment does not exist', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue(null);

            await expect(
                refundService.submitRefund({
                    paymentId: 'nonexistent',
                    reason: 'Test',
                    submittedById: 'user-1',
                    schoolId: 'school-1',
                })
            ).rejects.toThrow('Payment not found');
        });

        it('should reject if a PENDING or APPROVED refund already exists for this payment', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({
                id: 'pay-1',
                invoiceId: 'inv-1',
                amount: 5000,
                archived: false,
                invoice: { id: 'inv-1', learner: null },
            });
            (mockPrisma.refund.findFirst as any).mockResolvedValue({
                id: 'existing-refund',
                status: 'PENDING',
            });

            await expect(
                refundService.submitRefund({
                    paymentId: 'pay-1',
                    reason: 'Test',
                    submittedById: 'user-1',
                    schoolId: 'school-1',
                })
            ).rejects.toThrow(/A PENDING refund already exists/);
        });

        it('should continue if approval engine fails (graceful fallback)', async () => {
            (mockPrisma.feePayment.findUnique as any).mockResolvedValue({
                id: 'pay-1',
                invoiceId: 'inv-1',
                amount: 5000,
                archived: false,
                invoice: { id: 'inv-1', learner: null },
            });
            (mockPrisma.refund.findFirst as any).mockResolvedValue(null);
            (mockPrisma.refund.create as any).mockResolvedValue({ id: 'refund-1', amount: 5000 });
            (approvalEngineService.submitRequest as any).mockRejectedValue(
                new Error('No active workflow configured')
            );

            const result = await refundService.submitRefund({
                paymentId: 'pay-1',
                reason: 'Test',
                submittedById: 'user-1',
                schoolId: 'school-1',
            });

            // Refund still created even if approval engine fails
            expect(result.refundId).toBe('refund-1');
            expect(result.approvalRequestId).toBeUndefined();
        });
    });

    // ── approveRefund ────────────────────────────────────────────────────
    describe('approveRefund', () => {

        const mockRefund = {
            id: 'refund-1',
            status: 'PENDING',
            method: 'B2C',
            amount: 5000,
            submittedById: 'user-finance',
            paymentId: 'pay-1',
            reason: 'Duplicate payment',
            notes: null,
            payment: {
                id: 'pay-1',
                receiptNumber: 'MPESA-ABC123',
                referenceNumber: 'ABC123',
                paymentMethod: 'MPESA',
                paymentDate: new Date('2026-11-01'),
                notes: '',
                invoice: {
                    id: 'inv-1',
                    learnerId: 'learner-1',
                    totalAmount: 10000,
                    paidAmount: 5000,
                    balance: 5000,
                    status: 'PARTIAL',
                },
            },
        };

        it('should reject if approver is not SUPER_ADMIN', async () => {
            await expect(
                refundService.approveRefund({
                    refundId: 'refund-1',
                    approverId: 'user-admin',
                    approverRole: 'ADMIN',
                })
            ).rejects.toThrow(/Only the school owner/);
        });

        it('should reject self-approval (submitter === approver)', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue(mockRefund);

            await expect(
                refundService.approveRefund({
                    refundId: 'refund-1',
                    approverId: 'user-finance', // same as submittedById
                    approverRole: 'SUPER_ADMIN',
                })
            ).rejects.toThrow(/cannot approve a refund you submitted/);
        });

        it('should reject if refund is not PENDING', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue({
                ...mockRefund,
                status: 'APPROVED',
            });

            await expect(
                refundService.approveRefund({
                    refundId: 'refund-1',
                    approverId: 'user-owner',
                    approverRole: 'SUPER_ADMIN',
                })
            ).rejects.toThrow(/already APPROVED/);
        });

        it('should archive payment, correct invoice, post ledger reversal, and mark APPROVED', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue(mockRefund);

            // Mock the invoice re-evaluation in the transaction
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1',
                totalAmount: 10000,
                paidAmount: 0, // after decrement
                balance: 10000, // after increment
                status: 'PARTIAL',
            });

            (mockPrisma.feePayment.update as any).mockResolvedValue({});
            (mockPrisma.feeInvoice.update as any).mockResolvedValue({});
            (accountingService.postRefundToLedger as any).mockResolvedValue({});
            (mockPrisma.refund.update as any).mockResolvedValue({});
            (mockPrisma.learner.findUnique as any).mockResolvedValue({
                fatherPhone: '254712345678',
            });
            (mpesaService.initiatePayout as any).mockResolvedValue({
                success: true,
                conversationId: 'conv-123',
            });
            (messageService.createAndDispatchMessage as any).mockResolvedValue({});

            const result = await refundService.approveRefund({
                refundId: 'refund-1',
                approverId: 'user-owner',
                approverRole: 'SUPER_ADMIN',
                comment: 'Approved',
            });

            expect(result.success).toBe(true);
            expect(result.b2cInitiated).toBe(true);

            // Verify payment was archived
            const paymentUpdate = (mockPrisma.feePayment.update as any).mock.calls[0][0];
            expect(paymentUpdate.data.archived).toBe(true);
            expect(paymentUpdate.data.archivedBy).toBe('user-owner');

            // Verify invoice balance was incremented
            const invoiceUpdate = (mockPrisma.feeInvoice.update as any).mock.calls[0][0];
            expect(invoiceUpdate.data.balance).toEqual({ increment: 5000 });
            expect(invoiceUpdate.data.paidAmount).toEqual({ decrement: 5000 });

            // Verify ledger reversal was posted
            expect(accountingService.postRefundToLedger).toHaveBeenCalled();

            // Verify refund was marked APPROVED
            const refundUpdate = (mockPrisma.refund.update as any).mock.calls[0][0];
            expect(refundUpdate.data.status).toBe('APPROVED');
            expect(refundUpdate.data.approvedById).toBe('user-owner');
        });

        it('should mark as MANUAL if B2C initiation fails', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue(mockRefund);
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1', totalAmount: 10000, paidAmount: 0, balance: 10000, status: 'PARTIAL',
            });
            (mockPrisma.feePayment.update as any).mockResolvedValue({});
            (mockPrisma.feeInvoice.update as any).mockResolvedValue({});
            (accountingService.postRefundToLedger as any).mockResolvedValue({});
            (mockPrisma.learner.findUnique as any).mockResolvedValue({
                fatherPhone: '254712345678',
            });
            (mpesaService.initiatePayout as any).mockRejectedValue(new Error('B2C service unavailable'));

            const result = await refundService.approveRefund({
                refundId: 'refund-1',
                approverId: 'user-owner',
                approverRole: 'SUPER_ADMIN',
            });

            expect(result.success).toBe(true);
            expect(result.b2cInitiated).toBe(false);
            expect(result.message).toContain('manual processing');

            // Verify refund was marked MANUAL
            const manualUpdate = (mockPrisma.refund.update as any).mock.calls
                .find((c: any) => c[0].data.status === 'MANUAL');
            expect(manualUpdate).toBeDefined();
        });

        it('should mark as MANUAL for non-B2C methods (CASH, CHEQUE, BANK_TRANSFER)', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue({
                ...mockRefund,
                method: 'CASH',
            });
            (mockPrisma.feeInvoice.findUnique as any).mockResolvedValue({
                id: 'inv-1', totalAmount: 10000, paidAmount: 0, balance: 10000, status: 'PARTIAL',
            });
            (mockPrisma.feePayment.update as any).mockResolvedValue({});
            (mockPrisma.feeInvoice.update as any).mockResolvedValue({});
            (accountingService.postRefundToLedger as any).mockResolvedValue({});
            (mockPrisma.refund.update as any).mockResolvedValue({});

            const result = await refundService.approveRefund({
                refundId: 'refund-1',
                approverId: 'user-owner',
                approverRole: 'SUPER_ADMIN',
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('CASH');
        });
    });

    // ── rejectRefund ─────────────────────────────────────────────────────
    describe('rejectRefund', () => {

        it('should reject if rejector is not SUPER_ADMIN', async () => {
            await expect(
                refundService.rejectRefund({
                    refundId: 'refund-1',
                    rejectorId: 'user-accountant',
                    rejectorRole: 'ACCOUNTANT',
                    reason: 'Not valid',
                })
            ).rejects.toThrow(/Only the school owner/);
        });

        it('should mark refund as REJECTED with reason', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue({
                id: 'refund-1',
                status: 'PENDING',
            });
            (mockPrisma.refund.update as any).mockResolvedValue({});

            const result = await refundService.rejectRefund({
                refundId: 'refund-1',
                rejectorId: 'user-owner',
                rejectorRole: 'SUPER_ADMIN',
                reason: 'Invalid refund — payment was correct',
            });

            expect(result.success).toBe(true);
            const updateCall = (mockPrisma.refund.update as any).mock.calls[0][0];
            expect(updateCall.data.status).toBe('REJECTED');
            expect(updateCall.data.b2cFailureReason).toContain('Invalid refund');
        });

        it('should reject if refund is not PENDING', async () => {
            (mockPrisma.refund.findUnique as any).mockResolvedValue({
                id: 'refund-1',
                status: 'DISBURSED',
            });

            await expect(
                refundService.rejectRefund({
                    refundId: 'refund-1',
                    rejectorId: 'user-owner',
                    rejectorRole: 'SUPER_ADMIN',
                    reason: 'Test',
                })
            ).rejects.toThrow(/already DISBURSED/);
        });
    });

    // ── markDisbursed / markFailed ────────────────────────────────────────
    describe('markDisbursed', () => {
        it('should set status to DISBURSED with transaction ID and timestamp', async () => {
            (mockPrisma.refund.update as any).mockResolvedValue({});

            await refundService.markDisbursed('refund-1', 'MPESA-RECEIPT-XYZ');

            const call = (mockPrisma.refund.update as any).mock.calls[0][0];
            expect(call.where.id).toBe('refund-1');
            expect(call.data.status).toBe('DISBURSED');
            expect(call.data.b2cTransactionId).toBe('MPESA-RECEIPT-XYZ');
            expect(call.data.disbursedAt).toBeInstanceOf(Date);
        });
    });

    describe('markFailed', () => {
        it('should set status to FAILED with failure reason', async () => {
            (mockPrisma.refund.update as any).mockResolvedValue({});

            await refundService.markFailed('refund-1', 'Insufficient funds');

            const call = (mockPrisma.refund.update as any).mock.calls[0][0];
            expect(call.data.status).toBe('FAILED');
            expect(call.data.b2cFailureReason).toBe('Insufficient funds');
        });
    });

    // ── listRefunds ──────────────────────────────────────────────────────
    describe('listRefunds', () => {
        it('should return paginated refunds with optional status filter', async () => {
            (mockPrisma.refund.findMany as any).mockResolvedValue([
                { id: 'r1', status: 'PENDING' },
                { id: 'r2', status: 'PENDING' },
            ]);
            (mockPrisma.refund.count as any).mockResolvedValue(2);

            const result = await refundService.listRefunds({ status: 'PENDING', page: 1, limit: 10 });

            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.pages).toBe(1);
        });
    });
});
