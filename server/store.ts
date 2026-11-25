import fs from 'fs';
import path from 'path';
import { DEFAULT_CMS_DATA } from '../src/data/defaultCmsData';
import {
  CmsData,
  ContractManagerProfile,
  Department,
  DepartmentExcelFile,
  DepartmentKpi,
  DepartmentMedia,
  DepartmentReport,
  ExternalPortalSettings,
  KpiMetric,
  MediaItem,
  UserPublicProfile,
} from '../src/types/cms';
import { hydrateCmsData } from '../src/utils/cmsHydration';
import {
  canAccessDepartment,
  getAccessibleDepartmentIds,
  hasPermission,
} from '../src/utils/rbac';
import { queryAuditLogs, writeAuditLog } from './audit';
import { syncDepartmentsToDb } from './db';

export interface CmsStore {
  published: CmsData;
  draft: CmsData;
  lastPublishedAt: string;
  internalNotes: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_FILE = path.join(DATA_DIR, 'cms_store.json');
const LEGACY_CMS_FILE = path.join(DATA_DIR, 'cms.json');

let departmentsSyncedOnce = false;

export function getUploadsDir(): string {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  return UPLOADS_DIR;
}

function formatArabicDate(): string {
  return new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function createInitialStore(seedData?: Partial<CmsData>): CmsStore {
  const hydrated = hydrateCmsData(seedData);
  return {
    published: hydrated,
    draft: hydrated,
    lastPublishedAt: hydrated.lastUpdated || formatArabicDate(),
    internalNotes:
      'مساحة مخصصة لملاحظات فريق إدارة المحتوى والمراجعة الداخلية قبل نشر التعديلات للعامة.',
  };
}

export function ensureStoreReady(): CmsStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  getUploadsDir();

  let store: CmsStore;
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as Partial<CmsStore>;
      const published = hydrateCmsData(raw.published);
      const draft = hydrateCmsData(raw.draft || raw.published);
      store = {
        published,
        draft,
        lastPublishedAt: raw.lastPublishedAt || published.lastUpdated,
        internalNotes: typeof raw.internalNotes === 'string' ? raw.internalNotes : '',
      };
    } catch {
      store = createInitialStore();
      fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
    }
  } else {
    let seed: Partial<CmsData> | undefined;
    if (fs.existsSync(LEGACY_CMS_FILE)) {
      try {
        seed = JSON.parse(fs.readFileSync(LEGACY_CMS_FILE, 'utf-8')) as Partial<CmsData>;
      } catch {
        seed = undefined;
      }
    }
    store = createInitialStore(seed);
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  }

  if (!departmentsSyncedOnce) {
    syncDepartmentsToDb(store.draft.departments);
    departmentsSyncedOnce = true;
  }

  return store;
}

function writeStore(store: CmsStore) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  syncDepartmentsToDb(store.draft.departments);
  departmentsSyncedOnce = true;
}

export function getAllDepartmentIds(): Set<string> {
  const store = ensureStoreReady();
  return new Set(store.draft.departments.map((d) => d.id));
}

export function getDepartmentDirectory(): { id: string; code: string; name: string }[] {
  const store = ensureStoreReady();
  return store.draft.departments.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
  }));
}

const EMPTY_UNPUBLISHED_MANAGER: ContractManagerProfile = {
  isPublished: false,
  consentConfirmed: false,
  consentNote: '',
  fullName: '',
  jobTitle: 'مدير العقد',
  photoUrl: '',
  bio: '',
  introVideoType: 'external',
  introVideoUrl: '',
  introVideoTitle: '',
  introVideoPosterUrl: '',
  qualifications: [],
  trainings: [],
  experiences: [],
  attachments: [],
};

export function getPublicPublishedContent(): CmsData {
  const store = ensureStoreReady();
  const pub = store.published;
  const ext = pub.externalPortalSettings;
  const cm = pub.contractManagerProfile;

  const canExposeManager =
    !ext.showProjectNameOnly &&
    ext.showContractManagerAndVideo &&
    cm.isPublished &&
    cm.consentConfirmed;

  const canExposeProjectDetails =
    !ext.showProjectNameOnly && ext.showProjectDetailsAndVideo;

  const canExposeExecutive = !ext.showProjectNameOnly && ext.showExecutiveKpis;

  const safeExternalSettings: ExternalPortalSettings = {
    ...ext,
    alkhorayefLogoUrl: ext.showLogos ? ext.alkhorayefLogoUrl : '',
    nwcLogoUrl: ext.showLogos ? ext.nwcLogoUrl : '',
    projectIntroVideoUrl: canExposeProjectDetails ? ext.projectIntroVideoUrl : '',
    projectIntroVideoPosterUrl: canExposeProjectDetails ? ext.projectIntroVideoPosterUrl : '',
  };

  const safeManagerProfile: ContractManagerProfile = canExposeManager
    ? {
        ...cm,
        attachments: (cm.attachments || []).filter(
          (att) => att.approvedForPublic && isSafeMediaUrl(att.fileUrl)
        ),
      }
    : EMPTY_UNPUBLISHED_MANAGER;

  // Strict server-side whitelist projection: only approved, non-sensitive, externally enabled data leaves the server
  return {
    ...pub,
    hero: {
      ...pub.hero,
      heroVideoUrl: canExposeProjectDetails ? pub.hero.heroVideoUrl : '',
      description: canExposeProjectDetails ? pub.hero.description : '',
    },
    overviewBrief: canExposeProjectDetails
      ? pub.overviewBrief
      : {
          heading: pub.overviewBrief.heading,
          paragraphs: [],
          governanceNote: pub.overviewBrief.governanceNote,
        },
    kpis: canExposeExecutive ? pub.kpis : [],
    charts: canExposeExecutive ? pub.charts : [],
    media: canExposeExecutive
      ? pub.media.filter((m) => m.approvalStatus !== 'draft')
      : [],
    departments: pub.departments.map((dept) => ({
      ...dept,
      departmentKpis: canExposeExecutive ? dept.departmentKpis : [],
      mediaItems: canExposeExecutive
        ? (dept.mediaItems || []).filter((m) => m.approvalStatus !== 'draft')
        : [],
      reports: canExposeExecutive
        ? (dept.reports || []).filter((r) => r.status === 'approved')
        : [],
      // Operational Excel sheets stay internal-only on external showcase unless explicitly approved
      excelFiles: canExposeExecutive
        ? (dept.excelFiles || []).filter((f) => f.status === 'approved')
        : [],
    })),
    externalPortalSettings: safeExternalSettings,
    contractManagerProfile: safeManagerProfile,
  };
}

export function getPublicContractManagerPayload(): {
  enabled: boolean;
  isPublished: boolean;
  profile: ContractManagerProfile | null;
} {
  const pub = getPublicPublishedContent();
  const enabled =
    !pub.externalPortalSettings.showProjectNameOnly &&
    pub.externalPortalSettings.showContractManagerAndVideo;
  const isPublished =
    enabled &&
    pub.contractManagerProfile.isPublished &&
    pub.contractManagerProfile.consentConfirmed;
  return {
    enabled,
    isPublished,
    profile: isPublished ? pub.contractManagerProfile : null,
  };
}

export function getScopedWorkspaceForUser(user: UserPublicProfile) {
  const store = ensureStoreReady();
  const isFullSystem = user.role === 'super_admin' || hasPermission(user, 'manage_system');
  const allDeptIds = store.draft.departments.map((d) => d.id);
  const accessibleDeptIdSet = new Set(getAccessibleDepartmentIds(user, allDeptIds));
  const canViewAllDepts =
    user.role === 'super_admin' || user.departmentAccessScope === 'all';
  const canViewAudit =
    user.role === 'super_admin' || hasPermission(user, 'view_audit_logs');

  const scopedDraftDepts = store.draft.departments.filter((d) =>
    accessibleDeptIdSet.has(d.id)
  );
  const scopedPublishedDepts = store.published.departments.filter((d) =>
    accessibleDeptIdSet.has(d.id)
  );

  const scopedMedia = canViewAllDepts
    ? store.draft.media
    : store.draft.media.filter(
        (m) => !m.departmentId || accessibleDeptIdSet.has(m.departmentId)
      );

  const scopedAuditLog = canViewAudit
    ? user.role === 'super_admin' || user.departmentAccessScope === 'all'
      ? queryAuditLogs({ limit: 150 })
      : queryAuditLogs({ limit: 150 }).filter(
          (entry) =>
            (entry.departmentId && accessibleDeptIdSet.has(entry.departmentId)) ||
            entry.actorUserId === user.id
        )
    : [];

  const hasUnpublishedChanges = canViewAllDepts
    ? JSON.stringify(store.draft) !== JSON.stringify(store.published)
    : JSON.stringify(scopedDraftDepts) !== JSON.stringify(scopedPublishedDepts);

  return {
    currentUser: user,
    departmentDirectory: getDepartmentDirectory(),
    canManageFullCms: isFullSystem,
    canViewAllDepartments: canViewAllDepts,
    hasUnpublishedChanges,
    lastPublishedAt: store.lastPublishedAt,
    internalNotes: isFullSystem ? store.internalNotes : '',
    auditLog: scopedAuditLog,
    published: canViewAllDepts
      ? store.published
      : {
          ...store.published,
          departments: scopedPublishedDepts,
          media: scopedMedia,
        },
    draft: canViewAllDepts
      ? store.draft
      : {
          ...store.draft,
          departments: scopedDraftDepts,
          media: scopedMedia,
        },
  };
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeCmsPayload(payload: CmsData): CmsData {
  const hydrated = hydrateCmsData(payload);
  const ext = hydrated.externalPortalSettings;
  const cm = hydrated.contractManagerProfile;

  return {
    ...hydrated,
    hero: {
      ...hydrated.hero,
      heroImageUrl: isSafeMediaUrl(hydrated.hero.heroImageUrl)
        ? hydrated.hero.heroImageUrl
        : DEFAULT_CMS_DATA.hero.heroImageUrl,
      heroVideoUrl: isSafeMediaUrl(hydrated.hero.heroVideoUrl)
        ? hydrated.hero.heroVideoUrl
        : '',
    },
    media: hydrated.media.filter((m) => isSafeMediaUrl(m.url)),
    departments: hydrated.departments.map((d) => ({
      ...d,
      mediaItems: (d.mediaItems || []).filter((m) => isSafeMediaUrl(m.url)),
      reports: Array.isArray(d.reports) ? d.reports : [],
      excelFiles: (d.excelFiles || []).filter((f) => isSafeMediaUrl(f.url)),
    })),
    externalPortalSettings: {
      ...ext,
      alkhorayefLogoUrl: isSafeMediaUrl(ext.alkhorayefLogoUrl) ? ext.alkhorayefLogoUrl : '',
      nwcLogoUrl: isSafeMediaUrl(ext.nwcLogoUrl) ? ext.nwcLogoUrl : '',
      projectIntroVideoUrl: isSafeMediaUrl(ext.projectIntroVideoUrl)
        ? ext.projectIntroVideoUrl
        : '',
      projectIntroVideoPosterUrl: isSafeMediaUrl(ext.projectIntroVideoPosterUrl)
        ? ext.projectIntroVideoPosterUrl
        : DEFAULT_CMS_DATA.externalPortalSettings.projectIntroVideoPosterUrl,
      autoRotateSeconds: Math.min(120, Math.max(5, Math.round(Number(ext.autoRotateSeconds) || 20))),
    },
    contractManagerProfile: {
      ...cm,
      photoUrl: isSafeMediaUrl(cm.photoUrl) ? cm.photoUrl : '',
      introVideoUrl: isSafeMediaUrl(cm.introVideoUrl) ? cm.introVideoUrl : '',
      introVideoPosterUrl: isSafeMediaUrl(cm.introVideoPosterUrl)
        ? cm.introVideoPosterUrl
        : '',
      attachments: (cm.attachments || []).filter((a) => isSafeMediaUrl(a.fileUrl)),
    },
  };
}

// ==========================================
// Full-System CMS Operations (Super Admin / Explicit manage_system)
// ==========================================
export function saveDraftContent(
  nextDraft: CmsData,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const cleanDraft = sanitizeCmsPayload(nextDraft);
  cleanDraft.lastUpdated = formatArabicDate();
  const updated: CmsStore = {
    ...store,
    draft: cleanDraft,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'حفظ مسودة النظام',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تم حفظ تعديلات في مسودة الإدارة (غير منشورة بعد).',
  });

  return getScopedWorkspaceForUser(actor);
}

export function publishDraftContent(
  actor: UserPublicProfile,
  overrideDraft?: CmsData,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const dateLabel = formatArabicDate();
  const sourceDraft = overrideDraft ? sanitizeCmsPayload(overrideDraft) : store.draft;
  const nowIso = new Date().toISOString();

  const canPublishManager =
    Boolean(sourceDraft.contractManagerProfile.isPublished) &&
    Boolean(sourceDraft.contractManagerProfile.consentConfirmed);

  const publishedCopy: CmsData = {
    ...sourceDraft,
    lastUpdated: dateLabel,
    media: sourceDraft.media.map((m) => ({ ...m, approvalStatus: 'approved' as const })),
    departments: sourceDraft.departments.map((d) => ({
      ...d,
      mediaItems: (d.mediaItems || []).map((m) => ({
        ...m,
        approvalStatus: 'approved' as const,
      })),
      reports: (d.reports || []).map((r) => ({
        ...r,
        status: 'approved' as const,
        approvedBy: r.approvedBy || actor.fullName,
        approvedAt: r.approvedAt || nowIso,
      })),
      excelFiles: (d.excelFiles || []).map((f) => ({
        ...f,
        status: 'approved' as const,
      })),
    })),
    contractManagerProfile: {
      ...sourceDraft.contractManagerProfile,
      isPublished: canPublishManager,
      approvedBy: canPublishManager
        ? sourceDraft.contractManagerProfile.approvedBy || actor.fullName
        : undefined,
      approvedAt: canPublishManager
        ? sourceDraft.contractManagerProfile.approvedAt || nowIso
        : undefined,
    },
  };

  const updated: CmsStore = {
    ...store,
    published: publishedCopy,
    draft: publishedCopy,
    lastPublishedAt: dateLabel,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'اعتماد ونشر للعامة',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تم اعتماد ونشر التعديلات على الموقع العام والواجهة الخارجية للزوار.',
  });

  return getScopedWorkspaceForUser(actor);
}

export function updateExternalPortalSettingsDraft(
  settings: ExternalPortalSettings,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const nextDraft = sanitizeCmsPayload({
    ...store.draft,
    externalPortalSettings: settings,
  });
  nextDraft.lastUpdated = formatArabicDate();
  writeStore({
    ...store,
    draft: nextDraft,
  });

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تحديث مسودة إعدادات الواجهة الخارجية',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: `تم حفظ إعدادات الواجهة الخارجية وأوضاع العرض في المسودة (الوضع الافتراضي: ${nextDraft.externalPortalSettings.defaultLandingMode}).`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function updateContractManagerProfileDraft(
  profile: ContractManagerProfile,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const safeConsent = Boolean(profile.consentConfirmed);
  const nextDraft = sanitizeCmsPayload({
    ...store.draft,
    contractManagerProfile: {
      ...profile,
      consentConfirmed: safeConsent,
      // Cannot mark published without explicit privacy/copyright consent
      isPublished: safeConsent ? Boolean(profile.isPublished) : false,
    },
  });
  nextDraft.lastUpdated = formatArabicDate();
  writeStore({
    ...store,
    draft: nextDraft,
  });

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تحديث مسودة بيانات مدير العقد',
    departmentId: actor.primaryDepartmentId,
    targetLabel: nextDraft.contractManagerProfile.fullName || 'مدير العقد',
    ipAddress: ipAddress ?? null,
    detail: safeConsent
      ? 'تم حفظ مسودة بيانات مدير العقد ومرفقاته (مع تأكيد إقرار الموافقة على النشر).'
      : 'تم حفظ مسودة بيانات مدير العقد (بانتظار إقرار الموافقة والاعتماد قبل النشر العام).',
  });

  return getScopedWorkspaceForUser(actor);
}

export function discardDraftChanges(
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const updated: CmsStore = {
    ...store,
    draft: store.published,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تجاهل المسودة',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تمت إعادة المسودة لتطابق النسخة المنشورة حالياً.',
  });

  return getScopedWorkspaceForUser(actor);
}

export function saveInternalAdminNotes(
  notes: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const updated: CmsStore = {
    ...store,
    internalNotes: notes,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تحديث الملاحظات الداخلية',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تم تعديل الملاحظات الإدارية الخاصة.',
  });

  return getScopedWorkspaceForUser(actor);
}

export function resetWorkspaceToDefaults(
  actor: UserPublicProfile,
  alsoPublish: boolean,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const clean = hydrateCmsData(DEFAULT_CMS_DATA);
  const updated: CmsStore = {
    ...store,
    draft: clean,
    published: alsoPublish ? clean : store.published,
    lastPublishedAt: alsoPublish ? clean.lastUpdated : store.lastPublishedAt,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: alsoPublish ? 'إعادة ضبط ونشر القالب' : 'إعادة ضبط المسودة',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تمت استعادة البيانات الافتراضية للمحتوى.',
  });

  return getScopedWorkspaceForUser(actor);
}

// ==========================================
// Scoped Department Operations (RBAC + Scope Enforced)
// ==========================================
export function getScopedDepartment(deptId: string): Department | null {
  const store = ensureStoreReady();
  return store.draft.departments.find((d) => d.id === deptId) || null;
}

export function updateDepartmentDraftScoped(
  deptId: string,
  patch: Partial<Department>,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const updatedDept: Department = {
    ...existing,
    name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : existing.name,
    parentDivision:
      typeof patch.parentDivision === 'string' && patch.parentDivision.trim()
        ? patch.parentDivision.trim()
        : existing.parentDivision,
    headPlaceholder:
      typeof patch.headPlaceholder === 'string' ? patch.headPlaceholder : existing.headPlaceholder,
    summary: typeof patch.summary === 'string' ? patch.summary : existing.summary,
    interfaces: typeof patch.interfaces === 'string' ? patch.interfaces : existing.interfaces,
    kpiFocus: typeof patch.kpiFocus === 'string' ? patch.kpiFocus : existing.kpiFocus,
    responsibilities: Array.isArray(patch.responsibilities)
      ? patch.responsibilities.filter((x) => typeof x === 'string')
      : existing.responsibilities,
    dailyOperations: Array.isArray(patch.dailyOperations)
      ? patch.dailyOperations.filter((x) => typeof x === 'string')
      : existing.dailyOperations,
    fieldTeams: Array.isArray(patch.fieldTeams) ? patch.fieldTeams : existing.fieldTeams,
  };

  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = updatedDept;

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      lastUpdated: formatArabicDate(),
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تحديث بيانات إدارة',
    departmentId: deptId,
    targetLabel: updatedDept.name,
    ipAddress: ipAddress ?? null,
    detail: `تم تعديل مسودة بيانات: ${updatedDept.name}`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function updateDepartmentKpisScoped(
  deptId: string,
  departmentKpis: DepartmentKpi[],
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    departmentKpis,
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      lastUpdated: formatArabicDate(),
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تعديل مؤشرات أداء الإدارة',
    departmentId: deptId,
    targetLabel: existing.name,
    ipAddress: ipAddress ?? null,
    detail: `تم تحديث مؤشرات أداء (${existing.name}).`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function addDepartmentMediaScoped(
  deptId: string,
  mediaInput: {
    type: 'image' | 'youtube' | 'video';
    title: string;
    caption: string;
    url: string;
    alsoAddToGallery?: boolean;
    category?: MediaItem['category'];
    location?: string;
    thumbnailUrl?: string;
  },
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  if (!isSafeMediaUrl(mediaInput.url)) {
    return { ok: false, error: 'رابط الوسائط غير آمن أو غير صالح.' };
  }

  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return { ok: false, error: 'الإدارة غير موجودة.' };

  const existing = store.draft.departments[targetIdx];
  const deptMedia: DepartmentMedia = {
    id: `${deptId}-m-${Date.now()}`,
    type: mediaInput.type,
    title: mediaInput.title.trim(),
    caption: mediaInput.caption.trim() || `توثيق أعمال ${existing.name}`,
    url: mediaInput.url.trim(),
    approvalStatus: 'draft',
    createdBy: actor.fullName,
  };

  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    mediaItems: [deptMedia, ...(existing.mediaItems || [])],
  };

  let nextGallery = store.draft.media;
  if (mediaInput.alsoAddToGallery) {
    const galleryItem: MediaItem = {
      id: `med-${Date.now()}`,
      type: mediaInput.type,
      title: mediaInput.title.trim(),
      description: mediaInput.caption.trim() || `توثيق ميداني — ${existing.name}`,
      category: mediaInput.category || 'أخرى',
      location: mediaInput.location?.trim() || existing.name,
      dateLabel: formatArabicDate(),
      url: mediaInput.url.trim(),
      thumbnailUrl: mediaInput.thumbnailUrl,
      departmentId: deptId,
      approvalStatus: 'draft',
      createdBy: actor.fullName,
    };
    nextGallery = [galleryItem, ...nextGallery];
  }

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      lastUpdated: formatArabicDate(),
      departments: nextDepts,
      media: nextGallery,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إضافة وسائط ميدانية',
    departmentId: deptId,
    targetLabel: deptMedia.title,
    ipAddress: ipAddress ?? null,
    detail: `إضافة (${mediaInput.type}) بعنوان "${deptMedia.title}" ضمن ${existing.name}.`,
  });

  return { ok: true, workspace: getScopedWorkspaceForUser(actor) };
}

export function deleteDepartmentMediaScoped(
  deptId: string,
  mediaId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    mediaItems: (existing.mediaItems || []).filter((m) => m.id !== mediaId),
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'حذف وسائط إدارة',
    departmentId: deptId,
    ipAddress: ipAddress ?? null,
    detail: `تم حذف عنصر وسائط (${mediaId}) من ${existing.name}.`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function addDepartmentReportScoped(
  deptId: string,
  input: { title: string; summary: string; periodLabel: string },
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const report: DepartmentReport = {
    id: `rep-${Date.now()}`,
    departmentId: deptId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    periodLabel: input.periodLabel.trim() || formatArabicDate(),
    authorName: actor.fullName,
    authorUserId: actor.id,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };

  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    reports: [report, ...(existing.reports || [])],
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إضافة تقرير تشغيلي',
    departmentId: deptId,
    targetLabel: report.title,
    ipAddress: ipAddress ?? null,
    detail: `إضافة تقرير "${report.title}" ضمن ${existing.name}.`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function deleteDepartmentReportScoped(
  deptId: string,
  reportId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    reports: (existing.reports || []).filter((r) => r.id !== reportId),
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'حذف تقرير تشغيلي',
    departmentId: deptId,
    ipAddress: ipAddress ?? null,
    detail: `حذف تقرير (${reportId}) من ${existing.name}.`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function addDepartmentExcelScoped(
  deptId: string,
  input: { title: string; fileName: string; url: string },
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  if (!isSafeMediaUrl(input.url)) {
    return { ok: false, error: 'رابط ملف Excel غير آمن أو غير صالح.' };
  }

  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return { ok: false, error: 'الإدارة غير موجودة.' };

  const existing = store.draft.departments[targetIdx];
  const fileRec: DepartmentExcelFile = {
    id: `xls-${Date.now()}`,
    departmentId: deptId,
    title: input.title.trim(),
    fileName: input.fileName.trim(),
    url: input.url.trim(),
    uploadedBy: actor.fullName,
    uploadedAt: new Date().toISOString(),
    status: 'draft',
  };

  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    excelFiles: [fileRec, ...(existing.excelFiles || [])],
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'رفع ملف Excel للإدارة',
    departmentId: deptId,
    targetLabel: fileRec.title,
    ipAddress: ipAddress ?? null,
    detail: `رفع ملف "${fileRec.fileName}" بعنوان "${fileRec.title}" في (${existing.name}).`,
  });

  return { ok: true, workspace: getScopedWorkspaceForUser(actor) };
}

export function deleteDepartmentExcelScoped(
  deptId: string,
  fileId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const existing = store.draft.departments[targetIdx];
  const nextDepts = [...store.draft.departments];
  nextDepts[targetIdx] = {
    ...existing,
    excelFiles: (existing.excelFiles || []).filter((f) => f.id !== fileId),
  };

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDepts,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'حذف ملف Excel',
    departmentId: deptId,
    ipAddress: ipAddress ?? null,
    detail: `حذف ملف Excel (${fileId}) من ${existing.name}.`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function approveDepartmentContentScoped(
  deptId: string,
  actor: UserPublicProfile,
  publishToPublic: boolean,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const targetIdx = store.draft.departments.findIndex((d) => d.id === deptId);
  if (targetIdx < 0) return null;

  const nowIso = new Date().toISOString();
  const existing = store.draft.departments[targetIdx];
  const approvedDept: Department = {
    ...existing,
    mediaItems: (existing.mediaItems || []).map((m) => ({
      ...m,
      approvalStatus: 'approved' as const,
    })),
    reports: (existing.reports || []).map((r) => ({
      ...r,
      status: 'approved' as const,
      approvedBy: r.approvedBy || actor.fullName,
      approvedAt: r.approvedAt || nowIso,
    })),
    excelFiles: (existing.excelFiles || []).map((f) => ({
      ...f,
      status: 'approved' as const,
    })),
  };

  const nextDraftDepts = [...store.draft.departments];
  nextDraftDepts[targetIdx] = approvedDept;

  const nextDraftMedia = store.draft.media.map((m) =>
    m.departmentId === deptId ? { ...m, approvalStatus: 'approved' as const } : m
  );

  let nextPublished = store.published;
  if (publishToPublic) {
    const pubIdx = store.published.departments.findIndex((d) => d.id === deptId);
    const nextPubDepts = [...store.published.departments];
    if (pubIdx >= 0) {
      nextPubDepts[pubIdx] = approvedDept;
    } else {
      nextPubDepts.push(approvedDept);
    }

    const existingPubMediaMap = new Map(store.published.media.map((m) => [m.id, m]));
    for (const m of nextDraftMedia) {
      if (m.departmentId === deptId) {
        existingPubMediaMap.set(m.id, m);
      }
    }

    nextPublished = {
      ...store.published,
      lastUpdated: formatArabicDate(),
      departments: nextPubDepts,
      media: Array.from(existingPubMediaMap.values()),
    };
  }

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      departments: nextDraftDepts,
      media: nextDraftMedia,
    },
    published: nextPublished,
    lastPublishedAt: publishToPublic ? formatArabicDate() : store.lastPublishedAt,
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: publishToPublic ? 'اعتماد ونشر محتوى الإدارة' : 'اعتماد محتوى الإدارة داخلياً',
    departmentId: deptId,
    targetLabel: existing.name,
    ipAddress: ipAddress ?? null,
    detail: `تم اعتماد محتوى وتقارير ووسائط (${existing.name}).`,
  });

  return getScopedWorkspaceForUser(actor);
}

export function updateGlobalKpisScoped(
  kpis: KpiMetric[],
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  const store = ensureStoreReady();
  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      lastUpdated: formatArabicDate(),
      kpis,
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'تعديل مؤشرات المشروع العامة',
    departmentId: actor.primaryDepartmentId,
    ipAddress: ipAddress ?? null,
    detail: 'تم تحديث مصفوفة مؤشرات الأداء في المسودة.',
  });

  return getScopedWorkspaceForUser(actor);
}

export function addGalleryMediaScoped(
  item: MediaItem,
  actor: UserPublicProfile,
  ipAddress?: string | null
) {
  if (!isSafeMediaUrl(item.url)) {
    return { ok: false, error: 'رابط الوسائط غير آمن.' };
  }
  const store = ensureStoreReady();
  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      media: [item, ...store.draft.media],
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'إضافة عنصر للمعرض',
    departmentId: item.departmentId || actor.primaryDepartmentId,
    targetLabel: item.title,
    ipAddress: ipAddress ?? null,
    detail: `إضافة "${item.title}" (${item.type}).`,
  });

  return { ok: true, workspace: getScopedWorkspaceForUser(actor) };
}

export function deleteGalleryMediaScoped(
  mediaId: string,
  actor: UserPublicProfile,
  ipAddress?: string | null
): {
  ok: boolean;
  status?: number;
  workspace?: ReturnType<typeof getScopedWorkspaceForUser>;
  error?: string;
} {
  const store = ensureStoreReady();
  const target = store.draft.media.find((m) => m.id === mediaId);
  if (!target) {
    return { ok: false, status: 404, error: 'عنصر الوسائط غير موجود.' };
  }
  if (
    actor.role !== 'super_admin' &&
    actor.departmentAccessScope !== 'all' &&
    (!target.departmentId || !canAccessDepartment(actor, target.departmentId))
  ) {
    return {
      ok: false,
      status: 403,
      error: 'غير مصرح لك بحذف وسائط تابعة لإدارة أخرى.',
    };
  }

  const updated: CmsStore = {
    ...store,
    draft: {
      ...store.draft,
      media: store.draft.media.filter((m) => m.id !== mediaId),
    },
  };
  writeStore(updated);

  writeAuditLog({
    actorUserId: actor.id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actionType: 'حذف عنصر من المعرض',
    departmentId: target.departmentId || actor.primaryDepartmentId,
    targetLabel: target.title,
    ipAddress: ipAddress ?? null,
    detail: `تم حذف "${target.title}".`,
  });

  return { ok: true, workspace: getScopedWorkspaceForUser(actor) };
}
