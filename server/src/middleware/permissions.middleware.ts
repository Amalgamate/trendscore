import { Request, Response, NextFunction } from 'express';
import { Permission, Role, hasPermission } from '../config/permissions';
import { getCanonicalRoles, hasAnyRole } from '../utils/roleNormalizer';
import prisma from '../config/database';
import { ApiError } from '../utils/error.util';

type InstitutionType = 'PRIMARY_CBC' | 'SECONDARY' | 'TERTIARY';

export interface School {
  id: string;
  name: string;
  institutionType: InstitutionType;
  [key: string]: any;
}

// Globally augment Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
        roles?: Role[];
      };
      school?: School;
      requestId?: string;
      resolvedInstitutionType?: string;
      requestedInstitutionType?: string | null;
    }
  }
}

/**
 * Extended Request interface with user information and common middleware properties
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
    roles?: Role[];
  };
  school?: School;
  file?: any;
  files?: any;
  headers: any;
  body: any;
  query: any;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Local normalizeRole / resolveNormalizedUserRoles helpers have been
// removed. Use getCanonicalRoles(req.user) or hasAnyRole(req.user, [...])
// from utils/roleNormalizer.ts everywhere in this file and in all guards.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware to check if user has required permission.
 * Denials are routed through next(ApiError) so the global error handler
 * emits the RFC-compliant payload with code + requestId.
 */
export const requirePermission = (permission: Permission) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      const userRoles = getCanonicalRoles(req.user);

      if (userRoles.length === 0) {
        return next(
          new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED')
        );
      }

      const allowed = userRoles.some(r => hasPermission(r as Role, permission));
      if (!allowed) {
        return next(
          new ApiError(403, 'Insufficient permissions')
            .withCode('ROLE_FORBIDDEN')
            .withRoles([permission], userRoles)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions.
 * Denials are routed through next(ApiError).
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      const userRoles = getCanonicalRoles(req.user);

      if (userRoles.length === 0) {
        return next(
          new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED')
        );
      }

      const ok = permissions.some(permission =>
        userRoles.some(r => hasPermission(r, permission))
      );

      if (!ok) {
        return next(
          new ApiError(403, 'Insufficient permissions')
            .withCode('ROLE_FORBIDDEN')
            .withRoles(permissions as string[], userRoles)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user has a specific role.
 * Denials are routed through next(ApiError) so the global error handler
 * emits a consistent { code, requestId, allowedRoles, userRoles } payload.
 */
export const requireRole = (roles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      const userRoles = getCanonicalRoles(req.user);

      if (userRoles.length === 0) {
        return next(
          new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED')
        );
      }

      if (!hasAnyRole(req.user, roles as string[])) {
        return next(
          new ApiError(403, 'Access denied')
            .withCode('ROLE_FORBIDDEN')
            .withRoles(roles as string[], userRoles)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware factory for resource-level access control.
 * All denial paths call next(ApiError) instead of res.status().json().
 */
export class ResourceAccessControl {
  /**
   * Check if user can access a specific learner.
   * - SUPER_ADMIN, ADMIN, HEAD_TEACHER: all learners
   * - TEACHER: learner edits allowed by EDIT_LEARNER permission
   * - PARENT: only own children
   */
  static canAccessLearner() {
    return async (req: AuthRequest, _res: Response, next: NextFunction) => {
      try {
        const userRoles = getCanonicalRoles(req.user);
        const userId    = req.user?.userId;

        if (!userRoles.length || !userId) {
          return next(
            new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED')
          );
        }

        if (hasAnyRole(req.user, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])) {
          return next();
        }

        if (hasAnyRole(req.user, ['ACCOUNTANT', 'RECEPTIONIST'])) {
          if (req.method === 'GET') return next();
          return next(
            new ApiError(403, 'You can only view learner information').withCode('ROLE_FORBIDDEN')
          );
        }

        if (hasAnyRole(req.user, ['TEACHER'])) {
          return next();
        }

        if (hasAnyRole(req.user, ['PARENT'])) {
          const learnerId = req.params.learnerId || req.params.id || req.body.learnerId || req.query.learnerId;
          if (!learnerId) return next();

          const learner = await prisma.learner.findUnique({
            where: { id: learnerId },
            select: { parentId: true }
          });

          if (learner && learner.parentId === userId) return next();
          return next(
            new ApiError(403, "You can only access your own children's information")
              .withCode('ACCESS_DENIED')
          );
        }

        return next(
          new ApiError(403, 'Cannot access this learner').withCode('ACCESS_DENIED')
        );
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Check if user can access a specific assessment.
   */
  static canAccessAssessment() {
    return async (req: AuthRequest, _res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;

        if (!req.user || !userId) {
          return next(
            new ApiError(401, 'Authentication required').withCode('AUTH_REQUIRED')
          );
        }

        if (hasAnyRole(req.user, ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'])) {
          return next();
        }

        if (hasAnyRole(req.user, ['TEACHER'])) {
          if (req.method === 'GET') return next();

          const id = req.params.id || req.body.id || req.body.assessmentId || req.body.testId;
          if (!id) return next();

          const [result, test, formative] = await Promise.all([
            prisma.summativeResult.findUnique({ where: { id: id as string }, select: { recordedBy: true } }),
            prisma.summativeTest.findUnique({ where: { id: id as string }, select: { createdBy: true } }),
            prisma.formativeAssessment.findUnique({ where: { id: id as string }, select: { teacherId: true } })
          ]);

          const isOwner =
            (result?.recordedBy === userId) ||
            (test?.createdBy === userId) ||
            (formative?.teacherId === userId);

          if (isOwner) return next();

          return next(
            new ApiError(403, 'You can only modify assessments you recorded or tests you created')
              .withCode('ROLE_FORBIDDEN')
          );
        }

        if (hasAnyRole(req.user, ['PARENT'])) {
          if (req.method === 'GET') {
            const learnerId = req.query.learnerId || req.body.learnerId;
            if (!learnerId) return next();

            const learner = await prisma.learner.findUnique({
              where: { id: learnerId as string },
              select: { parentId: true }
            });

            if (learner && learner.parentId === userId) return next();
            return next(
              new ApiError(403, 'You can only view assessments for your own children')
                .withCode('ACCESS_DENIED')
            );
          }
          return next(
            new ApiError(403, 'Parents can only view assessments').withCode('ROLE_FORBIDDEN')
          );
        }

        return next(
          new ApiError(403, 'Cannot access this assessment').withCode('ACCESS_DENIED')
        );
      } catch (error) {
        next(error);
      }
    };
  }
}

/**
 * Audit log middleware — persists sensitive operations to the database.
 * Failures are logged but never block the request.
 */
export const auditLog = (action: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          userId:    req.user?.userId  || null,
          userEmail: req.user?.email   || null,
          userRole:  req.user?.role    || null,
          ipAddress: req.ip            || null,
          method:    req.method,
          path:      req.path,
          params:    JSON.stringify(req.params),
        }
      });
    } catch (e) {
      console.error('[AUDIT] Failed to write audit log:', e);
    }
    next();
  };
};
