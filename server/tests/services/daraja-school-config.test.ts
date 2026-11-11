import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockGet = jest.fn<any>();
const mockPost = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockFindLearner = jest.fn<any>();
const mockCreateTransaction = jest.fn<any>();

jest.mock('axios', () => ({
    __esModule: true,
    default: { get: mockGet, post: mockPost },
}));

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: {
        communicationConfig: { findFirst: mockFindFirst },
        learner: { findUnique: mockFindLearner },
        mpesaTransaction: { create: mockCreateTransaction },
    },
}));

jest.mock('../../src/utils/encryption.util', () => ({
    decrypt: (value: string) => `decrypted:${value}`,
}));

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { darajaService } from '../../src/services/daraja.service';

describe('Daraja school payment configuration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindLearner.mockResolvedValue({ admissionNumber: 'ADM-TEST-01' });
        mockGet.mockResolvedValue({ data: { access_token: 'sandbox-token' } });
        mockPost.mockResolvedValue({
            data: { MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1', CustomerMessage: 'Prompt sent' },
        });
        mockCreateTransaction.mockResolvedValue({ id: 'mpesa-1' });
    });

    it('uses the school sandbox credentials and shortcode even when the server runs in production', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        mockFindFirst.mockResolvedValue({
            mpesaEnabled: true,
            mpesaSandbox: true,
            mpesaPublicKey: 'school-sandbox-key',
            mpesaSecretKey: 'encrypted-sandbox-secret',
            mpesaPasskey: 'encrypted-sandbox-passkey',
            mpesaBusinessNo: '174379',
        });

        try {
            await darajaService.initiateStkPush({ phoneNumber: '0712345678', amount: 100, studentId: 'learner-1' });
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }

        expect(mockGet).toHaveBeenCalledWith(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            expect.objectContaining({
                headers: { Authorization: `Basic ${Buffer.from('school-sandbox-key:decrypted:encrypted-sandbox-secret').toString('base64')}` },
            }),
        );
        expect(mockPost).toHaveBeenCalledWith(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            expect.objectContaining({ BusinessShortCode: '174379', PartyB: '174379', PhoneNumber: '254712345678' }),
            expect.any(Object),
        );
    });

    it('uses the school live toggle and never substitutes a shared environment shortcode', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        mockFindFirst.mockResolvedValue({
            mpesaEnabled: true,
            mpesaSandbox: false,
            mpesaPublicKey: 'another-school-key',
            mpesaSecretKey: 'another-encrypted-secret',
            mpesaPasskey: 'another-encrypted-passkey',
            mpesaBusinessNo: '600001',
        });

        try {
            await darajaService.initiateStkPush({ phoneNumber: '254712345678', amount: 200 });
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }

        expect(mockGet).toHaveBeenCalledWith(
            'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            expect.any(Object),
        );
        expect(mockPost).toHaveBeenCalledWith(
            'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            expect.objectContaining({ BusinessShortCode: '600001', PartyB: '600001' }),
            expect.any(Object),
        );
    });

    it('fails closed when this school has not configured all required Daraja credentials', async () => {
        mockFindFirst.mockResolvedValue({
            mpesaEnabled: true,
            mpesaSandbox: true,
            mpesaPublicKey: 'school-key',
            mpesaSecretKey: null,
            mpesaPasskey: null,
            mpesaBusinessNo: '174379',
        });

        await expect(darajaService.initiateStkPush({ phoneNumber: '0712345678', amount: 100 }))
            .rejects.toThrow('Complete the school Daraja shortcode, consumer key, consumer secret, and passkey');
        expect(mockGet).not.toHaveBeenCalled();
        expect(mockPost).not.toHaveBeenCalled();
    });
});
