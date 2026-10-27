import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import 'express-async-errors';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { sanitizeResponse, hideSensitiveHeaders, securityHeaders } from './middleware/response-sanitization.middleware';
import { ipRateLimit } from './middleware/enhanced-rateLimit.middleware';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import logger from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { schoolContextMiddleware } from './middleware/schoolContext.middleware';
import { institutionContextResolver } from './middleware/institutionContextResolver.middleware';

const app: Application = express();

// ── Request ID — must be first so every log line and error response is traceable
app.use(requestIdMiddleware);

// Use lightweight request logging in dev to keep local UI snappy.
// Only log errors and slow requests instead of every request payload.
const isDev = process.env.NODE_ENV !== 'production';
app.use(pinoHttp({
  logger: logger.pino,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (isDev) return 'silent';
    return 'info';
  }
}));

// Parse cookies before context/auth-sensitive middleware.
app.use(cookieParser());

// ── Institution context pipeline ───────────────────────────────────────────────
// schoolContextMiddleware  — populates req.school from DB (cached, normalized).
// institutionContextResolver — derives req.resolvedInstitutionType with
//   explicit precedence: header > tenant > default.
// All downstream routes read req.resolvedInstitutionType; nothing re-computes.
app.use(schoolContextMiddleware);
app.use(institutionContextResolver);

// Set to the exact number of trusted reverse-proxy hops. Public deployments
// without an ingress proxy should use 0 to prevent spoofed X-Forwarded-For IPs.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (isDev ? 1 : 0));
app.set('trust proxy', Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 0);

// Security middleware
app.use(helmet());

// Compress JSON/text API responses so slow links and small servers spend less
// time pushing repeated dashboard/list payloads over the network.
app.use(compression({
  threshold: 1024,
}));

// CORS - allow configured origins and local development
const configuredOrigins = [process.env.FRONTEND_URL]
  .filter((origin): origin is string => Boolean(origin))
  .map(origin => origin.replace(/\/$/, ''));
const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost',
  'capacitor://localhost',
  'https://localhost',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Normalize incoming origin (remove trailing slash for comparison)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? configuredOrigins
      : [...configuredOrigins, ...developmentOrigins];
    const isAllowed = allowedOrigins.includes(normalizedOrigin) ||
                     (process.env.NODE_ENV !== 'production' && normalizedOrigin.startsWith('file://'));
                     
    if (isAllowed) {
      callback(null, true);
    } else {
      // Log rejected origins to help with production diagnostics 
      logger.warn({ origin: origin, normalizedOrigin }, 'CORS request rejected');
      callback(null, false); // Return false instead of Error to allow standard CORS handling
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'x-branch-id',
    'x-school-id',
    'x-institution-type',
    'X-Institution-Type',
    'x-session-check',
    'X-Session-Check',
    'x-csrf-token',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
}));

// Global IP-based rate limiting  
app.use(ipRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Much higher limit in dev to accommodate HMR, React StrictMode double-renders
  maxRequests: process.env.NODE_ENV === 'production' ? 1000 : 10000,
  message: 'Too many requests from this IP. Please try again later.'
}));

// Response sanitization
app.use(sanitizeResponse);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', routes);

// DEBUG: Simple endpoint that bypasses all other middleware for diagnostics
app.get('/status', (_req, res) => {
  res.send('OK');
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
