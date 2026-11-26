import { DEFAULT_CMS_DATA } from '../data/defaultCmsData';
import { CmsData, Department } from '../types/cms';

export function hydrateCmsData(raw: Partial<CmsData> | null | undefined): CmsData {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_CMS_DATA;
  }

  const defaultDeptMap = new Map(
    DEFAULT_CMS_DATA.departments.map((d) => [d.id, d])
  );

  const mergedDepartments: Department[] = Array.isArray(raw.departments)
    ? raw.departments.map((dept) => {
        const fallback = defaultDeptMap.get(dept.id);
        return {
          ...dept,
          dailyOperations:
            Array.isArray(dept.dailyOperations) && dept.dailyOperations.length > 0
              ? dept.dailyOperations
              : fallback?.dailyOperations || [
                  'مهام يومية قابلة للتحديث وإضافة التفاصيل التشغيلية من لوحة إدارة المحتوى.',
                ],
          fieldTeams:
            Array.isArray(dept.fieldTeams) && dept.fieldTeams.length > 0
              ? dept.fieldTeams
              : fallback?.fieldTeams || [
                  {
                    id: `${dept.id}-team-1`,
                    teamName: 'الفريق التشغيلي / الميداني (خانة قابلة للتعديل)',
                    roleDescription:
                      'توزيع الفرق والمهام الميدانية حسب النطاق الجغرافي المعتمد.',
                    shiftOrReadinessNote: 'جاهزية ومناوبات قابلة للتحديد',
                  },
                ],
          departmentKpis:
            Array.isArray(dept.departmentKpis) && dept.departmentKpis.length > 0
              ? dept.departmentKpis
              : fallback?.departmentKpis || [
                  {
                    id: `${dept.id}-kpi-1`,
                    label: dept.kpiFocus || 'مؤشر أداء القسم',
                    value: '00.0%',
                    unit: 'نموذج تجريبي',
                    targetNote: 'خانة قابلة لإدخال المستهدف الرسمي',
                    isSampleData: true,
                  },
                ],
          mediaItems:
            Array.isArray(dept.mediaItems) && dept.mediaItems.length > 0
              ? dept.mediaItems
              : fallback?.mediaItems || [],
          reports: Array.isArray(dept.reports) ? dept.reports : [],
          excelFiles: Array.isArray(dept.excelFiles) ? dept.excelFiles : [],
        };
      })
    : DEFAULT_CMS_DATA.departments;

  return {
    ...DEFAULT_CMS_DATA,
    ...raw,
    hero: {
      ...DEFAULT_CMS_DATA.hero,
      ...(raw.hero || {}),
    },
    overviewBrief: {
      ...DEFAULT_CMS_DATA.overviewBrief,
      ...(raw.overviewBrief || {}),
    },
    scope: {
      ...DEFAULT_CMS_DATA.scope,
      ...(raw.scope || {}),
      detailedTracks:
        raw.scope?.detailedTracks && raw.scope.detailedTracks.length > 0
          ? raw.scope.detailedTracks
          : DEFAULT_CMS_DATA.scope.detailedTracks,
      objectives:
        raw.scope?.objectives && raw.scope.objectives.length > 0
          ? raw.scope.objectives
          : DEFAULT_CMS_DATA.scope.objectives,
      continuityImpact:
        raw.scope?.continuityImpact?.items?.length
          ? raw.scope.continuityImpact
          : DEFAULT_CMS_DATA.scope.continuityImpact,
      sectors:
        raw.scope?.sectors && raw.scope.sectors.length > 0
          ? raw.scope.sectors
          : DEFAULT_CMS_DATA.scope.sectors,
    },
    projectDirectorate: {
      ...DEFAULT_CMS_DATA.projectDirectorate,
      ...(raw.projectDirectorate || {}),
    },
    departments: mergedDepartments,
    operations: {
      ...DEFAULT_CMS_DATA.operations,
      ...(raw.operations || {}),
    },
    kpis:
      Array.isArray(raw.kpis) && raw.kpis.length > 0
        ? raw.kpis
        : DEFAULT_CMS_DATA.kpis,
    charts:
      Array.isArray(raw.charts) && raw.charts.length > 0
        ? raw.charts
        : DEFAULT_CMS_DATA.charts,
    media:
      Array.isArray(raw.media) && raw.media.length > 0
        ? raw.media
        : DEFAULT_CMS_DATA.media,
    impact: {
      ...DEFAULT_CMS_DATA.impact,
      ...(raw.impact || {}),
    },
    customSections: Array.isArray(raw.customSections)
      ? raw.customSections
      : DEFAULT_CMS_DATA.customSections,
    externalPortalSettings: {
      ...DEFAULT_CMS_DATA.externalPortalSettings,
      ...(raw.externalPortalSettings || {}),
      autoRotateSeconds:
        typeof raw.externalPortalSettings?.autoRotateSeconds === 'number' &&
        Number.isFinite(raw.externalPortalSettings.autoRotateSeconds)
          ? Math.min(120, Math.max(5, Math.round(raw.externalPortalSettings.autoRotateSeconds)))
          : DEFAULT_CMS_DATA.externalPortalSettings.autoRotateSeconds,
    },
    contractManagerProfile: {
      ...DEFAULT_CMS_DATA.contractManagerProfile,
      ...(raw.contractManagerProfile || {}),
      qualifications: Array.isArray(raw.contractManagerProfile?.qualifications)
        ? raw.contractManagerProfile.qualifications
        : [],
      galleryPhotos: Array.isArray(raw.contractManagerProfile?.galleryPhotos)
        ? raw.contractManagerProfile.galleryPhotos.filter(
            (p): p is string => typeof p === 'string' && Boolean(p)
          )
        : [],
      trainings: Array.isArray(raw.contractManagerProfile?.trainings)
        ? raw.contractManagerProfile.trainings
        : [],
      experiences: Array.isArray(raw.contractManagerProfile?.experiences)
        ? raw.contractManagerProfile.experiences
        : [],
      attachments: Array.isArray(raw.contractManagerProfile?.attachments)
        ? raw.contractManagerProfile.attachments
        : [],
    },
  };
}
