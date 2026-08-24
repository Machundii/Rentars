/**
 * Unit tests for GET /health — verifies the aggregated status/HTTP code
 * across the healthy, degraded, and unconfigured scenarios described in
 * https://github.com/Rentars/Rentars/issues/219.
 *
 * config/redis.js and blockchain/soroban.js are real, shared singleton
 * modules consumed by several other services (cache, rate limiting, chain
 * sync) across the test suite. Since bun runs all test files in one process
 * without --isolate, a mock.module registration for either path leaks
 * globally — so instead of replacing the module outright, we capture its
 * real exports first and re-publish them unchanged alongside a stubbed
 * pingRedis/getRpcHealth, keeping every other consumer working exactly as
 * before.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';

const dbState = { ok: true };
const redisState = { ok: true };
const blockchainState = { ok: true };

mock.module('../../src/config/supabase.js', () => ({
  supabase: {
    from: mock((_: string) => ({
      select: mock(() => ({
        limit: mock(async () =>
          dbState.ok ? { data: [], error: null } : { data: null, error: new Error('db down') }
        ),
      })),
    })),
  },
}));

const realRedisConfig = await import('../../src/config/redis.js');
mock.module('../../src/config/redis.js', () => ({
  ...realRedisConfig,
  pingRedis: mock(async () => redisState.ok),
}));

const realSoroban = await import('../../src/blockchain/soroban.js');
mock.module('../../src/blockchain/soroban.js', () => ({
  ...realSoroban,
  getRpcHealth: mock(async () => blockchainState.ok),
}));

const { default: healthRoutes } = await import('../../src/routes/health.routes.js');

function buildApp() {
  const app = express();
  app.use(healthRoutes);
  return app;
}

describe('GET /health', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalRpcUrl = process.env.STELLAR_RPC_URL;

  beforeEach(() => {
    dbState.ok = true;
    redisState.ok = true;
    blockchainState.ok = true;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org';
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;

    if (originalRpcUrl === undefined) delete process.env.STELLAR_RPC_URL;
    else process.env.STELLAR_RPC_URL = originalRpcUrl;
  });

  it('returns 200 with status ok when every dependency is healthy', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toEqual({
      database: 'ok',
      redis: 'ok',
      blockchain: 'ok',
    });
  });

  it('returns 503 with status degraded when Redis is unreachable', async () => {
    redisState.ok = false;

    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.redis).toBe('error');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.checks.blockchain).toBe('ok');
  });

  it('returns 503 with status degraded when the Stellar RPC is unreachable', async () => {
    blockchainState.ok = false;

    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.blockchain).toBe('error');
  });

  it('returns 503 with status degraded when the database is unreachable', async () => {
    dbState.ok = false;

    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('error');
  });

  it('reports not_configured (and stays healthy) when Redis and the RPC URL are unset', async () => {
    delete process.env.REDIS_URL;
    delete process.env.STELLAR_RPC_URL;

    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toEqual({
      database: 'ok',
      redis: 'not_configured',
      blockchain: 'not_configured',
    });
  });

  it('includes service name and an ISO timestamp', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.body.service).toBe('Rentars API 🚀');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
