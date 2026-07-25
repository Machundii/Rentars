import { Router } from 'express';
import { login, register, verifyEmailHandler, resendVerificationHandler } from '@/controllers/auth.controller.js';
import { walletChallenge, walletVerify } from '@/controllers/wallet.controller.js';
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  walletChallengeSchema,
  walletVerifySchema,
  validateBody,
} from '@/validators/auth.validator.js';
import { authRateLimiter } from '@/middleware/rateLimiter.js';

const router = Router();

// POST /api/v1/auth/register
router.post('/register', authRateLimiter, validateBody(registerSchema), register);

// POST /api/v1/auth/login
router.post('/login', authRateLimiter, validateBody(loginSchema), login);

// GET /api/v1/auth/verify-email?token=...
router.get('/verify-email', verifyEmailHandler);

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', authRateLimiter, validateBody(resendVerificationSchema), resendVerificationHandler);

router.post('/wallet/challenge', authRateLimiter, validateBody(walletChallengeSchema), walletChallenge);
router.post('/wallet/verify', authRateLimiter, validateBody(walletVerifySchema), walletVerify);

export default router;
