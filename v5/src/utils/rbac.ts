import {
  DepartmentAccessScope,
  PermissionKey,
  UserPublicProfile,
  UserRole,
} from '../types/cms';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'مدير النظام الرئيسي (Super Admin)',
  project_manager: 'مدير المشروع',
  department_manager: 'مدير الإدارة',
  engineer: 'مهندس',
  supervisor: 'مشرف',
  employee: 'موظف',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin:
    'تحكم كامل في النظام والحسابات والأدوار والصلاحيات ونطاق الإدارات والأجهزة وسجل المراجعة.',
  project_manager:
    'متابعة الإدارات ومؤشرات المشروع والوصول إلى التقارير والبيانات وفق الصلاحيات الممنوحة (دون إنشاء حسابات).',
  department_manager:
    'إدارة بيانات إدارته وملفاتها ومتابعة الأعمال وفق الصلاحيات ونطاق الإدارات المحدد (دون إنشاء حسابات).',
  engineer:
    'إدخال وتحديث البيانات المصرح بها ورفع ملفات Excel التابعة لإدارته وفق صلاحياته.',
  supervisor:
    'متابعة الأعمال والبلاغات والمهام الميدانية وتحديث البيانات وفق الصلاحيات الممنوحة.',
  employee: 'تنفيذ المهام المحددة له فقط ضمن النطاق الإداري والصلاحيات المخصصة.',
};

export const ACCESS_SCOPE_LABELS: Record<DepartmentAccessScope, string> = {
  primary_only: 'الإدارة الأساسية فقط',
  specific: 'إدارات محددة',
  all: 'جميع إدارات المشروع',
};

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: 'operational' | 'media' | 'governance' | 'admin';
}

export const GRANULAR_PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'view_data',
    label: 'مشاهدة البيانات',
    description: 'الاطلاع على بيانات الإدارة والتقارير والوسائط والمؤشرات ضمن النطاق المسموح.',
    category: 'operational',
  },
  {
    key: 'add_data',
    label: 'إضافة البيانات',
    description: 'إدراج بنود أو فرق ميدانية أو مهام جديدة ضمن النطاق المصرح به.',
    category: 'operational',
  },
  {
    key: 'edit_data',
    label: 'تعديل البيانات',
    description: 'تحديث بيانات الإدارة والمسؤوليات والأعمال اليومية.',
    category: 'operational',
  },
  {
    key: 'delete_data',
    label: 'حذف البيانات',
    description: 'حذف عناصر وسائط أو تقارير أو ملفات غير معتمدة ضمن النطاق المسموح.',
    category: 'operational',
  },
  {
    key: 'upload_images',
    label: 'رفع الصور',
    description: 'رفع ملفات الصور الميدانية إلى الخادم وإضافتها للإدارة أو المعرض.',
    category: 'media',
  },
  {
    key: 'upload_videos',
    label: 'رفع الفيديوهات',
    description: 'رفع ملفات الفيديو الميدانية (MP4/WebM) إلى الخادم.',
    category: 'media',
  },
  {
    key: 'upload_excel',
    label: 'رفع ملفات Excel',
    description: 'رفع جداول البيانات والتقارير الهندسية بصيغ Excel و CSV التابعة للإدارة.',
    category: 'media',
  },
  {
    key: 'add_youtube',
    label: 'إضافة روابط YouTube',
    description: 'تضمين روابط فيديوهات YouTube الرسمية للتوثيق الميداني.',
    category: 'media',
  },
  {
    key: 'add_reports',
    label: 'إضافة التقارير',
    description: 'إنشاء وإرفاق التقارير التشغيلية الدورية للإدارة.',
    category: 'operational',
  },
  {
    key: 'edit_kpis',
    label: 'تعديل مؤشرات الأداء',
    description: 'إدخال وتحديث قيم مؤشرات الأداء والرسوم البيانية.',
    category: 'operational',
  },
  {
    key: 'approve_publish',
    label: 'اعتماد المحتوى للنشر',
    description: 'مراجعة واعتماد المحتوى والوسائط والتقارير ونشرها للعامة.',
    category: 'governance',
  },
];

export const ADMIN_ONLY_PERMISSIONS: PermissionDefinition[] = [
  {
    key: 'manage_users',
    label: 'إدارة المستخدمين (Super Admin)',
    description: 'إنشاء وتعديل وإيقاف الحسابات وتحديد الأدوار ونطاق الإدارات.',
    category: 'admin',
  },
  {
    key: 'manage_devices_sessions',
    label: 'إدارة الأجهزة والجلسات (Super Admin)',
    description: 'مراجعة الأجهزة الموثوقة وإلغاء الثقة وإنهاء الجلسات.',
    category: 'admin',
  },
  {
    key: 'view_audit_logs',
    label: 'الاطلاع على سجل المراجعة',
    description: 'مراجعة السجل الدائم لكافة العمليات الأمنية والإدارية.',
    category: 'admin',
  },
  {
    key: 'manage_departments',
    label: 'إدارة هيكلة الإدارات',
    description: 'تعديل الهيكل التنظيمي العام وإدارات المشروع.',
    category: 'admin',
  },
  {
    key: 'manage_system',
    label: 'إعدادات النظام الكاملة',
    description: 'التحكم الكامل في الواجهة العامة والأقسام المضافة وإعادة الضبط.',
    category: 'admin',
  },
];

export const ALL_OPERATIONAL_PERMISSION_KEYS: PermissionKey[] = GRANULAR_PERMISSIONS.map(
  (p) => p.key
);

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  ...ALL_OPERATIONAL_PERMISSION_KEYS,
  'manage_users',
  'manage_devices_sessions',
  'view_audit_logs',
  'manage_departments',
  'manage_system',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  super_admin: [...ALL_PERMISSION_KEYS],
  project_manager: ['view_data', 'approve_publish'],
  department_manager: [
    'view_data',
    'add_data',
    'edit_data',
    'upload_images',
    'add_reports',
    'edit_kpis',
    'approve_publish',
  ],
  engineer: ['view_data', 'add_data', 'edit_data', 'upload_images', 'upload_excel'],
  supervisor: ['view_data', 'add_data', 'edit_data', 'upload_images', 'add_reports'],
  employee: ['view_data'],
};

export function hasPermission(
  user: Pick<UserPublicProfile, 'role' | 'status' | 'permissions'> | null | undefined,
  perm: PermissionKey
): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role === 'super_admin') return true;
  return user.permissions.includes(perm);
}

export function canAccessDepartment(
  user:
    | Pick<
        UserPublicProfile,
        'role' | 'status' | 'primaryDepartmentId' | 'departmentAccessScope' | 'allowedDepartmentIds'
      >
    | null
    | undefined,
  departmentId: string
): boolean {
  if (!user || user.status !== 'active' || !departmentId) return false;
  if (user.role === 'super_admin') return true;
  if (user.departmentAccessScope === 'all') return true;
  if (departmentId === user.primaryDepartmentId) return true;
  if (user.departmentAccessScope === 'specific') {
    return user.allowedDepartmentIds.includes(departmentId);
  }
  return false;
}

export function getAccessibleDepartmentIds(
  user: Pick<
    UserPublicProfile,
    'role' | 'status' | 'primaryDepartmentId' | 'departmentAccessScope' | 'allowedDepartmentIds'
  >,
  allDepartmentIds: string[]
): string[] {
  if (user.status !== 'active') return [];
  if (user.role === 'super_admin' || user.departmentAccessScope === 'all') {
    return allDepartmentIds;
  }
  if (user.departmentAccessScope === 'specific') {
    return Array.from(new Set([user.primaryDepartmentId, ...user.allowedDepartmentIds]));
  }
  return [user.primaryDepartmentId];
}
