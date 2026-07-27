/**
 * Client-side error logger.
 *
 * Sends a sanitised error report to the backend for diagnosis.
 * Stack traces and internal details are NEVER exposed to the user —
 * they are stripped here and only forwarded server-side.
 *
 * In development the full error is also printed to the console.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ErrorReport {
  message: string;
  /** URL where the error occurred */
  href: string;
  /** Digest provided by Next.js error boundaries */
  digest?: string;
  /** Error boundary or component context label */
  context?: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Strip anything that looks like a stack trace, internal path, or token
 * from a raw error message before logging.
 */
function sanitiseMessage(raw: string): string {
  return raw
    // Remove file paths (e.g. /home/user/…, C:\, ./src/…)
    .replace(/([A-Za-z]:[\\/]|\/)[^\s'"]+/g, '[path]')
    // Remove anything that looks like a JWT / bearer token
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[token]')
    // Collapse consecutive whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Cap length so we never send huge payloads
    .slice(0, 300);
}

export async function logClientError(
  error: unknown,
  context?: string,
  digest?: string,
): Promise<void> {
  const raw = error instanceof Error ? error.message : String(error);
  const message = sanitiseMessage(raw);
  const href = typeof window !== 'undefined' ? window.location.href : '';

  const report: ErrorReport = {
    message,
    href,
    digest,
    context,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorLogger]', report, error instanceof Error ? error.stack : '');
  }

  try {
    await fetch(`${API_URL}/api/v1/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // fire-and-forget — don't await in error boundary useEffect to avoid cascading
      body: JSON.stringify(report),
      // Short timeout so a broken backend doesn't hang the error UI
      signal: AbortSignal.timeout?.(5000),
    });
  } catch {
    // Silently swallow — we must never throw from the logger
  }
}
