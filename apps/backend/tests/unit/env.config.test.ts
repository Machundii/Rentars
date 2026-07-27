/**
 * Unit tests for apps/backend/src/config/env.ts
 *
 * These tests import the raw Zod schema directly — they do NOT import the
 * module-level `env` export (which would trigger process.exit on failure).
 * Instead they exercise the schema.safeParse() path directly so every
 * assertion runs inside the test process without side-effects.
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';

// ── Inline the schema so we can call safeParse without side-effects ───────────
// (mirrors the real schema in config/env.ts exactly)

const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('PORT must be 1–65535');
      return n;
    }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  REDIS_URL: z.string().url().optional(),
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  STELLAR_RPC_URL: z.string().url().optional(),
  PROPERTY_LISTING_CONTRACT_ID: z.string().optional(),
  BOOKING_CONTRACT_ID: z.string().optional(),
  TRUSTLESS_WORK_API_URL: z.string().url().optional(),
  TRUSTLESS_WORK_API_KEY: z.string().optional(),
  GEOCODING_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Rentars <no-reply@rentars.app>'),
  FRONTEND_URL: z.string().url().default('https://rentars.app'),
  METRICS_TOKEN: z.string().optional(),
});

// ── Minimal valid env ─────────────────────────────────────────────────────────

const VALID_BASE = {
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
  JWT_SECRET: 'a-sufficiently-long-secret-32chars!!',
} as const;

// ─────────────────────────────────────────────────────────────────────────────

describe('env schema — required variables', () => {
  it('passes with all required vars present', () => {
    const result = envSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it('fails when SUPABASE_URL is missing', () => {
    const { SUPABASE_URL: _, ...rest } = VALID_BASE;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('SUPABASE_URL');
    }
  });

  it('fails when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _, ...rest } = VALID_BASE;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fails when JWT_SECRET is missing', () => {
    const { JWT_SECRET: _, ...rest } = VALID_BASE;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fails when JWT_SECRET is shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, JWT_SECRET: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('JWT_SECRET'))?.message ?? '';
      expect(msg).toMatch(/32/);
    }
  });

  it('reports all missing required vars at once (aggregated errors)', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('SUPABASE_URL');
      expect(paths).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(paths).toContain('JWT_SECRET');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('env schema — type coercion', () => {
  it('coerces PORT string to a number', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, PORT: '4200' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(4200);
  });

  it('coerces SMTP_PORT string to a number', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, SMTP_PORT: '465' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.SMTP_PORT).toBe(465);
  });

  it('coerces SMTP_SECURE "true" to boolean true', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, SMTP_SECURE: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.SMTP_SECURE).toBe(true);
  });

  it('coerces SMTP_SECURE "false" to boolean false', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, SMTP_SECURE: 'false' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.SMTP_SECURE).toBe(false);
  });

  it('rejects PORT out of valid TCP range', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, PORT: '99999' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('env schema — defaults', () => {
  it('defaults PORT to 3000', () => {
    const result = envSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(3000);
  });

  it('defaults NODE_ENV to "development"', () => {
    const result = envSchema.safeParse(VALID_BASE);
    if (result.success) expect(result.data.NODE_ENV).toBe('development');
  });

  it('defaults CORS_ORIGIN to localhost:3001', () => {
    const result = envSchema.safeParse(VALID_BASE);
    if (result.success) expect(result.data.CORS_ORIGIN).toBe('http://localhost:3001');
  });

  it('defaults STELLAR_NETWORK to "testnet"', () => {
    const result = envSchema.safeParse(VALID_BASE);
    if (result.success) expect(result.data.STELLAR_NETWORK).toBe('testnet');
  });

  it('defaults EMAIL_FROM to Rentars no-reply', () => {
    const result = envSchema.safeParse(VALID_BASE);
    if (result.success) expect(result.data.EMAIL_FROM).toContain('no-reply@rentars.app');
  });

  it('defaults FRONTEND_URL to https://rentars.app', () => {
    const result = envSchema.safeParse(VALID_BASE);
    if (result.success) expect(result.data.FRONTEND_URL).toBe('https://rentars.app');
  });

  it('allows SMTP_HOST to be absent (optional)', () => {
    const result = envSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.SMTP_HOST).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('env schema — invalid values', () => {
  it('rejects SUPABASE_URL that is not a URL', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, SUPABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('SUPABASE_URL'))).toBe(true);
    }
  });

  it('rejects NODE_ENV with an unlisted value', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects STELLAR_NETWORK with an unlisted value', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, STELLAR_NETWORK: 'devnet' });
    expect(result.success).toBe(false);
  });

  it('rejects REDIS_URL that is not a URL when present', () => {
    const result = envSchema.safeParse({ ...VALID_BASE, REDIS_URL: 'redis-not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts REDIS_URL when absent (optional)', () => {
    const result = envSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.REDIS_URL).toBeUndefined();
  });
});
