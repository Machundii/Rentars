import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import {
  savePushSubscription,
  removePushSubscription,
  getUserPushSubscriptions,
  validatePushSubscription,
} from '../services/push.service.js';

export async function registerPushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { subscription } = req.body;
  if (!subscription) {
    res.status(400).json({ error: 'subscription object is required' });
    return;
  }

  const validationError = validatePushSubscription(subscription);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const result = await savePushSubscription(userId, subscription);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({
    message: 'Push subscription registered successfully',
    subscription: result.data,
  });
}

export async function unregisterPushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { endpoint } = req.body;
  if (!endpoint || typeof endpoint !== 'string') {
    res.status(400).json({ error: 'endpoint (string) is required' });
    return;
  }

  const result = await removePushSubscription(userId, endpoint);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ message: 'Push subscription removed successfully' });
}

export async function listPushSubscriptions(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await getUserPushSubscriptions(userId);
  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json({
    subscriptions: result.data,
    count: result.data?.length ?? 0,
  });
}
