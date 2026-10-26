import { Response } from 'express';
import { ApiError } from '../utils/error.util';

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../services/redis-cache.service', () => ({
  redisCacheService: {
    get: jest.fn(),
    set: jest.fn(),
    getSecurityValue: jest.fn(),
    setSecurityValue: jest.fn(),
    setSecurityValueIfAbsent: jest.fn(),
  },
}));

jest.mock('../services/auth-session.service', () => ({
  isTokenGloballyInvalidated: jest.fn(),
}));

jest.mock('../utils/jwt.util', () => ({
  generateAccessToken: jest.fn(() => 'access.jwt'),
  generateRefreshToken: jest.fn(() => 'refresh.jwt'),
  verifyRefreshToken: jest.fn(() => ({ userId: 'user-1', iat: 100 })),
}));

import prisma from '../config/database';
import { redisCacheService } from '../services/redis-cache.service';
import { isTokenGloballyInvalidated } from '../services/auth-session.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { AuthTokenService } from '../services/auth-token.service';

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
};

const mockedRedis = redisCacheService as unknown as {
  get: jest.Mock;
  set: jest.Mock;
  getSecurityValue: jest.Mock;
  setSecurityValueIfAbsent: jest.Mock;
};

const mockedInvalidated = isTokenGloballyInvalidated as jest.Mock;
const mockedAccessToken = generateAccessToken as jest.Mock;
const mockedRefreshToken = generateRefreshToken as jest.Mock;
const mockedVerifyRefresh = verifyRefreshToken as jest.Mock;

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRedis.getSecurityValue.mockResolvedValue(null);
    mockedRedis.setSecurityValueIfAbsent.mockResolvedValue(true);
    service = new AuthTokenService();
  });

  it('issues access and refresh tokens through the shared JWT utility', () => {
    const user = {
      id: 'user-1',
      email: 'parent@example.test',
      role: 'PARENT',
      roles: ['PARENT'],
      institutionType: 'PRIMARY_CBC',
    } as any;

    const pair = service.issueTokenPair(user);

    expect(pair).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt', rememberMe: false });
    expect(mockedAccessToken).toHaveBeenCalledWith(user);
    expect(mockedRefreshToken).toHaveBeenCalledWith(user, false);
  });

  it('sets browser-session cookies when remember me is off', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    service.setTokenCookies(res, 'access.jwt', 'refresh.jwt');

    expect(cookie).toHaveBeenCalledWith(
      'accessToken',
      'access.jwt',
      expect.not.objectContaining({ maxAge: expect.any(Number) })
    );
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh.jwt',
      expect.not.objectContaining({ maxAge: expect.any(Number) })
    );
  });

  it('sets persistent access and 30-day refresh cookies when remember me is on', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    service.setTokenCookies(res, 'access.jwt', 'refresh.jwt', true);

    expect(cookie).toHaveBeenCalledWith(
      'accessToken',
      'access.jwt',
      expect.objectContaining({ maxAge: 24 * 60 * 60 * 1000 })
    );
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh.jwt',
      expect.objectContaining({ maxAge: 30 * 24 * 60 * 60 * 1000 })
    );
  });

  it('clears auth cookies with the existing names', () => {
    const clearCookie = jest.fn();
    const res = { clearCookie } as unknown as Response;

    service.clearTokenCookies(res);

    expect(clearCookie).toHaveBeenCalledWith('accessToken', expect.objectContaining({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    }));
    expect(clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    }));
  });

  it('rotates a valid refresh token and revokes the consumed token', async () => {
    mockedRedis.getSecurityValue.mockResolvedValue(null);
    mockedRedis.setSecurityValueIfAbsent.mockResolvedValue(true);
    mockedInvalidated.mockResolvedValue(false);
    const user = {
      id: 'user-1',
      email: 'user@example.test',
      role: 'ADMIN',
      roles: ['ADMIN'],
      institutionType: 'PRIMARY_CBC',
      status: 'ACTIVE',
      archived: false,
      authVersion: 0,
    };
    mockedPrisma.user.findUnique.mockResolvedValue(user);

    const pair = await service.rotateRefreshToken('old.refresh.jwt');

    expect(mockedVerifyRefresh).toHaveBeenCalledWith('old.refresh.jwt');
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(mockedRedis.setSecurityValueIfAbsent).toHaveBeenCalledWith('revoked_rt:old.refresh.jwt', '1', 30 * 24 * 60 * 60);
    expect(pair).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt', rememberMe: false });
  });

  it('rejects a refresh token that was already revoked', async () => {
    mockedRedis.getSecurityValue.mockResolvedValue('1');

    await expect(service.rotateRefreshToken('old.refresh.jwt')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token has already been used',
    });
    expect(mockedVerifyRefresh).not.toHaveBeenCalled();
  });

  it('revokes and rejects globally invalidated refresh tokens', async () => {
    mockedRedis.getSecurityValue.mockResolvedValue(null);
    mockedInvalidated.mockResolvedValue(true);

    await expect(service.rotateRefreshToken('old.refresh.jwt')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session invalidated by administrator',
    });
    expect(mockedRedis.setSecurityValueIfAbsent).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens whose role claims no longer match the account', async () => {
    mockedRedis.getSecurityValue.mockResolvedValue(null);
    mockedInvalidated.mockResolvedValue(false);
    mockedVerifyRefresh.mockReturnValue({
      userId: 'user-1', authVersion: 0, role: 'TEACHER', roles: ['TEACHER'], iat: 100,
    });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'user@example.test', role: 'ADMIN', roles: ['ADMIN'],
      institutionType: 'PRIMARY_CBC', status: 'ACTIVE', archived: false, authVersion: 0,
    });

    await expect(service.rotateRefreshToken('old.refresh.jwt')).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_REVOKED',
    });
    expect(mockedRedis.setSecurityValueIfAbsent).not.toHaveBeenCalled();
  });

  it('preserves remembered-session lifetime when rotating refresh tokens', async () => {
    mockedRedis.getSecurityValue.mockResolvedValue(null);
    mockedRedis.setSecurityValueIfAbsent.mockResolvedValue(true);
    mockedInvalidated.mockResolvedValue(false);
    mockedVerifyRefresh.mockReturnValue({ userId: 'user-1', rememberMe: true, iat: 100 });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'user@example.test', role: 'ADMIN', roles: ['ADMIN'],
      institutionType: 'PRIMARY_CBC', status: 'ACTIVE', archived: false, authVersion: 0,
    });

    const pair = await service.rotateRefreshToken('remembered.refresh.jwt');

    expect(mockedRefreshToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), true);
    expect(pair.rememberMe).toBe(true);
  });
});
