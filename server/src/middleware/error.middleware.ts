/**
 * error.middleware.ts
 *
 * Global error handler — emits the RFC-compliant structured error schema.
 *
 * 401/403 payload shape (RFC §7):
 * {
 *   success: false,
 *   code: "ROLE_FORBIDDEN",
 *   message: "Access denied",
 *   requiredRoles: [...],
 *   userRoles: [...],
 *   requestedInstitutionType: "SECONDARY",
 *   resolvedInstitutionType: "PRIMARY_CBC",
 *   requestId: "req_..."
 * }
 *
 * 5xx payload shape:
 * {
 *   success: false,
 *   code: "INTERNAL_ERROR",
 *   message: "Internal server error",
 *   requestId: "req_..."
 * }
 *
 * Stack traces are never included in responses. DEBUG_ERRORS=true in development
 * mode adds them only to the server-side log, not the response.
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/error.util';
import logger from '../utils/logger';

/** Pull requestId off req — set by requestIdMiddleware */
const getRequestId = (req: Request): string =>
  (req as any).requestId ?? 'unknown';

export const errorHandler = (
  err:   Error,
  req:   Request,
  res:   Response,
  _next: NextFunction
): void => {
  const requestId = getRequestId(req);
  let statusCode  = 500;
  let message     = 'Internal server error';
  let code        = 'INTERNAL_ERROR';

  // Structured ApiError — preserves all RFC fields set by builder methods
  let requiredRoles:            string[] | undefined;
  let userRoles:                string[] | undefined;
  let requestedInstitutionType: string | null | undefined;
  let resolvedInstitutionType:  string | undefined;

  if (err instanceof ApiError) {
    statusCode                = err.statusCode;
    message                   = err.message;
    code                      = err.code        ?? deriveCode(err.statusCode);
    requiredRoles             = err.requiredRoles;
    userRoles                 = err.userRoles;
    requestedInstitutionType  = err.requestedInstitutionType;
    resolvedInstitutionType   = err.resolvedInstitutionType;
  }

  // JWT errors (thrown by jsonwebtoken before they reach ApiError wrapping)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Invalid token';
    code       = 'INVALID_TOKEN';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Token expired';
    code       = 'TOKEN_EXPIRED';
  }

  // Structured log — raw + normalized values available for debugging
  const logPayload = {
    requestId,
    code,
    statusCode,
    message:  err.message,
    route:    `${req.method} ${req.originalUrl}`,
    userId:   (req as any).user?.userId,
    email:    (req as any).user?.email,
    requiredRoles,
    userRoles,
    requestedInstitutionType,
    resolvedInstitutionType,
    ...(statusCode >= 500 && { stack: err.stack }),
  };

  if (statusCode >= 500) {
    logger.error(logPayload, '[ERROR] Unhandled server error');
  } else if (statusCode >= 400) {
    logger.warn(logPayload, '[ERROR] Request rejected');
  }

  // Ensure CORS headers survive crash responses (existing behaviour kept)
  const origin = req.headers.origin;
  if (origin && origin.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Build response — only include fields that are populated
  const body: Record<string, unknown> = {
    success: false,
    code,
    message,
    requestId,
  };

  // Stack traces are not included in responses. Use server logs for stack details.

  if (requiredRoles            !== undefined) body.requiredRoles            = requiredRoles;
  if (userRoles                !== undefined) body.userRoles                = userRoles;
  if (requestedInstitutionType !== undefined) body.requestedInstitutionType = requestedInstitutionType;
  if (resolvedInstitutionType  !== undefined) body.resolvedInstitutionType  = resolvedInstitutionType;

  res.status(statusCode).json(body);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success:   false,
    code:      'NOT_FOUND',
    message:   `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: getRequestId(req),
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveCode(statusCode: number): string {
  switch (statusCode) {
    case 401: return 'AUTH_REQUIRED';
    case 403: return 'ROLE_FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    default:  return statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  }
}
