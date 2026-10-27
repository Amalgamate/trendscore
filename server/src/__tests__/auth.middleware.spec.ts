jest.mock('../config/database', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));

jest.mock('../utils/jwt.util', () => ({
  verifyAccessToken: jest.fn(),
}));

jest.mock('../services/auth-session.service', () => ({
  isTokenGloballyInvalidated: jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/redis-cache.service', () => {
  class SecurityStateUnavailableError extends Error {}
  return {
    SecurityStateUnavailableError,
    redisCacheService: { getSecurityValue: jest.fn().mockResolvedValue(null) },
  };
});

import prisma from '../config/database';
import { verifyAccessToken } from '../utils/jwt.util';
import { authenticate } from '../middleware/auth.middleware';
import { ApiError } from '../utils/error.util';
import { SecurityStateUnavailableError, redisCacheService } from '../services/redis-cache.service';

const userLookup = prisma.user.findUnique as jest.Mock;
const verify = verifyAccessToken as jest.Mock;
const activeUser = {
  id: 'user-1', email: 'current@example.test', role: 'DEPUTY_HEAD_TEACHER',
  roles: ['DEPUTY_HEAD_TEACHER'], status: 'ACTIVE', archived: false,
  institutionType: 'PRIMARY_CBC', authVersion: 3,
};

describe('authenticate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReturnValue({
      userId: 'user-1', email: 'current@example.test', role: 'DEPUTY_HEAD_TEACHER',
      roles: ['DEPUTY_HEAD_TEACHER'], authVersion: 3, iat: 100,
    });
    userLookup.mockResolvedValue(activeUser);
  });

  it('uses the current account identity and canonical roles', async () => {
    const req: any = { headers: { authorization: 'Bearer valid.token' }, cookies: {} };
    const next = jest.fn();

    await authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({
      userId: 'user-1', email: 'current@example.test', role: 'DEPUTY_HEAD_TEACHER',
      roles: ['DEPUTY_HEAD_TEACHER'],
    });
  });

  it('rejects access tokens with stale role claims', async () => {
    verify.mockReturnValue({ userId: 'user-1', role: 'HEAD_TEACHER', roles: ['HEAD_TEACHER'], authVersion: 3 });
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer valid.token' }, cookies: {} } as any, {} as any, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: 'SESSION_REVOKED' });
  });

  it('rejects tokens invalidated by logout or an account security change', async () => {
    verify.mockReturnValue({ userId: 'user-1', authVersion: 2 });
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer valid.token' }, cookies: {} } as any, {} as any, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: 'SESSION_REVOKED' });
  });

  it('rejects inactive and archived accounts immediately', async () => {
    userLookup.mockResolvedValue({ ...activeUser, status: 'INACTIVE' });
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer valid.token' }, cookies: {} } as any, {} as any, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: 'ACCOUNT_INACTIVE' });
  });

  it('returns a service-unavailable error when shared security state cannot be checked', async () => {
    verify.mockReturnValue({
      userId: 'user-1', role: 'DEPUTY_HEAD_TEACHER', roles: ['DEPUTY_HEAD_TEACHER'],
      authVersion: 3, isImpersonation: true, originalAdminId: 'admin-1', iat: 100, exp: 200,
    });
    (redisCacheService.getSecurityValue as jest.Mock).mockRejectedValue(new SecurityStateUnavailableError());
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer valid.token' }, cookies: {} } as any, {} as any, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(ApiError);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503, code: 'AUTH_STATE_UNAVAILABLE' });
  });
});
