/**
 * Route-level tests for messaging: auth guard, validation, and rate limiting.
 */

import { describe, it, expect, mock } from 'bun:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';

const JWT_SECRET = 'mock-jwt-secret-min-32-characters-long';
process.env.JWT_SECRET = JWT_SECRET;
// Force the in-memory rate limiter fallback — .env.test sets a REDIS_URL
// that Bun auto-loads under NODE_ENV=test, but no Redis server runs here.
// The project's own integration-test CI job does the same for this reason.
process.env.REDIS_URL = '';

const mockSendMessage = mock(async () => ({
  success: true,
  data: { id: 'msg-1', property_id: 'prop-1', sender_id: 'tenant-1', recipient_id: 'host-1' },
}));
const mockGetConversation = mock(async () => ({ success: true, data: [] }));
const mockMarkMessageRead = mock(async () => ({ success: true, data: { id: 'msg-1' } }));

mock.module('../../src/services/message.service.js', () => ({
  sendMessage: mockSendMessage,
  getConversation: mockGetConversation,
  markMessageRead: mockMarkMessageRead,
}));

const { default: messageRoutes } = await import('../../src/routes/message.routes.js');

function tokenFor(userId: string): string {
  return jwt.sign({ userId, role: 'user' }, JWT_SECRET);
}

const app = express();
app.use(express.json());
app.use('/messages', messageRoutes);
app.use(errorMiddleware);

const validBody = { propertyId: '123e4567-e89b-12d3-a456-426614174000', body: 'Is this available?' };

describe('POST /messages', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/messages').send(validBody);
    expect(res.status).toBe(401);
  });

  it('sends a message for an authenticated user', async () => {
    const res = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${tokenFor('tenant-route-1')}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(mockSendMessage).toHaveBeenCalledWith(
      'tenant-route-1',
      validBody.propertyId,
      validBody.body,
      undefined,
    );
  });

  it('rejects an empty body with a validation error', async () => {
    const res = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${tokenFor('tenant-route-2')}`)
      .send({ ...validBody, body: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid propertyId', async () => {
    const res = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${tokenFor('tenant-route-3')}`)
      .send({ ...validBody, propertyId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('rate-limits a user sending more than 10 messages within the window', async () => {
    const user = 'rate-limit-tester';
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/messages')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send(validBody);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('GET /messages/:otherUserId', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/messages/host-1?propertyId=prop-1');
    expect(res.status).toBe(401);
  });

  it('requires a propertyId query parameter', async () => {
    const res = await request(app)
      .get('/messages/host-1')
      .set('Authorization', `Bearer ${tokenFor('tenant-route-4')}`);
    expect(res.status).toBe(400);
  });

  it('lists a conversation scoped to a property', async () => {
    const res = await request(app)
      .get('/messages/host-1?propertyId=prop-1')
      .set('Authorization', `Bearer ${tokenFor('tenant-route-5')}`);
    expect(res.status).toBe(200);
    expect(mockGetConversation).toHaveBeenCalledWith('tenant-route-5', 'host-1', 'prop-1');
  });
});

describe('PATCH /messages/:id/read', () => {
  it('requires authentication', async () => {
    const res = await request(app).patch('/messages/msg-1/read');
    expect(res.status).toBe(401);
  });

  it('marks a message read for the authenticated recipient', async () => {
    const res = await request(app)
      .patch('/messages/msg-1/read')
      .set('Authorization', `Bearer ${tokenFor('host-route-1')}`);
    expect(res.status).toBe(200);
    expect(mockMarkMessageRead).toHaveBeenCalledWith('msg-1', 'host-route-1');
  });
});
