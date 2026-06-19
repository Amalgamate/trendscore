import { Response, NextFunction } from 'express';
import { AuthRequest } from './permissions.middleware';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../utils/error.util';
import { Role } from '../config/permissions';
import { normalizeRole, getCanonicalRoles } from '../utils/roleNormalizer';
import { isTokenGloballyInvalidated } from '../services/auth-session.service';

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

    // Normalize roles exactly once at the auth boundary.
    // From this point req.user.role and req.user.roles are always canonical —
    // no downstream guard or controller should re-normalize.
    const canonicalRole  = normalizeRole(decoded.role) as Role;
    const canonicalRoles = getCanonicalRoles(decoded) as Role[];
    req.user = { ...decoded, role: canonicalRole, roles: canonicalRoles };

    next();
  } catch (error: any) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error(`[Auth] Authentication failed: ${error.message} (Name: ${error.name})`);
    }

    if (error.name === 'TokenExpiredError') {
      next(new ApiError(401, 'Token expired').withCode('TOKEN_EXPIRED'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new ApiError(401, 'Invalid token').withCode('INVALID_TOKEN'));
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

    // Mirror authenticate(): normalize at the boundary so all downstream
    // code sees canonical roles whether or not auth was required.
    const canonicalRole  = normalizeRole(decoded.role) as Role;
    const canonicalRoles = getCanonicalRoles(decoded) as Role[];
    req.user = { ...decoded, role: canonicalRole, roles: canonicalRoles };

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
