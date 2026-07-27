import type { NextFunction, Response } from 'express';
import { supabase } from '@/config/supabase.js';
import type { AuthRequest } from './auth.middleware.js';

/**
 * Guard middleware — blocks requests from unverified accounts.
 * Must be placed after `authenticate` so `req.userId` is available.
 */
export async function requireEmailVerified(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('users')
    .select('email_verified')
    .eq('id', req.userId)
    .single();

  if (error || !data) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!(data as { email_verified: boolean }).email_verified) {
    res.status(403).json({
      error: 'Email verification required',
      message: 'Please verify your email address before performing this action.',
    });
    return;
  }

  next();
}
