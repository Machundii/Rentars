/**
 * K6 API load test — exercises all critical API endpoints under load.
 *
 * Run locally:
 *   k6 run tests/performance/k6/api-load-test.js
 *
 * Run with custom base URL:
 *   k6 run -e BASE_URL=https://api.staging.rentars.io tests/performance/k6/api-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, globalThresholds, loadTestStages } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────

const propertySearchErrors = new Rate('property_search_errors');
const bookingCreationErrors = new Rate('booking_creation_errors');
const propertyDetailLatency = new Trend('property_detail_latency');
const searchLatency = new Trend('search_latency');
const bookingsCreated = new Counter('bookings_created');

// ── Test options ──────────────────────────────────────────────────────────────

export const options = {
  stages: loadTestStages,
  thresholds: {
    ...globalThresholds,
    property_search_errors: ['rate<0.05'],
    booking_creation_errors: ['rate<0.05'],
    property_detail_latency: ['p(95)<400'],
    search_latency: ['p(95)<600'],
  },
};

// ── Shared headers ────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// ── Test lifecycle ────────────────────────────────────────────────────────────

export function setup() {
  // Verify the API is reachable before starting load
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'API health check passes': (r) => r.status === 200,
  });
  return {};
}

// ── Main test scenario ────────────────────────────────────────────────────────

export default function () {
  // 1. Health check
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { headers });
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health returns ok': (r) => r.json('status') === 'ok',
    });
  });

  sleep(0.5);

  // 2. List properties
  group('properties list', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/properties`, { headers });
    searchLatency.add(Date.now() - start);

    const ok = check(res, {
      'list properties 200': (r) => r.status === 200,
      'returns array': (r) => Array.isArray(r.json()),
    });
    propertySearchErrors.add(!ok);
  });

  sleep(0.5);

  // 3. Search with filters
  group('property search', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/properties?city=Miami&min_price=100&max_price=500&page=1&limit=20`,
      { headers }
    );
    searchLatency.add(Date.now() - start);

    check(res, {
      'search 200 or 422': (r) => [200, 422].includes(r.status),
    });
  });

  sleep(0.3);

  // 4. Property detail (use a realistic-looking UUID)
  group('property detail', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/properties/550e8400-e29b-41d4-a716-446655440000`,
      { headers }
    );
    propertyDetailLatency.add(Date.now() - start);

    check(res, {
      'property detail 200 or 404': (r) => [200, 404].includes(r.status),
      'latency under 500ms': () => (Date.now() - start) < 500,
    });
  });

  sleep(1);
}

// ── Teardown ──────────────────────────────────────────────────────────────────

export function teardown() {
  console.log('Load test completed. Check metrics above for results.');
}
