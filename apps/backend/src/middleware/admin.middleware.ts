import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  adminId?: string;
}

/**
 * Admin-only authentication middleware.
 *
 * Validates a JWT and checks that it carries the `role: "admin"` claim.
 * This is intentionally separate from the regular `authenticate` middleware
 * so admin routes can be locked down independently.
 *
 * Callers must set ADMIN_JWT_SECRET in the environment (falls back to JWT_SECRET).
 */
export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as { userId: string; role?: string };

    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: admin role required.' });
      return;
    }

    req.adminId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
