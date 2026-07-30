import { z } from 'zod';
import { REPORT_REASONS } from '../services/report.service.js';

export const createReportSchema = z.object({
  targetType: z.enum(['property', 'review'], {
    required_error: 'targetType is required',
    invalid_type_error: 'targetType must be "property" or "review"',
  }),
  targetId: z
    .string({ required_error: 'targetId is required' })
    .uuid('targetId must be a valid UUID'),
  reason: z.enum(REPORT_REASONS, {
    required_error: 'reason is required',
    invalid_type_error: `reason must be one of: ${REPORT_REASONS.join(', ')}`,
  }),
  details: z.string().max(2000, 'details must be at most 2000 characters').optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed'], {
    required_error: 'status is required',
    invalid_type_error: 'status must be "resolved" or "dismissed"',
  }),
  resolutionNote: z.string().max(2000, 'resolutionNote must be at most 2000 characters').optional(),
});
