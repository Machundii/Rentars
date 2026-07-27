# Rentars — Testing Infrastructure

Complete testing strategy for Rentars: unit, integration, E2E, contract, performance, and security.

---

## Architecture Overview

| Layer | Tool | Location | Runner |
|---|---|---|---|
| Backend unit tests | Bun test | `apps/backend/tests/unit/` | `bun test tests/unit` |
| Backend integration tests | Bun test + Supertest | `apps/backend/tests/integration/` | `bun test tests/integration` |
| Frontend unit tests | Vitest + Testing Library | `apps/web/src/**/*.test.tsx` | `vitest run` |
| Frontend E2E tests | Playwright | `apps/web/e2e/` | `playwright test` |
| Visual regression | Playwright snapshots | `apps/web/e2e/visual-regression.spec.ts` | `playwright test --update-snapshots` |
| Soroban contract tests | cargo test | `apps/contracts/contracts/*/src/test.rs` | `cargo test` |
| Performance tests | K6 | `tests/performance/k6/` | `k6 run` |
| Security scanning | OWASP ZAP + Gitleaks + CodeQL | CI only | Automated |

---

## Quick Start

### Backend

```bash
cd apps/backend

# All tests
bun test

# Unit only
bun test tests/unit

# Integration only
bun test tests/integration

# With coverage (lcov + text)
bun test --coverage --coverage-reporter=lcov --coverage-dir=./coverage
```

### Frontend

```bash
cd apps/web

# All tests
npx vitest run

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage

# E2E tests (requires app running on :3001)
npx playwright test

# E2E specific browser
npx playwright test --project=chromium

# Visual regression (update snapshots)
npx playwright test e2e/visual-regression.spec.ts --update-snapshots
```

### Smart Contracts

```bash
cd apps/contracts

# All contracts
cargo test

# Specific contract
cd contracts/booking && cargo test

# With output
cargo test -- --nocapture
```

### Performance Tests (K6)

```bash
# Install K6: https://grafana.com/docs/k6/latest/get-started/installation/

# Smoke test (quick sanity check)
k6 run tests/performance/k6/smoke-test.js

# Load test (50 VUs sustained)
k6 run tests/performance/k6/api-load-test.js

# Stress test (up to 300 VUs)
k6 run tests/performance/k6/booking-stress-test.js

# Against staging
k6 run -e BASE_URL=https://api.staging.rentars.io tests/performance/k6/api-load-test.js
```

---

## Coverage Targets

| Component | Threshold |
|---|---|
| Backend services | ≥ 80% lines/branches/functions |
| Frontend components | ≥ 80% lines/branches/functions |
| Smart contracts | Rust inline tests |

---

## CI/CD Pipeline

```
push/PR → main
│
├── lint (Biome)
├── typecheck (tsc)
│
├── backend-tests (Bun)   ─── 80% coverage gate
├── frontend-tests (Vitest) ─── 80% coverage gate
├── contract-tests (cargo)  ─── all tests pass
│
├── build (Turborepo)
│
└── On main merge:
    ├── e2e-tests (Playwright — chromium/firefox/webkit)
    ├── coverage (Codecov upload)
    ├── security (CodeQL + Gitleaks + cargo-audit)
    └── performance (K6 smoke — nightly full load)
```

---

## Security Scanning

| Tool | What it checks |
|---|---|
| **Gitleaks** | Secrets committed to git history |
| **CodeQL** | Static analysis for JS/TS security vulnerabilities |
| **cargo-audit** | Known vulnerabilities in Rust dependencies |
| **yarn audit** | Known vulnerabilities in Node.js dependencies |
| **OWASP ZAP** | Runtime API security scan (scheduled/manual) |
| **OSSF Scorecard** | Supply chain security posture (main branch) |

---

## Test Data & Mocks

- `apps/backend/tests/mocks/supabase.mock.ts` — chainable Supabase mock (bun:test)
- `apps/backend/tests/mocks/supabase.mock.data.ts` — fixture data for properties/bookings/users
- `apps/backend/tests/mocks/blockchain.mocks.ts` — blockchain service mocks
- `apps/web/src/tests/setup.ts` — global Vitest setup (Next.js router, Supabase, Freighter mocks)
- `apps/web/src/tests/utils/test-utils.tsx` — custom render with providers

---

## Performance Benchmarks

Established baselines from K6 load tests:

| Endpoint | p95 Target | p99 Target |
|---|---|---|
| `GET /health` | < 50ms | < 100ms |
| `GET /api/properties` | < 500ms | < 1000ms |
| `GET /api/properties/:id` | < 400ms | < 800ms |
| `POST /api/bookings` | < 2000ms | < 3000ms |
| `GET /api/reviews` | < 500ms | < 1000ms |

Error rate target: < 1% under normal load, < 5% under stress.
