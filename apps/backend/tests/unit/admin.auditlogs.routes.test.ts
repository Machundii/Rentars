/**
 * Route-level tests for GET /admin/audit-logs — admin-only listing/filtering.
 *
 * Mocks the Supabase client (not auditLog.service.js itself) so this file
 * exercises the real listAuditLogs implementation without colliding with
 * auditLog.service.test.ts's own mock.module registration for that path
 * (bun runs all test files in one process without --isolate, so mock.module
 * on the same path from two files would otherwise leak between them).
 */

import { describe, it, expect, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const ADMIN_JWT_SECRET = 'mock-jwt-secret-min-32-characters-long';
process.env.JWT_SECRET = ADMIN_JWT_SECRET;
delete process.env.ADMIN_JWT_SECRET;

const orderBuilder = { limit: mock(async () => ({ data: [], error: null })) };
const selectBuilder: any = { order: mock(() => orderBuilder) };
selectBuilder.eq = mock(() => selectBuilder);
const mockSelect = mock(() => selectBuilder);

mock.module('../../src/config/supabase.js', () => ({
  supabase: { from: mock((_: string) => ({ select: mockSelect })) },
}));

// admin.routes.ts also pulls in property/search-analytics/rate-limit services —
// stub them so importing the router has no real DB/Redis dependencies.
mock.module('../../src/services/property.service.js', () => ({
  setFeatured: mock(async () => ({ success: true, data: {} })),
  clearFeatured: mock(async () => ({ success: true, data: {} })),
  FEATURED_CAP: 6,
}));
mock.module('../../src/services/searchAnalytics.service.js', () => ({
  getTopQueries: mock(async () => ({ success: true, data: [] })),
  getZeroResultQueries: mock(async () => ({ success: true, data: [] })),
  getDailySearchVolume: mock(async () => ({ success: true, data: [] })),
}));
mock.module('../../src/services/rateLimitStore.service.js', () => ({
  rateLimitStore: {
    getSummary: mock(async () => ({ total: 0, byRoute: [] })),
    record: mock(async () => {}),
  },
}));

const { default: adminRoutes } = await import('../../src/routes/admin.routes.js');

function adminToken(role?: string): string {
  return jwt.sign({ userId: 'admin-1', role }, ADMIN_JWT_SECRET);
}

const app = express();
app.use(express.json());
app.use('/admin', adminRoutes);

describe('GET /admin/audit-logs', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/admin/audit-logs');
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin role with 403', async () => {
    const res = await request(app)
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken('user')}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin to list audit logs', async () => {
    const res = await request(app)
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken('admin')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('passes a status/action filter through to the query builder', async () => {
    const res = await request(app)
      .get('/admin/audit-logs?action=report.resolved&limit=10')
      .set('Authorization', `Bearer ${adminToken('admin')}`);
    expect(res.status).toBe(200);
    expect(selectBuilder.eq).toHaveBeenCalledWith('action', 'report.resolved');
  });

  it('rejects an invalid (non-UUID) actorId filter with 400', async () => {
    const res = await request(app)
      .get('/admin/audit-logs?actorId=not-a-uuid')
      .set('Authorization', `Bearer ${adminToken('admin')}`);
    expect(res.status).toBe(400);
  });
});
