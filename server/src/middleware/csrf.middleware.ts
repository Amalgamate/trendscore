import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/error.util';

const store: Record<string, string> = {};

export const issueCsrfToken = (req: Request, res: Response) => {
  const key = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  store[key] = token;
  res.json({ success: true, token });
};

export const requireCsrf = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }
  const key = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const token = req.header('X-CSRF-Token') || '';
  if (!store[key] || store[key] !== token) {
    return next(new ApiError(403, 'Invalid CSRF token').withCode('ACCESS_DENIED'));
  }
  next();
};
