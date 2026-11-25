import crypto from 'crypto';
import { getDb } from './db';
import { AuditLogEntry } from '../src/types/cms';

export interface RecordAuditParams {
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string | null;
  actionType: string;
  targetUserId?: string | null;
  targetLabel?: string | null;
  departmentId?: string | null;
  ipAddress?: string | null;
  detail: string;
}

function sanitizeAuditDetail(raw: string): string {
  // Never store passwords, password hashes, OTP codes, tokens, or provider secrets inside audit log entries
  return raw
    .replace(
      /(AppSid|UNIFONIC_APP_SID|SESSION_SECRET|BOOTSTRAP_ADMIN_TOKEN|password|newPassword|currentPassword|recoveryToken|token|otp)=[^\s&]+/gi,
      '$1=[REDACTED]'
    )
    .replace(/\$argon2(?:id|i|d)\$[^\s]+/gi, '[HASH_REDACTED]')
    .slice(0, 600);
}

export function writeAuditLog(params: RecordAuditParams): AuditLogEntry {
  const db = getDb();
  const id = `aud-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const cleanDetail = sanitizeAuditDetail(params.detail);

  db.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, actor_name, actor_role, action_type,
      target_user_id, target_label, department_id, ip_address, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.actorUserId ?? null,
    params.actorName,
    params.actorRole ?? null,
    params.actionType,
    params.targetUserId ?? null,
    params.targetLabel ?? null,
    params.departmentId ?? null,
    params.ipAddress ?? null,
    cleanDetail,
    createdAt
  );

  return {
    id,
    timestamp: createdAt,
    actor: params.actorName,
    actorUserId: params.actorUserId ?? undefined,
    actorRole: (params.actorRole as AuditLogEntry['actorRole']) ?? undefined,
    departmentId: params.departmentId ?? null,
    action: params.actionType,
    detail: cleanDetail,
    targetUserId: params.targetUserId ?? undefined,
    targetLabel: params.targetLabel ?? undefined,
    ipAddress: params.ipAddress ?? undefined,
  };
}

export interface AuditFilterOptions {
  actionType?: string;
  actorUserId?: string;
  targetUserId?: string;
  departmentId?: string;
  search?: string;
  limit?: number;
}

export function queryAuditLogs(filters: AuditFilterOptions = {}): AuditLogEntry[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters.actionType && filters.actionType !== 'all') {
    clauses.push('action_type = ?');
    params.push(filters.actionType);
  }
  if (filters.actorUserId) {
    clauses.push('(actor_user_id = ? OR target_user_id = ?)');
    params.push(filters.actorUserId, filters.actorUserId);
  }
  if (filters.targetUserId) {
    clauses.push('target_user_id = ?');
    params.push(filters.targetUserId);
  }
  if (filters.departmentId) {
    clauses.push('department_id = ?');
    params.push(filters.departmentId);
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    clauses.push('(actor_name LIKE ? OR action_type LIKE ? OR detail LIKE ? OR target_label LIKE ?)');
    params.push(q, q, q, q);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit || 200, 1), 500);
  params.push(limit);

  const rows = db
    .prepare(`
      SELECT id, actor_user_id, actor_name, actor_role, action_type,
             target_user_id, target_label, department_id, ip_address, detail, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(...params) as {
    id: string;
    actor_user_id: string | null;
    actor_name: string;
    actor_role: string | null;
    action_type: string;
    target_user_id: string | null;
    target_label: string | null;
    department_id: string | null;
    ip_address: string | null;
    detail: string;
    created_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.created_at,
    actor: r.actor_name,
    actorUserId: r.actor_user_id ?? undefined,
    actorRole: (r.actor_role as AuditLogEntry['actorRole']) ?? undefined,
    departmentId: r.department_id ?? null,
    action: r.action_type,
    detail: r.detail,
    targetUserId: r.target_user_id ?? undefined,
    targetLabel: r.target_label ?? undefined,
    ipAddress: r.ip_address ?? undefined,
  }));
}
