import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/booking.validator.js';
import { createReportSchema, resolveReportSchema } from '../validators/report.validator.js';
import {
  createReport,
  listReportsHandler,
  resolveReportHandler,
} from '../controllers/report.controller.js';

const router = Router();

// POST /api/v1/reports — report a listing or review
router.post('/', authenticate, validateBody(createReportSchema), createReport);

// GET /api/v1/reports — list/filter reports (moderator-only)
router.get('/', authenticate, requireRole('admin'), listReportsHandler);

// PATCH /api/v1/reports/:id/resolve — resolve or dismiss a report (moderator-only)
router.patch(
  '/:id/resolve',
  authenticate,
  requireRole('admin'),
  validateBody(resolveReportSchema),
  resolveReportHandler,
);

export default router;
