/**
 * Application entry point.
 *
 * dotenv is loaded before anything else so env vars are available when
 * config/env.ts runs its startup validation.  If any required variables are
 * missing or invalid, env.ts calls process.exit(1) with a full error report.
 */

import 'dotenv/config'; // must be first import
import { env } from './config/env.js';
import cors from 'cors';
import express from 'express';
import { errorMiddleware } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimiter';
import { timeoutMiddleware } from './middleware/timeout.middleware';
import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import propertyRoutes from './routes/property.routes';
import locationRoutes from './routes/location.routes';
import { setupOpenApiRoutes } from './config/swagger';
import { validateBlockchainConfig } from './blockchain/config.js';
import { startSyncScheduler } from './services/cleanup-schedular.js';
import { startRateRefreshLoop } from './services/exchangeRate.service.js';

dotenv.config();

export const app = express();

// ── Core middleware ───────────────────────────────────────────────────────────

app.use(express.json());
app.use(
  cors({
    origin: [env.CORS_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(rateLimiter);
app.use(timeoutMiddleware);
app.use(requestLoggingMiddleware);

// ── Metrics (must be before routes to record all requests) ────────────────────
app.use(metricsMiddleware);
app.use(metricsRouter);

// ── Application routes ────────────────────────────────────────────────────────
app.use(routes);

// ── OpenAPI docs ──────────────────────────────────────────────────────────────
setupOpenApiRoutes(app);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

const configErrors = validateBlockchainConfig();
if (configErrors.length > 0) {
  const errorDetails = configErrors
    .map((err) => `  - ${err.field}: ${err.message}`)
    .join('\n');
  console.error('❌ Blockchain configuration validation failed:\n' + errorDetails);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const GRACE_SHUTDOWN_TIMEOUT = parseInt(
  process.env.GRACE_SHUTDOWN_TIMEOUT_MS || '30000',
  10
);

async function startServer(): Promise<void> {
  // Retry dependency connections with exponential backoff
  await retryDependencyConnections();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Rentars API running on http://localhost:${PORT}`);
    startSyncScheduler();
    startRateRefreshLoop(); // pre-warm exchange-rate cache and keep it fresh
  });

  // Graceful shutdown handlers
  const shutdownSignals = ['SIGTERM', 'SIGINT'];

  function gracefulShutdown(signal: string): void {
    console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);

    server.close(() => {
      console.log('[Shutdown] HTTP server closed');
      process.exit(0);
    });

    const shutdownTimer = setTimeout(() => {
      console.error('[Shutdown] Forced shutdown after timeout');
      process.exit(1);
    }, GRACE_SHUTDOWN_TIMEOUT);

    shutdownTimer.unref();
  }

  shutdownSignals.forEach((signal) => {
    process.on(signal, () => gracefulShutdown(signal));
  });

  process.on('uncaughtException', (error) => {
    console.error('[Error] Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Error] Unhandled rejection at', promise, 'reason:', reason);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error('[Startup] Fatal error:', error);
  process.exit(1);
});
