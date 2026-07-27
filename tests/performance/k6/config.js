/**
 * Shared K6 configuration — thresholds and environment for all performance tests.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const FRONTEND_URL = __ENV.FRONTEND_URL || 'http://localhost:3001';

/** Global thresholds applied to all test runs. */
export const globalThresholds = {
  // 95% of requests must complete within 500ms
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // Error rate must stay below 1%
  http_req_failed: ['rate<0.01'],
  // At least 100 requests per second
  http_reqs: ['rate>100'],
};

/** Load test stages — ramp up, sustain, ramp down. */
export const loadTestStages = [
  { duration: '30s', target: 10 },   // warm-up
  { duration: '1m', target: 50 },    // ramp to 50 VUs
  { duration: '2m', target: 50 },    // sustain
  { duration: '30s', target: 0 },    // ramp down
];

/** Smoke test stages — minimal load to verify functionality. */
export const smokeTestStages = [
  { duration: '30s', target: 3 },
  { duration: '30s', target: 0 },
];

/** Stress test stages — push beyond normal capacity. */
export const stressTestStages = [
  { duration: '2m', target: 100 },
  { duration: '5m', target: 100 },
  { duration: '2m', target: 200 },
  { duration: '5m', target: 200 },
  { duration: '2m', target: 300 },
  { duration: '5m', target: 300 },
  { duration: '2m', target: 0 },
];
