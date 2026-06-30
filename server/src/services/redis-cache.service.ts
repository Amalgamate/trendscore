/**
 * Redis Cache Service
 * 
 * Provides distributed caching with Redis
 * Falls back to in-memory cache if Redis is unavailable
 * 
 * Usage:
 *   const value = await redisCacheService.get('key');
 *   await redisCacheService.set('key', value, 300); // 5 min TTL
 */

import Redis from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class RedisCacheService {
  private redis: Redis | null = null;
  private memoryFallback = new Map<string, CacheEntry<any>>();
  private useRedis = false;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initialize();
    // Cleanup memory cache every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  private async initialize() {
    const isDev = process.env.NODE_ENV !== 'production';
    const hasRedisConfig = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
    if (!hasRedisConfig) {
      console.log('[Cache] No Redis config detected — using in-memory cache.');
      this.useRedis = false;
      return;
    }

    try {
      if (process.env.REDIS_URL) {
        const isTls = process.env.REDIS_URL.startsWith('rediss://');
        console.log(`[Cache] Connecting to Upstash Redis (TLS: ${isTls})…`);
        this.redis = new Redis(process.env.REDIS_URL, {
          // ── Upstash-safe settings ────────────────────────────────────────
          // lazyConnect: true means we don't start a TCP handshake until the
          // first actual command, avoiding a useless timeout on dyno startup.
          lazyConnect: true,
          // Hard cap: 3 retries with exponential backoff, then give up and fall
          // through to the memory cache. Without this cap, a bad Upstash URL
          // retries forever and blocks the whole process for minutes.
          retryStrategy: (times: number) => {
            const maxRetries = isDev ? 1 : 3;
            if (times > maxRetries) {
              console.warn(`[Cache] Upstash Redis unreachable after ${maxRetries} retries — using memory fallback`);
              this.useRedis = false;
              return null; // stop retrying
            }
            return isDev ? 100 : Math.min(times * 200, 2000);
          },
          connectTimeout:       isDev ? 1_500 : 8_000,
          commandTimeout:       5_000,  // 5 s per command max
          enableReadyCheck:     false,  // skip PING on connect (saves 1 RTT)
          enableOfflineQueue:   false,  // drop commands that arrive while disconnected
          maxRetriesPerRequest: 2,
          ...(isTls ? { tls: {} } : {}),
        });
      } else {
        this.redis = new Redis({
          host:     process.env.REDIS_HOST || 'localhost',
          port:     parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          db:       parseInt(process.env.REDIS_DB || '0', 10),
          lazyConnect: true,
          retryStrategy: (times: number) => {
            const maxRetries = isDev ? 1 : 3;
            if (times > maxRetries) { this.useRedis = false; return null; }
            return isDev ? 100 : Math.min(times * 200, 2000);
          },
          connectTimeout:       isDev ? 1_500 : 5_000,
          commandTimeout:       5_000,
          enableReadyCheck:     false,
          enableOfflineQueue:   false,
          maxRetriesPerRequest: 2,
        });
      }

      this.redis.on('connect', () => {
        this.useRedis = true;
        console.log('[Cache] Connected to Redis ✅');
      });

      this.redis.on('ready', () => {
        this.useRedis = true;
      });

      this.redis.on('error', (err) => {
        // Only log once per error burst to avoid flooding the logs
        if (this.useRedis) {
          console.warn(`[Cache] Redis error: ${err.message} — falling back to memory cache`);
        }
        this.useRedis = false;
      });

      this.redis.on('close', () => {
        this.useRedis = false;
      });

      // Eagerly connect so the first request is not delayed by the handshake.
      // Errors are handled by the event listeners above; we don’t await so
      // the server boot is not blocked by a slow Redis connect.
      this.redis.connect().catch(() => {
        // swallow — the error event handler above already sets useRedis=false
      });

    } catch (error) {
      console.warn(`[Cache] Redis init error: ${error} — using memory fallback`);
      this.useRedis = false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.redis) {
        const value = await this.redis.get(key);
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      } else {
        // Memory fallback
        const entry = this.memoryFallback.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
          this.memoryFallback.delete(key);
          return null;
        }

        return entry.value as T;
      }
    } catch (error) {
      console.error(`[Cache] Get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.useRedis && this.redis) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        // Memory fallback
        const expiresAt = Date.now() + ttlSeconds * 1000;
        this.memoryFallback.set(key, { value, expiresAt });
      }
    } catch (error) {
      console.error(`[Cache] Set error for key ${key}:`, error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.useRedis && this.redis) {
        const result = await this.redis.del(key);
        return result > 0;
      } else {
        return this.memoryFallback.delete(key);
      }
    } catch (error) {
      console.error(`[Cache] Delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete all cache entries whose keys start with the given prefix
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      let deletedCount = 0;

      if (this.useRedis && this.redis) {
        const stream = this.redis.scanStream({
          match: `${prefix}*`,
          count: 100
        });

        for await (const keys of stream) {
          if (keys.length > 0) {
            const deleted = await this.redis.del(...keys);
            deletedCount += deleted;
          }
        }
      } else {
        // Memory fallback
        for (const key of this.memoryFallback.keys()) {
          if (key.startsWith(prefix)) {
            if (this.memoryFallback.delete(key)) {
              deletedCount++;
            }
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error(`[Cache] DeleteByPrefix error for prefix ${prefix}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.flushdb();
      } else {
        this.memoryFallback.clear();
      }
    } catch (error) {
      console.error('[Cache] Clear error:', error);
    }
  }

  /**
   * Get cache info
   */
  getInfo() {
    return {
      backend: this.useRedis ? 'Redis' : 'Memory',
      memorySize: this.memoryFallback.size,
    };
  }

  /**
   * Cleanup expired memory entries
   */
  private cleanupMemory() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryFallback.entries()) {
      if (now > entry.expiresAt) {
        this.memoryFallback.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Memory cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }

    this.memoryFallback.clear();
  }
}

// Export singleton instance
export const redisCacheService = new RedisCacheService();

// Cleanup on process exit
process.on('exit', () => {
  redisCacheService.destroy();
});

process.on('SIGINT', () => {
  redisCacheService.destroy();
  process.exit(0);
});
