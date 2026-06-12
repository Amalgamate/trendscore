/**
 * Tests for the MobileSasa SMS integration in SmsService.
 *
 * These tests mock axios and the encryption utility so no real HTTP
 * calls or crypto operations are performed.
 *
 * Covers:
 *  1. Correct endpoint: POST /v1/send/bulk
 *  2. Correct field name: `phones`
 *  3. Correct success detection: responseCode === '0200' (not HTTP status 200)
 *  4. Failure handling: non-0200 responseCode is treated as an error
 *  5. Balance check: POST /v1/get-balance/account-details returns balance correctly
 *  6. M-Pesa top-up: POST /v1/mpesa/stk-push uses the selected account number
 *  6. Balance check: returns error when responseCode is not 0200
 */

import axios from 'axios';
import { SmsService } from '../../src/services/sms.service';

// ── Mock axios ────────────────────────────────────────────────────────────────
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ── Mock encryption util so we don't need real crypto ─────────────────────────
jest.mock('../../src/utils/encryption.util', () => ({
  decrypt: (val: string) => `decrypted_${val}`,
  encrypt: (val: string) => `encrypted_${val}`,
}));

// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CONFIG = {
  smsEnabled: true,
  smsProvider: 'mobilesasa',
  smsApiKey: 'test_api_key',
  smsSenderId: 'TESTSENDER',
  smsBaseUrl: 'https://api.mobilesasa.com',
};

describe('SmsService — MobileSasa integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Send SMS ───────────────────────────────────────────────────────────────

  describe('sendSms (via MobileSasa)', () => {
    it('calls the correct endpoint POST /v1/send/bulk', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: true, responseCode: '0200', message: 'Accepted', messageId: 'abc123' },
      });

      // Use the public static sendSms which dispatches to sendViaMobileSasa
      // We need to trigger via a DB-config path; inject config via the private
      // method test by invoking through the public API with a mock DB config.
      // Access via "as any" to call the private method directly in tests.
      await (SmsService as any).sendViaMobileSasa(MOCK_CONFIG, '254712345678', 'Hello!');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(url).toBe('https://api.mobilesasa.com/v1/send/bulk');
    });

    it('sends the field as `phones`', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: true, responseCode: '0200', message: 'Accepted', messageId: 'abc123' },
      });

      await (SmsService as any).sendViaMobileSasa(MOCK_CONFIG, '+254712345678', 'Test message');

      const [, body] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(body).toHaveProperty('phones');
      expect(body).not.toHaveProperty('phone');
    });

    it('strips leading + from the phone number', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { responseCode: '0200', messageId: 'x1' },
      });

      await (SmsService as any).sendViaMobileSasa(MOCK_CONFIG, '+254712345678', 'Hi');

      const [, body] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(body.phones).toBe('254712345678');
    });

    it('returns success when responseCode is "0200"', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: true, responseCode: '0200', message: 'Accepted', messageId: 'msg-001' },
      });

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-001');
      expect(result.provider).toBe('mobilesasa');
    });

    it('returns failure when responseCode is not "0200" (even if HTTP 200)', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: false, responseCode: '0400', message: 'Insufficient credits' },
      });

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      // The error message surfaces the human-readable message from the API
      expect(result.error).toContain('Insufficient credits');
    });

    it('returns failure when axios throws a network error', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('Network Error'));

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network Error');
    });

    it('returns failure when API key is missing', async () => {
      const configWithoutKey = { ...MOCK_CONFIG, smsApiKey: null };

      const result = await (SmsService as any).sendViaMobileSasa(
        configWithoutKey,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('sends the correct Authorization header', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { responseCode: '0200', messageId: 'h1' },
      });

      await (SmsService as any).sendViaMobileSasa(MOCK_CONFIG, '254712345678', 'Test');

    });

    it('returns success when responseCode is "0200"', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: true, responseCode: '0200', message: 'Accepted', messageId: 'msg-001' },
      });

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-001');
      expect(result.provider).toBe('mobilesasa');
    });

    it('returns failure when responseCode is not "0200" (even if HTTP 200)', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: false, responseCode: '0400', message: 'Insufficient credits' },
      });

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      // The error message surfaces the human-readable message from the API
      expect(result.error).toContain('Insufficient credits');
    });

    it('returns failure when axios throws a network error', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('Network Error'));

      const result = await (SmsService as any).sendViaMobileSasa(
        MOCK_CONFIG,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network Error');
    });

    it('returns failure when API key is missing', async () => {
      const configWithoutKey = { ...MOCK_CONFIG, smsApiKey: null };

      const result = await (SmsService as any).sendViaMobileSasa(
        configWithoutKey,
        '254712345678',
        'Hello!'
      );

      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('sends the correct Authorization header', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { responseCode: '0200', messageId: 'h1' },
      });

      await (SmsService as any).sendViaMobileSasa(MOCK_CONFIG, '254712345678', 'Test');

      const [, , options] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer decrypted_test_api_key');
    });

    it('strips trailing slash from baseUrl before building endpoint', async () => {
      const configWithTrailingSlash = { ...MOCK_CONFIG, smsBaseUrl: 'https://api.mobilesasa.com/' };
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { responseCode: '0200', messageId: 'ts1' },
      });

      await (SmsService as any).sendViaMobileSasa(configWithTrailingSlash, '254712345678', 'Hi');

      const [url] = (mockedAxios.post as jest.Mock).mock.calls[0];
      expect(url).toBe('https://api.mobilesasa.com/v1/send/bulk');
    });
  });

  // ─── Balance Check ──────────────────────────────────────────────────────────

  describe('getMobileSasaBalance', () => {
    it('calls the correct endpoint GET /v1/get-balance/account-details', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          status: true,
          responseCode: '0200',
          message: 'Balances loaded successfully.',
          balance: 170,
          internationalBalance: 0,
        },
      });

      await SmsService.getMobileSasaBalance(MOCK_CONFIG);

      const [url] = (mockedAxios.get as jest.Mock).mock.calls[0];
      expect(url).toBe('https://api.mobilesasa.com/v1/get-balance/account-details');
    });

    it('returns the correct balance when responseCode is "0200"', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          status: true,
          responseCode: '0200',
          message: 'Balances loaded successfully.',
          balance: 170,
          internationalBalance: 5,
          sms_rate: 0.6,
          postpaid_limit: 2000,
          remaining_postpaid: 2029,
          wallet_balance: 100,
          currency: 'KES',
          localAccountNumber: 'aPQQJ5',
          internationalAccountNumber: 'in-aPQQJ5',
          emailAccountNumber: 'em-aPQQJ5',
          walletAccountNumber: 'wl-aPQQJ5',
          paymentDetails: {
            mpesa: 'use paybill 4078003 & the respective destination account number'
          },
        },
      });

      const result = await SmsService.getMobileSasaBalance(MOCK_CONFIG);

      expect(result.success).toBe(true);
      expect(result.balance).toBe(170);
      expect(result.internationalBalance).toBe(5);
      expect(result.smsRate).toBe(0.6);
      expect(result.postpaidLimit).toBe(2000);
      expect(result.remainingPostpaid).toBe(2029);
      expect(result.walletBalance).toBe(100);
      expect(result.currency).toBe('KES');
      expect(result.localAccountNumber).toBe('aPQQJ5');
      expect(result.walletAccountNumber).toBe('wl-aPQQJ5');
      expect(result.paymentDetails?.mpesa).toContain('4078003');
    });

    it('returns failure when responseCode is not "0200"', async () => {
      mockedAxios.get = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: false, responseCode: '0401', message: 'Invalid API key' },
      });

      const result = await SmsService.getMobileSasaBalance(MOCK_CONFIG);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('returns failure when API key is missing', async () => {
      const configWithoutKey = { ...MOCK_CONFIG, smsApiKey: null };

      const result = await SmsService.getMobileSasaBalance(configWithoutKey);

      expect(result.success).toBe(false);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('returns failure when axios throws', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('Timeout'));

      const result = await SmsService.getMobileSasaBalance(MOCK_CONFIG);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('initiateMobileSasaTopUp', () => {
    it('initiates an M-Pesa STK push for the selected account', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          status: true,
          responseCode: '0200',
          message: 'Mpesa stk push sent to your phone successfully.',
        },
      });

      const result = await SmsService.initiateMobileSasaTopUp(MOCK_CONFIG, {
        phone: '0713612141',
        amount: 300,
        accountNo: 'aPQQJ5',
      });

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.mobilesasa.com/v1/mpesa/stk-push',
        {
          phone: '+254713612141',
          amount: 300,
          accountNo: 'aPQQJ5',
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer decrypted_test_api_key',
          }),
        })
      );
    });

    it('rejects invalid top-up details before calling MobileSasa', async () => {
      const result = await SmsService.initiateMobileSasaTopUp(MOCK_CONFIG, {
        phone: '123',
        amount: 5,
        accountNo: '',
      });

      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('returns the MobileSasa top-up error message', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: {
          status: false,
          responseCode: '0400',
          message: 'Unable to initiate STK push',
        },
      });

      const result = await SmsService.initiateMobileSasaTopUp(MOCK_CONFIG, {
        phone: '+254713612141',
        amount: 100,
        accountNo: 'aPQQJ5',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to initiate STK push');
    });
  });
});
