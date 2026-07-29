/**
 * Route-level tests for report endpoints: submission, moderator-only
 * list/resolve enforcement, and validation of the submitted reason.
 */

import { describe, it, expect, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';

const JWT_SECRET = 'mock-jwt-secret-min-32-characters-long';
process.env.JWT_SECRET = JWT_SECRET;

const mockSubmitReport = mock(async () => ({
  success: true,
  data: { id: 'report-1', status: 'pending' },
}));
const mockListReports = mock(async () => ({ success: true, data: [] }));
const mockResolveReport = mock(async () => ({
  success: true,
  data: { id: 'report-1', status: 'resolved' },
}));

mock.module('../../src/services/report.service.js', () => ({
  REPORT_REASONS: ['spam', 'fraud', 'inappropriate', 'misleading', 'harassment', 'other'],
  submitReport: mockSubmitReport,
  listReports: mockListReports,
  resolveReport: mockResolveReport,
}));

const { default: reportRoutes } = await import('../../src/routes/report.routes.js');

function tokenFor(role?: string): string {
  return jwt.sign({ userId: 'user-1', role }, JWT_SECRET);
}

const app = express();
app.use(express.json());
app.use('/reports', reportRoutes);
app.use(errorMiddleware);

const validReportBody = {
  targetType: 'property',
  targetId: '123e4567-e89b-12d3-a456-426614174000',
  reason: 'spam',
};

describe('POST /reports', () => {
  it('allows an authenticated user to submit a report', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${tokenFor('user')}`)
      .send(validReportBody);

    expect(res.status).toBe(201);
    expect(mockSubmitReport).toHaveBeenCalledWith(
      'user-1',
      'property',
      validReportBody.targetId,
      'spam',
      undefined,
    );
  });

  it('rejects submission with no auth token', async () => {
    const res = await request(app).post('/reports').send(validReportBody);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid reason with a validation error', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${tokenFor('user')}`)
      .send({ ...validReportBody, reason: 'not-a-real-reason' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid targetType', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${tokenFor('user')}`)
      .send({ ...validReportBody, targetType: 'user' });

    expect(res.status).toBe(400);
  });
});

describe('GET /reports — moderator-only', () => {
  it('rejects a non-admin with 403', async () => {
    const res = await request(app).get('/reports').set('Authorization', `Bearer ${tokenFor('user')}`);
    expect(res.status).toBe(403);
  });

  it('allows an admin through', async () => {
    const res = await request(app).get('/reports').set('Authorization', `Bearer ${tokenFor('admin')}`);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /reports/:id/resolve — moderator-only', () => {
  it('rejects a non-admin with 403', async () => {
    const res = await request(app)
      .patch('/reports/report-1/resolve')
      .set('Authorization', `Bearer ${tokenFor('user')}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(403);
  });

  it('allows an admin to resolve a report', async () => {
    const res = await request(app)
      .patch('/reports/report-1/resolve')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send({ status: 'resolved', resolutionNote: 'checked, taken down' });

    expect(res.status).toBe(200);
    expect(mockResolveReport).toHaveBeenCalledWith(
      'report-1',
      'user-1',
      'resolved',
      'checked, taken down',
    );
  });
});
