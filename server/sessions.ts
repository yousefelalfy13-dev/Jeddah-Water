import crypto from 'crypto';
import type { Request, Response } from 'express';
import {
  SessionInfoRecord,
  TrustedDeviceRecord,
  UserPublicProfile,
} from '../src/types/cms';
import { ROLE_LABELS } from '../src/utils/rbac';
import { writeAuditLog } from './audit';
import {
  getAuthSmsConfig,
  getBootstrapTokenConfig,
  getSessionSecret,
  isProductionEnv,
  maskSaudiPhone,
  normalizeSaudiPhone,
} from './config';
import { getDb, withTransaction } from './db';
import {
  hashPasswordArgon2id,
  validatePasswordStrength,
  verifyPasswordArgon2id,
} from './passwords';
import {
  getUserAuthRecordByUsername,
  getUserProfileById,
  getUserProfileByPhone,
  needsBootstrapSuperAdmin,
} from './users';

export const SESSION_COOKIE_NAME = 'jw_session';
export const DEVICE_COOKIE_NAME = 'jw_device';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

const ipOtpLimits = new Map<string, { count: number; resetAt: number }>();

function getTokenPepper(): string {
  // In production, validateStartupConfiguration ensures SESSION_SECRET >= 32 chars.
  // In local dev without SESSION_SECRET set, use fixed deterministic dev pepper so SQLite sessions survive server restarts.
  return getSessionSecret() || 'jw-local-dev-sqlite-token-pepper-v1';
}

export function hashSecretToken(rawToken: string): string {
  return crypto.createHmac('sha256', getTokenPepper()).update(rawToken).digest('hex');
}

function hashOtpCode(otpCode: string, salt: string): string {
  return crypto
    .createHmac('sha256', getTokenPepper())
    .update(`${salt}:${otpCode}`)
    .digest('hex');
}

function verifyOtpHash(otpCode: string, salt: string, storedHash: string): boolean {
  const candidate = hashOtpCode(otpCode, salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function parseDeviceLabel(userAgent: string): string {
  const ua = userAgent || '';
  let browser = 'متصفح ويب';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/curl|node/i.test(ua)) browser = 'أداة طرفية / عميل HTTP';

  let os = 'نظام غير محدد';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} · ${os}`;
}

export function computeDeviceFingerprint(req: Request): string {
  const ua = String(req.headers['user-agent'] || 'unknown');
  const lang = String(req.headers['accept-language'] || '');
  // Never rely on name alone; binds cryptographic device token + UA + language
  return crypto
    .createHash('sha256')
    .update(`${ua}|${lang.slice(0, 32)}`)
    .digest('hex');
}

function checkIpOtpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipOtpLimits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipOtpLimits.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function emitAuthCookies(
  res: Response,
  rawSessionToken: string,
  rawDeviceToken?: string
) {
  const maxAgeSession = Math.floor(SESSION_TTL_MS / 1000);
  const cookies = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawSessionToken)}; HttpOnly; Secure; SameSite=None; Partitioned; Path=/; Max-Age=${maxAgeSession}`,
  ];
  if (rawDeviceToken) {
    const maxAgeDevice = 90 * 24 * 60 * 60; // 90 days
    cookies.push(
      `${DEVICE_COOKIE_NAME}=${encodeURIComponent(rawDeviceToken)}; HttpOnly; Secure; SameSite=None; Partitioned; Path=/; Max-Age=${maxAgeDevice}`
    );
  }
  res.setHeader('Set-Cookie', cookies);
}

export function clearSessionOnlyCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Partitioned; Path=/; Max-Age=0`
  );
}

export function clearAllAuthCookies(res: Response) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Partitioned; Path=/; Max-Age=0`,
    `${DEVICE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=None; Partitioned; Path=/; Max-Age=0`,
  ]);
}

// ==========================================
// Bootstrap OTP (One-Time First Super Admin)
// ==========================================
export function verifyBootstrapAuthorizationToken(providedToken: string): boolean {
  const cfg = getBootstrapTokenConfig();
  const cleanProvided = (providedToken || '').trim();
  if (!cleanProvided || cleanProvided.length !== cfg.expectedToken.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(cleanProvided),
    Buffer.from(cfg.expectedToken)
  );
}

export async function requestBootstrapOtp(params: {
  bootstrapToken: string;
  phoneRaw: string;
  ipAddress: string;
}): Promise<{
  ok: boolean;
  status: number;
  message?: string;
  error?: string;
  via?: string;
  devBootstrapOtp?: string;
}> {
  if (!needsBootstrapSuperAdmin()) {
    return {
      ok: false,
      status: 403,
      error: 'تمت تهيئة أول حساب Super Admin مسبقاً. التهيئة الأولية معطلة نهائياً.',
    };
  }
  if (!verifyBootstrapAuthorizationToken(params.bootstrapToken)) {
    writeAuditLog({
      actorName: 'مجهول',
      actionType: 'محاولة تهيئة أولية فاشلة',
      ipAddress: params.ipAddress,
      detail: 'رمز تهيئة Bootstrap غير صحيح.',
    });
    return { ok: false, status: 401, error: 'رمز التفويض الخاص بالتهيئة الأولية غير صحيح.' };
  }

  const normalizedPhone = normalizeSaudiPhone(params.phoneRaw);
  if (!normalizedPhone) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى إدخال رقم جوال سعودي صالح (يبدأ بـ 05 أو +9665).',
    };
  }

  const db = getDb();
  const lastReq = db
    .prepare(
      "SELECT created_at FROM otp_requests WHERE phone = ? AND purpose = 'bootstrap_super_admin' ORDER BY created_at DESC LIMIT 1"
    )
    .get(normalizedPhone) as { created_at: string } | undefined;

  if (lastReq) {
    const elapsed = Date.now() - new Date(lastReq.created_at).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        ok: false,
        status: 429,
        error: `يرجى الانتظار ${waitSec} ثانية قبل إعادة طلب رمز التحقق.`,
      };
    }
  }

  const otpCode = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtpCode(otpCode, salt);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const smsCfg = getAuthSmsConfig();

  let channel = 'mock_console';
  let deliveryStatus = 'logged_on_server_terminal';

  if (smsCfg.mode === 'unifonic') {
    return {
      ok: false,
      status: 410,
      error: 'تم إيقاف التحقق عبر OTP و Unifonic. يرجى اعتماد التهيئة عبر الخادم.',
    };
  }
  if (isProductionEnv()) {
    return {
      ok: false,
      status: 503,
      error: 'يُمنع استخدام وضع Mock SMS في بيئة الإنتاج.',
    };
  }

  return {
    ok: false,
    status: 410,
    error: 'تم إيقاف التحقق عبر OTP. يرجى استخدام تسجيل الدخول باسم المستخدم وكلمة المرور.',
  };
}

export function verifyOtpRecord(params: {
  purpose: 'login' | 'bootstrap_super_admin';
  phoneRaw: string;
  otpCode: string;
  ipAddress: string;
}): { ok: boolean; status: number; otpId?: string; userId?: string | null; error?: string } {
  const normalizedPhone = normalizeSaudiPhone(params.phoneRaw);
  const cleanCode = (params.otpCode || '').trim();
  if (!normalizedPhone || !/^\d{6}$/.test(cleanCode)) {
    return { ok: false, status: 400, error: 'رقم الجوال أو رمز التحقق غير صحيح.' };
  }

  const db = getDb();
  const row = db
    .prepare(`
      SELECT id, user_id, otp_hash, otp_salt, expires_at, attempts, max_attempts, consumed_at, invalidated_at
      FROM otp_requests
      WHERE phone = ? AND purpose = ? AND consumed_at IS NULL AND invalidated_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(normalizedPhone, params.purpose) as
    | {
        id: string;
        user_id: string | null;
        otp_hash: string;
        otp_salt: string;
        expires_at: string;
        attempts: number;
        max_attempts: number;
        consumed_at: string | null;
        invalidated_at: string | null;
      }
    | undefined;

  if (!row) {
    return {
      ok: false,
      status: 401,
      error: 'رمز التحقق غير صالح أو منتهي الصلاحية.',
    };
  }

  const nowIso = new Date().toISOString();
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('UPDATE otp_requests SET invalidated_at = ? WHERE id = ?').run(
      nowIso,
      row.id
    );
    return {
      ok: false,
      status: 401,
      error: 'انتهت صلاحية رمز التحقق (5 دقائق). يرجى طلب رمز جديد.',
    };
  }

  if (row.attempts >= row.max_attempts) {
    db.prepare('UPDATE otp_requests SET invalidated_at = ? WHERE id = ?').run(
      nowIso,
      row.id
    );
    return {
      ok: false,
      status: 429,
      error: 'تم تجاوز الحد الأقصى لمحاولات التحقق. يرجى طلب رمز جديد.',
    };
  }

  const matches = verifyOtpHash(cleanCode, row.otp_salt, row.otp_hash);
  if (!matches) {
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= row.max_attempts) {
      db.prepare(
        'UPDATE otp_requests SET attempts = ?, invalidated_at = ? WHERE id = ?'
      ).run(nextAttempts, nowIso, row.id);
    } else {
      db.prepare('UPDATE otp_requests SET attempts = ? WHERE id = ?').run(
        nextAttempts,
        row.id
      );
    }
    return {
      ok: false,
      status: 401,
      error: 'رمز التحقق غير صحيح.',
    };
  }

  // Single-use atomic consume
  const consumeRes = db
    .prepare(
      'UPDATE otp_requests SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL'
    )
    .run(nowIso, row.id);

  if (consumeRes.changes === 0) {
    return {
      ok: false,
      status: 401,
      error: 'تم استخدام رمز التحقق مسبقاً.',
    };
  }

  return { ok: true, status: 200, otpId: row.id, userId: row.user_id };
}

// ==========================================
// Legacy OTP Login Disabled (410 Gone)
// ==========================================
export async function requestLoginOtp(
  _phoneRaw: string,
  _ipAddress: string
): Promise<{ ok: boolean; status: number; message?: string; error?: string }> {
  return {
    ok: false,
    status: 410,
    error: 'تم إيقاف تسجيل الدخول عبر OTP و Unifonic حالياً. يرجى استخدام اسم المستخدم وكلمة المرور.',
  };
}

// ==========================================
// Username & Password Auth + Rate Limiting + Recovery
// ==========================================
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_TOKEN_TTL_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
const GENERIC_RECOVERY_ERROR =
  'بيانات الاستعادة الإدارية غير صالحة أو منتهية الصلاحية.';

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RateLimitRow {
  limit_key: string;
  failed_attempts: number;
  first_failed_at: string | null;
  last_failed_at: string | null;
  locked_until: string | null;
  lockout_tier: number;
}

function getActiveLockoutRemainingSeconds(keys: string[]): number {
  const db = getDb();
  const now = Date.now();
  let maxRemainingMs = 0;

  const stmt = db.prepare(
    'SELECT limit_key, failed_attempts, first_failed_at, last_failed_at, locked_until, lockout_tier FROM login_rate_limits WHERE limit_key = ? LIMIT 1'
  );

  for (const key of keys) {
    const row = stmt.get(key) as RateLimitRow | undefined;
    if (!row || !row.locked_until) continue;
    const lockedUntilMs = new Date(row.locked_until).getTime();
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > now) {
      maxRemainingMs = Math.max(maxRemainingMs, lockedUntilMs - now);
    }
  }

  return maxRemainingMs > 0 ? Math.ceil(maxRemainingMs / 1000) : 0;
}

function recordAuthFailureForKeys(keys: string[]): {
  maxFailures: number;
  lockoutSeconds: number;
} {
  const db = getDb();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let maxFailures = 0;
  let maxLockoutSec = 0;

  const selectStmt = db.prepare(
    'SELECT limit_key, failed_attempts, first_failed_at, last_failed_at, locked_until, lockout_tier FROM login_rate_limits WHERE limit_key = ? LIMIT 1'
  );
  const upsertStmt = db.prepare(`
    INSERT INTO login_rate_limits (
      limit_key, failed_attempts, first_failed_at, last_failed_at, locked_until, lockout_tier, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(limit_key) DO UPDATE SET
      failed_attempts = excluded.failed_attempts,
      first_failed_at = excluded.first_failed_at,
      last_failed_at = excluded.last_failed_at,
      locked_until = excluded.locked_until,
      lockout_tier = excluded.lockout_tier,
      updated_at = excluded.updated_at
  `);

  withTransaction(() => {
    for (const key of keys) {
      const existing = selectStmt.get(key) as RateLimitRow | undefined;
      const firstFailedMs = existing?.first_failed_at
        ? new Date(existing.first_failed_at).getTime()
        : 0;
      const expiredWindow =
        !existing ||
        !firstFailedMs ||
        (now - firstFailedMs > LOGIN_RATE_WINDOW_MS &&
          (!existing.locked_until || new Date(existing.locked_until).getTime() <= now));

      const nextAttempts = expiredWindow ? 1 : existing.failed_attempts + 1;
      const nextFirstAt = expiredWindow ? nowIso : existing.first_failed_at || nowIso;

      let lockDurationMs = 0;
      let tier = existing?.lockout_tier || 0;
      if (nextAttempts >= 12) {
        lockDurationMs = 30 * 60 * 1000; // 30 minutes
        tier = 3;
      } else if (nextAttempts >= 8) {
        lockDurationMs = 15 * 60 * 1000; // 15 minutes
        tier = 2;
      } else if (nextAttempts >= 5) {
        lockDurationMs = 5 * 60 * 1000; // 5 minutes
        tier = 1;
      }

      const lockedUntilIso =
        lockDurationMs > 0 ? new Date(now + lockDurationMs).toISOString() : null;

      upsertStmt.run(
        key,
        nextAttempts,
        nextFirstAt,
        nowIso,
        lockedUntilIso,
        tier,
        nowIso
      );

      maxFailures = Math.max(maxFailures, nextAttempts);
      if (lockDurationMs > 0) {
        maxLockoutSec = Math.max(maxLockoutSec, Math.ceil(lockDurationMs / 1000));
      }
    }
  });

  return { maxFailures, lockoutSeconds: maxLockoutSec };
}

function clearAuthFailuresForKeys(keys: string[]) {
  const db = getDb();
  const delStmt = db.prepare('DELETE FROM login_rate_limits WHERE limit_key = ?');
  for (const key of keys) {
    delStmt.run(key);
  }
}

function formatWaitArabic(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.ceil(seconds / 60);
    return `${mins} دقيقة`;
  }
  return `${seconds} ثانية`;
}

export async function loginWithUsernamePassword(params: {
  usernameRaw: string;
  passwordRaw: string;
  req: Request;
  res: Response;
}): Promise<{
  ok: boolean;
  status: number;
  retryAfterSeconds?: number;
  user?: UserPublicProfile;
  sessionId?: string;
  deviceId?: string;
  isNewDevice?: boolean;
  mustChangePassword?: boolean;
  error?: string;
}> {
  const cleanUsername = (params.usernameRaw || '').trim().toLowerCase();
  const password = typeof params.passwordRaw === 'string' ? params.passwordRaw : '';
  const ip = getClientIp(params.req);

  if (!cleanUsername || !password) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
    };
  }

  const rateKeys = [`user:${cleanUsername}`, `ip:${ip}`];
  const activeWait = getActiveLockoutRemainingSeconds(rateKeys);
  if (activeWait > 0) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: activeWait,
      error: `تم تجاوز عدد محاولات تسجيل الدخول الفاشلة. تم تقييد الدخول مؤقتاً، يرجى المحاولة بعد ${formatWaitArabic(activeWait)}.`,
    };
  }

  const isValidFormat = /^[a-z0-9_.-]{3,32}$/.test(cleanUsername);
  const authRecord = isValidFormat ? getUserAuthRecordByUsername(cleanUsername) : null;

  // Always verify via Argon2id (even with dummy hash when account doesn't exist) to prevent username timing leaks
  const passwordOk = await verifyPasswordArgon2id(authRecord?.passwordHash, password);

  if (!authRecord || !passwordOk || authRecord.user.status !== 'active') {
    const failureState = recordAuthFailureForKeys(rateKeys);
    if (failureState.maxFailures >= 2 && failureState.lockoutSeconds === 0) {
      const delayMs = Math.min((failureState.maxFailures - 1) * 350, 1400);
      await sleepMs(delayMs);
    }

    writeAuditLog({
      actorUserId: authRecord?.user.id ?? null,
      actorName: authRecord ? authRecord.user.fullName : 'محاولة دخول غير مصرح بها',
      actorRole: authRecord?.user.role ?? 'system',
      actionType: 'فشل تسجيل الدخول',
      targetUserId: authRecord?.user.id ?? null,
      targetLabel: authRecord ? `@${authRecord.user.username}` : cleanUsername.slice(0, 32),
      departmentId: authRecord?.user.primaryDepartmentId ?? null,
      ipAddress: ip,
      detail:
        failureState.lockoutSeconds > 0
          ? `فشل المصادقة بكلمة المرور وتفعيل الحظر المؤقت (${failureState.maxFailures} محاولات).`
          : `فشل المصادقة باسم المستخدم وكلمة المرور (محاولة رقم ${failureState.maxFailures}).`,
    });

    if (failureState.lockoutSeconds > 0) {
      return {
        ok: false,
        status: 429,
        retryAfterSeconds: failureState.lockoutSeconds,
        error: `تم تجاوز عدد محاولات تسجيل الدخول المسموح بها. يرجى الانتظار ${formatWaitArabic(failureState.lockoutSeconds)} ثم المحاولة مجدداً.`,
      };
    }

    return {
      ok: false,
      status: 401,
      error: GENERIC_LOGIN_ERROR,
    };
  }

  clearAuthFailuresForKeys(rateKeys);

  const sesMeta = createTrustedDeviceAndSession({
    user: authRecord.user,
    req: params.req,
    res: params.res,
  });

  writeAuditLog({
    actorUserId: authRecord.user.id,
    actorName: authRecord.user.fullName,
    actorRole: authRecord.user.role,
    actionType: 'تسجيل دخول ناجح',
    targetUserId: authRecord.user.id,
    targetLabel: `${authRecord.user.fullName} (@${authRecord.user.username})`,
    departmentId: authRecord.user.primaryDepartmentId,
    ipAddress: ip,
    detail: `دخول مصادق عليه باسم المستخدم وكلمة المرور (Argon2id) بدور (${ROLE_LABELS[authRecord.user.role]}).`,
  });

  return {
    ok: true,
    status: 200,
    user: authRecord.user,
    sessionId: sesMeta.sessionId,
    deviceId: sesMeta.deviceId,
    isNewDevice: sesMeta.isNewDevice,
    mustChangePassword: authRecord.mustChangePassword,
  };
}

const INITIAL_SUPER_ADMIN_ID = 'usr-abafe459-5034-4c1b-97ef-dc4994ea27db';
const INITIAL_SUPER_ADMIN_USERNAME = 'yousef.elalfy';
// Activated temporarily in dev only per explicit user approval; will be removed completely after first login
const INITIAL_WEB_PASSWORD_SETUP_ACTIVE = true;

function isInitialWebPasswordSetupActivated(): boolean {
  if (isProductionEnv()) return false;
  return (
    INITIAL_WEB_PASSWORD_SETUP_ACTIVE ||
    process.env.__TEST_ALLOW_INITIAL_PW_SETUP === '1'
  );
}

export function needsInitialPasswordSetup(): boolean {
  if (!isInitialWebPasswordSetupActivated()) {
    return false;
  }
  const authRecord = getUserAuthRecordByUsername(INITIAL_SUPER_ADMIN_USERNAME);
  if (!authRecord) {
    return false;
  }
  return (
    authRecord.user.id === INITIAL_SUPER_ADMIN_ID &&
    authRecord.user.role === 'super_admin' &&
    authRecord.user.status === 'active' &&
    !authRecord.passwordHash
  );
}

export async function setInitialSuperAdminPasswordWithToken(params: {
  bootstrapToken: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress: string;
}): Promise<{ ok: boolean; status: number; retryAfterSeconds?: number; error?: string }> {
  if (isProductionEnv()) {
    return {
      ok: false,
      status: 403,
      error: 'هذا المسار المؤقت مخصص لبيئة التطوير فقط ومعطّل في الإنتاج.',
    };
  }

  if (!isInitialWebPasswordSetupActivated()) {
    return {
      ok: false,
      status: 503,
      error: 'المسار المؤقت مهيأ البرمجة ولكنه غير مفعّل بعد بانتظار موافقة التفعيل.',
    };
  }

  const tokenCfg = getBootstrapTokenConfig();
  if (!tokenCfg.isEnvConfigured) {
    return {
      ok: false,
      status: 503,
      error:
        'متغير BOOTSTRAP_ADMIN_TOKEN غير مضبوط في Secrets ببيئة الخادم الحالية. يرجى ضبطه أولاً.',
    };
  }

  const authRecord = getUserAuthRecordByUsername(INITIAL_SUPER_ADMIN_USERNAME);
  if (!authRecord || authRecord.user.id !== INITIAL_SUPER_ADMIN_ID) {
    return {
      ok: false,
      status: 404,
      error: 'تعذر العثور على حساب المدير الرئيسي المعتمد.',
    };
  }
  if (authRecord.user.status !== 'active' || authRecord.user.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'الحساب غير مؤهل لإجراء التعيين الأولي لكلمة المرور.',
    };
  }
  if (authRecord.passwordHash) {
    return {
      ok: false,
      status: 410,
      error: 'تم تعيين كلمة المرور الأولى مسبقاً. تم إغلاق هذا المسار نهائياً.',
    };
  }

  const rateKeys = [
    `initial_pw_user:${INITIAL_SUPER_ADMIN_USERNAME}`,
    `initial_pw_ip:${params.ipAddress}`,
  ];
  const activeWait = getActiveLockoutRemainingSeconds(rateKeys);
  if (activeWait > 0) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: activeWait,
      error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${formatWaitArabic(activeWait)} ثم المحاولة مجدداً.`,
    };
  }

  const cleanProvided = (params.bootstrapToken || '').trim();
  const providedBuf = Buffer.from(cleanProvided, 'utf8');
  const expectedBuf = Buffer.from(tokenCfg.expectedToken, 'utf8');
  const tokenMatches =
    cleanProvided.length > 0 &&
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!tokenMatches) {
    const failureState = recordAuthFailureForKeys(rateKeys);
    if (failureState.maxFailures >= 2 && failureState.lockoutSeconds === 0) {
      await sleepMs(Math.min((failureState.maxFailures - 1) * 350, 1400));
    }

    writeAuditLog({
      actorUserId: authRecord.user.id,
      actorName: 'محاولة تعيين كلمة مرور أولية غير مفوضة',
      actorRole: 'system',
      actionType: 'فشل تعيين كلمة المرور الأولى',
      targetUserId: authRecord.user.id,
      targetLabel: `@${authRecord.user.username}`,
      departmentId: authRecord.user.primaryDepartmentId,
      ipAddress: params.ipAddress,
      detail:
        failureState.lockoutSeconds > 0
          ? `فشل التحقق من رمز التفويض السري وتفعيل الحظر المؤقت (${failureState.maxFailures} محاولات).`
          : `فشل التحقق من رمز التفويض السري أثناء تعيين كلمة المرور الأولى (محاولة ${failureState.maxFailures}).`,
    });

    if (failureState.lockoutSeconds > 0) {
      return {
        ok: false,
        status: 429,
        retryAfterSeconds: failureState.lockoutSeconds,
        error: `تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار ${formatWaitArabic(failureState.lockoutSeconds)}.`,
      };
    }

    return {
      ok: false,
      status: 401,
      error: 'رمز التفويض السري غير صحيح.',
    };
  }

  const newPassword = typeof params.newPassword === 'string' ? params.newPassword : '';
  const confirmPassword =
    typeof params.confirmPassword === 'string' ? params.confirmPassword : '';
  if (!newPassword || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى إدخال كلمة المرور الجديدة وتأكيدها.',
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.',
    };
  }

  const strength = validatePasswordStrength(newPassword, INITIAL_SUPER_ADMIN_USERNAME);
  if (!strength.ok) {
    return { ok: false, status: 400, error: strength.error };
  }

  const passwordHash = await hashPasswordArgon2id(newPassword);
  const nowIso = new Date().toISOString();

  const updated = withTransaction((tx) => {
    const res = tx
      .prepare(`
        UPDATE users
        SET password_hash = ?, password_updated_at = ?, must_change_password = 0, updated_at = ?
        WHERE id = ? AND username = ? AND status = 'active' AND password_hash IS NULL
      `)
      .run(
        passwordHash,
        nowIso,
        nowIso,
        INITIAL_SUPER_ADMIN_ID,
        INITIAL_SUPER_ADMIN_USERNAME
      );

    if (res.changes !== 1) {
      return false;
    }

    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'initial_password_set' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, INITIAL_SUPER_ADMIN_ID);

    return true;
  });

  if (!updated) {
    return {
      ok: false,
      status: 410,
      error: 'تم تعيين كلمة المرور الأولى مسبقاً. تم إغلاق هذا المسار نهائياً.',
    };
  }

  clearAuthFailuresForKeys([
    ...rateKeys,
    `user:${INITIAL_SUPER_ADMIN_USERNAME}`,
    `ip:${params.ipAddress}`,
  ]);

  writeAuditLog({
    actorUserId: authRecord.user.id,
    actorName: authRecord.user.fullName,
    actorRole: authRecord.user.role,
    actionType: 'تعيين كلمة المرور الأولى',
    targetUserId: authRecord.user.id,
    targetLabel: `${authRecord.user.fullName} (@${authRecord.user.username})`,
    departmentId: authRecord.user.primaryDepartmentId,
    ipAddress: params.ipAddress,
    detail:
      'تم تعيين كلمة المرور الأولى لحساب المدير الرئيسي بتشفير Argon2id (Salt مستقل) وإغلاق المسار المؤقت تلقائياً.',
  });

  return { ok: true, status: 200 };
}

export async function changeAuthenticatedUserPassword(params: {
  user: UserPublicProfile;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  req: Request;
  res: Response;
}): Promise<{ ok: boolean; status: number; sessionId?: string; error?: string }> {
  const currentPassword =
    typeof params.currentPassword === 'string' ? params.currentPassword : '';
  const newPassword = typeof params.newPassword === 'string' ? params.newPassword : '';
  const confirmPassword =
    typeof params.confirmPassword === 'string' ? params.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى إدخال كلمة المرور الحالية والجديدة وتأكيدها.',
    };
  }
  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.',
    };
  }
  if (currentPassword === newPassword) {
    return {
      ok: false,
      status: 400,
      error: 'يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية.',
    };
  }

  const strength = validatePasswordStrength(newPassword, params.user.username);
  if (!strength.ok) {
    return { ok: false, status: 400, error: strength.error };
  }

  const authRecord = getUserAuthRecordByUsername(params.user.username);
  if (!authRecord || !authRecord.passwordHash) {
    return {
      ok: false,
      status: 400,
      error: 'لا توجد كلمة مرور حالية مضبوطة لهذا الحساب. استخدم التهيئة الإدارية.',
    };
  }

  const matches = await verifyPasswordArgon2id(authRecord.passwordHash, currentPassword);
  if (!matches) {
    writeAuditLog({
      actorUserId: params.user.id,
      actorName: params.user.fullName,
      actorRole: params.user.role,
      actionType: 'فشل تغيير كلمة المرور',
      targetUserId: params.user.id,
      targetLabel: `@${params.user.username}`,
      departmentId: params.user.primaryDepartmentId,
      ipAddress: getClientIp(params.req),
      detail: 'تم رفض طلب تغيير كلمة المرور لعدم صحة كلمة المرور الحالية.',
    });
    return { ok: false, status: 401, error: 'كلمة المرور الحالية غير صحيحة.' };
  }

  const nextHash = await hashPasswordArgon2id(newPassword);
  const nowIso = new Date().toISOString();

  withTransaction((tx) => {
    tx.prepare(
      'UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(nextHash, nowIso, nowIso, params.user.id);

    // Revoke ALL previously active sessions across all devices on password change
    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_changed' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, params.user.id);
  });

  // Rotate current session cleanly so the active browser receives a brand-new session cookie while prior sessions stay revoked
  const refreshedUser = getUserProfileById(params.user.id) || params.user;
  const sesMeta = createTrustedDeviceAndSession({
    user: refreshedUser,
    req: params.req,
    res: params.res,
  });

  writeAuditLog({
    actorUserId: refreshedUser.id,
    actorName: refreshedUser.fullName,
    actorRole: refreshedUser.role,
    actionType: 'تغيير كلمة المرور',
    targetUserId: refreshedUser.id,
    targetLabel: `${refreshedUser.fullName} (@${refreshedUser.username})`,
    departmentId: refreshedUser.primaryDepartmentId,
    ipAddress: getClientIp(params.req),
    detail: 'تم تحديث كلمة المرور بنجاح (Argon2id) وإبطال كافة الجلسات السابقة وتدوير الجلسة الحالية.',
  });

  return { ok: true, status: 200, sessionId: sesMeta.sessionId };
}

export async function resetPasswordBySuperAdmin(params: {
  actor: UserPublicProfile;
  targetUserId: string;
  temporaryPassword: string;
  ipAddress?: string | null;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  if (params.actor.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'فقط مدير النظام الرئيسي يملك صلاحية إعادة تعيين كلمات المرور.',
    };
  }

  const target = getUserProfileById(params.targetUserId);
  if (!target) {
    return { ok: false, status: 404, error: 'الحساب المطلوب غير موجود.' };
  }

  const strength = validatePasswordStrength(params.temporaryPassword, target.username);
  if (!strength.ok) {
    return { ok: false, status: 400, error: strength.error };
  }

  const nextHash = await hashPasswordArgon2id(params.temporaryPassword);
  const nowIso = new Date().toISOString();

  withTransaction((tx) => {
    tx.prepare(
      'UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
    ).run(nextHash, nowIso, nowIso, target.id);

    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'admin_password_reset' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, target.id);

    tx.prepare(
      'UPDATE password_recovery_tokens SET invalidated_at = ? WHERE user_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL'
    ).run(nowIso, target.id);
  });

  writeAuditLog({
    actorUserId: params.actor.id,
    actorName: params.actor.fullName,
    actorRole: params.actor.role,
    actionType: 'إعادة تعيين كلمة مرور مستخدم',
    targetUserId: target.id,
    targetLabel: `${target.fullName} (@${target.username})`,
    departmentId: target.primaryDepartmentId,
    ipAddress: params.ipAddress ?? null,
    detail: 'تم تعيين كلمة مرور مؤقتة إدارياً وإبطال جميع الجلسات النشطة للحساب.',
  });

  return { ok: true, status: 200 };
}

export function issueAdminPasswordRecoveryToken(params: {
  actor: UserPublicProfile;
  targetUserId: string;
  ipAddress?: string | null;
}): {
  ok: boolean;
  status: number;
  recoveryToken?: string;
  expiresAt?: string;
  error?: string;
} {
  if (params.actor.role !== 'super_admin') {
    return {
      ok: false,
      status: 403,
      error: 'فقط مدير النظام الرئيسي يملك صلاحية إصدار رمز استعادة كلمة المرور.',
    };
  }

  const target = getUserProfileById(params.targetUserId);
  if (!target) {
    return { ok: false, status: 404, error: 'الحساب المطلوب غير موجود.' };
  }
  if (target.status !== 'active') {
    return { ok: false, status: 400, error: 'لا يمكن إصدار رمز استعادة لحساب موقوف.' };
  }

  const rawRecoveryToken = crypto.randomBytes(18).toString('base64url');
  const tokenHash = hashSecretToken(`recovery:${target.id}:${rawRecoveryToken}`);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + RECOVERY_TOKEN_TTL_MS).toISOString();
  const recId = `rec-${crypto.randomUUID()}`;

  withTransaction((tx) => {
    tx.prepare(
      'UPDATE password_recovery_tokens SET invalidated_at = ? WHERE user_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL'
    ).run(nowIso, target.id);

    tx.prepare(`
      INSERT INTO password_recovery_tokens (
        id, user_id, token_hash, issued_by_user_id, expires_at, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      recId,
      target.id,
      tokenHash,
      params.actor.id,
      expiresAtIso,
      params.ipAddress ?? null,
      nowIso
    );
  });

  writeAuditLog({
    actorUserId: params.actor.id,
    actorName: params.actor.fullName,
    actorRole: params.actor.role,
    actionType: 'إصدار رمز استعادة كلمة مرور إداري',
    targetUserId: target.id,
    targetLabel: `${target.fullName} (@${target.username})`,
    departmentId: target.primaryDepartmentId,
    ipAddress: params.ipAddress ?? null,
    detail: 'تم إصدار رمز استعادة إداري صالح لمرة واحدة لمدة 15 دقيقة.',
  });

  return {
    ok: true,
    status: 200,
    recoveryToken: rawRecoveryToken,
    expiresAt: expiresAtIso,
  };
}

export async function recoverPasswordWithAdminToken(params: {
  usernameRaw: string;
  recoveryToken: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress: string;
}): Promise<{ ok: boolean; status: number; retryAfterSeconds?: number; error?: string }> {
  const cleanUser = (params.usernameRaw || '').trim().toLowerCase();
  const cleanToken = (params.recoveryToken || '').trim();
  const newPassword = typeof params.newPassword === 'string' ? params.newPassword : '';
  const confirmPassword =
    typeof params.confirmPassword === 'string' ? params.confirmPassword : '';

  if (!cleanUser || !cleanToken || !newPassword || !confirmPassword) {
    return {
      ok: false,
      status: 400,
      error: 'يرجى تعبئة اسم المستخدم ورمز الاستعادة الإداري وكلمة المرور الجديدة وتأكيدها.',
    };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, status: 400, error: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.' };
  }

  const rateKeys = [`recover_user:${cleanUser}`, `recover_ip:${params.ipAddress}`];
  const activeWait = getActiveLockoutRemainingSeconds(rateKeys);
  if (activeWait > 0) {
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: activeWait,
      error: `تم تجاوز محاولات الاستعادة المسموح بها. يرجى الانتظار ${formatWaitArabic(activeWait)}.`,
    };
  }

  const strength = validatePasswordStrength(newPassword, cleanUser);
  if (!strength.ok) {
    return { ok: false, status: 400, error: strength.error };
  }

  const authRecord = getUserAuthRecordByUsername(cleanUser);
  const db = getDb();
  const tokenRow = authRecord
    ? (db
        .prepare(`
          SELECT id, token_hash, expires_at
          FROM password_recovery_tokens
          WHERE user_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .get(authRecord.user.id) as
        | { id: string; token_hash: string; expires_at: string }
        | undefined)
    : undefined;

  const candidateHash = hashSecretToken(
    `recovery:${authRecord?.user.id || 'missing'}:${cleanToken}`
  );
  const expectedHash = tokenRow?.token_hash || hashSecretToken('recovery:dummy:invalid');
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  const hashMatches = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  const notExpired = Boolean(
    tokenRow && new Date(tokenRow.expires_at).getTime() > Date.now()
  );

  if (
    !authRecord ||
    authRecord.user.status !== 'active' ||
    !tokenRow ||
    !hashMatches ||
    !notExpired
  ) {
    const failure = recordAuthFailureForKeys(rateKeys);
    if (failure.maxFailures >= 2 && failure.lockoutSeconds === 0) {
      await sleepMs(Math.min((failure.maxFailures - 1) * 350, 1400));
    }
    return {
      ok: false,
      status: failure.lockoutSeconds > 0 ? 429 : 401,
      ...(failure.lockoutSeconds > 0 ? { retryAfterSeconds: failure.lockoutSeconds } : {}),
      error:
        failure.lockoutSeconds > 0
          ? `تم تجاوز محاولات الاستعادة المسموح بها. يرجى الانتظار ${formatWaitArabic(failure.lockoutSeconds)}.`
          : GENERIC_RECOVERY_ERROR,
    };
  }

  const nextPasswordHash = await hashPasswordArgon2id(newPassword);
  const nowIso = new Date().toISOString();

  const consumed = withTransaction((tx) => {
    const res = tx
      .prepare(
        'UPDATE password_recovery_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL'
      )
      .run(nowIso, tokenRow.id);
    if (res.changes === 0) return false;

    tx.prepare(
      'UPDATE users SET password_hash = ?, password_updated_at = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(nextPasswordHash, nowIso, nowIso, authRecord.user.id);

    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'password_recovered' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, authRecord.user.id);

    return true;
  });

  if (!consumed) {
    return { ok: false, status: 401, error: GENERIC_RECOVERY_ERROR };
  }

  clearAuthFailuresForKeys([...rateKeys, `user:${cleanUser}`]);

  writeAuditLog({
    actorUserId: authRecord.user.id,
    actorName: authRecord.user.fullName,
    actorRole: authRecord.user.role,
    actionType: 'استعادة كلمة المرور بإجراء إداري',
    targetUserId: authRecord.user.id,
    targetLabel: `${authRecord.user.fullName} (@${authRecord.user.username})`,
    departmentId: authRecord.user.primaryDepartmentId,
    ipAddress: params.ipAddress,
    detail: 'تم تعيين كلمة مرور جديدة عبر رمز استعادة إداري وإبطال كافة الجلسات السابقة.',
  });

  return { ok: true, status: 200 };
}

export function createTrustedDeviceAndSession(params: {
  user: UserPublicProfile;
  req: Request;
  res: Response;
  isBootstrap?: boolean;
}): { sessionId: string; deviceId: string; isNewDevice: boolean } {
  const cookies = parseCookies(params.req);
  const existingDeviceToken = cookies[DEVICE_COOKIE_NAME];
  const userAgent = String(params.req.headers['user-agent'] || 'unknown');
  const fingerprintHash = computeDeviceFingerprint(params.req);
  const deviceLabel = parseDeviceLabel(userAgent);
  const ip = getClientIp(params.req);
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const db = getDb();
  let deviceId = '';
  let rawDeviceTokenToSet: string | undefined;
  let isNewDevice = true;

  if (existingDeviceToken) {
    const existingDeviceHash = hashSecretToken(existingDeviceToken);
    const matchedDevice = db
      .prepare(`
        SELECT id, is_trusted, revoked_at
        FROM trusted_devices
        WHERE user_id = ? AND device_token_hash = ? AND is_trusted = 1 AND revoked_at IS NULL
        LIMIT 1
      `)
      .get(params.user.id, existingDeviceHash) as
      | { id: string; is_trusted: number; revoked_at: string | null }
      | undefined;

    if (matchedDevice) {
      deviceId = matchedDevice.id;
      isNewDevice = false;
    }
  }

  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const sessionTokenHash = hashSecretToken(rawSessionToken);
  const sessionId = `ses-${crypto.randomUUID()}`;

  withTransaction((tx) => {
    if (isNewDevice) {
      deviceId = `dev-${crypto.randomUUID()}`;
      const newDeviceRaw = crypto.randomBytes(32).toString('hex');
      const newDeviceHash = hashSecretToken(newDeviceRaw);
      rawDeviceTokenToSet = newDeviceRaw;

      tx.prepare(`
        INSERT INTO trusted_devices (
          id, user_id, device_token_hash, device_fingerprint_hash,
          device_label, user_agent, is_trusted, first_seen_at, last_seen_at, last_ip
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        deviceId,
        params.user.id,
        newDeviceHash,
        fingerprintHash,
        deviceLabel,
        userAgent.slice(0, 300),
        nowIso,
        nowIso,
        ip
      );
    } else {
      // Revoke stale sessions on this same device & rotate to a new Session ID
      tx.prepare(
        "UPDATE sessions SET revoked_at = ?, revoked_reason = 'session_rotated' WHERE user_id = ? AND trusted_device_id = ? AND revoked_at IS NULL"
      ).run(nowIso, params.user.id, deviceId);

      tx.prepare(
        'UPDATE trusted_devices SET last_seen_at = ?, last_ip = ?, device_fingerprint_hash = ? WHERE id = ?'
      ).run(nowIso, ip, fingerprintHash, deviceId);
    }

    tx.prepare(`
      INSERT INTO sessions (
        id, user_id, trusted_device_id, session_token_hash,
        expires_at, last_activity_at, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      params.user.id,
      deviceId,
      sessionTokenHash,
      expiresAtIso,
      nowIso,
      ip,
      userAgent.slice(0, 300),
      nowIso
    );

    tx.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(
      nowIso,
      params.user.id
    );
  });

  emitAuthCookies(params.res, rawSessionToken, rawDeviceTokenToSet);

  if (isNewDevice && !params.isBootstrap) {
    writeAuditLog({
      actorUserId: params.user.id,
      actorName: params.user.fullName,
      actorRole: params.user.role,
      actionType: 'تسجيل جهاز موثوق',
      targetUserId: params.user.id,
      targetLabel: deviceLabel,
      departmentId: params.user.primaryDepartmentId,
      ipAddress: ip,
      detail: `تم اعتماد الجهاز (${deviceLabel}) بعد المصادقة الموثقة.`,
    });
  }

  return { sessionId, deviceId, isNewDevice };
}

export function resolveAuthenticatedSession(req: Request): {
  user: UserPublicProfile;
  sessionId: string;
  deviceId: string | null;
} | null {
  const cookies = parseCookies(req);
  const rawSession = cookies[SESSION_COOKIE_NAME];
  const rawDevice = cookies[DEVICE_COOKIE_NAME];
  if (!rawSession || !rawDevice) return null;

  const sessionHash = hashSecretToken(rawSession);
  const deviceHash = hashSecretToken(rawDevice);
  const db = getDb();

  const sesRow = db
    .prepare(`
      SELECT s.id, s.user_id, s.trusted_device_id, s.expires_at, s.revoked_at,
             td.id as td_id, td.device_token_hash, td.is_trusted, td.revoked_at as td_revoked
      FROM sessions s
      JOIN trusted_devices td ON td.id = s.trusted_device_id
      WHERE s.session_token_hash = ?
      LIMIT 1
    `)
    .get(sessionHash) as
    | {
        id: string;
        user_id: string;
        trusted_device_id: string | null;
        expires_at: string;
        revoked_at: string | null;
        td_id: string;
        device_token_hash: string;
        is_trusted: number;
        td_revoked: string | null;
      }
    | undefined;

  if (!sesRow) return null;
  if (sesRow.revoked_at !== null) return null;
  if (new Date(sesRow.expires_at).getTime() <= Date.now()) {
    db.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'expired' WHERE id = ?"
    ).run(new Date().toISOString(), sesRow.id);
    return null;
  }

  // Verify the device cookie matches & device trust is still intact
  const devBufA = Buffer.from(deviceHash, 'hex');
  const devBufB = Buffer.from(sesRow.device_token_hash, 'hex');
  if (
    devBufA.length !== devBufB.length ||
    !crypto.timingSafeEqual(devBufA, devBufB) ||
    sesRow.is_trusted !== 1 ||
    sesRow.td_revoked !== null
  ) {
    return null;
  }

  // Always check live user status & current RBAC permissions from DB
  const liveUser = getUserProfileById(sesRow.user_id);
  if (!liveUser || liveUser.status !== 'active') {
    return null;
  }

  // Sliding session renewal & activity tracking
  const nowIso = new Date().toISOString();
  const nextExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ip = getClientIp(req);

  db.prepare(
    'UPDATE sessions SET last_activity_at = ?, expires_at = ?, ip_address = ? WHERE id = ?'
  ).run(nowIso, nextExpiry, ip, sesRow.id);

  db.prepare(
    'UPDATE trusted_devices SET last_seen_at = ?, last_ip = ? WHERE id = ?'
  ).run(nowIso, ip, sesRow.td_id);

  return {
    user: liveUser,
    sessionId: sesRow.id,
    deviceId: sesRow.td_id,
  };
}

export function checkHasValidTrustedDeviceCookie(req: Request): boolean {
  const cookies = parseCookies(req);
  const rawDevice = cookies[DEVICE_COOKIE_NAME];
  if (!rawDevice) return false;
  const deviceHash = hashSecretToken(rawDevice);
  const db = getDb();
  const row = db
    .prepare(
      'SELECT id FROM trusted_devices WHERE device_token_hash = ? AND is_trusted = 1 AND revoked_at IS NULL LIMIT 1'
    )
    .get(deviceHash);
  return Boolean(row);
}

export function logoutCurrentSession(req: Request, res: Response) {
  const ctx = resolveAuthenticatedSession(req);
  const nowIso = new Date().toISOString();
  if (ctx) {
    const db = getDb();
    db.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'user_logout' WHERE id = ?"
    ).run(nowIso, ctx.sessionId);

    writeAuditLog({
      actorUserId: ctx.user.id,
      actorName: ctx.user.fullName,
      actorRole: ctx.user.role,
      actionType: 'تسجيل خروج',
      targetUserId: ctx.user.id,
      targetLabel: ctx.user.fullName,
      departmentId: ctx.user.primaryDepartmentId,
      ipAddress: getClientIp(req),
      detail: 'تم إنهاء الجلسة الحالية عند تسجيل الخروج.',
    });
  }
  clearSessionOnlyCookie(res);
}

// ==========================================
// Super Admin Device & Session Management
// ==========================================
export function listTrustedDevicesAndSessions(filterUserId?: string): {
  devices: TrustedDeviceRecord[];
  sessions: SessionInfoRecord[];
} {
  const db = getDb();
  const userClause = filterUserId ? 'WHERE td.user_id = ?' : '';
  const deviceParams = filterUserId ? [filterUserId] : [];

  const devRows = db
    .prepare(`
      SELECT td.*, u.full_name, u.username, u.phone, u.primary_department_id, d.name as dept_name
      FROM trusted_devices td
      JOIN users u ON u.id = td.user_id
      JOIN departments d ON d.id = u.primary_department_id
      ${userClause}
      ORDER BY td.last_seen_at DESC
      LIMIT 200
    `)
    .all(...deviceParams) as {
    id: string;
    user_id: string;
    device_label: string;
    user_agent: string;
    is_trusted: number;
    first_seen_at: string;
    last_seen_at: string;
    last_ip: string | null;
    revoked_at: string | null;
    full_name: string;
    username: string;
    phone: string;
    primary_department_id: string;
    dept_name: string;
  }[];

  const sesWhere = filterUserId ? 'WHERE s.user_id = ?' : '';
  const sesRows = db
    .prepare(`
      SELECT s.*, u.full_name, u.username, u.phone, u.primary_department_id, d.name as dept_name,
             td.device_label, td.is_trusted as td_trusted, td.revoked_at as td_revoked
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN departments d ON d.id = u.primary_department_id
      LEFT JOIN trusted_devices td ON td.id = s.trusted_device_id
      ${sesWhere}
      ORDER BY s.last_activity_at DESC
      LIMIT 200
    `)
    .all(...deviceParams) as {
    id: string;
    user_id: string;
    trusted_device_id: string | null;
    expires_at: string;
    last_activity_at: string;
    ip_address: string | null;
    revoked_at: string | null;
    revoked_reason: string | null;
    created_at: string;
    full_name: string;
    username: string;
    phone: string;
    primary_department_id: string;
    dept_name: string;
    device_label: string | null;
    td_trusted: number | null;
    td_revoked: string | null;
  }[];

  const nowMs = Date.now();

  return {
    devices: devRows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userFullName: r.full_name,
      userUsername: r.username,
      maskedPhone: maskSaudiPhone(r.phone),
      primaryDepartmentId: r.primary_department_id,
      primaryDepartmentName: r.dept_name,
      deviceLabel: r.device_label,
      userAgent: r.user_agent,
      isTrusted: r.is_trusted === 1 && r.revoked_at === null,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      lastIp: r.last_ip,
      revokedAt: r.revoked_at,
    })),
    sessions: sesRows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userFullName: r.full_name,
      userUsername: r.username,
      maskedPhone: maskSaudiPhone(r.phone),
      primaryDepartmentId: r.primary_department_id,
      primaryDepartmentName: r.dept_name,
      trustedDeviceId: r.trusted_device_id,
      deviceLabel: r.device_label || 'جهاز غير مسجل',
      deviceTrusted: r.td_trusted === 1 && r.td_revoked === null,
      expiresAt: r.expires_at,
      lastActivityAt: r.last_activity_at,
      ipAddress: r.ip_address,
      revokedAt: r.revoked_at,
      revokedReason: r.revoked_reason,
      createdAt: r.created_at,
      isActive: r.revoked_at === null && new Date(r.expires_at).getTime() > nowMs,
    })),
  };
}

export function revokeDeviceTrustByAdmin(
  deviceId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
): { ok: boolean; error?: string } {
  const db = getDb();
  const device = db
    .prepare(
      'SELECT td.id, td.user_id, td.device_label, u.full_name, u.primary_department_id FROM trusted_devices td JOIN users u ON u.id = td.user_id WHERE td.id = ? LIMIT 1'
    )
    .get(deviceId) as
    | {
        id: string;
        user_id: string;
        device_label: string;
        full_name: string;
        primary_department_id: string;
      }
    | undefined;

  if (!device) {
    return { ok: false, error: 'الجهاز المطلوب غير موجود.' };
  }

  const nowIso = new Date().toISOString();
  withTransaction((tx) => {
    tx.prepare(
      'UPDATE trusted_devices SET is_trusted = 0, revoked_at = ?, revoked_by_user_id = ? WHERE id = ?'
    ).run(nowIso, actor.id, deviceId);

    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'device_trust_revoked' WHERE trusted_device_id = ? AND revoked_at IS NULL"
    ).run(nowIso, deviceId);
  });

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إلغاء ثقة جهاز',
    targetUserId: device.user_id,
    targetLabel: `${device.full_name} · ${device.device_label}`,
    departmentId: device.primary_department_id,
    ipAddress: ipAddress ?? null,
    detail: `تم إلغاء الثقة بالجهاز (${device.device_label}) وإنهاء جميع جلساته فوراً.`,
  });

  return { ok: true };
}

export function terminateSessionByAdmin(
  sessionId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
): { ok: boolean; error?: string } {
  const db = getDb();
  const ses = db
    .prepare(
      'SELECT s.id, s.user_id, u.full_name, u.primary_department_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? LIMIT 1'
    )
    .get(sessionId) as
    | { id: string; user_id: string; full_name: string; primary_department_id: string }
    | undefined;

  if (!ses) {
    return { ok: false, error: 'الجلسة المطلوبة غير موجودة.' };
  }

  const nowIso = new Date().toISOString();
  db.prepare(
    "UPDATE sessions SET revoked_at = ?, revoked_reason = 'terminated_by_super_admin' WHERE id = ?"
  ).run(nowIso, sessionId);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إنهاء جلسة محددة',
    targetUserId: ses.user_id,
    targetLabel: ses.full_name,
    departmentId: ses.primary_department_id,
    ipAddress: ipAddress ?? null,
    detail: `تم إنهاء الجلسة (${sessionId}) من لوحة Super Admin.`,
  });

  return { ok: true };
}

export function terminateAllUserSessionsByAdmin(
  targetUserId: string,
  actor: UserPublicProfile,
  revokeDevices: boolean,
  ipAddress?: string | null
): { ok: boolean; error?: string } {
  const target = getUserProfileById(targetUserId);
  if (!target) {
    return { ok: false, error: 'المستخدم غير موجود.' };
  }

  const nowIso = new Date().toISOString();
  withTransaction((tx) => {
    tx.prepare(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'all_sessions_terminated' WHERE user_id = ? AND revoked_at IS NULL"
    ).run(nowIso, targetUserId);

    if (revokeDevices) {
      tx.prepare(
        'UPDATE trusted_devices SET is_trusted = 0, revoked_at = ?, revoked_by_user_id = ? WHERE user_id = ? AND revoked_at IS NULL'
      ).run(nowIso, actor.id, targetUserId);
    }
  });

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إنهاء جميع جلسات مستخدم',
    targetUserId: target.id,
    targetLabel: `${target.fullName} (@${target.username})`,
    departmentId: target.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: revokeDevices
      ? 'تم إنهاء كافة الجلسات النشطة وإلغاء ثقة جميع الأجهزة المرتبطة بالحساب.'
      : 'تم إنهاء كافة الجلسات النشطة للحساب.',
  });

  return { ok: true };
}
