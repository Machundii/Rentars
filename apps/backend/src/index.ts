/**
 * Application entry point.
 *
 * dotenv is loaded before anything else so env vars are available when
 * config/env.ts runs its startup validation.  If any required variables are
 * missing or invalid, env.ts calls process.exit(1) with a full error report.
 *
 * Middleware order is intentional:
 *   1. securityMiddleware  — Helmet headers on every response, including errors
 *   2. corsMiddleware      — CORS preflight resolved before any auth/body parsing
 *   3. requestIdMiddleware — injects X-Request-Id before any logging happens
 *   4. body parsers        — JSON / multipart
 *   5. rateLimiter         — reject abusive traffic before heavy processing
 *   6. timeoutMiddleware   — bound long-running handlers
 *   7. requestLoggingMiddleware — structured per-request log on response finish
 *   8. metricsMiddleware   — record latency / counts on response finish
 *   9. metricsRouter       — /metrics scrape endpoint (before app routes)
 *  10. routes              — application routes
 *  11. errorMiddleware     — structured error logging + error responses
 */

import 'dotenv/config'; // must be first import
import { env } from './config/env.js';
import express from 'express';

// ── Observability & security middleware ───────────────────────────────────────
import { securityMiddleware } from './middleware/security.middleware.js';
import { corsMiddleware } from './middleware/cors.middleware.js';
import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  structuredLog,
} from './middleware/logging.middleware.js';
import { metricsMiddleware, metricsRouter } from './middleware/metrics.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';

// ── Core middleware ───────────────────────────────────────────────────────────
import { rateLimiter } from './middleware/rateLimiter.js';
import { timeoutMiddleware } from './middleware/timeout.middleware.js';

// ── Routes & services ─────────────────────────────────────────────────────────
import routes from './routes/index.js';
import { setupOpenApiRoutes } from './config/swagger.js';
import { validateBlockchainConfig } from './blockchain/config.js';
import { startSyncScheduler } from './services/cleanup-schedular.js';
import { startRateRefreshLoop } from './services/exchangeRate.service.js';

// ── Validate blockchain config early (before the server binds) ────────────────
const configErrors = validateBlockchainConfig();
if (configErrors.length > 0) {
  const errorDetails = configErrors
    .map((err) => `  - ${err.field}: ${err.message}`)
    .join('\n');
  structuredLog({
    level: 'error',
    message: 'Blockchain configuration validation failed',
    timestamp: new Date().toISOString(),
    details: errorDetails,
  });
  process.exit(1);
}

export const app = express();

// ── 1. Security headers (must be first — applies to every response) ───────────
app.use(securityMiddleware);

// ── 2. CORS (resolved before body parsing and auth) ──────────────────────────
app.use(corsMiddleware);

// ── 3. Request-ID injection ───────────────────────────────────────────────────
app.use(requestIdMiddleware);

// ── 4. Body parsers ───────────────────────────────────────────────────────────
const JSON_BODY_LIMIT = env.JSON_BODY_LIMIT;
app.use((req, res, next) => {
  // Skip JSON parsing for multipart requests — multer handles those.
  if (req.is('multipart/form-data')) return next();
  express.json({ limit: JSON_BODY_LIMIT })(req, res, next);
});

// ── 5. Rate limiting ──────────────────────────────────────────────────────────
app.use(rateLimiter);

// ── 6. Request timeout ────────────────────────────────────────────────────────
app.use(timeoutMiddleware);

// ── 7. Structured request logging ─────────────────────────────────────────────
app.use(requestLoggingMiddleware);

// ── 8. Metrics collection (must be before routes to record all requests) ──────
app.use(metricsMiddleware);

// ── 9. /metrics scrape endpoint ───────────────────────────────────────────────
app.use(metricsRouter);

// ── 10. Application routes ────────────────────────────────────────────────────
app.use(routes);

// ── OpenAPI / Swagger UI docs ─────────────────────────────────────────────────
setupOpenApiRoutes(app);

// ── 11. Centralised error handler ─────────────────────────────────────────────
app.use(errorMiddleware);

// ── Server startup ────────────────────────────────────────────────────────────

const PORT = env.PORT;
const GRACE_SHUTDOWN_TIMEOUT = parseInt(
  process.env.GRACE_SHUTDOWN_TIMEOUT_MS ?? '30000',
  10,
);

async function startServer(): Promise<void> {
  const server = app.listen(PORT, () => {
    structuredLog({
      level: 'info',
      message: `Rentars API listening`,
      timestamp: new Date().toISOString(),
      port: PORT,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
    });
    startSyncScheduler();
    startRateRefreshLoop(); // pre-warm exchange-rate cache and keep it fresh
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────

  function gracefulShutdown(signal: string): void {
    structuredLog({
      level: 'info',
      message: `Received ${signal}, starting graceful shutdown`,
      timestamp: new Date().toISOString(),
      signal,
    });

    server.close(() => {
      structuredLog({
        level: 'info',
        message: 'HTTP server closed',
        timestamp: new Date().toISOString(),
      });
      process.exit(0);
    });

    const shutdownTimer = setTimeout(() => {
      structuredLog({
        level: 'error',
        message: 'Forced shutdown after timeout',
        timestamp: new Date().toISOString(),
        timeoutMs: GRACE_SHUTDOWN_TIMEOUT,
      });
      process.exit(1);
    }, GRACE_SHUTDOWN_TIMEOUT);

    shutdownTimer.unref();
  }

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => gracefulShutdown(signal));
  }

  process.on('uncaughtException', (error) => {
    structuredLog({
      level: 'error',
      message: 'Uncaught exception',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    structuredLog({
      level: 'error',
      message: 'Unhandled promise rejection',
      timestamp: new Date().toISOString(),
      reason: String(reason),
    });
    process.exit(1);
  });
}

startServer().catch((error) => {
  structuredLog({
    level: 'error',
    message: 'Fatal startup error',
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
