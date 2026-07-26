import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { createHash } from 'node:crypto';
import { redisClient } from '@/config/redis.js';
import { loggingService } from '@/services/logging.service.js';
import { rateLimitStore } from '@/services/rateLimitStore.service.js';

export interface AuthRequest extends Request {
  userId?: string;
}

// Rate limiter instances
let generalLimiter: RateLimiterRedis | RateLimiterMemory;
let authLimiter: RateLimiterRedis | RateLimiterMemory;
let bookingLimiter: RateLimiterRedis | RateLimiterMemory;
let blockchainLimiter: RateLimiterRedis | RateLimiterMemory;

const useRedis = !!process.env.REDIS_URL;

if (useRedis) {
  generalLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:general',
    points: 100,
    duration: 60,
  });

  authLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:auth',
    points: 10,
    duration: 60,
  });

  bookingLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:booking',
    points: 5,
    duration: 60,
  });

  blockchainLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl:blockchain',
    points: 20,
    duration: 60,
  });
} else {
  generalLimiter = new RateLimiterMemory({ points: 100, duration: 60 });
  authLimiter = new RateLimiterMemory({ points: 10, duration: 60 });
  bookingLimiter = new RateLimiterMemory({ points: 5, duration: 60 });
  blockchainLimiter = new RateLimiterMemory({ points: 20, duration: 60 });
}

function setRateLimitHeaders(res: Response, limiterRes: any): void {
  res.setHeader('X-RateLimit-Limit', limiterRes.consumedPoints);
  res.setHeader('X-RateLimit-Remaining', limiterRes.remainingPoints);
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + limiterRes.msBeforeNext).toISOString());
}

/**
 * Hash an identity string (IP or userId) before recording it so we don't
 * persist raw personally-identifiable data in the metrics store.
 */
export function hashIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Record a rate-limit rejection and send the 429 response.
 * Identity is hashed before storage — raw IPs/user IDs are never persisted.
 */
async function handleRejection(
  req: Request,
  res: Response,
  limiterRes: any,
  scope: string,
  rawIdentity: string,
  message: string,
): Promise<void> {
  setRateLimitHeaders(res, limiterRes);
  res.setHeader('Retry-After', Math.ceil(limiterRes.msBeforeNext / 1000));

  // Record the rejection — identity is hashed for privacy
  const hashedIdentity = hashIdentity(rawIdentity);
  await rateLimitStore.record({
    route: req.path,
    method: req.method,
    scope,
    hashedIdentity,
    timestamp: Date.now(),
  });

  loggingService.logBlockchainOperation(
    'rate_limit_exceeded',
    { scope, route: req.path, method: req.method },
    undefined,
    message,
  );

  res.status(429).json({ error: message });
}

export function generalRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';

  generalLimiter
    .consume(key)
    .then((limiterRes) => {
      setRateLimitHeaders(res, limiterRes);
      next();
    })
    .catch((limiterRes) => {
      handleRejection(req, res, limiterRes, 'general', key, 'Too many requests, please try again later.');
    });
}

export function authRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';

  authLimiter
    .consume(key)
    .then((limiterRes) => {
      setRateLimitHeaders(res, limiterRes);
      next();
    })
    .catch((limiterRes) => {
      handleRejection(req, res, limiterRes, 'auth', key, 'Too many authentication requests, please try again later.');
    });
}

export function bookingRateLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const key = req.userId || req.ip || 'unknown';

  bookingLimiter
    .consume(key)
    .then((limiterRes) => {
      setRateLimitHeaders(res, limiterRes);
      next();
    })
    .catch((limiterRes) => {
      handleRejection(req, res, limiterRes, 'booking', key, 'Too many booking requests, please try again later.');
    });
}

export function blockchainRateLimiter(req: AuthRequest, res: Response, next: NextFunction): void {
  const key = req.userId || req.ip || 'unknown';

  blockchainLimiter
    .consume(key)
    .then((limiterRes) => {
      setRateLimitHeaders(res, limiterRes);
      next();
    })
    .catch((limiterRes) => {
      handleRejection(req, res, limiterRes, 'blockchain', key, 'Too many blockchain operations, please try again later.');
    });
}

// Backward compatibility export
export const rateLimiter = generalRateLimiter;
