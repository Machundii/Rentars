import { supabase } from '../config/supabase.js';
import { connectRedis } from '../config/redis.js';

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: parseInt(process.env.STARTUP_RETRY_ATTEMPTS || '5', 10),
  initialDelayMs: parseInt(process.env.STARTUP_RETRY_INITIAL_DELAY_MS || '1000', 10),
  maxDelayMs: parseInt(process.env.STARTUP_RETRY_MAX_DELAY_MS || '30000', 10),
  backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateNextDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  return Math.min(exponentialDelay, options.maxDelayMs);
}

async function probeSupabase(): Promise<boolean> {
  const { error } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true });
  return !error;
}

async function probeRedis(): Promise<boolean> {
  try {
    await connectRedis();
    return true;
  } catch {
    return false;
  }
}

export async function retryDependencyConnections(
  options: RetryOptions = {}
): Promise<void> {
  const config: Required<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    attempt++;
    console.log(
      `[Startup] Checking dependencies (attempt ${attempt}/${config.maxAttempts})...`
    );

    try {
      const supabaseOk = await probeSupabase();
      const redisOk = await probeRedis();

      if (supabaseOk && redisOk) {
        console.log('[Startup] All dependencies are reachable ✓');
        return;
      }

      const failedDeps = [];
      if (!supabaseOk) failedDeps.push('Supabase');
      if (!redisOk) failedDeps.push('Redis');

      console.warn(`[Startup] Unreachable: ${failedDeps.join(', ')}`);
    } catch (error) {
      console.error(
        `[Startup] Dependency check failed:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    if (attempt >= config.maxAttempts) {
      console.error(
        `[Startup] Failed to connect to dependencies after ${config.maxAttempts} attempts. Exiting.`
      );
      process.exit(1);
    }

    const delay = calculateNextDelay(attempt - 1, config);
    console.log(`[Startup] Retrying in ${delay}ms...`);
    await sleep(delay);
  }
}
