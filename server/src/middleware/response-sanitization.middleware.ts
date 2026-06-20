/**
 * Response Sanitization Middleware
 * Prevents sensitive information leakage in API responses and
 * standardizes all error responses to a consistent JSON shape.
 */

import { Request, Response, NextFunction } from 'express';
import { escapeHtml } from '../utils/sanitization.util';

const STATUS_ERROR_THRESHOLD = 400;

/**
 * Middleware to sanitize API responses
 * Prevents XSS and information leakage
 */
export const sanitizeResponse = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const originalJson = res.json;

  res.json = function (data: any) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const statusCode = res.statusCode || 200;

    let payload = data;

    if (statusCode >= STATUS_ERROR_THRESHOLD || (data && data.success === false)) {
      payload = normalizeErrorPayload(data);
    }

    if (payload && payload.success === false && payload.error) {
      payload.error = sanitizeErrorResponse(payload.error, isDevelopment);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    return originalJson.call(this, payload);
  };

  next();
};

function normalizeErrorPayload(data: any): any {
  if (data == null) {
    return {
      success: false,
      error: { message: 'An unexpected error occurred' }
    };
  }

  if (typeof data === 'string') {
    return {
      success: false,
      error: { message: data }
    };
  }

  if (typeof data !== 'object') {
    return {
      success: false,
      error: { message: String(data) }
    };
  }

  const isAlreadyStandard = data.success === false && data.error && typeof data.error === 'object';
  if (isAlreadyStandard) {
    return data;
  }

  const message = data.error?.message || data.message || data.error || 'An error occurred';
  const errorObject = typeof message === 'object' ? message : { message };

  const normalized: any = {
    success: false,
    error: errorObject
  };

  if (data.error && typeof data.error === 'object') {
    normalized.error = { ...errorObject, ...data.error };
  }

  const errorCode = data.reasonCode || data.code;
  if (errorCode) {
    normalized.error.code = errorCode;
  }

  if (data.geofenceDecision && typeof data.geofenceDecision === 'object') {
    normalized.error.geofenceDecision = data.geofenceDecision;
  }

  return normalized;
}

/**
 * Sanitize error response to prevent information leakage
 */
function sanitizeErrorResponse(
  error: any,
  isDevelopment: boolean
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  if (error.message) {
    sanitized.message = escapeHtml(
      typeof error.message === 'string' ? error.message : String(error.message)
    );
  }

  if (error.code) {
    sanitized.code = escapeHtml(String(error.code));
  }

  if (error.geofenceDecision && typeof error.geofenceDecision === 'object') {
    sanitized.geofenceDecision = error.geofenceDecision;
  }

  if (isDevelopment && error.stack) {
    sanitized.stack = escapeHtml(String(error.stack));
  }

  if (error.details && Array.isArray(error.details)) {
    sanitized.details = error.details.map((detail: any) => {
      if (typeof detail === 'string') {
        return escapeHtml(detail);
      }
      return detail;
    });
  }

  const sensitivePatterns = ['password', 'token', 'secret', 'key', 'database', 'sql'];
  for (const [key, value] of Object.entries(error)) {
    if (
      !key.toLowerCase().includes('msg') &&
      !key.toLowerCase().includes('message') &&
      !key.toLowerCase().includes('code') &&
      !key.toLowerCase().includes('details') &&
      !sensitivePatterns.some((pattern) => key.toLowerCase().includes(pattern))
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to prevent sensitive data in response headers
 */
export const hideSensitiveHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.removeHeader('server');
  res.removeHeader('x-powered-by');
  res.removeHeader('x-aspnet-version');
  res.setHeader('Server', 'SecureServer/1.0');
  next();
};

/**
 * Middleware to sanitize outgoing cookies
 */
export const secureCookies = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const allowSecure = !isDevelopment && (process.env.SECURE_COOKIES || '').toLowerCase() === 'true';

  res.setHeader(
    'Set-Cookie',
    (res.getHeader('Set-Cookie') as string[])?.map((cookie) => {
      let secureCookie = cookie;

      if (allowSecure && !secureCookie.includes('Secure')) {
        secureCookie += '; Secure';
      }

      if (!secureCookie.includes('HttpOnly')) {
        secureCookie += '; HttpOnly';
      }

      if (!secureCookie.includes('SameSite')) {
        secureCookie += '; SameSite=Strict';
      }

      return secureCookie;
    }) || []
  );

  next();
};

/**
 * Middleware to prevent MIME type sniffing
 */
export const preventMimeSniffing = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
};

/**
 * Middleware to add security-related response headers
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');

  next();
};
