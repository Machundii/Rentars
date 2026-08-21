/**
 * Follow routes — mounted at /api/v1/follows
 *
 * All routes require a valid JWT (authenticate middleware).
 */

import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware.js';
import {
  followHostHandler,
  unfollowHostHandler,
  followStatusHandler,
  listFollowedHostsHandler,
  listFollowersHandler,
} from '@/controllers/follow.controller.js';

const router = Router();

// All follow routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /api/v1/follows/hosts:
 *   get:
 *     tags: [Follows]
 *     summary: List hosts the current user follows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of followed host summaries
 *       401:
 *         description: Unauthorized
 */
router.get('/hosts', listFollowedHostsHandler);

/**
 * @openapi
 * /api/v1/follows/followers:
 *   get:
 *     tags: [Follows]
 *     summary: List users following the current user (as host)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of follower summaries
 *       401:
 *         description: Unauthorized
 */
router.get('/followers', listFollowersHandler);

/**
 * @openapi
 * /api/v1/follows/hosts/{hostId}/status:
 *   get:
 *     tags: [Follows]
 *     summary: Check if the current user follows a specific host
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hostId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: "{ following: boolean }"
 *       401:
 *         description: Unauthorized
 */
router.get('/hosts/:hostId/status', followStatusHandler);

/**
 * @openapi
 * /api/v1/follows/hosts/{hostId}:
 *   post:
 *     tags: [Follows]
 *     summary: Follow a host
 *     description: Idempotent — safe to call if already following.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hostId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Follow created (or already existed)
 *       404:
 *         description: Host not found
 *       422:
 *         description: Cannot follow yourself
 *       401:
 *         description: Unauthorized
 */
router.post('/hosts/:hostId', followHostHandler);

/**
 * @openapi
 * /api/v1/follows/hosts/{hostId}:
 *   delete:
 *     tags: [Follows]
 *     summary: Unfollow a host
 *     description: Idempotent — safe to call if not following.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hostId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Unfollowed (or was never following)
 *       401:
 *         description: Unauthorized
 */
router.delete('/hosts/:hostId', unfollowHostHandler);

export default router;
