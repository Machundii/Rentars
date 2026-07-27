/**
 * K6 smoke test — minimal load to verify all endpoints are functional.
 * Run before deploying to production to catch obvious regressions.
 *
 * Run:
 *   k6 run tests/performance/k6/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, smokeTestStages } from './config.js';

export const options = {
  stages: smokeTestStages,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

const headers = { Accept: 'application/json' };

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/health`, { headers });
  check(health, { 'health 200': (r) => r.status === 200 });

  sleep(0.5);

  // Properties list
  const props = http.get(`${BASE_URL}/api/properties?limit=5`, { headers });
  check(props, {
    'properties 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // Search endpoint
  const search = http.get(`${BASE_URL}/api/properties?city=Miami&limit=5`, { headers });
  check(search, {
    'search 200': (r) => r.status === 200,
  });

  sleep(1);
}
