import 'dotenv/config';
import { validateEnvironment } from './config/env-validator';

// Validate environment before anything else
validateEnvironment();

import app from './server';
import prisma from './config/database';
import http from 'http';
import { initializeSocket } from './services/socket.service';
import { ensureSuperAdmin } from './utils/setup-admin';
import logger from './utils/logger';
import { PRODUCT_DISPLAY_NAME } from './config/productIdentity';

const PORT = process.env.PORT || 5000;
const skipSuperAdminBootstrap = (process.env.SKIP_SUPERADMIN_BOOTSTRAP || 'false').toLowerCase() === 'true';

async function startServer() {
  try {
    // Phase 4: Explicit DB connection check for production stability
    await prisma.$connect();
    logger.info('✅ Database connection established');

    // Optional fast-dev optimization: skip bootstrap user upserts/hashing.
    if (skipSuperAdminBootstrap) {
      logger.warn('⚡ Skipping ensureSuperAdmin bootstrap (SKIP_SUPERADMIN_BOOTSTRAP=true)');
    } else {
      await ensureSuperAdmin();
    }

    const httpServer = http.createServer(app);
    const io = initializeSocket(httpServer);
    app.set('io', io);

    // Handle listen-time failures (e.g. a stale process still holding the port)
    // BEFORE calling listen() — otherwise Node throws an unhandled 'error' event
    // and the process dies with a raw stack trace instead of an actionable message.
    httpServer.on('error', async (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `❌ Port ${PORT} is already in use. Another process (often a leftover ` +
          `nodemon/tsx instance from a previous run) is still bound to it.\n` +
          `   Fix: run "npm run kill-ports" from the project root, or "npm run kill" ` +
          `from server/, then start the dev server again.`
        );
        await prisma.$disconnect().catch(() => {});
        process.exit(1);
        return;
      }

      logger.error(error, '❌ HTTP server error');
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });

    httpServer.listen(PORT, () => {
      const isDev = process.env.NODE_ENV !== 'production';

      const apiUrl = isDev
        ? `http://localhost:${PORT}/api`
        : (process.env.API_URL || `http://localhost:${PORT}/api`);

      const healthUrl = `${apiUrl}/health`;

      logger.info({
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        apiUrl,
        healthUrl
      }, `🚀 ${PRODUCT_DISPLAY_NAME} server started`);
    });
  } catch (error) {
    logger.error(error, '❌ Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Known non-fatal error patterns from background libraries (e.g. Baileys WhatsApp)
const KNOWN_NON_FATAL_PATTERNS = [
  'Connection Closed',
  'Connection Lost',
  'Connection Timed Out',
  'WebSocket was closed',
  'write EPIPE',
  'read ECONNRESET',
  'WebSocket connection',
  'Baileys',
];

function isKnownNonFatalError(error: Error): boolean {
  return KNOWN_NON_FATAL_PATTERNS.some(
    (pattern) => error?.message?.includes(pattern) || error?.stack?.includes(pattern)
  );
}

// Global error handlers — only suppress known non-fatal library errors.
// All other uncaught exceptions trigger a graceful exit so they don't go silently missing.
process.on('uncaughtException', (error) => {
  if (isKnownNonFatalError(error)) {
    logger.warn(error, '⚠️  Non-fatal uncaught exception (background library) — server continuing');
    return;
  }
  logger.error(error, '🚨 Uncaught Exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '🚨 Unhandled Rejection detected');
});

startServer();
