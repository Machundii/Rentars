/**
 * Tests for property image upload limits and validation.
 *
 * Covers:
 *  1. File size exceeding MAX_IMAGE_SIZE_BYTES -> 400 Bad Request
 *  2. Non-image MIME types -> 400 Bad Request
 *  3. Property reaching MAX_IMAGES_PER_PROPERTY cap -> Rejection before storage
 *  4. Valid upload within limits -> 201 Created / Success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Response } from 'express';
import request from 'supertest';
import { upload } from '../middleware/multer.js';
import { errorMiddleware } from '../middleware/error.middleware.js';
import { addPropertyImage } from '../services/propertyImage.service.js';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import * as storage from '../config/supabase-storage.js';

vi.mock('../config/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../config/supabase-storage.js', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock('../services/cache.service.js', () => ({
  del: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
}));

function makeTestApp() {
  const app = express();

  app.post('/api/v1/properties/:id/images', upload.single('image'), async (req: any, res: Response, next: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }
      const userId = req.headers['x-user-id'] as string || 'user-1';
      const result = await addPropertyImage(req.params.id, userId, req.file);
      if (!result.success) {
        res.status(result.error?.startsWith('Forbidden') ? 403 : 400).json({ error: result.error });
        return;
      }
      res.status(201).json(result.data);
    } catch (err) {
      next(err);
    }
  });

  app.use(errorMiddleware);
  return app;
}

describe('Property Image Upload Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects upload when file size exceeds limit', async () => {
    const app = makeTestApp();
    // Create oversized buffer (limit + 100 bytes)
    const oversizedBuffer = Buffer.alloc(env.MAX_IMAGE_SIZE_BYTES + 100);

    const res = await request(app)
      .post('/api/v1/properties/prop-1/images')
      .set('x-user-id', 'owner-1')
      .attach('image', oversizedBuffer, { filename: 'large.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('File size exceeds maximum allowed size');
  });

  it('rejects upload with non-image MIME type', async () => {
    const app = makeTestApp();
    const textBuffer = Buffer.from('this is text content');

    const res = await request(app)
      .post('/api/v1/properties/prop-1/images')
      .set('x-user-id', 'owner-1')
      .attach('image', textBuffer, { filename: 'doc.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only JPEG, PNG, and WebP images are allowed');
  });

  it('rejects upload when property image cap is reached', async () => {
    const app = makeTestApp();
    const validBuffer = Buffer.from('fake image content');
    const mockSupabase = supabase as any;

    mockSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'prop-1', owner_id: 'owner-1' },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: env.MAX_IMAGES_PER_PROPERTY, error: null }),
        }),
      });

    const res = await request(app)
      .post('/api/v1/properties/prop-1/images')
      .set('x-user-id', 'owner-1')
      .attach('image', validBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Maximum image limit reached for property');
    expect(storage.uploadImage).not.toHaveBeenCalled();
  });

  it('succeeds when image is valid and under limit', async () => {
    const app = makeTestApp();
    const validBuffer = Buffer.from('fake image content');
    const mockSupabase = supabase as any;

    vi.mocked(storage.uploadImage).mockResolvedValue('https://example.com/img1.jpg');

    mockSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'prop-1', owner_id: 'owner-1' },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'img-3',
                property_id: 'prop-1',
                url: 'https://example.com/img1.jpg',
                is_primary: false,
                display_order: 3,
              },
              error: null,
            }),
          }),
        }),
      });

    const res = await request(app)
      .post('/api/v1/properties/prop-1/images')
      .set('x-user-id', 'owner-1')
      .attach('image', validBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://example.com/img1.jpg');
    expect(res.body.display_order).toBe(3);
    expect(storage.uploadImage).toHaveBeenCalled();
  });
});
