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
};

const mockedInvalidated = isTokenGloballyInvalidated as jest.Mock;
const mockedAccessToken = generateAccessToken as jest.Mock;
const mockedRefreshToken = generateRefreshToken as jest.Mock;
const mockedVerifyRefresh = verifyRefreshToken as jest.Mock;

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(pair).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });
    expect(mockedAccessToken).toHaveBeenCalledWith(user);
    expect(mockedRefreshToken).toHaveBeenCalledWith(user);
  });

  it('sets auth cookies with the existing names and max ages', () => {
    const cookie = jest.fn();
    const res = { cookie } as unknown as Response;

    service.setTokenCookies(res, 'access.jwt', 'refresh.jwt');

    expect(cookie).toHaveBeenCalledWith(
      'accessToken',
      'access.jwt',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 24 * 60 * 60 * 1000 })
    );
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      'refresh.jwt',
      expect.objectContaining({ httpOnly: true, path: '/', maxAge: 24 * 60 * 60 * 1000 })
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
    mockedRedis.get.mockResolvedValue(null);
    mockedInvalidated.mockResolvedValue(false);
    const user = {
      id: 'user-1',
      email: 'user@example.test',
      role: 'ADMIN',
      roles: ['ADMIN'],
      institutionType: 'PRIMARY_CBC',
      status: 'ACTIVE',
    };
    mockedPrisma.user.findUnique.mockResolvedValue(user);

    const pair = await service.rotateRefreshToken('old.refresh.jwt');

    expect(mockedVerifyRefresh).toHaveBeenCalledWith('old.refresh.jwt');
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(mockedRedis.set).toHaveBeenCalledWith('revoked_rt:old.refresh.jwt', '1', 24 * 60 * 60);
    expect(pair).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });
  });

  it('rejects a refresh token that was already revoked', async () => {
    mockedRedis.get.mockResolvedValue('1');

    await expect(service.rotateRefreshToken('old.refresh.jwt')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token has already been used',
    });
    expect(mockedVerifyRefresh).not.toHaveBeenCalled();
  });

  it('revokes and rejects globally invalidated refresh tokens', async () => {
    mockedRedis.get.mockResolvedValue(null);
    mockedInvalidated.mockResolvedValue(true);

    await expect(service.rotateRefreshToken('old.refresh.jwt')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session invalidated by administrator',
    });
    expect(mockedRedis.set).toHaveBeenCalledWith('revoked_rt:old.refresh.jwt', '1', 24 * 60 * 60);
  });
});
