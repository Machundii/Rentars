import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  registerPushSubscription,
  unregisterPushSubscription,
  listPushSubscriptions,
} from '../controllers/push.controller.js';

const router = Router();

// POST /api/push/subscribe — register a push subscription
router.post('/subscribe', authenticate, registerPushSubscription);

// POST /api/push/unsubscribe — unregister a push subscription
router.post('/unsubscribe', authenticate, unregisterPushSubscription);

// GET /api/push/subscriptions — list user's push subscriptions
router.get('/subscriptions', authenticate, listPushSubscriptions);

export default router;
