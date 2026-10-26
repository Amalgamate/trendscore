import { Request, Response, NextFunction } from 'express';

type Entry = { count: number; resetAt: number };
const buckets: Record<string, Entry> = {};

export const rateLimit = (max: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Express resolves forwarded addresses from the configured trusted proxy.
    // Never key limits from raw caller-controlled forwarding headers.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = buckets[key] || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    buckets[key] = entry;
    if (entry.count > max) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }
    next();
  };
};
