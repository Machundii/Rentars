/**
 * Timing-safe utilities for authentication operations.
 * Prevents account enumeration attacks based on response time differences.
 */

import { timingSafeEqual } from 'crypto';

/**
 * Add delay to equalize response timing across success/failure paths.
 * Uses jitter to prevent timing analysis.
 *
 * @param minDelayMs - Minimum delay in milliseconds
 */
export async function constantTimeDelay(minDelayMs: number = 50): Promise<void> {
  const randomJitter = Math.random() * minDelayMs;
  const totalDelay = minDelayMs + randomJitter;

  return new Promise(resolve => setTimeout(resolve, totalDelay));
}

/**
 * Wrapper for operations that should have consistent timing.
 * Adds padding delay if operation completes too quickly.
 *
 * @param operation - Async function to execute
 * @param minDelayMs - Minimum total execution time including padding
 */
export async function withConstantTiming<T>(
  operation: () => Promise<T>,
  minDelayMs: number = 50,
): Promise<T> {
  const startTime = Date.now();
  const result = await operation();
  const elapsedMs = Date.now() - startTime;

  if (elapsedMs < minDelayMs) {
    const remainingDelay = minDelayMs - elapsedMs + Math.random() * minDelayMs;
    await new Promise(resolve => setTimeout(resolve, remainingDelay));
  }

  return result;
}

/**
 * Timing-safe comparison of two hex-encoded strings (e.g. HMAC signatures).
 *
 * Compares the raw bytes rather than the string representation so that
 * comparison time does not leak information about how many leading
 * characters matched. Returns false for any malformed input, length
 * mismatch, or non-hex characters without throwing.
 *
 * @param a - First hex string (e.g. computed signature)
 * @param b - Second hex string (e.g. provided signature)
 * @returns true only if both decode to identical byte sequences
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Normalize case; hex signatures are case-insensitive.
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  // Reject odd-length or non-hex input early. These are structural
  // failures, not secret-dependent, so early return is safe.
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  if (left.length % 2 !== 0 || right.length % 2 !== 0) {
    return false;
  }
  const hexPattern = /^[0-9a-f]+$/;
  if (!hexPattern.test(left) || !hexPattern.test(right)) {
    return false;
  }

  const leftBuf = Buffer.from(left, 'hex');
  const rightBuf = Buffer.from(right, 'hex');

  // timingSafeEqual requires equal-length buffers.
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }

  return timingSafeEqual(leftBuf, rightBuf);
}