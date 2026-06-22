import { Router } from 'express';
import {
  getNotificationPreferences,
  listNotifications,
  readAllNotifications,
  readNotification,
  registerPushSubscription,
  removeNotification,
  unregisterPushSubscription,
  updateNotificationPreferences,
} from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// GET /api/v1/notifications
router.get('/', authenticate, listNotifications);

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, readAllNotifications);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, readNotification);

// DELETE /api/v1/notifications/:id
router.delete('/:id', authenticate, removeNotification);

// GET /api/v1/notifications/preferences
router.get('/preferences', authenticate, getNotificationPreferences);

// PATCH /api/v1/notifications/preferences
router.patch('/preferences', authenticate, updateNotificationPreferences);

// POST /api/v1/notifications/push/subscribe
router.post('/push/subscribe', authenticate, registerPushSubscription);

// POST /api/v1/notifications/push/unsubscribe
router.post('/push/unsubscribe', authenticate, unregisterPushSubscription);

export default router;
