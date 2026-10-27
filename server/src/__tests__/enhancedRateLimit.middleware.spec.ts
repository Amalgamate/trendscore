jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    incrementSecurityCounter: jest.fn(),
  },
}));

jest.mock('../utils/security-logging.util', () => ({
  logRateLimitExceeded: jest.fn(),
}));

import { authRateLimit } from '../middleware/enhanced-rateLimit.middleware';
import { redisCacheService } from '../services/redis-cache.service';
import { isFixedOtpPhone } from '../services/auth-phone-otp.service';

describe('authRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not count or block exempt fixed-OTP phone requests', async () => {
    const middleware = authRateLimit(3, 60_000, {
      skip: (req) => isFixedOtpPhone(req.body?.phone),
    });
    const req = {
      body: { phone: '0797985794' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      path: '/phone-otp/request',
    } as any;
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(redisCacheService.get).not.toHaveBeenCalled();
    expect(redisCacheService.set).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails closed in production when the shared rate-limit store is unavailable', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    (redisCacheService.incrementSecurityCounter as jest.Mock).mockRejectedValue(new Error('redis unavailable'));
    const middleware = authRateLimit(3, 60_000);
    const req = {
      body: { email: 'staff@example.test' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      path: '/login',
      ip: '127.0.0.1',
    } as any;
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503, code: 'RATE_LIMIT_UNAVAILABLE' });
    process.env.NODE_ENV = previousEnvironment;
  });
});
