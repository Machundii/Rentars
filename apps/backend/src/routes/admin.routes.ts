import { Router } from 'express';
import { requireAdmin } from '@/middleware/admin.middleware.js';
import { getRateLimitSummary } from '@/controllers/admin.controller.js';

const router = Router();

/**
 * All routes in this file require an admin JWT.
 */
router.use(requireAdmin);

/**
 * @openapi
 * /api/v1/admin/rate-limits:
 *   get:
 *     tags: [Admin]
 *     summary: Rate-limit rejection summary
 *     description: |
 *       Returns aggregated counts of rate-limit rejections grouped by route,
 *       method, and limiter scope over a configurable time window.
 *       Identities are hashed — no raw IP addresses or user IDs are exposed.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window
 *         schema:
 *           type: integer
 *           default: 3600
 *         description: Time window in seconds (max 604800 = 7 days)
 *     responses:
 *       200:
 *         description: Summary payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 windowSeconds: { type: integer }
 *                 since: { type: string, format: date-time }
 *                 total: { type: integer }
 *                 alert: { type: boolean }
 *                 byRoute:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       route: { type: string }
 *                       method: { type: string }
 *                       scope: { type: string }
 *                       count: { type: integer }
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Not an admin
 */
router.get('/rate-limits', getRateLimitSummary);

export default router;
