import { phoneOtpRequestSchema, phoneOtpVerifySchema } from '../utils/validation.util';

describe('phone OTP validation contracts', () => {
  it('accepts request payloads with a phone number', () => {
    expect(phoneOtpRequestSchema.parse({ phone: '0712345678' })).toEqual({ phone: '0712345678' });
  });

  it('rejects request payloads without a usable phone number', () => {
    expect(() => phoneOtpRequestSchema.parse({ phone: '123' })).toThrow();
  });

  it('accepts verify payloads with challenge id, phone, and 6 digit code', () => {
    expect(phoneOtpVerifySchema.parse({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    })).toEqual({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '123456',
    });
  });

  it('rejects verify payloads with malformed OTP codes', () => {
    expect(() => phoneOtpVerifySchema.parse({
      challengeId: 'challenge-1',
      phone: '0712345678',
      code: '12345',
    })).toThrow();
  });
});
