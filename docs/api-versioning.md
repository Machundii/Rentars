# API Versioning & Deprecation Policy

> This document is the single source of truth for how Rentars versions its HTTP API,
> when breaking changes trigger a version bump, and how deprecated endpoints are
> communicated to clients and eventually removed.

---

## Table of Contents

1. [Version Namespace](#1-version-namespace)
2. [What Counts as a Breaking Change](#2-what-counts-as-a-breaking-change)
3. [Introducing a New Major Version](#3-introducing-a-new-major-version)
4. [Deprecation Process](#4-deprecation-process)
5. [Deprecation Headers Reference](#5-deprecation-headers-reference)
6. [How to Register a Deprecated Endpoint](#6-how-to-register-a-deprecated-endpoint)
7. [Client Responsibilities](#7-client-responsibilities)
8. [Current Deprecated Endpoints](#8-current-deprecated-endpoints)

---

## 1. Version Namespace

All public API routes are prefixed with a major version segment:

```
/api/v{MAJOR}/{resource}
```

| Version | Status       | Base path   |
|---------|--------------|-------------|
| v1      | **Current**  | `/api/v1`   |
| v2      | Planned      | `/api/v2`   |

The `/health` endpoint is intentionally unversioned so infrastructure probes
(load balancers, Kubernetes liveness checks) never need to track the API version.

### Route audit checklist

Every new route file added to `apps/backend/src/routes/` **must** be mounted
inside the `apiV1` (or a future `apiVN`) router in `src/routes/index.ts`.
No route may be mounted directly on the root `router` except `/health`.

---

## 2. What Counts as a Breaking Change

A **breaking change** requires a new major version:

| Category | Breaking examples | Non-breaking examples |
|---|---|---|
| Request shape | Removing a required field; changing a field type; renaming a query param | Adding an optional field |
| Response shape | Removing a field; renaming a field; changing a field type | Adding a new field; adding a new optional header |
| Behaviour | Changing HTTP method; changing status codes on existing paths; altering authentication scheme | Bug fixes that make behaviour match documented spec |
| URL structure | Renaming or removing a path segment | Adding new sub-resources |

When in doubt, treat the change as breaking and bump the version.

---

## 3. Introducing a New Major Version

Follow these steps when v1 needs a breaking change:

1. **Create** `apps/backend/src/routes/v2/` and add the new route modules there.
2. **Import and mount** them on the `apiV2` router in `src/routes/index.ts`:

   ```ts
   import propertiesV2Routes from './v2/properties.routes.js';
   // ...
   const apiV2 = Router();
   apiV2.use('/properties', propertiesV2Routes);
   router.use('/api/v2', apiV2);
   ```

3. **Mark superseded v1 endpoints as deprecated** in the registry
   (`src/middleware/deprecation.middleware.ts → DEPRECATED_ENDPOINTS`) with:
   - `deprecatedAt` — today's date (ISO 8601)
   - `sunsetAt` — at least **6 months** from today (see §4)
   - `successor` — the equivalent v2 path

4. **Run the existing test suite** (`bun test`) to confirm v1 still passes.

5. **Announce** the deprecation in the changelog and developer communications.

6. After the Sunset date, **remove** the v1 handler and its registry entry.

---

## 4. Deprecation Process

```
Day 0         Month 3          Month 6 (Sunset date)
  |               |                  |
  ▼               ▼                  ▼
Announced   Reminder notice    Handler removed from codebase
  +
Headers set
```

| Phase | Action |
|---|---|
| **Announcement** | Add the endpoint to `DEPRECATED_ENDPOINTS`; headers start appearing in responses immediately. Announce in changelog. |
| **Active deprecation window** | Minimum **6 months** from `deprecatedAt`. Clients should migrate during this window. |
| **Sunset date** | The `Sunset` header value. After this date the endpoint **will be removed**. |
| **Removal** | Delete the route handler and remove the entry from `DEPRECATED_ENDPOINTS`. Returning `410 Gone` for 30 days afterward is recommended to help straggler clients. |

### Exceptions

- Security vulnerabilities may force immediate removal without the standard window.
- Internal/admin-only endpoints (`/api/v1/admin/*`) may use a shorter window (minimum 1 month).

---

## 5. Deprecation Headers Reference

Two standard headers are emitted for deprecated endpoints. Clients **must** monitor
these headers in CI or integration-test suites.

### `Deprecation`

An HTTP-date indicating when the endpoint was marked deprecated.

```
Deprecation: Wed, 01 Jan 2025 00:00:00 GMT
```

Defined in the [IETF Deprecation HTTP Header draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-deprecation-header/).

### `Sunset`

An HTTP-date indicating when the endpoint **will be removed**.

```
Sunset: Tue, 01 Jul 2025 00:00:00 GMT
```

Defined in [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594).

### `Link` (successor)

When a replacement endpoint exists, a `Link` header points to it:

```
Link: </api/v2/properties>; rel="successor-version"
```

---

## 6. How to Register a Deprecated Endpoint

Open `apps/backend/src/middleware/deprecation.middleware.ts` and add an entry to
`DEPRECATED_ENDPOINTS`:

```ts
export const DEPRECATED_ENDPOINTS: DeprecatedEndpoint[] = [
  {
    // Matches requests: GET /api/v1/properties/legacy-search
    key:          'GET /api/v1/properties/legacy-search',
    deprecatedAt: '2025-01-01T00:00:00Z',    // date it was deprecated
    sunsetAt:     '2025-07-01T00:00:00Z',    // date it will be removed
    successor:    '/api/v2/properties/search', // replacement (optional)
  },
];
```

The `autoDeprecationHeaders` middleware (wired in `src/routes/index.ts`) picks
this up automatically — no further changes to the route file are needed.

### Key format

| Scenario | Key format |
|---|---|
| Single route | `"METHOD /api/v1/full/path"` (e.g. `"GET /api/v1/properties/legacy-search"`) |
| Whole sub-router | `"router:/api/v1/prefix"` (e.g. `"router:/api/v1/legacy"`) |

---

## 7. Client Responsibilities

- **Poll the headers** — clients should log or alert when `Deprecation` or
  `Sunset` headers appear in responses.
- **Migrate before Sunset** — clients must switch to the successor endpoint
  before the `Sunset` date. After that date requests may receive `410 Gone`.
- **Pin your version** — always use an explicit version prefix in every request
  URL. Never rely on a versionless alias.

---

## 8. Current Deprecated Endpoints

_None at this time._

When endpoints are deprecated, they will be listed here and in
`DEPRECATED_ENDPOINTS` with their Sunset dates.
