import { Response } from 'express';
import { User } from '@prisma/client';
import prisma from '../config/database';
import { redisCacheService, SecurityStateUnavailableError } from './redis-cache.service';
import { isTokenGloballyInvalidated } from './auth-session.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { ApiError } from '../utils/error.util';
import { normalizeRole } from '../utils/roleNormalizer';

const SESSION_TTL_SECONDS = 24 * 60 * 60;
const REMEMBERED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const revokedTokenKey = (token: string) => `revoked_rt:${token}`;

type TokenUser = Pick<User, 'id' | 'email' | 'role' | 'roles' | 'institutionType'> &
  Partial<Pick<User, 'authVersion'>>;

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
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

  issueTokenPair(user: TokenUser, rememberMe = false): AuthTokenPair {
    return {
      accessToken: generateAccessToken(user),
      refreshToken: generateRefreshToken(user, rememberMe),
      rememberMe,
    };
  }

  setTokenCookies(res: Response, accessToken: string, refreshToken: string, rememberMe = false): void {
    const commonOptions = this.getCookieOptions();

    res.cookie('accessToken', accessToken, {
      ...commonOptions,
      ...(rememberMe ? { maxAge: SESSION_TTL_SECONDS * 1000 } : {}),
    });

    res.cookie('refreshToken', refreshToken, {
      ...commonOptions,
      ...(rememberMe ? { maxAge: REMEMBERED_SESSION_TTL_SECONDS * 1000 } : {}),
    });
  }

  clearTokenCookies(res: Response): void {
    const commonOptions = this.getCookieOptions();
    res.clearCookie('accessToken', commonOptions);
    res.clearCookie('refreshToken', commonOptions);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await redisCacheService.setSecurityValue(revokedTokenKey(token), '1', REMEMBERED_SESSION_TTL_SECONDS);
  }

  async isRefreshTokenRevoked(token: string): Promise<boolean> {
    const val = await redisCacheService.getSecurityValue<string>(revokedTokenKey(token));
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
        throw new ApiError(401, 'Session invalidated by administrator').withCode('FORCE_LOGOUT');
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.status !== 'ACTIVE' || user.archived || (decoded.authVersion ?? 0) !== user.authVersion) {
        throw new ApiError(401, 'Invalid user or account inactive');
      }
      if (decoded.role) {
        const previousRoles = Array.from(new Set([decoded.role, ...(decoded.roles ?? [])].map(normalizeRole))).sort();
        const currentRoles = Array.from(new Set([user.role, ...user.roles].map(normalizeRole))).sort();
        if (previousRoles.length !== currentRoles.length || previousRoles.some((role, index) => role !== currentRoles[index])) {
          throw new ApiError(401, 'Session roles changed; sign in again').withCode('SESSION_REVOKED');
        }
      }

      const consumed = await redisCacheService.setSecurityValueIfAbsent(
        revokedTokenKey(refreshToken), '1', REMEMBERED_SESSION_TTL_SECONDS
      );
      if (!consumed) throw new ApiError(401, 'Refresh token has already been used');
      return this.issueTokenPair(user, decoded.rememberMe === true);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof SecurityStateUnavailableError) {
        throw new ApiError(503, 'Authentication service is temporarily unavailable').withCode('AUTH_STATE_UNAVAILABLE');
      }
      throw new ApiError(401, 'Invalid refresh token');
    }
  }
}

export const authTokenService = new AuthTokenService();
