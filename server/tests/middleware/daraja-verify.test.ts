import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

/**
 * Tests for Daraja callback HMAC-SHA256 verification middleware.
 *
 * The middleware verifies that callbacks from Daraja (Safaricom's M-Pesa API)
 * are authentic by checking the Authorization header against a computed
 * HMAC-SHA256 signature of the callback URL + raw body.
 *
 * This is a critical safety fix from Step 1 — without it, anyone could POST
 * forged callback payloads to mark payments as successful.
 */

// Mock logger
jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../../src/config/database', () => ({
    __esModule: true,
    default: {
        communicationConfig: {
            findFirst: jest.fn().mockResolvedValue({ mpesaSecretKey: 'encrypted-test-secret' } as never),
        },
    },
}));

jest.mock('../../src/utils/encryption.util', () => ({
    decrypt: () => 'test-daraja-secret-key',
}));

// We need to set the env vars BEFORE importing the middleware
const TEST_SECRET = 'test-daraja-secret-key';
const TEST_CALLBACK_URL = 'https://example.com/api/mpesa/callback';

process.env.MPESA_CONSUMER_SECRET = TEST_SECRET;
process.env.MPESA_CALLBACK_URL = TEST_CALLBACK_URL;

// Import after env is set
import { verifyDarajaCallback } from '../../src/middleware/daraja-verify.middleware';

describe('Daraja Callback HMAC Verification (Safety Fix)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * Helper: compute a valid Daraja HMAC-SHA256 signature.
     * Daraja signs the payload as: HMAC-SHA256(callback_url + raw_body, consumer_secret)
     * The result is base64-encoded and sent as: "Bearer <signature>"
     */
    function computeValidSignature(rawBody: string): string {
        const data = TEST_CALLBACK_URL + rawBody;
        return crypto.createHmac('sha256', TEST_SECRET)
            .update(data)
            .digest('base64');
    }

    it('should accept a callback with a valid HMAC signature', async () => {
        const rawBody = JSON.stringify({ Body: { stkCallback: { MerchantRequestID: '123' } } });
        const signature = computeValidSignature(rawBody);

        const req: any = {
            rawBody: Buffer.from(rawBody),
            headers: { authorization: `Bearer ${signature}` },
        };
        const res: any = {};
        const next = jest.fn();

        await verifyDarajaCallback(req, res, next);

        expect(next).toHaveBeenCalledWith(); // no error = pass-through
    });

    it('should reject a callback with an invalid HMAC signature (forged payload)', async () => {
        const rawBody = JSON.stringify({ Body: { stkCallback: { MerchantRequestID: 'forged' } } });
        const fakeSignature = 'invalid-base64-signature=';

        const req: any = {
            rawBody: Buffer.from(rawBody),
            headers: { authorization: `Bearer ${fakeSignature}` },
        };
        const jsonSpy = jest.fn().mockReturnThis();
        const statusSpy = jest.fn().mockReturnThis();
        const res: any = { json: jsonSpy, status: statusSpy };
        const next = jest.fn();

        await verifyDarajaCallback(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(statusSpy).toHaveBeenCalledWith(401);
        expect(jsonSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.stringContaining('signature'),
            })
        );
    });

    it('should reject a callback with no Authorization header', async () => {
        const req: any = {
            rawBody: Buffer.from('{"test":true}'),
            headers: {}, // no auth header
        };
        const jsonSpy = jest.fn().mockReturnThis();
        const statusSpy = jest.fn().mockReturnThis();
        const res: any = { json: jsonSpy, status: statusSpy };
        const next = jest.fn();

        await verifyDarajaCallback(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(statusSpy).toHaveBeenCalledWith(401);
    });

    it('should reject when rawBody is missing', async () => {
        const signature = computeValidSignature('{}');
        const req: any = {
            rawBody: undefined,
            headers: { authorization: `Bearer ${signature}` },
        };
        const jsonSpy = jest.fn().mockReturnThis();
        const statusSpy = jest.fn().mockReturnThis();
        const res: any = { json: jsonSpy, status: statusSpy };
        const next = jest.fn();

        await verifyDarajaCallback(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(statusSpy).toHaveBeenCalledWith(401);
    });

    it('should detect tampered body (signature does not match modified body)', async () => {
        const originalBody = JSON.stringify({ amount: 1000 });
        const tamperedBody = JSON.stringify({ amount: 999999 }); // attacker changed amount

        const signature = computeValidSignature(originalBody);

        const req: any = {
            rawBody: Buffer.from(tamperedBody), // different body
            headers: { authorization: `Bearer ${signature}` },
        };
        const jsonSpy = jest.fn().mockReturnThis();
        const statusSpy = jest.fn().mockReturnThis();
        const res: any = { json: jsonSpy, status: statusSpy };
        const next = jest.fn();

        await verifyDarajaCallback(req, res, next);

        // Signature was computed for original body, but body was tampered → reject
        expect(next).not.toHaveBeenCalled();
        expect(statusSpy).toHaveBeenCalledWith(401);
    });
});
