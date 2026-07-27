import { Router } from 'express';
import { receiveClientError } from '@/controllers/clientError.controller.js';

const router = Router();

/**
 * @openapi
 * /api/v1/client-errors:
 *   post:
 *     tags: [Monitoring]
 *     summary: Receive a client-side error report
 *     description: |
 *       Accepts sanitised error reports from the browser.
 *       Stack traces and sensitive data must be stripped before sending.
 *       Always returns 204 regardless of payload validity.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string, maxLength: 300 }
 *               href: { type: string, format: uri, maxLength: 2048 }
 *               digest: { type: string, maxLength: 64 }
 *               context: { type: string, maxLength: 100 }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       204:
 *         description: Accepted (always — response is not differentiated)
 */
router.post('/', receiveClientError);

export default router;
