/**
 * Audit log service — immutable trail of sensitive admin/moderator actions.
 *
 * Entries are append-only: this module exposes no update/delete function,
 * and no route ever calls one.
 */

import { supabase } from '../config/supabase.js';
import type { ServiceResponse } from './index.js';

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
}

/**
 * Record an audit entry for a sensitive admin/moderator action.
 * Never throws — a logging failure must not block the action it describes.
 */
export async function record(
  actorId: string,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<ServiceResponse<AuditLogEntry>> {
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId ?? null,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error(`[auditLog] Failed to record "${action}" on ${targetType}:`, error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as AuditLogEntry };
}

/**
 * List/filter audit log entries. Admin-only — enforced at the route layer.
 */
export async function listAuditLogs(
  filters?: AuditLogFilters,
): Promise<ServiceResponse<AuditLogEntry[]>> {
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);

  let query = supabase.from('audit_logs').select('*');

  if (filters?.actorId) query = query.eq('actor_id', filters.actorId);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.targetType) query = query.eq('target_type', filters.targetType);
  if (filters?.targetId) query = query.eq('target_id', filters.targetId);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as AuditLogEntry[] };
}
