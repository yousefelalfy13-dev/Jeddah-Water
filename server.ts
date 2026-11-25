import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { queryAuditLogs, writeAuditLog } from './server/audit';
import {
  AuthenticatedRequest,
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope,
  requirePermission,
  requireSuperAdmin,
} from './server/auth';
import {
  getAuthSmsConfig,
  getBootstrapTokenConfig,
  isProductionEnv,
  logBootstrapInstructionsIfNeeded,
  maskSaudiPhone,
  normalizeSaudiPhone,
  validateStartupConfiguration,
} from './server/config';
import { getDb } from './server/db';
import { hashPasswordArgon2id, validatePasswordStrength } from './server/passwords';
import {
  changeAuthenticatedUserPassword,
  checkHasValidTrustedDeviceCookie,
  createTrustedDeviceAndSession,
  getClientIp,
  issueAdminPasswordRecoveryToken,
  listTrustedDevicesAndSessions,
  loginWithUsernamePassword,
  logoutCurrentSession,
  needsInitialPasswordSetup,
  recoverPasswordWithAdminToken,
  requestBootstrapOtp,
  resetPasswordBySuperAdmin,
  resolveAuthenticatedSession,
  revokeDeviceTrustByAdmin,
  setInitialSuperAdminPasswordWithToken,
  terminateAllUserSessionsByAdmin,
  terminateSessionByAdmin,
  verifyBootstrapAuthorizationToken,
  verifyOtpRecord,
} from './server/sessions';
import {
  addDepartmentExcelScoped,
  addDepartmentMediaScoped,
  addDepartmentReportScoped,
  addGalleryMediaScoped,
  approveDepartmentContentScoped,
  deleteDepartmentExcelScoped,
  deleteDepartmentMediaScoped,
  deleteDepartmentReportScoped,
  deleteGalleryMediaScoped,
  discardDraftChanges,
  ensureStoreReady,
  getDepartmentDirectory,
  getPublicContractManagerPayload,
  getPublicPublishedContent,
  getScopedDepartment,
  getScopedWorkspaceForUser,
  getUploadsDir,
  publishDraftContent,
  resetWorkspaceToDefaults,
  saveDraftContent,
  saveInternalAdminNotes,
  updateContractManagerProfileDraft,
  updateDepartmentDraftScoped,
  updateDepartmentKpisScoped,
  updateExternalPortalSettingsDraft,
  updateGlobalKpisScoped,
} from './server/store';
import {
  CreateUserByAdminInput,
  UpdateUserByAdminInput,
  createFirstSuperAdminAtomic,
  createUserBySuperAdmin,
  getUserProfileById,
  getUserProfileByPhone,
  listAllUsers,
  needsBootstrapSuperAdmin,
  updateUserBySuperAdmin,
} from './server/users';
import {
  CmsData,
  ContractManagerProfile,
  DepartmentKpi,
  ExternalPortalSettings,
  KpiMetric,
  MediaItem,
  UserPublicProfile,
} from './src/types/cms';
import {
  ROLE_LABELS,
  canAccessDepartment,
  getAccessibleDepartmentIds,
  hasPermission,
} from './src/utils/rbac';

validateStartupConfiguration();
getDb();
ensureStoreReady();
logBootstrapInstructionsIfNeeded(needsBootstrapSuperAdmin());

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
// Security headers on every response.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob:; frame-src https://www.youtube.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );
  }
  next();
});

app.use(express.json({ limit: '25mb' }));

const UPLOADS_DIR = getUploadsDir();
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  },
  express.static(UPLOADS_DIR)
);

// Prevent static or Vite dev middleware from exposing internal DB, server code, snapshots, or env files
app.use((req, res, next) => {
  const lowerPath = req.path.toLowerCase();
  if (
    lowerPath === '/data' ||
    lowerPath.startsWith('/data/') ||
    lowerPath === '/server' ||
    lowerPath === '/server.ts' ||
    lowerPath.startsWith('/server/') ||
    lowerPath === '/original_snapshot' ||
    lowerPath.startsWith('/original_snapshot/') ||
    lowerPath.startsWith('/.env') ||
    lowerPath.startsWith('/.git')
  ) {
    res.status(403).json({ error: 'غير مصرح بالوصول إلى الملفات الداخلية.' });
    return;
  }
  next();
});

// Prevent indexing of Admin Portal and internal APIs across search engines
app.use((req, res, next) => {
  const lowerPath = req.path.toLowerCase();
  if (lowerPath === '/admin' || lowerPath.startsWith('/admin/') || lowerPath.startsWith('/api/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  next();
});

function resolveSiteBaseUrl(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0].trim()
    : req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = resolveSiteBaseUrl(req);
  res.type('text/plain; charset=utf-8').send(
    [
      'User-agent: *',
      'Allow: /',
      'Allow: /project',
      'Allow: /contract-manager',
      'Allow: /executive',
      'Allow: /showcase',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /api/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = resolveSiteBaseUrl(req);
  const pub = getPublicPublishedContent();
  const urls = ['/'];
  if (!pub.externalPortalSettings.showProjectNameOnly) {
    urls.push('/project');
    if (pub.externalPortalSettings.enableShowcaseMode) urls.push('/showcase');
    if (pub.externalPortalSettings.showExecutiveKpis) urls.push('/executive');
    if (
      pub.externalPortalSettings.showContractManagerAndVideo &&
      pub.contractManagerProfile.isPublished &&
      pub.contractManagerProfile.consentConfirmed
    ) {
      urls.push('/contract-manager');
    }
  }
  const xmlItems = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${baseUrl}${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u === '/' || u === '/project' ? '1.0' : '0.8'}</priority>\n  </url>`
    )
    .join('\n');
  res.type('application/xml; charset=utf-8').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlItems}\n</urlset>`
  );
});

function actorUser(req: Request): UserPublicProfile {
  const user = (req as AuthenticatedRequest).authUser;
  if (!user) {
    throw new Error('Missing authenticated user');
  }
  return user;
}

// ==========================================
// 1. Public Read-Only Content Routes (Whitelist Filtered)
// ==========================================
app.get('/api/public/content', (_req, res) => {
  res.json(getPublicPublishedContent());
});

app.get('/api/public/showcase', (_req, res) => {
  res.json(getPublicPublishedContent());
});

app.get('/api/public/contract-manager', (_req, res) => {
  res.json(getPublicContractManagerPayload());
});

app.get('/api/cms', (_req, res) => {
  res.json(getPublicPublishedContent());
});

// ==========================================
// 2. First Super Admin Bootstrap Routes (/api/bootstrap/*)
//    Permanently disabled (403) once 1 super_admin exists
// ==========================================
app.get('/api/bootstrap/status', (_req, res) => {
  const needsBootstrap = needsBootstrapSuperAdmin();
  const smsCfg = getAuthSmsConfig();
  const tokenCfg = needsBootstrap ? getBootstrapTokenConfig() : null;
  res.json({
    needsBootstrap,
    smsMode: smsCfg.mode,
    unifonicConfigured: smsCfg.unifonicConfigured,
    ...(tokenCfg ? { bootstrapTokenConfigured: tokenCfg.isEnvConfigured } : {}),
    departments: needsBootstrap ? getDepartmentDirectory() : [],
  });
});

app.post('/api/bootstrap/request-otp', requireCsrfSafe, async (req, res) => {
  const { bootstrapToken, phone } = req.body as {
    bootstrapToken?: string;
    phone?: string;
  };
  const result = await requestBootstrapOtp({
    bootstrapToken: String(bootstrapToken || ''),
    phoneRaw: String(phone || ''),
    ipAddress: getClientIp(req),
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const canExposeDevMockOtp =
    !isProductionEnv() &&
    getAuthSmsConfig().mode === 'mock' &&
    needsBootstrapSuperAdmin() &&
    typeof result.devBootstrapOtp === 'string' &&
    /^\d{6}$/.test(result.devBootstrapOtp);

  res.json({
    ok: true,
    via: result.via,
    message: result.message,
    ...(canExposeDevMockOtp ? { devMockOtp: result.devBootstrapOtp } : {}),
  });
});

app.post('/api/bootstrap/verify', requireCsrfSafe, async (req, res) => {
  if (!needsBootstrapSuperAdmin()) {
    res.status(403).json({
      error: 'تمت تهيئة أول حساب Super Admin مسبقاً. المسار مغلق نهائياً.',
    });
    return;
  }

  const { bootstrapToken, fullName, username, phone, jobTitle, primaryDepartmentId, otpCode, password, confirmPassword } =
    req.body as {
      bootstrapToken?: string;
      fullName?: string;
      username?: string;
      phone?: string;
      jobTitle?: string;
      primaryDepartmentId?: string;
      otpCode?: string;
      password?: string;
      confirmPassword?: string;
    };

  if (!verifyBootstrapAuthorizationToken(String(bootstrapToken || ''))) {
    res.status(401).json({ error: 'رمز التفويض الخاص بالتهيئة الأولية غير صحيح.' });
    return;
  }

  const ip = getClientIp(req);

  // OTP delivery is disabled platform-wide (410 on request). The bootstrap page therefore
  // sets the first password directly; the token remains the authorization factor.
  // If an OTP code is ever supplied, keep the original verification path.
  let bootstrapPasswordHash: string | null = null;
  const cleanOtp = String(otpCode || '').trim();
  if (cleanOtp) {
    const otpCheck = verifyOtpRecord({
      purpose: 'bootstrap_super_admin',
      phoneRaw: String(phone || ''),
      otpCode: cleanOtp,
      ipAddress: ip,
    });
    if (!otpCheck.ok) {
      res.status(otpCheck.status).json({ error: otpCheck.error });
      return;
    }
  } else {
    const pass = typeof password === 'string' ? password : '';
    const confirm = typeof confirmPassword === 'string' ? confirmPassword : '';
    if (!pass) {
      res.status(400).json({ error: 'يرجى إدخال كلمة مرور لحساب المدير الرئيسي.' });
      return;
    }
    if (pass !== confirm) {
      res.status(400).json({ error: 'كلمة المرور وتأكيدها غير متطابقتين.' });
      return;
    }
    const strength = validatePasswordStrength(pass, String(username || ''));
    if (!strength.ok) {
      res.status(400).json({ error: strength.error });
      return;
    }
    bootstrapPasswordHash = await hashPasswordArgon2id(pass);
  }

  const createRes = createFirstSuperAdminAtomic({
    fullName: String(fullName || ''),
    username: String(username || ''),
    phone: String(phone || ''),
    jobTitle: jobTitle ? String(jobTitle) : undefined,
    primaryDepartmentId: primaryDepartmentId ? String(primaryDepartmentId) : undefined,
    passwordHash: bootstrapPasswordHash,
    ipAddress: ip,
  });

  if (!createRes.ok || !createRes.user) {
    res.status(400).json({ error: createRes.error });
    return;
  }

  const sessionMeta = createTrustedDeviceAndSession({
    user: createRes.user,
    req,
    res,
    isBootstrap: true,
  });

  res.status(201).json({
    authenticated: true,
    user: createRes.user,
    sessionId: sessionMeta.sessionId,
  });
});

// ==========================================
// 3. Authentication Routes (/api/auth/*)
//    Username + Argon2id Password + HttpOnly/Secure/SameSite Cookies
//    (OTP & Unifonic Login Disabled)
// ==========================================
app.get('/api/auth/session', (req, res) => {
  const needsBootstrap = needsBootstrapSuperAdmin();
  const hasTrustedDeviceCookie = checkHasValidTrustedDeviceCookie(req);
  const ctx = resolveAuthenticatedSession(req);

  if (!ctx) {
    const initialSetupNeeded = !needsBootstrap && needsInitialPasswordSetup();
    const initialPasswordTokenConfigured = initialSetupNeeded
      ? getBootstrapTokenConfig().isEnvConfigured
      : false;
    res.json({
      authenticated: false,
      needsBootstrap,
      authMode: 'password',
      hasTrustedDeviceCookie,
      needsInitialPasswordSetup: initialSetupNeeded,
      initialPasswordTokenConfigured,
    });
    return;
  }

  res.json({
    authenticated: true,
    needsBootstrap: false,
    authMode: 'password',
    hasTrustedDeviceCookie: true,
    needsInitialPasswordSetup: false,
    initialPasswordTokenConfigured: false,
    sessionId: ctx.sessionId,
    deviceId: ctx.deviceId,
    mustChangePassword: Boolean(ctx.user.mustChangePassword),
    user: ctx.user,
  });
});

app.post('/api/auth/initial-password', requireCsrfSafe, async (req, res) => {
  const { bootstrapToken, newPassword, confirmPassword } = req.body as {
    bootstrapToken?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const result = await setInitialSuperAdminPasswordWithToken({
    bootstrapToken: typeof bootstrapToken === 'string' ? bootstrapToken : '',
    newPassword: typeof newPassword === 'string' ? newPassword : '',
    confirmPassword: typeof confirmPassword === 'string' ? confirmPassword : '',
    ipAddress: getClientIp(req),
  });

  if (!result.ok) {
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    ok: true,
    message:
      'تم تعيين كلمة المرور الأولى لحساب yousef.elalfy وإغلاق هذا المسار نهائياً. يمكنك تسجيل الدخول الآن.',
  });
});

app.post('/api/auth/login', requireCsrfSafe, async (req, res) => {
  if (needsBootstrapSuperAdmin()) {
    res.status(409).json({
      error: 'النظام بانتظار التهيئة الأولية لأول حساب Super Admin.',
    });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  const result = await loginWithUsernamePassword({
    usernameRaw: String(username || ''),
    passwordRaw: typeof password === 'string' ? password : '',
    req,
    res,
  });

  if (!result.ok || !result.user) {
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    authenticated: true,
    user: result.user,
    sessionId: result.sessionId,
    deviceId: result.deviceId,
    isNewDevice: result.isNewDevice,
    mustChangePassword: Boolean(result.mustChangePassword),
  });
});

app.post('/api/auth/password/change', requireAuth, requireCsrfSafe, async (req, res) => {
  const user = actorUser(req);
  const { currentPassword, newPassword, confirmPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const result = await changeAuthenticatedUserPassword({
    user,
    currentPassword: typeof currentPassword === 'string' ? currentPassword : '',
    newPassword: typeof newPassword === 'string' ? newPassword : '',
    confirmPassword: typeof confirmPassword === 'string' ? confirmPassword : '',
    req,
    res,
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    ok: true,
    sessionId: result.sessionId,
    message: 'تم تغيير كلمة المرور بنجاح وإبطال كافة الجلسات السابقة.',
  });
});

app.post('/api/auth/password/recover', requireCsrfSafe, async (req, res) => {
  const { username, recoveryToken, newPassword, confirmPassword } = req.body as {
    username?: string;
    recoveryToken?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const result = await recoverPasswordWithAdminToken({
    usernameRaw: String(username || ''),
    recoveryToken: String(recoveryToken || ''),
    newPassword: typeof newPassword === 'string' ? newPassword : '',
    confirmPassword: typeof confirmPassword === 'string' ? confirmPassword : '',
    ipAddress: getClientIp(req),
  });

  if (!result.ok) {
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    ok: true,
    message:
      'تم تعيين كلمة المرور الجديدة عبر الإجراء الإداري وإبطال جميع الجلسات السابقة. يمكنك تسجيل الدخول الآن.',
  });
});

// Explicitly disable legacy OTP / Unifonic login endpoints
app.post('/api/auth/otp/request', requireCsrfSafe, (_req, res) => {
  res.status(410).json({
    error: 'تم إيقاف تسجيل الدخول عبر OTP و Unifonic حالياً. يرجى استخدام اسم المستخدم وكلمة المرور.',
  });
});

app.post('/api/auth/otp/verify', requireCsrfSafe, (_req, res) => {
  res.status(410).json({
    error: 'تم إيقاف التحقق عبر OTP حالياً. يرجى استخدام اسم المستخدم وكلمة المرور.',
  });
});

app.post('/api/auth/logout', requireCsrfSafe, (req, res) => {
  logoutCurrentSession(req, res);
  res.json({ authenticated: false });
});

// ==========================================
// 4. Scoped Workspace Route
// ==========================================
app.get('/api/admin/workspace', requireAuth, (req, res) => {
  const user = actorUser(req);
  const workspace = getScopedWorkspaceForUser(user);
  const users = user.role === 'super_admin' ? listAllUsers() : [];
  res.json({
    ...workspace,
    users,
  });
});

// ==========================================
// 5. Super-Admin-Only Users & RBAC Management
// ==========================================
app.get('/api/admin/users', requireAuth, requireSuperAdmin, (_req, res) => {
  res.json({ users: listAllUsers() });
});

app.post('/api/admin/users', requireAuth, requireCsrfSafe, requireSuperAdmin, async (req, res) => {
  const user = actorUser(req);
  const result = await createUserBySuperAdmin(
    user,
    req.body as CreateUserByAdminInput,
    getClientIp(req)
  );
  if (!result.ok || !result.user) {
    res.status(result.status || 400).json({ error: result.error });
    return;
  }

  res.status(201).json({
    user: result.user,
    users: listAllUsers(),
  });
});

app.post(
  '/api/admin/users/:userId/reset-password',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  async (req, res) => {
    const user = actorUser(req);
    const { temporaryPassword } = req.body as { temporaryPassword?: string };
    const result = await resetPasswordBySuperAdmin({
      actor: user,
      targetUserId: req.params.userId,
      temporaryPassword: typeof temporaryPassword === 'string' ? temporaryPassword : '',
      ipAddress: getClientIp(req),
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      ok: true,
      users: listAllUsers(),
      message: 'تم تعيين كلمة المرور المؤقتة وإبطال جميع الجلسات النشطة للحساب.',
    });
  }
);

app.post(
  '/api/admin/users/:userId/recovery-token',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = issueAdminPasswordRecoveryToken({
      actor: user,
      targetUserId: req.params.userId,
      ipAddress: getClientIp(req),
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      ok: true,
      recoveryToken: result.recoveryToken,
      expiresAt: result.expiresAt,
    });
  }
);

app.patch(
  '/api/admin/users/:userId',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = updateUserBySuperAdmin(
      user,
      req.params.userId,
      req.body as UpdateUserByAdminInput,
      getClientIp(req)
    );
    if (!result.ok || !result.user) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    res.json({
      user: result.user,
      users: listAllUsers(),
    });
  }
);

app.post(
  '/api/admin/users/:userId/suspend',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = updateUserBySuperAdmin(
      user,
      req.params.userId,
      { status: 'suspended' },
      getClientIp(req)
    );
    if (!result.ok || !result.user) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user, users: listAllUsers() });
  }
);

app.post(
  '/api/admin/users/:userId/activate',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = updateUserBySuperAdmin(
      user,
      req.params.userId,
      { status: 'active' },
      getClientIp(req)
    );
    if (!result.ok || !result.user) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user, users: listAllUsers() });
  }
);

// ==========================================
// 6. Super-Admin-Only Trusted Devices & Active Sessions
// ==========================================
app.get(
  '/api/admin/devices-sessions',
  requireAuth,
  requireSuperAdmin,
  (req, res) => {
    const filterUserId =
      typeof req.query.userId === 'string' && req.query.userId.trim()
        ? req.query.userId.trim()
        : undefined;
    const data = listTrustedDevicesAndSessions(filterUserId);
    res.json(data);
  }
);

app.post(
  '/api/admin/devices/:deviceId/revoke',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = revokeDeviceTrustByAdmin(
      req.params.deviceId,
      user,
      getClientIp(req)
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true, ...listTrustedDevicesAndSessions() });
  }
);

app.post(
  '/api/admin/sessions/:sessionId/terminate',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const result = terminateSessionByAdmin(
      req.params.sessionId,
      user,
      getClientIp(req)
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true, ...listTrustedDevicesAndSessions() });
  }
);

app.post(
  '/api/admin/users/:userId/terminate-sessions',
  requireAuth,
  requireCsrfSafe,
  requireSuperAdmin,
  (req, res) => {
    const user = actorUser(req);
    const revokeDevices = req.body?.revokeDevices !== false;
    const result = terminateAllUserSessionsByAdmin(
      req.params.userId,
      user,
      revokeDevices,
      getClientIp(req)
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true, ...listTrustedDevicesAndSessions() });
  }
);

// ==========================================
// 7. Persistent Audit Logs Viewer
// ==========================================
app.get(
  '/api/admin/audit-logs',
  requireAuth,
  requirePermission('view_audit_logs'),
  (req, res) => {
    const user = actorUser(req);
    const actionType =
      typeof req.query.actionType === 'string' ? req.query.actionType : undefined;
    const actorUserId =
      typeof req.query.userId === 'string' && req.query.userId.trim()
        ? req.query.userId.trim()
        : undefined;
    const search =
      typeof req.query.search === 'string' ? req.query.search : undefined;

    let logs = queryAuditLogs({
      actionType,
      actorUserId,
      search,
      limit: 250,
    });

    if (user.role !== 'super_admin' && user.departmentAccessScope !== 'all') {
      const allDeptIds = getDepartmentDirectory().map((d) => d.id);
      const accessible = new Set(getAccessibleDepartmentIds(user, allDeptIds));
      logs = logs.filter(
        (entry) =>
          (entry.departmentId && accessible.has(entry.departmentId)) ||
          entry.actorUserId === user.id
      );
    }

    res.json({ auditLogs: logs });
  }
);

// ==========================================
// 8. Department-Scoped RBAC Endpoints
// ==========================================
app.get(
  '/api/admin/departments/:deptId',
  requireAuth,
  requireDepartmentScope('deptId'),
  requirePermission('view_data'),
  (req, res) => {
    const dept = getScopedDepartment(req.params.deptId);
    if (!dept) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ department: dept });
  }
);

app.put(
  '/api/admin/departments/:deptId',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('edit_data'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = updateDepartmentDraftScoped(
      req.params.deptId,
      req.body,
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.put(
  '/api/admin/departments/:deptId/kpis',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('edit_kpis'),
  (req, res) => {
    const user = actorUser(req);
    const { departmentKpis } = req.body as { departmentKpis?: DepartmentKpi[] };
    if (!Array.isArray(departmentKpis)) {
      res.status(400).json({ error: 'بيانات مؤشرات الأداء غير صالحة.' });
      return;
    }
    const workspace = updateDepartmentKpisScoped(
      req.params.deptId,
      departmentKpis,
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/departments/:deptId/media',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  (req, res) => {
    const user = actorUser(req);
    const { type, title, caption, url, alsoAddToGallery, category, location, thumbnailUrl } =
      req.body as {
        type?: 'image' | 'youtube' | 'video';
        title?: string;
        caption?: string;
        url?: string;
        alsoAddToGallery?: boolean;
        category?: MediaItem['category'];
        location?: string;
        thumbnailUrl?: string;
      };

    if (!type || !['image', 'youtube', 'video'].includes(type)) {
      res.status(400).json({ error: 'نوع الوسائط غير صالح.' });
      return;
    }

    const requiredPerm =
      type === 'image' ? 'upload_images' : type === 'video' ? 'upload_videos' : 'add_youtube';

    if (!hasPermission(user, requiredPerm)) {
      res.status(403).json({ error: 'لا تملك صلاحية إضافة هذا النوع من الوسائط.' });
      return;
    }

    if (!title?.trim() || !url?.trim()) {
      res.status(400).json({ error: 'يرجى إدخال عنوان ورابط الوسائط.' });
      return;
    }

    const result = addDepartmentMediaScoped(
      req.params.deptId,
      { type, title, caption: caption || '', url, alsoAddToGallery, category, location, thumbnailUrl },
      user,
      getClientIp(req)
    );
    if (!result.ok || !result.workspace) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      ...result.workspace,
      users: user.role === 'super_admin' ? listAllUsers() : [],
    });
  }
);

app.delete(
  '/api/admin/departments/:deptId/media/:mediaId',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('delete_data'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = deleteDepartmentMediaScoped(
      req.params.deptId,
      req.params.mediaId,
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/departments/:deptId/reports',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('add_reports'),
  (req, res) => {
    const user = actorUser(req);
    const { title, summary, periodLabel } = req.body as {
      title?: string;
      summary?: string;
      periodLabel?: string;
    };
    if (!title?.trim() || !summary?.trim()) {
      res.status(400).json({ error: 'يرجى إدخال عنوان التقرير وملخصه.' });
      return;
    }
    const workspace = addDepartmentReportScoped(
      req.params.deptId,
      { title, summary, periodLabel: periodLabel || '' },
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.delete(
  '/api/admin/departments/:deptId/reports/:reportId',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('delete_data'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = deleteDepartmentReportScoped(
      req.params.deptId,
      req.params.reportId,
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/departments/:deptId/excel',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('upload_excel'),
  (req, res) => {
    const user = actorUser(req);
    const { title, fileName, url } = req.body as {
      title?: string;
      fileName?: string;
      url?: string;
    };
    if (!title?.trim() || !url?.trim()) {
      res.status(400).json({ error: 'يرجى إدخال عنوان ملف Excel ورفعه أولاً.' });
      return;
    }
    const result = addDepartmentExcelScoped(
      req.params.deptId,
      {
        title,
        fileName: fileName?.trim() || `${title.trim()}.xlsx`,
        url,
      },
      user,
      getClientIp(req)
    );
    if (!result.ok || !result.workspace) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      ...result.workspace,
      users: user.role === 'super_admin' ? listAllUsers() : [],
    });
  }
);

app.delete(
  '/api/admin/departments/:deptId/excel/:fileId',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('delete_data'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = deleteDepartmentExcelScoped(
      req.params.deptId,
      req.params.fileId,
      user,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/departments/:deptId/approve',
  requireAuth,
  requireCsrfSafe,
  requireDepartmentScope('deptId'),
  requirePermission('approve_publish'),
  (req, res) => {
    const user = actorUser(req);
    const publishLive = req.body?.publishLive !== false;
    const workspace = approveDepartmentContentScoped(
      req.params.deptId,
      user,
      publishLive,
      getClientIp(req)
    );
    if (!workspace) {
      res.status(404).json({ error: 'الإدارة غير موجودة.' });
      return;
    }
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

// ==========================================
// 9. Media Gallery & Global KPI Endpoints
// ==========================================
app.post('/api/admin/media', requireAuth, requireCsrfSafe, (req, res) => {
  const user = actorUser(req);
  const item = req.body as MediaItem;
  if (!item || !item.type || !item.title?.trim() || !item.url?.trim()) {
    res.status(400).json({ error: 'بيانات عنصر الوسائط غير مكتملة.' });
    return;
  }

  const requiredPerm =
    item.type === 'image'
      ? 'upload_images'
      : item.type === 'video'
        ? 'upload_videos'
        : 'add_youtube';

  if (!hasPermission(user, requiredPerm)) {
    res.status(403).json({ error: 'لا تملك صلاحية إضافة هذا النوع من الوسائط.' });
    return;
  }

  const targetDeptId = item.departmentId || user.primaryDepartmentId;
  if (
    user.role !== 'super_admin' &&
    user.departmentAccessScope !== 'all' &&
    !canAccessDepartment(user, targetDeptId)
  ) {
    res.status(403).json({ error: 'غير مصرح لك بإضافة وسائط لإدارة خارج نطاقك.' });
    return;
  }

  const result = addGalleryMediaScoped(
    {
      ...item,
      id: item.id || `med-${Date.now()}`,
      departmentId: targetDeptId,
      approvalStatus: 'draft',
      createdBy: user.fullName,
    },
    user,
    getClientIp(req)
  );
  if (!result.ok || !result.workspace) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({
    ...result.workspace,
    users: user.role === 'super_admin' ? listAllUsers() : [],
  });
});

app.delete(
  '/api/admin/media/:mediaId',
  requireAuth,
  requireCsrfSafe,
  requirePermission('delete_data'),
  (req, res) => {
    const user = actorUser(req);
    const result = deleteGalleryMediaScoped(
      req.params.mediaId,
      user,
      getClientIp(req)
    );
    if (!result.ok || !result.workspace) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json({
      ...result.workspace,
      users: user.role === 'super_admin' ? listAllUsers() : [],
    });
  }
);

app.put(
  '/api/admin/kpis',
  requireAuth,
  requireCsrfSafe,
  requirePermission('edit_kpis'),
  (req, res) => {
    const user = actorUser(req);
    if (user.role !== 'super_admin' && user.departmentAccessScope !== 'all') {
      res.status(403).json({ error: 'تعديل مؤشرات المشروع العامة يتطلب صلاحية نطاق شامل.' });
      return;
    }
    const { kpis } = req.body as { kpis?: KpiMetric[] };
    if (!Array.isArray(kpis)) {
      res.status(400).json({ error: 'بيانات المؤشرات غير صالحة.' });
      return;
    }
    const workspace = updateGlobalKpisScoped(kpis, user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

// ==========================================
// 10. Secure File Upload (Images, Videos, Excel gated by exact permission)
// ==========================================
function handleSecureUpload(req: Request, res: Response) {
  try {
    const user = actorUser(req);
    const { filename, dataUrl } = req.body as { filename?: string; dataUrl?: string };
    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'الملف مفقود' });
      return;
    }

    const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'صيغة الملف غير مدعومة' });
      return;
    }

    const mimeType = match[1].toLowerCase();
    const base64Data = match[2];

    const imageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const videoMimes = ['video/mp4', 'video/webm'];
    const pdfMimes = ['application/pdf'];
    const excelMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];

    const lowerName = (filename || '').toLowerCase();
    const isExcelOctetStream =
      mimeType === 'application/octet-stream' &&
      (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv'));

    if (imageMimes.includes(mimeType)) {
      if (!hasPermission(user, 'upload_images')) {
        res.status(403).json({ error: 'لا تملك صلاحية رفع الصور.' });
        return;
      }
    } else if (videoMimes.includes(mimeType)) {
      if (!hasPermission(user, 'upload_videos')) {
        res.status(403).json({ error: 'لا تملك صلاحية رفع الفيديوهات.' });
        return;
      }
    } else if (pdfMimes.includes(mimeType)) {
      if (!hasPermission(user, 'add_reports') && !hasPermission(user, 'manage_system')) {
        res.status(403).json({ error: 'لا تملك صلاحية رفع ملفات PDF المعتمدة.' });
        return;
      }
      const rawBuf = Buffer.from(base64Data, 'base64');
      if (rawBuf.subarray(0, 5).toString('ascii') !== '%PDF-') {
        res.status(400).json({ error: 'ملف PDF غير صالح.' });
        return;
      }
    } else if (excelMimes.includes(mimeType) || isExcelOctetStream) {
      if (!hasPermission(user, 'upload_excel')) {
        res.status(403).json({ error: 'لا تملك صلاحية رفع ملفات Excel.' });
        return;
      }
    } else {
      res.status(400).json({
        error: 'يُسمح فقط برفع الصور (JPG/PNG/WebP)، الفيديو (MP4/WebM)، ملفات PDF، أو ملفات Excel/CSV.',
      });
      return;
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'text/csv': '.csv',
      'application/csv': '.csv',
    };

    const inferredExt = isExcelOctetStream
      ? lowerName.endsWith('.csv')
        ? '.csv'
        : lowerName.endsWith('.xls')
          ? '.xls'
          : '.xlsx'
      : extMap[mimeType] || '.bin';

    const safeBase = (filename || 'file')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const outName = `${Date.now()}_${safeBase}${inferredExt}`;
    const resolvedOutPath = path.resolve(UPLOADS_DIR, outName);

    if (!resolvedOutPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'مسار الملف غير آمن' });
      return;
    }

    const fileBuffer = Buffer.from(base64Data, 'base64');
    const MAX_UPLOAD_BYTES = 18 * 1024 * 1024; // base64 payloads must also fit the 25mb JSON body limit
    if (fileBuffer.length === 0 || fileBuffer.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: 'حجم الملف يتجاوز الحد المسموح (18 ميجابايت). استخدم رابط YouTube للفيديوهات الأكبر.' });
      return;
    }

    fs.writeFileSync(resolvedOutPath, fileBuffer);
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      actionType: 'رفع ملف إلى الخادم',
      departmentId: user.primaryDepartmentId,
      targetLabel: outName,
      ipAddress: getClientIp(req),
      detail: `رفع ملف (${inferredExt}) باسم ${outName}`,
    });

    res.json({ url: `/uploads/${outName}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
  }
}

app.post('/api/admin/upload', requireAuth, requireCsrfSafe, handleSecureUpload);
app.post('/api/upload', requireAuth, requireCsrfSafe, handleSecureUpload);

// ==========================================
// 11. Full-System CMS Management
// ==========================================
app.put(
  '/api/admin/draft',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const payload = req.body as CmsData;
    if (!payload || typeof payload !== 'object' || !payload.hero) {
      res.status(400).json({ error: 'بيانات المسودة غير صالحة' });
      return;
    }
    const workspace = saveDraftContent(payload, user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.put(
  '/api/admin/external-settings',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const settings = req.body as ExternalPortalSettings;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'بيانات إعدادات الواجهة الخارجية غير صالحة.' });
      return;
    }
    const workspace = updateExternalPortalSettingsDraft(settings, user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.put(
  '/api/admin/contract-manager',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const profile = req.body as ContractManagerProfile;
    if (!profile || typeof profile !== 'object') {
      res.status(400).json({ error: 'بيانات مدير العقد غير صالحة.' });
      return;
    }
    const workspace = updateContractManagerProfileDraft(profile, user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/publish',
  requireAuth,
  requireCsrfSafe,
  requirePermission('approve_publish'),
  (req, res) => {
    const user = actorUser(req);
    if (user.role !== 'super_admin' && user.departmentAccessScope !== 'all') {
      res.status(403).json({
        error: 'النشر العام للموقع يتطلب نطاق وصول شامل وصلاحية الاعتماد والنشر.',
      });
      return;
    }
    const overrideDraft = req.body?.draft as CmsData | undefined;
    if (overrideDraft && !hasPermission(user, 'manage_system')) {
      res.status(403).json({ error: 'تعديل ونشر هيكل النظام الكامل يتطلب صلاحية manage_system.' });
      return;
    }
    if (overrideDraft && (typeof overrideDraft !== 'object' || !overrideDraft.hero)) {
      res.status(400).json({ error: 'بيانات النشر غير صالحة' });
      return;
    }
    const workspace = publishDraftContent(user, overrideDraft, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/discard-draft',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = discardDraftChanges(user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.put(
  '/api/admin/internal-notes',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const { notes } = req.body as { notes?: string };
    if (typeof notes !== 'string') {
      res.status(400).json({ error: 'نص الملاحظات غير صالح' });
      return;
    }
    const workspace = saveInternalAdminNotes(notes, user, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

app.post(
  '/api/admin/reset',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const alsoPublish = Boolean(req.body?.alsoPublish);
    const workspace = resetWorkspaceToDefaults(user, alsoPublish, getClientIp(req));
    res.json({ ...workspace, users: user.role === 'super_admin' ? listAllUsers() : [] });
  }
);

// Legacy mutation routes locked behind strict RBAC
app.put(
  '/api/cms',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const payload = req.body as CmsData;
    if (!payload || typeof payload !== 'object' || !payload.hero) {
      res.status(400).json({ error: 'بيانات المحتوى غير صالحة' });
      return;
    }
    const workspace = publishDraftContent(user, payload, getClientIp(req));
    res.json(workspace.published);
  }
);

app.post(
  '/api/cms/reset',
  requireAuth,
  requireCsrfSafe,
  requirePermission('manage_system'),
  (req, res) => {
    const user = actorUser(req);
    const workspace = resetWorkspaceToDefaults(user, true, getClientIp(req));
    res.json(workspace.published);
  }
);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
