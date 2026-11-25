import crypto from 'crypto';
import {
  AccountStatus,
  DepartmentAccessScope,
  PermissionKey,
  UserPublicProfile,
  UserRole,
} from '../src/types/cms';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
} from '../src/utils/rbac';
import { writeAuditLog } from './audit';
import { maskSaudiPhone, normalizeSaudiPhone } from './config';
import { getDb, withTransaction } from './db';
import { hashPasswordArgon2id, validatePasswordStrength } from './passwords';

const VALID_ROLES: UserRole[] = [
  'super_admin',
  'project_manager',
  'department_manager',
  'engineer',
  'supervisor',
  'employee',
];

const ADMIN_EXCLUSIVE_PERMS = new Set<PermissionKey>([
  'manage_users',
  'manage_devices_sessions',
  'manage_departments',
  'manage_system',
]);

interface UserRow {
  id: string;
  full_name: string;
  username: string;
  phone: string;
  job_title: string;
  primary_department_id: string;
  department_access_scope: DepartmentAccessScope;
  status: AccountStatus;
  password_hash?: string | null;
  password_updated_at?: string | null;
  must_change_password?: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

function hydrateUserRow(row: UserRow): UserPublicProfile {
  const db = getDb();
  const roleRow = db
    .prepare('SELECT role_id FROM user_roles WHERE user_id = ? LIMIT 1')
    .get(row.id) as { role_id: UserRole } | undefined;

  const permRows = db
    .prepare('SELECT permission_id FROM user_permissions WHERE user_id = ?')
    .all(row.id) as { permission_id: PermissionKey }[];

  const deptRows = db
    .prepare('SELECT department_id FROM user_department_access WHERE user_id = ?')
    .all(row.id) as { department_id: string }[];

  const role: UserRole = roleRow?.role_id || 'employee';
  const permissions =
    role === 'super_admin'
      ? [...ALL_PERMISSION_KEYS]
      : permRows.map((p) => p.permission_id);

  return {
    id: row.id,
    fullName: row.full_name,
    jobTitle: row.job_title,
    username: row.username,
    phone: row.phone,
    maskedPhone: maskSaudiPhone(row.phone),
    primaryDepartmentId: row.primary_department_id,
    departmentAccessScope: row.department_access_scope,
    allowedDepartmentIds: deptRows.map((d) => d.department_id),
    role,
    status: row.status,
    permissions,
    hasPassword: Boolean(row.password_hash && row.password_hash.startsWith('$argon2')),
    mustChangePassword: row.must_change_password === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

export function countSuperAdmins(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = 'super_admin'"
    )
    .get() as { cnt: number };
  return Number(row?.cnt || 0);
}

export function needsBootstrapSuperAdmin(): boolean {
  return countSuperAdmins() === 0;
}

export function getUserProfileById(userId: string): UserPublicProfile | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    .get(userId) as UserRow | undefined;
  return row ? hydrateUserRow(row) : null;
}

export function getUserProfileByPhone(phoneRaw: string): UserPublicProfile | null {
  const normalized = normalizeSaudiPhone(phoneRaw);
  if (!normalized) return null;
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE phone = ? LIMIT 1')
    .get(normalized) as UserRow | undefined;
  return row ? hydrateUserRow(row) : null;
}

export function getUserAuthRecordByUsername(usernameRaw: string): {
  user: UserPublicProfile;
  passwordHash: string | null;
  mustChangePassword: boolean;
} | null {
  const cleanUsername = (usernameRaw || '').trim().toLowerCase();
  if (!cleanUsername) return null;
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = ? LIMIT 1')
    .get(cleanUsername) as UserRow | undefined;
  if (!row) return null;
  return {
    user: hydrateUserRow(row),
    passwordHash: row.password_hash ?? null,
    mustChangePassword: row.must_change_password === 1,
  };
}

export function listAllUsers(): UserPublicProfile[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM users ORDER BY created_at DESC')
    .all() as unknown as UserRow[];
  return rows.map(hydrateUserRow);
}

function validateDepartmentExists(deptId: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM departments WHERE id = ? AND is_active = 1 LIMIT 1')
    .get(deptId) as { id: string } | undefined;
  return Boolean(row);
}

function resolveDefaultPrimaryDepartmentId(): string {
  const db = getDb();
  const preferred = db
    .prepare("SELECT id FROM departments WHERE id = 'dept-pm' LIMIT 1")
    .get() as { id: string } | undefined;
  if (preferred) return preferred.id;
  const first = db
    .prepare('SELECT id FROM departments WHERE is_active = 1 ORDER BY code ASC LIMIT 1')
    .get() as { id: string } | undefined;
  if (!first) {
    throw new Error('لا توجد إدارات مهيأة في قاعدة البيانات.');
  }
  return first.id;
}

function sanitizePermissionsForRole(
  role: UserRole,
  requested: PermissionKey[] | undefined
): PermissionKey[] {
  const validSet = new Set<PermissionKey>(ALL_PERMISSION_KEYS);
  if (role === 'super_admin') {
    return [...ALL_PERMISSION_KEYS];
  }
  const source = Array.isArray(requested) ? requested : DEFAULT_ROLE_PERMISSIONS[role];
  const unique = Array.from(new Set(source.filter((p) => validSet.has(p))));
  // Non-super-admin roles NEVER receive Super-Admin exclusive system/user/device admin keys
  return unique.filter((p) => !ADMIN_EXCLUSIVE_PERMS.has(p));
}

export function createFirstSuperAdminAtomic(input: {
  fullName: string;
  username: string;
  phone: string;
  jobTitle?: string;
  primaryDepartmentId?: string;
  passwordHash?: string | null;
  ipAddress?: string | null;
}): { ok: boolean; user?: UserPublicProfile; error?: string } {
  const cleanName = (input.fullName || '').trim();
  const cleanUser = (input.username || '').trim().toLowerCase();
  const normalizedPhone = normalizeSaudiPhone(input.phone || '');
  const cleanTitle = (input.jobTitle || 'مدير النظام الرئيسي').trim();

  if (cleanName.length < 3) {
    return { ok: false, error: 'يجب إدخال الاسم الكامل (3 أحرف على الأقل).' };
  }
  if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUser)) {
    return {
      ok: false,
      error: 'اسم المستخدم يجب أن يكون 3–32 حرفاً إنجليزياً أو أرقاماً (a-z, 0-9, _, ., -).',
    };
  }
  if (!normalizedPhone) {
    return { ok: false, error: 'يجب إدخال رقم جوال سعودي صالح (يبدأ بـ 05 أو +9665).' };
  }

  const primaryDept =
    input.primaryDepartmentId && validateDepartmentExists(input.primaryDepartmentId)
      ? input.primaryDepartmentId
      : resolveDefaultPrimaryDepartmentId();

  try {
    const createdUser = withTransaction((db) => {
      const existingSuper = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM user_roles WHERE role_id = 'super_admin'"
        )
        .get() as { cnt: number };

      if (Number(existingSuper?.cnt || 0) > 0) {
        throw new Error('ALREADY_BOOTSTRAPPED');
      }

      const now = new Date().toISOString();
      const userId = `usr-${crypto.randomUUID()}`;

      db.prepare(`
        INSERT INTO users (
          id, full_name, username, phone, job_title,
          primary_department_id, department_access_scope, status,
          password_hash, password_updated_at,
          created_by_user_id, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'all', 'active', ?, ?, NULL, ?, ?, ?)
      `).run(
        userId,
        cleanName,
        cleanUser,
        normalizedPhone,
        cleanTitle,
        primaryDept,
        input.passwordHash || null,
        input.passwordHash ? now : null,
        now,
        now,
        now
      );

      db.prepare(
        'INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at) VALUES (?, ?, ?, ?)'
      ).run(userId, 'super_admin', userId, now);

      const insertPerm = db.prepare(
        'INSERT INTO user_permissions (user_id, permission_id, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)'
      );
      for (const perm of ALL_PERMISSION_KEYS) {
        insertPerm.run(userId, perm, userId, now);
      }

      return userId;
    });

    const profile = getUserProfileById(createdUser)!;
    writeAuditLog({
      actorUserId: profile.id,
      actorName: profile.fullName,
      actorRole: 'super_admin',
      actionType: 'تهيئة أول مدير نظام رئيسي (Bootstrap)',
      targetUserId: profile.id,
      targetLabel: `${profile.fullName} (${profile.maskedPhone})`,
      departmentId: profile.primaryDepartmentId,
      ipAddress: input.ipAddress ?? null,
      detail: `تم إنشاء أول حساب Super Admin وتعطيل التهيئة الأولية نهائياً.`,
    });

    return { ok: true, user: profile };
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_BOOTSTRAPPED') {
      return {
        ok: false,
        error: 'تمت تهيئة أول حساب Super Admin مسبقاً. التهيئة معطلة نهائياً.',
      };
    }
    return {
      ok: false,
      error: 'تعذر إتمام التهيئة الأولية لمدير النظام. تحقق من عدم تكرار البيانات.',
    };
  }
}

export interface CreateUserByAdminInput {
  fullName: string;
  username: string;
  phone: string;
  jobTitle: string;
  primaryDepartmentId: string;
  departmentAccessScope: DepartmentAccessScope;
  allowedDepartmentIds?: string[];
  role: UserRole;
  status?: AccountStatus;
  permissions?: PermissionKey[];
  initialPassword?: string;
}

export async function createUserBySuperAdmin(
  actor: UserPublicProfile,
  input: CreateUserByAdminInput,
  ipAddress?: string | null
): Promise<{ ok: boolean; status?: number; user?: UserPublicProfile; error?: string }> {
  if (actor.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'فقط مدير النظام الرئيسي (Super Admin) يملك صلاحية إنشاء حسابات المستخدمين.',
    };
  }

  const cleanName = (input.fullName || '').trim();
  const cleanUser = (input.username || '').trim().toLowerCase();
  const cleanTitle = (input.jobTitle || '').trim();
  const normalizedPhone = normalizeSaudiPhone(input.phone || '');

  if (cleanName.length < 2) {
    return { ok: false, status: 400, error: 'يرجى إدخال الاسم الكامل للمستخدم.' };
  }
  if (!/^[a-z0-9_.-]{3,32}$/.test(cleanUser)) {
    return {
      ok: false,
      status: 400,
      error: 'اسم المستخدم يجب أن يتكون من 3–32 حرفاً إنجليزياً أو أرقاماً.',
    };
  }
  if (!normalizedPhone) {
    return {
      ok: false,
      status: 400,
      error: 'يجب إدخال رقم جوال سعودي صالح (مثال: 05XXXXXXXX أو +9665XXXXXXXX).',
    };
  }
  if (cleanTitle.length < 2) {
    return { ok: false, status: 400, error: 'يرجى إدخال المسمى الوظيفي.' };
  }
  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, status: 400, error: 'الدور الوظيفي المحدد غير صالح.' };
  }
  if (!input.primaryDepartmentId || !validateDepartmentExists(input.primaryDepartmentId)) {
    return {
      ok: false,
      status: 400,
      error: 'يجب تحديد إدارة أساسية واحدة صالحة للمستخدم.',
    };
  }

  const pwdValidation = validatePasswordStrength(input.initialPassword || '', cleanUser);
  if (!pwdValidation.ok) {
    return {
      ok: false,
      status: 400,
      error: pwdValidation.error || 'يرجى إدخال كلمة مرور ابتدائية قوية (10 أحرف فأكثر بحروف وأرقام).',
    };
  }

  const effectiveScope: DepartmentAccessScope =
    input.role === 'super_admin'
      ? 'all'
      : ['primary_only', 'specific', 'all'].includes(input.departmentAccessScope)
        ? input.departmentAccessScope
        : 'primary_only';

  const cleanAllowedDepts =
    effectiveScope === 'specific'
      ? Array.from(
          new Set(
            [input.primaryDepartmentId, ...(input.allowedDepartmentIds || [])].filter((id) =>
              validateDepartmentExists(id)
            )
          )
        )
      : [];

  const db = getDb();
  const dupPhone = db
    .prepare('SELECT id FROM users WHERE phone = ? LIMIT 1')
    .get(normalizedPhone);
  if (dupPhone) {
    return { ok: false, status: 409, error: 'رقم الجوال مسجل مسبقاً لحساب آخر.' };
  }

  const dupUsername = db
    .prepare('SELECT id FROM users WHERE username = ? LIMIT 1')
    .get(cleanUser);
  if (dupUsername) {
    return { ok: false, status: 409, error: 'اسم المستخدم مسجل مسبقاً.' };
  }

  const passwordHash = await hashPasswordArgon2id(input.initialPassword!);
  const perms = sanitizePermissionsForRole(input.role, input.permissions);
  const status: AccountStatus = input.status === 'suspended' ? 'suspended' : 'active';
  const now = new Date().toISOString();
  const userId = `usr-${crypto.randomUUID()}`;

  withTransaction((tx) => {
    tx.prepare(`
      INSERT INTO users (
        id, full_name, username, phone, job_title,
        primary_department_id, department_access_scope, status,
        password_hash, password_updated_at, must_change_password,
        created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      userId,
      cleanName,
      cleanUser,
      normalizedPhone,
      cleanTitle,
      input.primaryDepartmentId,
      effectiveScope,
      status,
      passwordHash,
      now,
      actor.id,
      now,
      now
    );

    tx.prepare(
      'INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at) VALUES (?, ?, ?, ?)'
    ).run(userId, input.role, actor.id, now);

    const insertPerm = tx.prepare(
      'INSERT INTO user_permissions (user_id, permission_id, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)'
    );
    for (const p of perms) {
      insertPerm.run(userId, p, actor.id, now);
    }

    const insertScope = tx.prepare(
      'INSERT INTO user_department_access (user_id, department_id, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)'
    );
    for (const dId of cleanAllowedDepts) {
      insertScope.run(userId, dId, actor.id, now);
    }
  });

  const created = getUserProfileById(userId)!;
  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إنشاء حساب مستخدم',
    targetUserId: created.id,
    targetLabel: `${created.fullName} (@${created.username})`,
    departmentId: created.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: `إنشاء حساب بدور (${created.role}) وإدارة أساسية (${created.primaryDepartmentId}) ونطاق (${created.departmentAccessScope}) بكلمة مرور ابتدائية مشفرة.`,
  });

  return { ok: true, status: 201, user: created };
}

export interface UpdateUserByAdminInput {
  fullName?: string;
  jobTitle?: string;
  phone?: string;
  primaryDepartmentId?: string;
  departmentAccessScope?: DepartmentAccessScope;
  allowedDepartmentIds?: string[];
  role?: UserRole;
  status?: AccountStatus;
  permissions?: PermissionKey[];
}

export function updateUserBySuperAdmin(
  actor: UserPublicProfile,
  targetUserId: string,
  patch: UpdateUserByAdminInput,
  ipAddress?: string | null
): { ok: boolean; status?: number; user?: UserPublicProfile; error?: string } {
  if (actor.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'فقط مدير النظام الرئيسي يملك صلاحية تعديل الحسابات أو الصلاحيات أو نطاق الإدارات.',
    };
  }

  const existing = getUserProfileById(targetUserId);
  if (!existing) {
    return { ok: false, status: 404, error: 'الحساب المطلوب غير موجود.' };
  }

  if (existing.id === actor.id && patch.status === 'suspended') {
    return { ok: false, status: 400, error: 'لا يمكنك إيقاف حسابك النشط حالياً.' };
  }

  const nextRole = patch.role ?? existing.role;
  if (!VALID_ROLES.includes(nextRole)) {
    return { ok: false, status: 400, error: 'الدور الوظيفي غير صالح.' };
  }

  const nextStatus: AccountStatus =
    patch.status === 'suspended' || patch.status === 'active'
      ? patch.status
      : existing.status;

  if (
    existing.role === 'super_admin' &&
    (nextRole !== 'super_admin' || nextStatus === 'suspended')
  ) {
    const db = getDb();
    const activeSupers = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role_id = 'super_admin' AND u.status = 'active'"
      )
      .get() as { cnt: number };
    if (Number(activeSupers?.cnt || 0) <= 1) {
      return {
        ok: false,
        status: 400,
        error: 'لا يمكن إيقاف أو تخفيض دور آخر مدير نظام رئيسي نشط.',
      };
    }
  }

  let nextPhone = existing.phone;
  if (patch.phone !== undefined) {
    const norm = normalizeSaudiPhone(patch.phone);
    if (!norm) {
      return { ok: false, status: 400, error: 'رقم الجوال السعودي غير صالح.' };
    }
    if (norm !== existing.phone) {
      const db = getDb();
      const dup = db
        .prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1')
        .get(norm, existing.id);
      if (dup) {
        return { ok: false, status: 409, error: 'رقم الجوال مستخدم لحساب آخر.' };
      }
      nextPhone = norm;
    }
  }

  const nextPrimaryDept = patch.primaryDepartmentId ?? existing.primaryDepartmentId;
  if (!validateDepartmentExists(nextPrimaryDept)) {
    return { ok: false, status: 400, error: 'الإدارة الأساسية المحددة غير صالحة.' };
  }

  const nextScope: DepartmentAccessScope =
    nextRole === 'super_admin'
      ? 'all'
      : patch.departmentAccessScope ?? existing.departmentAccessScope;

  if (!['primary_only', 'specific', 'all'].includes(nextScope)) {
    return { ok: false, status: 400, error: 'نطاق الوصول للإدارات غير صالح.' };
  }

  const nextAllowedDepts =
    nextScope === 'specific'
      ? Array.from(
          new Set(
            [
              nextPrimaryDept,
              ...(patch.allowedDepartmentIds ?? existing.allowedDepartmentIds),
            ].filter((id) => validateDepartmentExists(id))
          )
        )
      : [];

  const nextPerms =
    patch.permissions !== undefined || patch.role !== undefined
      ? sanitizePermissionsForRole(nextRole, patch.permissions ?? existing.permissions)
      : existing.permissions;

  const nextName =
    typeof patch.fullName === 'string' && patch.fullName.trim().length >= 2
      ? patch.fullName.trim()
      : existing.fullName;

  const nextJob =
    typeof patch.jobTitle === 'string' && patch.jobTitle.trim().length >= 2
      ? patch.jobTitle.trim()
      : existing.jobTitle;

  const now = new Date().toISOString();

  withTransaction((tx) => {
    tx.prepare(`
      UPDATE users SET
        full_name = ?, job_title = ?, phone = ?,
        primary_department_id = ?, department_access_scope = ?,
        status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextName,
      nextJob,
      nextPhone,
      nextPrimaryDept,
      nextScope,
      nextStatus,
      now,
      existing.id
    );

    if (patch.role !== undefined) {
      tx.prepare('DELETE FROM user_roles WHERE user_id = ?').run(existing.id);
      tx.prepare(
        'INSERT INTO user_roles (user_id, role_id, assigned_by_user_id, assigned_at) VALUES (?, ?, ?, ?)'
      ).run(existing.id, nextRole, actor.id, now);
    }

    if (patch.permissions !== undefined || patch.role !== undefined) {
      tx.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(existing.id);
      const insertPerm = tx.prepare(
        'INSERT INTO user_permissions (user_id, permission_id, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)'
      );
      for (const p of nextPerms) {
        insertPerm.run(existing.id, p, actor.id, now);
      }
    }

    if (
      patch.departmentAccessScope !== undefined ||
      patch.allowedDepartmentIds !== undefined ||
      patch.primaryDepartmentId !== undefined ||
      patch.role !== undefined
    ) {
      tx.prepare('DELETE FROM user_department_access WHERE user_id = ?').run(existing.id);
      const insertScope = tx.prepare(
        'INSERT INTO user_department_access (user_id, department_id, granted_by_user_id, granted_at) VALUES (?, ?, ?, ?)'
      );
      for (const dId of nextAllowedDepts) {
        insertScope.run(existing.id, dId, actor.id, now);
      }
    }

    // Immediate revocation of ALL sessions and trusted devices upon suspension
    if (nextStatus === 'suspended') {
      tx.prepare(
        "UPDATE sessions SET revoked_at = ?, revoked_reason = 'account_suspended' WHERE user_id = ? AND revoked_at IS NULL"
      ).run(now, existing.id);

      tx.prepare(
        'UPDATE trusted_devices SET is_trusted = 0, revoked_at = ?, revoked_by_user_id = ? WHERE user_id = ? AND revoked_at IS NULL'
      ).run(now, actor.id, existing.id);
    }
  });

  const updated = getUserProfileById(existing.id)!;

  // Record specific granular audit logs
  const changes: string[] = [];
  if (existing.status !== updated.status) {
    changes.push(
      updated.status === 'suspended' ? 'إيقاف الحساب وإلغاء الجلسات والأجهزة' : 'إعادة تفعيل الحساب'
    );
  }
  if (existing.primaryDepartmentId !== updated.primaryDepartmentId) {
    changes.push(
      `تغيير الإدارة الأساسية (${existing.primaryDepartmentId} ← ${updated.primaryDepartmentId})`
    );
  }
  if (
    existing.departmentAccessScope !== updated.departmentAccessScope ||
    JSON.stringify(existing.allowedDepartmentIds) !==
      JSON.stringify(updated.allowedDepartmentIds)
  ) {
    changes.push(`تغيير نطاق الوصول (${updated.departmentAccessScope})`);
  }
  if (existing.role !== updated.role) {
    changes.push(`تغيير الدور (${existing.role} ← ${updated.role})`);
  }
  if (JSON.stringify(existing.permissions) !== JSON.stringify(updated.permissions)) {
    changes.push(`تحديث الصلاحيات (${updated.permissions.length} صلاحية)`);
  }
  if (existing.phone !== updated.phone) {
    changes.push('تحديث رقم الجوال');
  }

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType:
      existing.status !== updated.status
        ? updated.status === 'suspended'
          ? 'إيقاف حساب مستخدم'
          : 'إعادة تفعيل حساب مستخدم'
        : 'تعديل بيانات وصلاحيات مستخدم',
    targetUserId: updated.id,
    targetLabel: `${updated.fullName} (@${updated.username})`,
    departmentId: updated.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: changes.length > 0 ? changes.join(' · ') : 'تحديث بيانات الحساب.',
  });

  return { ok: true, status: 200, user: updated };
}
