/**
 * Deprecation / Sunset header middleware.
 *
 * RFC 8594 (Sunset) and the draft Deprecation HTTP header spec define two
 * standard headers for communicating that an endpoint is deprecated:
 *
 *   Deprecation: <HTTP-date>   — when the endpoint was marked deprecated
 *   Sunset:      <HTTP-date>   — when it will be removed (may be omitted)
 *   Link:        <url>; rel="successor-version"  — migration target (optional)
 *
 * Usage
 * -----
 * 1. Add an entry to DEPRECATED_ENDPOINTS below.
 * 2. Wrap the route (or the whole router) with the `deprecationHeaders`
 *    middleware — it will inject the correct headers automatically.
 *
 * Example route-level usage:
 *
 *   import { deprecationHeaders } from '@/middleware/deprecation.middleware.js';
 *
 *   router.get(
 *     '/legacy-search',
 *     deprecationHeaders('/api/v1/properties/legacy-search'),
 *     legacySearchHandler,
 *   );
 *
 * Example router-level usage (marks every route in the router):
 *
 *   apiV1.use('/legacy', deprecationHeaders('router:/api/v1/legacy'), legacyRouter);
 */

import type { NextFunction, Request, Response } from 'express';

// ─── Registry ─────────────────────────────────────────────────────────────────

export interface DeprecatedEndpoint {
  /**
   * The route key, typically `METHOD /api/v1/path`.
   * Use `router:/api/v1/prefix` for router-level entries.
   */
  key: string;

  /**
   * ISO 8601 timestamp when this endpoint was marked deprecated.
   * Will be formatted as an HTTP-date in the response header.
   */
  deprecatedAt: string;

  /**
   * ISO 8601 timestamp when the endpoint will be removed.
   * Maps to the Sunset header.  Omit if no hard removal date is set yet.
   */
  sunsetAt?: string;

  /**
   * URL of the replacement endpoint.  Emitted as:
   *   Link: <url>; rel="successor-version"
   */
  successor?: string;
}

/**
 * Central registry of deprecated endpoints.
 *
 * Add a new entry here whenever an endpoint is scheduled for removal.
 * Keys should follow the pattern `METHOD /api/v1/path` (uppercase method).
 *
 * ⚠️  Do NOT remove entries until after the Sunset date has passed and
 * you have confirmed no clients are still calling the endpoint.
 */
export const DEPRECATED_ENDPOINTS: DeprecatedEndpoint[] = [
  // ── Example (disabled — uncomment to activate) ────────────────────────────
  // {
  //   key:          'GET /api/v1/properties/featured-legacy',
  //   deprecatedAt: '2025-01-01T00:00:00Z',
  //   sunsetAt:     '2025-07-01T00:00:00Z',
  //   successor:    '/api/v1/properties/search/advanced?featured=true',
  // },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an ISO 8601 date string to an RFC 7231 HTTP-date string.
 * Example: "2025-01-01T00:00:00Z" → "Wed, 01 Jan 2025 00:00:00 GMT"
 */
function toHttpDate(iso: string): string {
  return new Date(iso).toUTCString();
}

/**
 * Find the registry entry for a given route key or router prefix.
 */
function findEntry(key: string): DeprecatedEndpoint | undefined {
  return DEPRECATED_ENDPOINTS.find((e) => e.key === key);
}

// ─── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns an Express middleware that injects `Deprecation`, `Sunset`, and
 * `Link` headers when the given `routeKey` exists in the registry.
 *
 * If the key is not in the registry the middleware is a transparent no-op,
 * so it is safe to wire up speculatively.
 *
 * @param routeKey - Must match a `key` field in DEPRECATED_ENDPOINTS.
 *                   Typically `"METHOD /api/v1/path"` or
 *                   `"router:/api/v1/prefix"` for a whole sub-router.
 */
export function deprecationHeaders(routeKey: string) {
  return function deprecationMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const entry = findEntry(routeKey);

    if (entry) {
      res.setHeader('Deprecation', toHttpDate(entry.deprecatedAt));

      if (entry.sunsetAt) {
        res.setHeader('Sunset', toHttpDate(entry.sunsetAt));
      }

      if (entry.successor) {
        res.setHeader('Link', `<${entry.successor}>; rel="successor-version"`);
      }
    }

    next();
  };
}

/**
 * Router-level middleware that matches the request path against every entry
 * in the registry.  Mount this once at the top of the API v1 router so
 * every registered deprecated route is handled automatically, without having
 * to annotate individual route handlers.
 *
 * This is the recommended approach for bulk adoption.
 */
export function autoDeprecationHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const method = req.method.toUpperCase();
  const path   = req.path;

  // Check exact-match keys first (e.g. "GET /api/v1/properties/legacy-search")
  const exactKey = `${method} ${req.baseUrl}${path}`;
  let entry = findEntry(exactKey);

  // Fall back to router-prefix keys ("router:/api/v1/prefix")
  if (!entry) {
    const routerKey = `router:${req.baseUrl}`;
    entry = findEntry(routerKey);
  }

  if (entry) {
    res.setHeader('Deprecation', toHttpDate(entry.deprecatedAt));

    if (entry.sunsetAt) {
      res.setHeader('Sunset', toHttpDate(entry.sunsetAt));
    }

    if (entry.successor) {
      res.setHeader('Link', `<${entry.successor}>; rel="successor-version"`);
    }
  }

  next();
}
