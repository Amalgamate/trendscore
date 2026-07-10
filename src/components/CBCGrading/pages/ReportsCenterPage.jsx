import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  GraduationCap,
  PieChart,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useModuleAccess } from '../../../contexts/ModuleAccessContext';
import { hasPageAccess } from '../utils/appAccess';

const reportSections = [
  {
    id: 'academics',
    label: 'Academic Reports',
    accent: 'from-indigo-500 to-sky-500',
    reports: [
      { title: 'Report Card Hub', path: 'sec-report-cards', icon: GraduationCap, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', permissionLabel: 'Term packets' },
      { title: 'Learner Reports', path: 'assess-learner-reports', icon: FileText, color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100', permissionLabel: 'Report cards and sheets' },
      { title: 'Summative Sheets', path: 'assess-summative-report', icon: BarChart3, color: 'text-sky-600 bg-sky-50 border-sky-100', permissionLabel: 'Exam sheets' },
      { title: 'Formative Report', path: 'assess-formative-report', icon: BookOpenCheck, color: 'text-violet-600 bg-violet-50 border-violet-100', permissionLabel: 'CBC ratings' },
      { title: 'Summary Report', path: 'assess-summary-report', icon: ClipboardList, color: 'text-blue-600 bg-blue-50 border-blue-100', permissionLabel: 'Class summaries' },
      { title: 'Custom Reports', path: 'assess-custom-reports', icon: FileSpreadsheet, color: 'text-cyan-700 bg-cyan-50 border-cyan-100', permissionLabel: 'Builder' },
      { title: 'Academic Intelligence', path: 'academic-intelligence', icon: Sparkles, color: 'text-amber-600 bg-amber-50 border-amber-100', permissionLabel: 'Insights' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations Reports',
    accent: 'from-emerald-500 to-teal-500',
    reports: [
      { title: 'Attendance Reports', path: 'attendance-reports', icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', permissionLabel: 'Daily trends' },
      { title: 'Transport Reports', path: 'transport-reports', icon: Truck, color: 'text-orange-600 bg-orange-50 border-orange-100', permissionLabel: 'Routes' },
      { title: 'Biometric Reports', path: 'biometric-reports', icon: Fingerprint, color: 'text-rose-600 bg-rose-50 border-rose-100', permissionLabel: 'Clocking' },
      { title: 'Learning Reports', path: 'lms-reports', icon: BookOpen, color: 'text-lime-700 bg-lime-50 border-lime-100', permissionLabel: 'LMS' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance Reports',
    accent: 'from-amber-500 to-red-500',
    reports: [
      { title: 'Fee Reports', path: 'fees-reports', icon: CreditCard, color: 'text-emerald-700 bg-emerald-50 border-emerald-100', permissionLabel: 'Collections' },
      { title: 'Accounting Reports', path: 'accounting-reports', icon: PieChart, color: 'text-purple-600 bg-purple-50 border-purple-100', permissionLabel: 'Ledgers' },
      { title: 'Student Statements', path: 'fees-statements', icon: FileText, color: 'text-slate-700 bg-slate-50 border-slate-200', permissionLabel: 'Balances' },
      { title: 'Fee Overview', path: 'fees-overview', icon: BarChart3, color: 'text-teal-700 bg-teal-50 border-teal-100', permissionLabel: 'Dashboard' },
    ],
  },
];

const ReportsCenterPage = ({ onNavigate, user }) => {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const { activeSlugs } = useModuleAccess();
  const accessUser = useMemo(() => ({ ...(user || {}), enabledApps: activeSlugs }), [activeSlugs, user]);

  const visibleSections = useMemo(() => reportSections
    .map((section) => ({
      ...section,
      reports: section.reports.filter((report) => hasPageAccess(accessUser, report.path)),
    }))
    .filter((section) => section.reports.length > 0), [accessUser]);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visibleSections
      .filter((section) => activeSection === 'all' || section.id === activeSection)
      .map((section) => ({
        ...section,
        reports: section.reports.filter((report) => {
          if (!normalizedQuery) return true;
          return `${report.title} ${report.permissionLabel} ${section.label}`.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.reports.length > 0);
  }, [activeSection, query, visibleSections]);

  const allReports = visibleSections.reduce((total, section) => total + section.reports.length, 0);
  const firstReports = visibleSections.flatMap((section) => section.reports).slice(0, 3);

  return (
    <div className="min-h-full bg-slate-100 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                  <BarChart3 size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Reports Center</p>
                  <h1 className="text-2xl font-black tracking-tight text-slate-950">Module Reports</h1>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Reports</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{allReports}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Sections</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{visibleSections.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Access</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">Live</p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Fast Picks</p>
              <div className="mt-4 space-y-2">
                {firstReports.map((report) => {
                  const Icon = report.icon;
                  return (
                    <button
                      key={report.path}
                      type="button"
                      onClick={() => onNavigate?.(report.path)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/25 hover:bg-white/10"
                    >
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Icon size={16} />
                        {report.title}
                      </span>
                      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{report.permissionLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[{ id: 'all', label: 'All' }, ...visibleSections.map((section) => ({ id: section.id, label: section.label }))].map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-black transition ${
                  activeSection === section.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {filteredSections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`h-8 w-1.5 rounded-full bg-gradient-to-b ${section.accent}`} />
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-950">{section.label}</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{section.reports.length} available</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {section.reports.map((report) => {
                  const Icon = report.icon;
                  return (
                    <button
                      key={report.path}
                      type="button"
                      onClick={() => onNavigate?.(report.path)}
                      className="group min-h-[138px] rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`flex h-11 w-11 items-center justify-center rounded-lg border ${report.color}`}>
                          <Icon size={21} />
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Open
                        </span>
                      </div>
                      <div className="mt-4">
                        <h3 className="text-base font-black text-slate-950 group-hover:text-blue-700">{report.title}</h3>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{report.permissionLabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {filteredSections.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm font-bold text-slate-500">No matching reports found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsCenterPage;
