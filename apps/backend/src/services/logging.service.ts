import { AsyncLocalStorage } from 'node:async_hooks';
import { supabase } from '@/config/supabase.js';

// ─── Request correlation context ──────────────────────────────────────────────

/**
 * Per-request context propagated via AsyncLocalStorage so that any log call
 * made during a request's async call chain (controllers, services, blockchain
 * calls, Supabase queries) can be tagged with the same correlation id without
 * threading `req` through every function signature.
 */
export interface RequestLogContext {
  requestId: string;
  method?: string;
  path?: string;
  userId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestLogContext>();

/**
 * Run `callback` with `context` bound to the current async execution chain.
 * Called once per request by `requestIdMiddleware`.
 */
export function runWithRequestContext<T>(
  context: RequestLogContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

/** Returns the correlation context for the in-flight request, if any. */
export function getRequestContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Attach the authenticated user id to the current request context once auth
 * middleware resolves it, so subsequent log calls in the same request include it.
 */
export function setRequestContextUserId(userId: string): void {
  const store = requestContextStorage.getStore();
  if (store) store.userId = userId;
}

export interface BlockchainOperationLog {
  operation: string;
  userId?: string;
  bookingId?: string;
  propertyId?: string;
  txHash?: string;
  escrowId?: string;
  error?: string;
  [key: string]: unknown;
}

class LoggingService {
  async logBlockchainOperation(
    operation: string,
    input: Record<string, unknown>,
    result?: Record<string, unknown>,
    error?: string,
  ): Promise<void> {
    const context = getRequestContext();

    try {
      const { error: dbError } = await supabase
        .from('blockchain_logs')
        .insert({
          operation,
          input_json: input,
          result_json: result || null,
          error_message: error || null,
        });

      if (dbError) {
        console.error(`Failed to log blockchain operation ${operation}:`, dbError);
      }
    } catch (err) {
      console.error(`Error logging blockchain operation ${operation}:`, err);
    }

    const { error: errorMsg, ...rest } = { error, ...input };
    const entry = {
      ...rest,
      requestId: context?.requestId,
      method: context?.method,
      path: context?.path,
      userId: context?.userId,
    };
    if (error) {
      console.error(`[Blockchain:${operation}] ERROR:`, errorMsg, JSON.stringify(entry));
    } else {
      console.log(`[Blockchain:${operation}]`, JSON.stringify(entry));
    }
  }
}

export const loggingService = new LoggingService();

// ─── Security event logger ────────────────────────────────────────────────────

type SecurityEvent =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'register_success'
  | 'token_revoked'
  | 'unauthorized_access'
  | 'rate_limit_exceeded';

class SecurityLogger {
  async logAuthEvent(
    event: SecurityEvent,
    userId?: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const context = getRequestContext();
    const entry = {
      event,
      userId: userId ?? context?.userId,
      requestId: context?.requestId,
      method: context?.method,
      path: context?.path,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    // Console output always
    if (event === 'login_failure' || event === 'unauthorized_access') {
      console.warn(`[Security:${event}]`, JSON.stringify(entry));
    } else {
      console.log(`[Security:${event}]`, JSON.stringify(entry));
    }

    // Persist to Supabase (best-effort)
    try {
      await supabase.from('security_logs').insert({
        event,
        user_id: userId || null,
        meta_json: meta || null,
      });
    } catch {
      // non-fatal — DB table may not exist yet
    }
  }
}

export const securityLogger = new SecurityLogger();
