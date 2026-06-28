/**
 * Security Logging Utility
 * Tracks security-related events for audit trails
 */

import { Request } from 'express';
import logger from './logger';

export enum SecurityEventType {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  ADMIN_ACTION = 'ADMIN_ACTION',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  SECURITY_POLICY_VIOLATION = 'SECURITY_POLICY_VIOLATION',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR'
}

export interface SecurityLogEntry {
  timestamp: string;
  eventType: SecurityEventType;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  status: 'success' | 'failure';
  message: string;
  details?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Extract IP address from request
 */
export const getIpAddress = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Extract user agent from request
 */
export const getUserAgent = (req: Request): string => {
  return (req.headers['user-agent'] || '').slice(0, 500);
};

/**
 * Log security event
 */
export const logSecurityEvent = (entry: SecurityLogEntry): void => {
  const logData = {
    eventType: entry.eventType,
    userId: entry.userId,
    userEmail: entry.userEmail,
    ipAddress: entry.ipAddress,
    status: entry.status,
    riskLevel: entry.riskLevel,
    ...(entry.details && { details: entry.details })
  };

  if (entry.riskLevel === 'critical') {
    logger.error(logData, entry.message);
  } else if (['medium', 'high'].includes(entry.riskLevel)) {
    logger.warn(logData, entry.message);
  } else {
    logger.info(logData, entry.message);
  }

  // In production, send to the configured centralized logging service.
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to logging service
  }
};

/**
 * Log authentication failure
 */
export const logAuthFailure = (
  req: Request,
  email: string,
  reason: string,
  details?: Record<string, any>
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.AUTHENTICATION_FAILED,
    userEmail: email,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    status: 'failure',
    message: `Authentication failed: ${reason}`,
    details,
    riskLevel: 'medium'
  });
};

/**
 * Log authentication success
 */
export const logAuthSuccess = (
  req: Request,
  userId: string,
  email: string
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.AUTHENTICATION_SUCCESS,
    userId,
    userEmail: email,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    status: 'success',
    message: 'User authenticated successfully',
    riskLevel: 'low'
  });
};

/**
 * Log authorization denial
 */
export const logAuthorizationDenial = (
  req: Request,
  userId: string,
  resource: string,
  action: string,
  reason: string
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.AUTHORIZATION_DENIED,
    userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    resource,
    action,
    status: 'failure',
    message: `Authorization denied: ${reason}`,
    riskLevel: 'medium'
  });
};

/**
 * Log rate limit exceeded
 */
export const logRateLimitExceeded = (
  req: Request,
  endpoint: string,
  limit: number,
  window: number
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
    ipAddress: getIpAddress(req),
    resource: endpoint,
    status: 'failure',
    message: `Rate limit exceeded: ${limit} requests per ${window}ms`,
    details: { endpoint, limit, window },
    riskLevel: 'medium'
  });
};

/**
 * Log invalid input
 */
export const logInvalidInput = (
  req: Request,
  userId: string | undefined,
  fieldName: string,
  reason: string
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.INVALID_INPUT,
    userId,
    ipAddress: getIpAddress(req),
    resource: req.path,
    status: 'failure',
    message: `Invalid input received: ${fieldName} - ${reason}`,
    details: { fieldName, reason },
    riskLevel: 'low'
  });
};

/**
 * Log suspicious activity
 */
export const logSuspiciousActivity = (
  req: Request,
  userId: string | undefined,
  activityType: string,
  reason: string,
  details?: Record<string, any>
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    resource: req.path,
    status: 'failure',
    message: `Suspicious activity detected: ${activityType} - ${reason}`,
    details: {
      activityType,
      reason,
      ...details
    },
    riskLevel: 'high'
  });
};

/**
 * Log data access
 */
export const logDataAccess = (
  userId: string,
  resource: string,
  recordCount: number = 1
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.DATA_ACCESS,
    userId,
    resource,
    status: 'success',
    message: `User accessed ${recordCount} record(s)`,
    details: { recordCount },
    riskLevel: 'low'
  });
};

/**
 * Log data modification
 */
export const logDataModification = (
  userId: string,
  resource: string,
  action: 'create' | 'update' | 'delete',
  recordId: string,
  details?: Record<string, any>
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.DATA_MODIFICATION,
    userId,
    resource,
    action,
    status: 'success',
    message: `User ${action}d record in ${resource}`,
    details: {
      recordId,
      ...details
    },
    riskLevel: 'low'
  });
};

/**
 * Log admin action
 */
export const logAdminAction = (
  userId: string,
  action: string,
  targetResourceType: string,
  targetResourceId: string,
  details?: Record<string, any>
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.ADMIN_ACTION,
    userId,
    resource: targetResourceType,
    action,
    status: 'success',
    message: `Admin user performed action: ${action} on ${targetResourceType}`,
    details: {
      targetResourceId,
      ...details
    },
    riskLevel: 'medium'
  });
};

/**
 * Log password change
 */
export const logPasswordChange = (
  userId: string,
  userEmail: string,
  req: Request
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.PASSWORD_CHANGED,
    userId,
    userEmail,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    status: 'success',
    message: 'User password changed',
    riskLevel: 'medium'
  });
};

/**
 * Log security policy violation
 */
export const logSecurityPolicyViolation = (
  userId: string | undefined,
  req: Request,
  policyName: string,
  reason: string,
  details?: Record<string, any>
): void => {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    eventType: SecurityEventType.SECURITY_POLICY_VIOLATION,
    userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
    resource: req.path,
    status: 'failure',
    message: `Security policy violation: ${policyName} - ${reason}`,
    details,
    riskLevel: 'critical'
  });
};
