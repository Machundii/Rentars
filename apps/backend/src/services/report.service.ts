/**
 * Report service — abuse reports against listings (properties) and reviews.
 */

import { supabase } from '../config/supabase.js';
import { createNotification, shouldSendInApp } from './notification.service.js';
import type { ServiceResponse } from './index.js';

export type ReportTargetType = 'property' | 'review';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export const REPORT_REASONS = [
  'spam',
  'fraud',
  'inappropriate',
  'misleading',
  'harassment',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface Report {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reporter_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const UNIQUE_VIOLATION = '23505';

/**
 * Submit an abuse report for a property listing or review.
 * Duplicate reports (same reporter + target) are rejected as a conflict.
 */
export async function submitReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<ServiceResponse<Report>> {
  if (!['property', 'review'].includes(targetType)) {
    return { success: false, error: 'target_type must be "property" or "review"' };
  }
  if (!REPORT_REASONS.includes(reason)) {
    return { success: false, error: `reason must be one of: ${REPORT_REASONS.join(', ')}` };
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: reporterId,
      reason,
      details: details || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        success: false,
        error: 'You have already reported this item',
        conflict: true,
        statusCode: 409,
      };
    }
    return { success: false, error: error.message };
  }

  await notifyModerators(data as Report);

  return { success: true, data: data as Report };
}

/**
 * List reports, optionally filtered by status and/or target type.
 * Moderator-only.
 */
export async function listReports(filters?: {
  status?: ReportStatus;
  targetType?: ReportTargetType;
}): Promise<ServiceResponse<Report[]>> {
  let query = supabase.from('reports').select('*');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.targetType) {
    query = query.eq('target_type', filters.targetType);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as Report[] };
}

/**
 * Resolve or dismiss a report. Moderator-only.
 */
export async function resolveReport(
  reportId: string,
  resolverId: string,
  status: Extract<ReportStatus, 'resolved' | 'dismissed'>,
  resolutionNote?: string,
): Promise<ServiceResponse<Report>> {
  if (status !== 'resolved' && status !== 'dismissed') {
    return { success: false, error: 'status must be "resolved" or "dismissed"' };
  }

  const { data, error } = await supabase
    .from('reports')
    .update({
      status,
      resolved_by: resolverId,
      resolution_note: resolutionNote || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Report not found' };

  const { record } = await import('./auditLog.service.js');
  await record(resolverId, `report.${status}`, 'report', reportId, { resolutionNote });

  return { success: true, data: data as Report };
}

/**
 * Fan out an in-app notification to every admin user when a new report comes in.
 * One recipient's failure never aborts notifying the rest.
 */
async function notifyModerators(report: Report): Promise<void> {
  const { data: admins, error } = await supabase.from('users').select('id').eq('role', 'admin');
  if (error || !admins) return;

  for (const admin of admins as Array<{ id: string }>) {
    try {
      const send = await shouldSendInApp(admin.id, 'report_created');
      if (!send) continue;
      await createNotification(admin.id, 'report_created', {
        reportId: report.id,
        targetType: report.target_type,
        targetId: report.target_id,
        reason: report.reason,
      });
    } catch (err) {
      console.error(`[notifyModerators] Failed to notify admin ${admin.id}:`, err);
    }
  }
}
