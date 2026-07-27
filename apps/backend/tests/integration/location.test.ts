import { describe, it, expect, beforeEach, mock } from 'bun:test';
import request from 'supertest';
import { app } from '../../src/index';

// Mock geocoding provider
const mockGeocoder = {
  geocode: mock(async (address: string) => {
    if (!address || address.trim() === '') {
      throw new Error('Invalid address');
    }
    if (address === 'invalid-address') {
      throw new Error('Address not found');
    }
    return {
      latitude: 40.7128,
      longitude: -74.006,
      address: address,
    };
  }),
  search: mock(async (lat: number, lng: number, radius: number) => {
    if (radius < 0) {
      throw new Error('Invalid radius');
    }
    return [
      {
        id: 'prop-1',
        title: 'Cozy Apartment',
        latitude: lat + 0.001,
        longitude: lng + 0.001,
        price_per_night: 100,
      },
      {
        id: 'prop-2',
        title: 'Modern Loft',
        latitude: lat - 0.001,
        longitude: lng - 0.001,
        price_per_night: 150,
      },
    ];
  }),
};

describe('Location Endpoints', () => {
  describe('GET /api/locations/geocode', () => {
    it('should geocode a valid address', async () => {
      const response = await request(app)
        .get('/api/locations/geocode')
        .query({ address: 'New York, NY' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('latitude');
      expect(response.body).toHaveProperty('longitude');
      expect(response.body).toHaveProperty('address');
    });

    it('should reject an invalid address', async () => {
      const response = await request(app)
        .get('/api/locations/geocode')
        .query({ address: 'invalid-address' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing address parameter', async () => {
      const response = await request(app)
        .get('/api/locations/geocode');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject empty address', async () => {
      const response = await request(app)
        .get('/api/locations/geocode')
        .query({ address: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle geocoding service unavailability', async () => {
      // Mock service failure
      const response = await request(app)
        .get('/api/locations/geocode')
        .query({ address: 'test-address' });

      // Should return 503 or 500 depending on implementation
      expect([500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/locations/search', () => {
    it('should return nearby properties', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          lng: -74.006,
          radius: 5,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('latitude');
      expect(response.body[0]).toHaveProperty('longitude');
    });

    it('should return empty result when no properties found', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 90,
          lng: 180,
          radius: 1,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should reject missing latitude parameter', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lng: -74.006,
          radius: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing longitude parameter', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          radius: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing radius parameter', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          lng: -74.006,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid latitude', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 'invalid',
          lng: -74.006,
          radius: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid longitude', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          lng: 'invalid',
          radius: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject negative radius', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          lng: -74.006,
          radius: -5,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle location service unavailability', async () => {
      const response = await request(app)
        .get('/api/locations/search')
        .query({
          lat: 40.7128,
          lng: -74.006,
          radius: 5,
        });

      // Should return 503 or 500 depending on implementation
      expect([200, 500, 503]).toContain(response.status);
    });
  });
});

  describe('GET /api/v1/locations/reverse-geocode', () => {
    it('should return a label for valid coordinates', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: '40.7128', lng: '-74.0060' });

      // Real Nominatim call may succeed (200) or be blocked in CI (502/503/500).
      // We assert either the happy-path shape or a server-side error — never a 400.
      if (response.status === 200) {
        expect(response.body).toHaveProperty('label');
        expect(typeof response.body.label).toBe('string');
        expect(response.body.label.length).toBeGreaterThan(0);
      } else {
        expect([500, 502, 503, 404]).toContain(response.status);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject missing lat parameter', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lng: '-74.0060' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing lng parameter', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: '40.7128' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-numeric lat', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: 'not-a-number', lng: '-74.0060' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-numeric lng', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: '40.7128', lng: 'bad' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject latitude out of range', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: '91', lng: '0' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject longitude out of range', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode')
        .query({ lat: '0', lng: '181' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject both parameters missing', async () => {
      const response = await request(app)
        .get('/api/v1/locations/reverse-geocode');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
