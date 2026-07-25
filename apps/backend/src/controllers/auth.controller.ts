import type { Request, Response } from 'express';
import {
  loginUser,
  registerUser,
  generateWalletChallenge,
  verifyWalletChallenge,
  verifyEmail,
  resendVerification,
} from '@/services/auth.service.js';
import { AuthError } from '@/types/errors.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await registerUser(email, password);
    res.status(201).json(result.data);
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result.data);
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw err;
  }
}

export async function walletChallenge(req: Request, res: Response): Promise<void> {
  try {
    const { stellar_address } = req.body;
    const result = await generateWalletChallenge(stellar_address);
    res.json(result.data);
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw err;
  }
}

export async function walletVerify(req: Request, res: Response): Promise<void> {
  try {
    const { stellar_address, challenge, signature } = req.body;
    const result = await verifyWalletChallenge(stellar_address, challenge, signature);
    res.json(result.data);
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw err;
  }
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    res.status(422).json({ error: 'token query parameter is required' });
    return;
  }
  await verifyEmail(token);
  res.json({ message: 'Email verified successfully.' });
}

export async function resendVerificationHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body;
  await resendVerification(email);
  res.json({ message: 'If your account exists and is unverified, a new verification email has been sent.' });
}
