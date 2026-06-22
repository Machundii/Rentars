import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import {
  deleteNotification,
  getNotifications,
  getPreferences,
  markAllAsRead,
  markAsRead,
  updatePreferences,
} from '../services/notification.service.js';
import {
  type PushSubscription,
  removePushSubscription,
  savePushSubscription,
} from '../services/push.service.js';

export async function listNotifications(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await getNotifications(userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.data);
}

export async function readNotification(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await markAsRead(req.params.id, userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(204).send();
}

export async function readAllNotifications(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await markAllAsRead(userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(204).send();
}

export async function removeNotification(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await deleteNotification(req.params.id, userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(204).send();
}

export async function getNotificationPreferences(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const result = await getPreferences(userId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.data);
}

export async function updateNotificationPreferences(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { email_notifications, push_notifications, notification_types } = req.body as {
    email_notifications?: boolean;
    push_notifications?: boolean;
    notification_types?: Record<string, boolean>;
  };

  const result = await updatePreferences(userId, {
    ...(email_notifications !== undefined && { email_notifications }),
    ...(push_notifications !== undefined && { push_notifications }),
    ...(notification_types !== undefined && { notification_types }),
  });

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result.data);
}

export async function registerPushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const subscription = req.body as PushSubscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    res.status(400).json({ error: 'Invalid push subscription' });
    return;
  }

  const result = await savePushSubscription(userId, subscription);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(result.data);
}

export async function unregisterPushSubscription(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: 'Missing endpoint' });
    return;
  }

  const result = await removePushSubscription(userId, endpoint);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(204).send();
}
