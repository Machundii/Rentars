import { Router } from 'express';
import { login, register, requestReset, confirmReset } from '@/controllers/auth.controller.js';
import { walletChallenge, walletVerify } from '@/controllers/wallet.controller.js';
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
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

// POST /api/v1/auth/password-reset/request
router.post('/password-reset/request', authRateLimiter, validateBody(requestPasswordResetSchema), requestReset);

// POST /api/v1/auth/password-reset/confirm
router.post('/password-reset/confirm', authRateLimiter, validateBody(confirmPasswordResetSchema), confirmReset);

router.post('/wallet/challenge', authRateLimiter, validateBody(walletChallengeSchema), walletChallenge);
router.post('/wallet/verify', authRateLimiter, validateBody(walletVerifySchema), walletVerify);

export default router;
