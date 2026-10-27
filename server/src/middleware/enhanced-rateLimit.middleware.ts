/**
 * Enhanced Rate Limiting Middleware
 * Implements progressive rate limiting for sensitive endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logRateLimitExceeded } from '../utils/security-logging.util';
import { redisCacheService } from '../services/redis-cache.service';
import { ApiError } from '../utils/error.util';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  failedAttempts?: number;
}

interface AuthRateLimitOptions {
  skip?: (req: Request) => boolean;
}

/**
 * Get client identifier (IP address)
 */
const getClientId = (req: Request): string => {
  // Express resolves forwarded addresses using the application's trusted
  // proxy configuration. Do not key limits from caller-controlled headers.
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const incrementRateLimitEntry = async (
  key: string,
  windowMs: number,
  metadataKey = key,
): Promise<RateLimitEntry> => {
  const now = Date.now();
  const count = await redisCacheService.incrementSecurityCounter(key, Math.ceil(windowMs / 1000));
  const metadata = await redisCacheService.get<RateLimitEntry>(metadataKey);
  return {
    count,
    resetAt: metadata?.resetAt && metadata.resetAt > now ? metadata.resetAt : now + windowMs,
    failedAttempts: metadata?.failedAttempts ?? 0,
  };
};

const handleRateLimitStoreFailure = (next: NextFunction, error: unknown): void => {
  console.error('[RateLimit Error]', error);
  if (process.env.NODE_ENV === 'production') {
    next(new ApiError(503, 'Request protection is temporarily unavailable').withCode('RATE_LIMIT_UNAVAILABLE'));
    return;
  }
  next();
};

/**
 * Standard rate limiter middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientId(req);
      // Include method + mounted path so GET list and POST create do not share one counter (both used req.path "/")
      const routeKey = `${req.baseUrl || ''}${req.path || '/'}`.replace(/\/{2,}/g, '/') || '/';
      const key = `rl:${clientId}:${req.method}:${routeKey}`;
      
      const entry = await incrementRateLimitEntry(key, config.windowMs);

      // Set rate limit headers
      res.setHeader('RateLimit-Limit', config.maxRequests);
      res.setHeader('RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count));
      res.setHeader('RateLimit-Reset', new Date(entry.resetAt).toISOString());

      if (entry.count > config.maxRequests) {
        logRateLimitExceeded(req, req.path, config.maxRequests, config.windowMs);
        
        res.status(429).json({
          success: false,
          error: {
            message: config.message || 'Too many requests. Please try again later.'
          }
        });
        return;
      }

      next();
    } catch (e) {
      handleRateLimitStoreFailure(next, e);
    }
  };
};

/**
 * Progressive rate limiter that increases restrictions on repeated failures
 */
export const progressiveRateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientId(req);
      const metadataKey = `prl:${clientId}:${req.path}`;
      const counterKey = `${metadataKey}:count`;
      const metadata = await redisCacheService.get<RateLimitEntry>(metadataKey);
      const entry = await incrementRateLimitEntry(counterKey, config.windowMs, metadataKey);
      const resetAt = metadata?.resetAt && metadata.resetAt > Date.now()
        ? metadata.resetAt
        : entry.resetAt;
      const currentMetadata = metadata?.resetAt && metadata.resetAt > Date.now()
        ? metadata
        : { resetAt, failedAttempts: 0 };
      await redisCacheService.set(metadataKey, {
        ...currentMetadata,
        count: entry.count,
      }, Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));

      // Calculate dynamic limits based on failed attempts — only start
      // tightening after 3+ failures so a single typo doesn't lock you out.
      const failureMultiplier = Math.max(0, Math.min((entry.failedAttempts || 0) - 2, 5));
      const adjustedLimit = Math.max(3, Math.floor(config.maxRequests / (1 + failureMultiplier)));

      // Set rate limit headers
      res.setHeader('RateLimit-Limit', adjustedLimit);
      res.setHeader('RateLimit-Remaining', Math.max(0, adjustedLimit - entry.count));
      res.setHeader('RateLimit-Reset', new Date(entry.resetAt).toISOString());

      if (entry.count > adjustedLimit) {
        logRateLimitExceeded(req, req.path, adjustedLimit, config.windowMs);
        
        // Increase delay on subsequent requests
        const delay = Math.min(10000, 1000 * Math.pow(2, failureMultiplier));
        
        res.status(429).json({
          success: false,
          error: {
            message: `Too many requests. Please try again after ${Math.ceil(delay / 1000)} seconds.`,
            retryAfter: Math.ceil(delay / 1000)
          },
          headers: {
            'Retry-After': Math.ceil(delay / 1000)
          }
        });
        return;
      }

      next();
    } catch (e) {
      handleRateLimitStoreFailure(next, e);
    }
  };
};

/**
 * IP-based rate limiter (for entire IP, not per endpoint)
 */
export const ipRateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = getClientId(req);
      const key = `iprl:${clientId}`;

      const entry = await incrementRateLimitEntry(key, config.windowMs);

      res.setHeader('RateLimit-Limit', config.maxRequests);
      res.setHeader('RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count));
      res.setHeader('RateLimit-Reset', new Date(entry.resetAt).toISOString());

      if (entry.count > config.maxRequests) {
        logRateLimitExceeded(req, 'global', config.maxRequests, config.windowMs);
        
        res.status(429).json({
          success: false,
          error: {
            message: config.message || 'Too many requests from this IP. Please try again later.'
          }
        });
        return;
      }

      next();
    } catch (e) {
      handleRateLimitStoreFailure(next, e);
    }
  };
};

/**
 * Authentication rate limiter (specifically for login/register attempts)
 */
export const authRateLimit = (
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  options: AuthRateLimitOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.skip?.(req)) {
        next();
        return;
      }

      const clientId = getClientId(req);
      const identifier = req.body?.email || req.body?.username || clientId;
      const key = `authrl:${clientId}:${identifier}`;
      const now = Date.now();

      const entry = await incrementRateLimitEntry(`${key}:count`, windowMs, key);

      res.setHeader('RateLimit-Limit', maxAttempts);
      res.setHeader('RateLimit-Remaining', Math.max(0, maxAttempts - entry.count));
      res.setHeader('RateLimit-Reset', new Date(entry.resetAt).toISOString());

      if (entry.count > maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        
        logRateLimitExceeded(req, `${req.path} (${identifier})`, maxAttempts, windowMs);

        res.status(429).json({
          success: false,
          error: {
            message: `Too many authentication attempts. Please try again in ${retryAfter} seconds.`,
            retryAfter
          }
        });
        return;
      }

      await redisCacheService.set(key, {
        count: entry.count,
        resetAt: entry.resetAt,
        failedAttempts: entry.failedAttempts ?? 0,
      }, Math.ceil(windowMs / 1000));
      next();
    } catch (e) {
      handleRateLimitStoreFailure(next, e);
    }
  };
};

/**
 * Track failed authentication attempts
 */
export const recordAuthFailure = async (email: string, clientId: string): Promise<void> => {
  try {
    const key = `authrl:${clientId}:${email}`;
    const entry = await redisCacheService.get<RateLimitEntry>(key);

    if (entry) {
      entry.failedAttempts = (entry.failedAttempts || 0) + 1;
      const now = Date.now();
      const remainingSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      await redisCacheService.set(key, entry, remainingSeconds);
    }
  } catch (e) {
    console.error('[RateLimit Error]', e);
  }
};

/**
 * Clear rate limit for specific key (e.g., after successful auth)
 */
export const clearRateLimit = async (clientId: string, identifier: string, type: string = 'auth'): Promise<void> => {
  try {
    const prefix = type === 'auth' ? 'authrl' : type;
    const key = `${prefix}:${clientId}:${identifier}`;
    await redisCacheService.delete(key);
    await redisCacheService.delete(`${key}:count`);
  } catch (e) {
    console.error('[RateLimit Error]', e);
  }
};

/**
 * Cleanup old entries periodically to prevent memory leaks
 * NOTE: Redis natively handles TTL, so this is only needed if falling back to the memory cache in redisCacheService
 * Since redisCacheService itself cleans up its memory fallback, we do not need to do anything here.
 */
export const cleanupRateLimitStore = (): void => {
  // No-op. redisCacheService handles its own memory cleanup via setInterval.
};
