import { loginSchema, phoneOtpRequestSchema, phoneOtpVerifySchema } from '../utils/validation.util';

describe('phone OTP validation contracts', () => {
  it('accepts password login payloads with email credentials', () => {
    expect(loginSchema.parse({
      email: 'USER@Example.com',
      password: 'Test123!',
    })).toEqual({
      email: 'user@example.com',
      password: 'Test123!',
      rememberMe: false,
    });
  });

  it('accepts password login payloads with phone credentials', () => {
    expect(loginSchema.parse({
      phone: '0712345678',
      password: 'Test123!',
    })).toEqual({
      phone: '0712345678',
      password: 'Test123!',
      rememberMe: false,
    });
  });

  it('rejects password login payloads without email or phone credentials', () => {
    expect(() => loginSchema.parse({ password: 'Test123!' })).toThrow();
  });

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
      rememberMe: false,
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
