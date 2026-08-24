import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('[redis] Client error:', err));
redisClient.on('connect', () => console.log('[redis] Connected'));
redisClient.on('reconnecting', () => console.log('[redis] Reconnecting...'));

let connected = false;

export async function connectRedis(): Promise<void> {
  if (connected) return;
  await redisClient.connect();
  connected = true;
}

const REDIS_PING_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Redis operation timed out')), ms);
    }),
  ]);
}

/**
 * Verify Redis connectivity with a bounded-time PING.
 *
 * @returns true if Redis replies with PONG within the timeout, false otherwise
 */
export async function pingRedis(): Promise<boolean> {
  try {
    await withTimeout(connectRedis(), REDIS_PING_TIMEOUT_MS);
    const reply = await withTimeout(redisClient.ping(), REDIS_PING_TIMEOUT_MS);
    return reply === 'PONG';
  } catch {
    return false;
  }
}
