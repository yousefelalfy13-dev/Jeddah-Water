export type PageId =
  | 'overview'
  | 'scope'
  | 'org'
  | 'duties'
  | 'stations'
  | 'maintenance'
  | 'networks'
  | 'quality'
  | 'hse'
  | 'achievements'
  | 'media'
  | 'impact'
  | string;

export interface HeroConfig {
  title: string;
  subtitle: string;
  description: string;
  contractLabel: string;
  locationLabel: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  useVideoBackdrop: boolean;
}

export interface ScopeObjective {
  id: string;
  number: string;
  title: string;
  description: string;
  deliverable: string;
}

export interface ScopeTrack {
  id: string;
  number: string;
  title: string;
  scopeBoundary: string;
  coveredAssets: string;
  operationalStandard: string;
}

export interface ContinuityImpactItem {
  id: string;
  number: string;
  title: string;
  continuityEffect: string;
  efficiencyEffect: string;
}

export interface SectorCoverage {
  id: string;
  name: string;
  zonesNote: string;
  assetsSummary: string;
}

export interface ProjectDirectorate {
  title: string;
  subtitle: string;
  headPlaceholder: string;
  mandate: string;
}

export interface DepartmentTeam {
  id: string;
  teamName: string;
  roleDescription: string;
  shiftOrReadinessNote: string;
}

export interface DepartmentKpi {
  id: string;
  label: string;
  value: string;
  unit: string;
  targetNote: string;
  isSampleData: boolean;
}

export type UserRole =
  | 'super_admin'
  | 'project_manager'
  | 'department_manager'
  | 'engineer'
  | 'supervisor'
  | 'employee';

export type AccountStatus = 'active' | 'suspended';

export type DepartmentAccessScope = 'primary_only' | 'specific' | 'all';

export type PermissionKey =
  | 'view_data'
  | 'add_data'
  | 'edit_data'
  | 'delete_data'
  | 'upload_images'
  | 'upload_videos'
  | 'upload_excel'
  | 'add_youtube'
  | 'add_reports'
  | 'edit_kpis'
  | 'approve_publish'
  | 'manage_users'
  | 'manage_devices_sessions'
  | 'view_audit_logs'
  | 'manage_departments'
  | 'manage_system';

export interface UserPublicProfile {
  id: string;
  fullName: string;
  jobTitle: string;
  username: string;
  phone: string;
  maskedPhone: string;
  primaryDepartmentId: string;
  departmentAccessScope: DepartmentAccessScope;
  allowedDepartmentIds: string[];
  role: UserRole;
  status: AccountStatus;
  permissions: PermissionKey[];
  hasPassword?: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface TrustedDeviceRecord {
  id: string;
  userId: string;
  userFullName: string;
  userUsername: string;
  maskedPhone: string;
  primaryDepartmentId: string;
  primaryDepartmentName: string;
  deviceLabel: string;
  userAgent: string;
  isTrusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp: string | null;
  revokedAt: string | null;
}

export interface SessionInfoRecord {
  id: string;
  userId: string;
  userFullName: string;
  userUsername: string;
  maskedPhone: string;
  primaryDepartmentId: string;
  primaryDepartmentName: string;
  trustedDeviceId: string | null;
  deviceLabel: string;
  deviceTrusted: boolean;
  expiresAt: string;
  lastActivityAt: string;
  ipAddress: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface DepartmentReport {
  id: string;
  departmentId: string;
  title: string;
  summary: string;
  periodLabel: string;
  authorName: string;
  authorUserId: string;
  status: 'draft' | 'approved';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DepartmentExcelFile {
  id: string;
  departmentId: string;
  title: string;
  fileName: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'draft' | 'approved';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorUserId?: string;
  actorRole?: UserRole | 'system';
  departmentId?: string | null;
  action: string;
  detail: string;
  targetUserId?: string;
  targetLabel?: string;
  ipAddress?: string;
}

export interface DepartmentMedia {
  id: string;
  type: 'image' | 'youtube' | 'video';
  title: string;
  caption: string;
  url: string;
  approvalStatus?: 'draft' | 'approved';
  createdBy?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  parentDivision: string;
  headPlaceholder: string;
  summary: string;
  responsibilities: string[];
  dailyOperations: string[];
  fieldTeams: DepartmentTeam[];
  departmentKpis: DepartmentKpi[];
  mediaItems: DepartmentMedia[];
  reports?: DepartmentReport[];
  excelFiles?: DepartmentExcelFile[];
  interfaces: string;
  kpiFocus: string;
}

export interface OperationalPillar {
  id: 'stations' | 'maintenance' | 'networks' | 'quality' | 'hse';
  chapterNumber: string;
  title: string;
  subtitle: string;
  leadDescription: string;
  imageUrl: string;
  imageCaption: string;
  procedures: {
    id: string;
    step: string;
    title: string;
    detail: string;
  }[];
  standardsNote: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  periodNote: string;
  category: 'التشغيل' | 'الصيانة' | 'الشبكات' | 'الجودة' | 'السلامة';
  isSampleData: boolean;
}

export interface ChartPoint {
  id: string;
  label: string;
  primaryValue: number;
  secondaryValue: number;
}

export interface ChartDataset {
  id: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
  unit: string;
  type: 'trend' | 'bar';
  isSampleData: boolean;
  points: ChartPoint[];
}

export type MediaType = 'image' | 'youtube' | 'video';

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  description: string;
  category: 'محطات المياه' | 'إصلاح الانكسارات' | 'أعمال الشبكات' | 'المختبرات والجودة' | 'السلامة المهنية' | 'أخرى';
  location: string;
  dateLabel: string;
  url: string;
  thumbnailUrl?: string;
  departmentId?: string | null;
  approvalStatus?: 'draft' | 'approved';
  createdBy?: string;
}

export interface CustomSection {
  id: string;
  chapterNumber: string;
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  imageUrl?: string;
  createdAt: string;
}

export interface ImpactPillar {
  id: string;
  number: string;
  title: string;
  description: string;
}

export type PublicDisplayMode = 'showcase' | 'project' | 'contract-manager' | 'executive';

export type ExecutiveScreenId = 'kpis' | 'operations' | 'achievements' | 'comparison';

export interface ExternalPortalSettings {
  showProjectNameOnly: boolean;
  showLogos: boolean;
  showProjectDetailsAndVideo: boolean;
  showContractManagerAndVideo: boolean;
  showExecutiveKpis: boolean;
  enableShowcaseMode: boolean;
  defaultLandingMode: PublicDisplayMode;
  autoRotateSeconds: number;
  allowVisitorModeSwitch: boolean;
  alkhorayefLogoUrl: string;
  nwcLogoUrl: string;
  logosConsentConfirmed: boolean;
  projectIntroVideoUrl: string;
  projectIntroVideoTitle: string;
  projectIntroVideoPosterUrl: string;
}

export interface ContractManagerQualification {
  id: string;
  title: string;
  issuer: string;
  year: string;
  kind: 'academic' | 'professional';
  credentialNote: string;
}

export interface ContractManagerTraining {
  id: string;
  title: string;
  provider: string;
  year: string;
  durationNote: string;
}

export interface ContractManagerExperience {
  id: string;
  roleTitle: string;
  organization: string;
  period: string;
  summary: string;
  highlights: string[];
}

export interface ContractManagerAttachment {
  id: string;
  title: string;
  category: 'cv' | 'certificate' | 'credential';
  fileUrl: string;
  fileName: string;
  allowDownload: boolean;
  approvedForPublic: boolean;
}

export interface ContractManagerProfile {
  isPublished: boolean;
  consentConfirmed: boolean;
  consentNote: string;
  approvedBy?: string;
  approvedAt?: string;
  fullName: string;
  jobTitle: string;
  photoUrl: string;
  bio: string;
  introVideoType: 'upload' | 'external';
  introVideoUrl: string;
  introVideoTitle: string;
  introVideoPosterUrl: string;
  qualifications: ContractManagerQualification[];
  trainings: ContractManagerTraining[];
  experiences: ContractManagerExperience[];
  attachments: ContractManagerAttachment[];
}

export interface CmsData {
  lastUpdated: string;
  hero: HeroConfig;
  overviewBrief: {
    heading: string;
    paragraphs: string[];
    governanceNote: string;
  };
  scope: {
    heading: string;
    intro: string;
    detailedTracks: ScopeTrack[];
    objectives: ScopeObjective[];
    continuityImpact: {
      heading: string;
      summary: string;
      items: ContinuityImpactItem[];
    };
    sectors: SectorCoverage[];
  };
  projectDirectorate: ProjectDirectorate;
  departments: Department[];
  operations: Record<'stations' | 'maintenance' | 'networks' | 'quality' | 'hse', OperationalPillar>;
  kpis: KpiMetric[];
  charts: ChartDataset[];
  media: MediaItem[];
  impact: {
    heading: string;
    subtitle: string;
    statement: string;
    pillars: ImpactPillar[];
    closingQuote: string;
  };
  customSections: CustomSection[];
  externalPortalSettings: ExternalPortalSettings;
  contractManagerProfile: ContractManagerProfile;
}
