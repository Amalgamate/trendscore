import { Response, NextFunction } from 'express';
import { AuthRequest } from './permissions.middleware';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../utils/error.util';
import { Role } from '../config/permissions';
import { normalizeRole, getCanonicalRoles } from '../utils/roleNormalizer';
import { isTokenGloballyInvalidated } from '../services/auth-session.service';
import { redisCacheService, SecurityStateUnavailableError } from '../services/redis-cache.service';
import { revokedImpersonationKey } from '../services/impersonation.service';
import prisma from '../config/database';

export type { AuthRequest };

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('__cookie__')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED');
    }

    const decoded = verifyAccessToken(token);
    if (await isTokenGloballyInvalidated(decoded)) {
      throw new ApiError(401, 'Session invalidated by administrator').withCode('FORCE_LOGOUT');
    }

    if (decoded.isImpersonation && await redisCacheService.getSecurityValue(revokedImpersonationKey(token))) {
      throw new ApiError(401, 'Impersonation session has been revoked').withCode('TOKEN_REVOKED');
    }

    const userId = decoded.userId;
    let currentUser;
    try {
      currentUser = userId ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, roles: true, status: true, archived: true, institutionType: true, authVersion: true },
      }) : null;
    } catch {
      throw new ApiError(503, 'Authentication service is temporarily unavailable').withCode('AUTH_STATE_UNAVAILABLE');
    }
    if (!currentUser || currentUser.status !== 'ACTIVE' || currentUser.archived) {
      throw new ApiError(401, 'Account is inactive').withCode('ACCOUNT_INACTIVE');
    }
    if ((decoded.authVersion ?? 0) !== currentUser.authVersion) {
      throw new ApiError(401, 'Session invalidated by account security change').withCode('SESSION_REVOKED');
    }
    const tokenRoles = getCanonicalRoles(decoded).sort();
    const databaseRoles = getCanonicalRoles(currentUser).sort();
    if (tokenRoles.length !== databaseRoles.length || tokenRoles.some((role, index) => role !== databaseRoles[index])) {
      throw new ApiError(401, 'Session role claims are no longer current').withCode('SESSION_REVOKED');
    }

    // ── Validate impersonation payload integrity (Requirement 6.4) ───────────
    // If the token claims isImpersonation:true it MUST also carry originalAdminId.
    // Reject early to prevent partially-formed sessions from reaching handlers.
    if (decoded.isImpersonation === true) {
      if (!decoded.originalAdminId || (decoded.originalAdminId as string).trim() === '') {
        throw new ApiError(401, 'Invalid impersonation token: missing originalAdminId').withCode('INVALID_TOKEN');
      }
      const administrator = await prisma.user.findUnique({
        where: { id: decoded.originalAdminId },
        select: { role: true, roles: true, status: true, archived: true },
      });
      const administratorRoles = getCanonicalRoles(administrator);
      if (!administrator || administrator.status !== 'ACTIVE' || administrator.archived ||
          !administratorRoles.some(role => role === 'ADMIN' || role === 'SUPER_ADMIN')) {
        throw new ApiError(401, 'Impersonation owner is no longer authorized').withCode('SESSION_REVOKED');
      }
    }

    // Normalize roles exactly once at the auth boundary.
    // From this point req.user.role and req.user.roles are always canonical —
    // no downstream guard or controller should re-normalize.
    const canonicalRole  = normalizeRole(currentUser.role) as Role;
    const canonicalRoles = getCanonicalRoles(currentUser) as Role[];

    // ── Propagate impersonation claims to req.user (Requirements 6.1, 6.2) ──
    req.user = {
      ...decoded,
      userId: currentUser.id,
      email: currentUser.email,
      institutionType: currentUser.institutionType,
      role: canonicalRole,
      roles: canonicalRoles,
      isImpersonation: !!decoded.isImpersonation,
      originalAdminId: decoded.originalAdminId,
    };
    req.accessToken = token;

    next();
  } catch (error: unknown) {
    const authError = error instanceof Error ? error : new Error('Unknown authentication error');
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error(`[Auth] Authentication failed: ${authError.message} (Name: ${authError.name})`);
    }

    if (error instanceof ApiError) {
      next(error);
    } else if (authError.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Token expired').withCode('TOKEN_EXPIRED'));
    } else if (authError.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid token').withCode('INVALID_TOKEN'));
    } else if (error instanceof SecurityStateUnavailableError) {
      next(new ApiError(503, 'Authentication service is temporarily unavailable').withCode('AUTH_STATE_UNAVAILABLE'));
    } else {
      next(new ApiError(401, 'Authentication failed').withCode('AUTH_REQUIRED'));
    }
  }
};

/**
 * Optional auth: attach req.user when a valid token is present; continue
 * anonymously when absent or invalid. Applies the same canonical role
 * normalization as authenticate() so that mixed routes get consistent
 * req.user shape regardless of which middleware path runs.
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('__cookie__')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next();
    }

    const decoded = verifyAccessToken(token);
    if (await isTokenGloballyInvalidated(decoded)) {
      return next();
    }

    if (decoded.isImpersonation && await redisCacheService.getSecurityValue(revokedImpersonationKey(token))) {
      return next();
    }

    const userId = decoded.userId;
    const currentUser = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, roles: true, status: true, archived: true, institutionType: true, authVersion: true },
    }) : null;
    if (!currentUser || currentUser.status !== 'ACTIVE' || currentUser.archived || (decoded.authVersion ?? 0) !== currentUser.authVersion) {
      return next();
    }
    if (decoded.isImpersonation) {
      if (!decoded.originalAdminId?.trim()) return next();
      const administrator = await prisma.user.findUnique({
        where: { id: decoded.originalAdminId },
        select: { role: true, roles: true, status: true, archived: true },
      });
      const administratorRoles = getCanonicalRoles(administrator);
      if (!administrator || administrator.status !== 'ACTIVE' || administrator.archived ||
          !administratorRoles.some(role => role === 'ADMIN' || role === 'SUPER_ADMIN')) return next();
    }
    const tokenRoles = getCanonicalRoles(decoded).sort();
    const databaseRoles = getCanonicalRoles(currentUser).sort();
    if (tokenRoles.length !== databaseRoles.length || tokenRoles.some((role, index) => role !== databaseRoles[index])) return next();

    // Mirror authenticate(): normalize at the boundary so all downstream
    // code sees canonical roles whether or not auth was required.
    const canonicalRole  = normalizeRole(currentUser.role) as Role;
    const canonicalRoles = getCanonicalRoles(currentUser) as Role[];

    // Propagate impersonation claims (Requirements 6.1, 6.2).
    req.user = {
      ...decoded,
      userId: currentUser.id,
      email: currentUser.email,
      institutionType: currentUser.institutionType,
      role: canonicalRole,
      roles: canonicalRoles,
      isImpersonation: !!decoded.isImpersonation,
      originalAdminId: decoded.originalAdminId,
    };
    req.accessToken = token;

    next();
  } catch {
    // For optional auth, ignore invalid/expired token and continue as anonymous.
    next();
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    // req.user.roles is pre-normalized by authenticate() — no local alias resolution needed.
    const userRoles = getCanonicalRoles(req.user);
    if (!req.user || !userRoles.some(r => (roles as string[]).includes(r))) {
      return next(
        new ApiError(403, 'Access denied')
          .withCode('ROLE_FORBIDDEN')
          .withRoles(roles as string[], userRoles)
      );
    }
    next();
  };
};
