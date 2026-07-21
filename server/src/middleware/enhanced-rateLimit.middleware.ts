/**
 * Enhanced Rate Limiting Middleware
 * Implements progressive rate limiting for sensitive endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logRateLimitExceeded } from '../utils/security-logging.util';
import { redisCacheService } from '../services/redis-cache.service';

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
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

const getRateLimitEntry = async (key: string, windowMs: number): Promise<RateLimitEntry> => {
  const now = Date.now();
  const entry = await redisCacheService.get<RateLimitEntry>(key);
  if (!entry || now > entry.resetAt) {
    return {
      count: 0,
      resetAt: now + windowMs,
      failedAttempts: 0
    };
  }
  return entry;
};

const saveRateLimitEntry = async (key: string, entry: RateLimitEntry, windowMs: number) => {
  // TTL is windowMs divided by 1000 to get seconds
  await redisCacheService.set(key, entry, Math.ceil(windowMs / 1000));
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
      
      const entry = await getRateLimitEntry(key, config.windowMs);
      entry.count++;
      await saveRateLimitEntry(key, entry, config.windowMs);

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
      console.error('[RateLimit Error]', e);
      next();
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
      const key = `prl:${clientId}:${req.path}`;

      const entry = await getRateLimitEntry(key, config.windowMs);
      entry.count++;

      // Calculate dynamic limits based on failed attempts
      const failureMultiplier = Math.min(entry.failedAttempts || 0, 5);
      const adjustedLimit = Math.max(1, Math.floor(config.maxRequests / (1 + failureMultiplier)));

      await saveRateLimitEntry(key, entry, config.windowMs);

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
      console.error('[RateLimit Error]', e);
      next();
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

      const entry = await getRateLimitEntry(key, config.windowMs);
      entry.count++;
      await saveRateLimitEntry(key, entry, config.windowMs);

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
      console.error('[RateLimit Error]', e);
      next();
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

      const entry = await getRateLimitEntry(key, windowMs);
      entry.count++;

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

      await saveRateLimitEntry(key, entry, windowMs);
      next();
    } catch (e) {
      console.error('[RateLimit Error]', e);
      next();
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
      // Re-save with remaining TTL (approximate by using resetAt)
      const now = Date.now();
      const remainingMs = Math.max(1000, entry.resetAt - now);
      await saveRateLimitEntry(key, entry, remainingMs);
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
