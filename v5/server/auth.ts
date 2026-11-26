import type { NextFunction, Request, Response } from 'express';
import { PermissionKey, UserPublicProfile } from '../src/types/cms';
import { canAccessDepartment, hasPermission } from '../src/utils/rbac';
import { writeAuditLog } from './audit';
import { getClientIp, resolveAuthenticatedSession } from './sessions';

export interface AuthenticatedRequest extends Request {
  authUser?: UserPublicProfile;
  authSessionId?: string;
  authDeviceId?: string | null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const ctx = resolveAuthenticatedSession(req);
  if (!ctx) {
    res.status(401).json({
      error: 'غير مصرح بالوصول. يلزم تسجيل الدخول بجلسة صالحة وجهاز معتمد.',
    });
    return;
  }
  const authReq = req as AuthenticatedRequest;
  authReq.authUser = ctx.user;
  authReq.authSessionId = ctx.sessionId;
  authReq.authDeviceId = ctx.deviceId;
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).authUser;
  if (!user) {
    res.status(401).json({ error: 'غير مصرح بالوصول.' });
    return;
  }
  if (user.role !== 'super_admin') {
    writeAuditLog({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      actionType: 'محاولة وصول غير مصرح بها',
      departmentId: user.primaryDepartmentId,
      ipAddress: getClientIp(req),
      detail: `محاولة تنفيذ عملية مخصصة لمدير النظام الرئيسي على المسار ${req.originalUrl}`,
    });
    res.status(403).json({
      error: 'هذه الصلاحية محصورة بمدير النظام الرئيسي (Super Admin) فقط.',
    });
    return;
  }
  next();
}

export function requirePermission(perm: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) {
      res.status(401).json({ error: 'غير مصرح بالوصول.' });
      return;
    }
    if (!hasPermission(user, perm)) {
      writeAuditLog({
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        actionType: 'محاولة وصول غير مصرح بها',
        departmentId: user.primaryDepartmentId,
        ipAddress: getClientIp(req),
        detail: `رفض الوصول لعدم توفر الصلاحية (${perm}) على ${req.method} ${req.originalUrl}`,
      });
      res.status(403).json({
        error: 'لا تملك الصلاحية المعتمدة لتنفيذ هذا الإجراء.',
      });
      return;
    }
    next();
  };
}

export function requireDepartmentScope(paramName = 'deptId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) {
      res.status(401).json({ error: 'غير مصرح بالوصول.' });
      return;
    }
    const targetDeptId = req.params[paramName];
    if (!targetDeptId || !canAccessDepartment(user, targetDeptId)) {
      writeAuditLog({
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        actionType: 'محاولة وصول غير مصرح بها لإدارة',
        departmentId: targetDeptId || null,
        ipAddress: getClientIp(req),
        detail: `رفض الوصول إلى الإدارة (${targetDeptId}) لخروجها عن نطاق الوصول المعتمد للمستخدم.`,
      });
      res.status(403).json({
        error: 'غير مصرح لك بالوصول إلى بيانات هذه الإدارة وفق نطاق صلاحياتك.',
      });
      return;
    }
    next();
  };
}

export function requireCsrfSafe(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const host = rawHost.split(',')[0].trim();
  const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest';

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const appUrlRaw = (process.env.APP_URL || '').trim();
      let appUrlHost = '';
      if (appUrlRaw && appUrlRaw !== 'MY_APP_URL') {
        try {
          appUrlHost = new URL(appUrlRaw).host;
        } catch {
          appUrlHost = '';
        }
      }
      if (
        (host && parsedOrigin.host === host) ||
        (appUrlHost && parsedOrigin.host === appUrlHost)
      ) {
        next();
        return;
      }
    } catch {
      res.status(403).json({ error: 'طلب مرفوض: مصدر غير موثوق.' });
      return;
    }
    res.status(403).json({ error: 'طلب مرفوض: تعارض في نطاق المصدر.' });
    return;
  }

  if (hasCustomHeader) {
    next();
    return;
  }

  res.status(403).json({ error: 'طلب مرفوض: التحقق الأمني للطلب مفقود.' });
}
