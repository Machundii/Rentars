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
import { errorMiddleware } from './middleware/error.middleware.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestLoggingMiddleware } from './middleware/logging.middleware.js';
import { metricsMiddleware, metricsRouter } from './middleware/metrics.middleware.js';
import routes from './routes/index.js';
import { setupOpenApiRoutes } from './config/swagger.js';
import { startSyncScheduler } from './services/cleanup-schedular.js';

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

// ── Start server ──────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`🚀 Rentars API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
    startSyncScheduler();
  });
}
