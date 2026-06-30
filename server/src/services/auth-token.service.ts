import { Response } from 'express';
import { User } from '@prisma/client';
import prisma from '../config/database';
import { redisCacheService } from './redis-cache.service';
import { isTokenGloballyInvalidated } from './auth-session.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { ApiError } from '../utils/error.util';

const SESSION_TTL_SECONDS = 24 * 60 * 60;

const revokedTokenKey = (token: string) => `revoked_rt:${token}`;

type TokenUser = Pick<User, 'id' | 'email' | 'role' | 'roles' | 'institutionType'>;

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthTokenService {
  private getCookieOptions(): any {
    const isProd = process.env.NODE_ENV === 'production';
    const secureCookies = (process.env.SECURE_COOKIES || '').toLowerCase() === 'true';
    const useSecureCookies = isProd ? secureCookies : false;

    return {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: useSecureCookies ? 'none' : 'lax',
      path: '/',
    };
  }

  issueTokenPair(user: TokenUser): AuthTokenPair {
    return {
      accessToken: generateAccessToken(user),
      refreshToken: generateRefreshToken(user),
    };
  }

  setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const commonOptions = this.getCookieOptions();

    res.cookie('accessToken', accessToken, {
      ...commonOptions,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      ...commonOptions,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }

  clearTokenCookies(res: Response): void {
    const commonOptions = this.getCookieOptions();
    res.clearCookie('accessToken', commonOptions);
    res.clearCookie('refreshToken', commonOptions);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await redisCacheService.set(revokedTokenKey(token), '1', SESSION_TTL_SECONDS);
  }

  async isRefreshTokenRevoked(token: string): Promise<boolean> {
    const val = await redisCacheService.get<string>(revokedTokenKey(token));
    return val !== null;
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair> {
    if (await this.isRefreshTokenRevoked(refreshToken)) {
      throw new ApiError(401, 'Refresh token has already been used');
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      if (await isTokenGloballyInvalidated(decoded)) {
        await this.revokeRefreshToken(refreshToken);
        throw new ApiError(401, 'Session invalidated by administrator');
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.status !== 'ACTIVE') {
        throw new ApiError(401, 'Invalid user or account inactive');
      }

      await this.revokeRefreshToken(refreshToken);
      return this.issueTokenPair(user);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'Invalid refresh token');
    }
  }
}

export const authTokenService = new AuthTokenService();
