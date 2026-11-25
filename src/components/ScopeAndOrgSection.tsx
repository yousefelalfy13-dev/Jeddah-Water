import React from 'react';
import {
  ArrowLeft,
  Compass,
  GitBranch,
  MapPin,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { CmsData, Department } from '../types/cms';
import { DepartmentDetailView } from './DepartmentDetailView';

interface ScopeAndOrgSectionProps {
  data: CmsData;
  activeDepartmentPageId: string | null;
  onSelectDepartmentPage: (id: string | null) => void;
}

export const ScopeAndOrgSection: React.FC<ScopeAndOrgSectionProps> = ({
  data,
  activeDepartmentPageId,
  onSelectDepartmentPage,
}) => {
  const activeDepartment = activeDepartmentPageId
    ? data.departments.find((d) => d.id === activeDepartmentPageId) || null
    : null;

  // Group departments by parentDivision for the visual organizational tree
  const divisionsMap = new Map<string, Department[]>();
  data.departments.forEach((dept) => {
    const key = dept.parentDivision || 'إدارات المشروع';
    if (!divisionsMap.has(key)) {
      divisionsMap.set(key, []);
    }
    divisionsMap.get(key)!.push(dept);
  });
  const divisionGroups = Array.from(divisionsMap.entries());

  const handleOpenCardDetail = (deptId: string) => {
    onSelectDepartmentPage(deptId);
    setTimeout(() => {
      const el = document.getElementById('org');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  return (
    <div className="bg-[#F8FAFC] border-b border-slate-200">
      {/* Chapter 02: Detailed Scope of Work, Strategic Objectives & Continuity/Efficiency Impact */}
      <section id="scope" className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        {/* Detailed Scope of Work */}
        <div>
          <div className="max-w-3xl mb-10">
            <div className="text-xs font-medium text-[#0D9488] mb-2">
              02 · النطاق التفصيلي لأعمال العقد الموحد
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance mb-3">
              {data.scope.heading}
            </h2>
            <p className="text-base text-slate-700 leading-relaxed">
              {data.scope.intro}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.scope.detailedTracks.map((track) => (
              <div
                key={track.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="font-mono-num font-bold text-[#0284C7]">
                      نطاق {track.number}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#0D9488]">
                      <Compass className="w-3.5 h-3.5" />
                      <span>نطاق تعاقدي</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-display font-bold text-[#0B1F3A] mb-2">
                    {track.title}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    {track.scopeBoundary}
                  </p>
                </div>

                <dl className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500 mb-0.5">الأصول والمكونات المشمولة:</dt>
                    <dd className="font-medium text-[#0B1F3A]">{track.coveredAssets}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 mb-0.5">منهجية التنفيذ والضبط:</dt>
                    <dd className="text-slate-600 leading-relaxed">{track.operationalStandard}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        {/* Dedicated Section: Project Objectives & Impact on Service Continuity & O&M Efficiency */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-8 border-b border-slate-200">
            <div className="lg:col-span-5 space-y-3">
              <div className="text-xs font-medium text-[#0D9488] flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>أهداف المشروع وأثره التشغيلي</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-[#0B1F3A] text-balance">
                {data.scope.continuityImpact.heading}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {data.scope.continuityImpact.summary}
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.scope.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className="p-5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-mono-num font-bold text-[#0284C7] mb-1.5">
                      هدف {obj.number}
                    </div>
                    <h4 className="text-base font-display font-bold text-[#0B1F3A] mb-1.5">
                      {obj.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">
                      {obj.description}
                    </p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-200 text-xs text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                    <span>{obj.deliverable}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Continuity & Efficiency Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.scope.continuityImpact.items.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-num text-xs font-bold text-[#0D9488]">
                    {item.number}
                  </span>
                  <h4 className="text-base font-display font-bold text-[#0B1F3A]">
                    {item.title}
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-semibold text-[#0284C7] mb-1">
                      الأثر على استمرارية خدمات المياه
                    </div>
                    <p className="text-slate-600">{item.continuityEffect}</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-white border border-slate-200">
                    <div className="font-semibold text-[#0D9488] mb-1">
                      الأثر على كفاءة التشغيل والصيانة
                    </div>
                    <p className="text-slate-600">{item.efficiencyEffect}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jeddah Geographical Sectors */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-display font-bold text-[#0B1F3A]">
                التوزيع الجغرافي لقطاعات التشغيل في مدينة جدة
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                النطاقات التشغيلية المعتمدة لخدمة أحياء مدينة جدة
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-4 h-4 text-[#0D9488]" />
              <span>{data.scope.sectors.length} نطاقات جغرافية رئيسية</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.scope.sectors.map((sec) => (
              <div
                key={sec.id}
                className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 space-y-2"
              >
                <div className="text-sm font-display font-bold text-[#0B1F3A]">
                  {sec.name}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {sec.zonesNote}
                </p>
                <div className="pt-2 border-t border-slate-200 text-xs text-[#0284C7]">
                  {sec.assetsSummary}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chapter 03 & 04: Interactive Visual Organizational Chart OR Dedicated Department Detail Page */}
      <section id="org" className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs font-medium text-[#0D9488] mb-2">
              03 & 04 · الهيكل التنظيمي البصري وصفحات الإدارات التفصيلية
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B1F3A] text-balance mb-2">
              {activeDepartment
                ? `ملف الإدارة: ${activeDepartment.name}`
                : 'الهيكل التنظيمي التفاعلي لإدارة المشروع والإدارات التابعة'}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {activeDepartment
                ? 'عرض متكامل لتعريف القسم ومهامه اليومية وفرقه الميدانية ومؤشرات أدائه وتوثيقه المرئي.'
                : 'اضغط على بطاقة أي إدارة أو قسم في الهيكل التنظيمي لفتح صفحته التفصيلية المستقلة.'}
            </p>
          </div>

          {/* Dedicated Department Detail Page View when a Card is Clicked */}
          {activeDepartment ? (
            <DepartmentDetailView
              department={activeDepartment}
              allDepartments={data.departments}
              onBackToOrg={() => onSelectDepartmentPage(null)}
              onSelectDepartment={(id) => onSelectDepartmentPage(id)}
            />
          ) : (
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10">
              {/* Tier 1: Project Directorate Root Node */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-2xl bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-7 border border-[#0B1F3A] text-center shadow-sm">
                  <div className="text-xs font-medium text-[#5EEAD4] mb-1.5">
                    {data.projectDirectorate.subtitle}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-display font-bold mb-2">
                    {data.projectDirectorate.title}
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium mb-3">
                    {data.projectDirectorate.headPlaceholder}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
                    {data.projectDirectorate.mandate}
                  </p>
                </div>

                {/* Connector Trunk */}
                <div className="w-px h-8 bg-slate-300" aria-hidden="true" />
                <div className="hidden lg:block w-4/5 h-px bg-slate-300" aria-hidden="true" />
              </div>

              {/* Tier 2 & Tier 3: Grouped Divisions & Independent Department Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4 lg:mt-0">
                {divisionGroups.map(([divisionName, depts]) => (
                  <div key={divisionName} className="flex flex-col">
                    <div className="hidden lg:flex justify-center">
                      <div className="w-px h-6 bg-slate-300" aria-hidden="true" />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <GitBranch className="w-4 h-4 text-[#0D9488] shrink-0" />
                        <span className="text-sm sm:text-base font-display font-bold text-[#0B1F3A]">
                          {divisionName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono-num">
                        {depts.length} {depts.length === 1 ? 'إدارة' : 'إدارات'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {depts.map((dept) => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => handleOpenCardDetail(dept.id)}
                          className="group text-right bg-white border border-slate-200 hover:border-[#0D9488] rounded-xl p-5 flex flex-col justify-between transition-all duration-150 hover:shadow-sm cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                              <span className="font-mono-num font-semibold text-[#0284C7]">
                                {dept.code}
                              </span>
                              <span>{dept.departmentKpis.length} مؤشرات</span>
                            </div>
                            <h4 className="text-base font-display font-bold text-[#0B1F3A] group-hover:text-[#0284C7] transition-colors mb-1.5">
                              {dept.name}
                            </h4>
                            <div className="text-xs text-[#0D9488] font-medium mb-2">
                              {dept.headPlaceholder}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-4">
                              {dept.summary}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-[#0B1F3A] group-hover:text-[#0D9488]">
                            <span>عرض الصفحة التفصيلية</span>
                            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-1" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div
                id="duties"
                className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-slate-600"
              >
                <span>
                  يحتوي ملف كل إدارة على: التعريف · المسؤوليات · الأعمال اليومية · الفرق الميدانية · مؤشرات الأداء · الوسائط الموثقة.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    data.departments[0] &&
                    handleOpenCardDetail(data.departments[0].id)
                  }
                  className="font-semibold text-[#0284C7] hover:text-[#0B1F3A] cursor-pointer"
                >
                  استعراض ملف أول إدارة
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
