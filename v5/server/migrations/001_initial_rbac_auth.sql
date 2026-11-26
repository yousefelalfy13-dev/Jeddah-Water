-- Migration 001: Permanent Relational Schema for Users, Hierarchical RBAC, Department Scope, OTP, Trusted Devices, Sessions, and Audit Logs

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_division TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  rank INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL UNIQUE,
  job_title TEXT NOT NULL,
  primary_department_id TEXT NOT NULL REFERENCES departments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  department_access_scope TEXT NOT NULL CHECK (department_access_scope IN ('primary_only', 'specific', 'all')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_primary_dept ON users(primary_department_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_department_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, department_id)
);

CREATE TABLE IF NOT EXISTS otp_requests (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'bootstrap_super_admin')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  consumed_at TEXT,
  invalidated_at TEXT,
  delivery_channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_requests(phone, purpose, created_at);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_hash TEXT NOT NULL UNIQUE,
  device_fingerprint_hash TEXT NOT NULL,
  device_label TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  is_trusted INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_ip TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id, is_trusted);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trusted_device_id TEXT REFERENCES trusted_devices(id) ON DELETE SET NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  revoked_at TEXT,
  revoked_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token_hash);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_name TEXT NOT NULL,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  target_user_id TEXT,
  target_label TEXT,
  department_id TEXT,
  ip_address TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type);

-- Seed canonical roles
INSERT OR IGNORE INTO roles (id, name_ar, description_ar, rank) VALUES
  ('super_admin', 'مدير النظام الرئيسي (Super Admin)', 'تحكم كامل في النظام والحسابات والأدوار والصلاحيات ونطاق الإدارات والأجهزة وسجل المراجعة.', 100),
  ('project_manager', 'مدير المشروع', 'متابعة الإدارات والمؤشرات والتقارير وفق الصلاحيات الممنوحة دون صلاحية إنشاء حسابات.', 80),
  ('department_manager', 'مدير الإدارة', 'إدارة محتوى إدارته وملفاتها ومتابعة الأعمال وفق الصلاحيات ونطاق الوصول المحدد.', 60),
  ('engineer', 'مهندس', 'إدخال وتحديث البيانات المصرح بها ورفع ملفات Excel والوسائط وفق الصلاحيات الممنوحة.', 40),
  ('supervisor', 'مشرف', 'متابعة الأعمال والبلاغات والمهام الميدانية وتحديث البيانات وفق الصلاحيات الممنوحة.', 30),
  ('employee', 'موظف', 'تنفيذ المهام المحددة له فقط ضمن إدارته وصلاحياته المخصصة.', 10);

-- Seed canonical permissions
INSERT OR IGNORE INTO permissions (id, label_ar, description_ar, category) VALUES
  ('view_data', 'مشاهدة البيانات', 'الاطلاع على بيانات الإدارات والتقارير والمؤشرات والوسائط المصرح بها.', 'operational'),
  ('add_data', 'إضافة البيانات', 'إضافة بنود ومهام وفرق عمل ومؤشرات جديدة ضمن النطاق المصرح به.', 'operational'),
  ('edit_data', 'تعديل البيانات', 'تحديث بيانات الإدارة والمسؤوليات والأعمال اليومية.', 'operational'),
  ('delete_data', 'حذف البيانات', 'إزالة عناصر وسائط أو تقارير أو بنود غير معتمدة ضمن النطاق المسموح.', 'operational'),
  ('upload_images', 'رفع الصور', 'رفع ملفات الصور الميدانية إلى الخادم وإضافتها للإدارة أو المعرض.', 'media'),
  ('upload_videos', 'رفع الفيديوهات', 'رفع ملفات الفيديو الميدانية (MP4/WebM) إلى الخادم.', 'media'),
  ('upload_excel', 'رفع ملفات Excel', 'رفع ملفات الجداول والبيانات التشغيلية بصيغة Excel/CSV التابعة للإدارة.', 'media'),
  ('add_youtube', 'إضافة روابط YouTube', 'تضمين روابط فيديوهات YouTube الرسمية للتوثيق الميداني.', 'media'),
  ('add_reports', 'إضافة التقارير', 'إنشاء وإرفاق التقارير التشغيلية الدورية للإدارة.', 'operational'),
  ('edit_kpis', 'تعديل مؤشرات الأداء', 'إدخال وتحديث قيم مؤشرات الأداء والرسوم البيانية.', 'operational'),
  ('approve_publish', 'اعتماد المحتوى للنشر', 'مراجعة واعتماد المحتوى والوسائط والتقارير ونشرها للعامة.', 'governance'),
  ('manage_users', 'إدارة المستخدمين', 'إنشاء وتعديل وإيقاف الحسابات وتحديد الأدوار ونطاق الإدارات (لـ Super Admin).', 'admin'),
  ('manage_devices_sessions', 'إدارة الأجهزة والجلسات', 'مراجعة الأجهزة الموثوقة وإلغاء الثقة وإنهاء الجلسات (لـ Super Admin).', 'admin'),
  ('view_audit_logs', 'الاطلاع على سجل المراجعة', 'مراجعة السجل الدائم لكافة العمليات الأمنية والإدارية.', 'admin'),
  ('manage_departments', 'إدارة هيكلة الإدارات', 'تعديل الهيكل التنظيمي العام وإدارات المشروع.', 'admin'),
  ('manage_system', 'إعدادات النظام الكاملة', 'التحكم الكامل في الواجهة العامة والنسخ الاحتياطي وإعادة الضبط.', 'admin');
