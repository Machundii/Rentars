/**
 * Authorization tests for review moderation endpoints.
 * Confirms non-admins get 403 and admins can reach the handler (#65/#280).
 */

import { describe, it, expect, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'mock-jwt-secret-min-32-characters-long';
process.env.JWT_SECRET = JWT_SECRET;

mock.module('../../src/services/review.service.js', () => ({
  submitReview: mock(async () => ({ success: true, data: {} })),
  getReviewsForProperty: mock(async () => ({ success: true, data: [] })),
  getReviewsForUser: mock(async () => ({ success: true, data: [] })),
  getAverageRating: mock(async () => ({ success: true, data: 0 })),
  addHostResponse: mock(async () => ({ success: true, data: {} })),
  flagReview: mock(async () => ({ success: true, data: {} })),
  moderateReview: mock(async () => ({ success: true, data: { id: 'r1' } })),
  getFlaggedReviews: mock(async () => ({ success: true, data: [] })),
  approveReview: mock(async () => ({ success: true, data: { id: 'r1' } })),
  rejectReview: mock(async () => ({ success: true, data: { id: 'r1' } })),
  getPendingReviews: mock(async () => ({ success: true, data: [] })),
}));

const { default: reviewRoutes } = await import('../../src/routes/review.routes.js');

function tokenFor(role?: string): string {
  return jwt.sign({ userId: 'user-1', role }, JWT_SECRET);
}

const app = express();
app.use(express.json());
app.use('/reviews', reviewRoutes);

const MODERATION_ENDPOINTS: Array<{ method: 'get' | 'patch' | 'post'; path: string }> = [
  { method: 'get', path: '/reviews/moderation/flagged' },
  { method: 'get', path: '/reviews/moderation/pending' },
  { method: 'patch', path: '/reviews/r1/moderate' },
  { method: 'post', path: '/reviews/r1/approve' },
  { method: 'post', path: '/reviews/r1/reject' },
];

describe('review moderation endpoints — role enforcement', () => {
  for (const { method, path } of MODERATION_ENDPOINTS) {
    it(`${method.toUpperCase()} ${path} rejects a non-admin user with 403`, async () => {
      const res = await request(app)
        [method](path)
        .set('Authorization', `Bearer ${tokenFor('user')}`)
        .send({ approve: true, reason: 'spam' });

      expect(res.status).toBe(403);
    });

    it(`${method.toUpperCase()} ${path} rejects a request with no token with 401`, async () => {
      const res = await request(app)[method](path).send({ approve: true, reason: 'spam' });

      expect(res.status).toBe(401);
    });

    it(`${method.toUpperCase()} ${path} allows an admin through to the handler`, async () => {
      const res = await request(app)
        [method](path)
        .set('Authorization', `Bearer ${tokenFor('admin')}`)
        .send({ approve: true, reason: 'spam' });

      expect(res.status).toBeLessThan(400);
    });
  }
});
