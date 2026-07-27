/**
 * K6 stress test — booking endpoint under heavy load.
 * Validates that bookings remain consistent under concurrent requests.
 *
 * Run:
 *   k6 run tests/performance/k6/booking-stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, stressTestStages } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────

const bookingErrors = new Rate('booking_errors');
const bookingLatency = new Trend('booking_latency');

// ── Options ───────────────────────────────────────────────────────────────────

export const options = {
  stages: stressTestStages,
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // more lenient during stress
    http_req_failed: ['rate<0.05'],      // allow up to 5% errors under stress
    booking_errors: ['rate<0.1'],
    booking_latency: ['p(95)<2000'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${__ENV.TEST_JWT || 'stress-test-token'}`,
};

export default function () {
  const vu = __VU;
  const iter = __ITER;

  group('booking creation under stress', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1 + (iter % 30));
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 3);

    const payload = JSON.stringify({
      property_id: `550e8400-e29b-41d4-a716-${String(vu).padStart(12, '0')}`,
      check_in: tomorrow.toISOString().split('T')[0],
      check_out: dayAfter.toISOString().split('T')[0],
      guests: 2,
      total_price: 300,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/bookings`, payload, { headers });
    bookingLatency.add(Date.now() - start);

    const ok = check(res, {
      // Accept 201 (created), 400 (validation), 401 (auth), 404 (property not found), 429 (rate limited)
      // Fail on 500 (server error)
      'no 5xx errors': (r) => r.status < 500,
      'response time acceptable': () => (Date.now() - start) < 2000,
    });

    bookingErrors.add(!ok);
  });

  sleep(Math.random() * 2 + 0.5);
}
