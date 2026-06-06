import React from 'react';
import { BarChart3, Filter, Search } from 'lucide-react';

export const ACADEMIC_INTELLIGENCE_NAV = [
  { path: 'academic-intelligence', label: 'Executive Dashboard', shortLabel: 'Executive' },
  { path: 'academic-section-analysis', label: 'Section Analysis', shortLabel: 'Sections' },
  { path: 'academic-subject-intelligence', label: 'Subject Intelligence', shortLabel: 'Subjects' },
  { path: 'academic-gender-analysis', label: 'Gender Analysis', shortLabel: 'Gender' },
  { path: 'academic-stream-analysis', label: 'Stream Analysis', shortLabel: 'Streams' },
  { path: 'academic-competency-analysis', label: 'Competency Analysis', shortLabel: 'Competencies' },
  { path: 'academic-learner-risk', label: 'Learner Risk', shortLabel: 'Risk' },
  { path: 'academic-growth-trends', label: 'Growth Trends', shortLabel: 'Growth' },
  { path: 'academic-ai-insights', label: 'AI Insights', shortLabel: 'AI' },
  { path: 'academic-top-bottom-performers', label: 'Top / Bottom Performers', shortLabel: 'Rankings' },
];

export const DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS = [
  { key: 'term', label: 'Term', value: 'Current term' },
  { key: 'grade', label: 'Grade', value: 'All grades' },
  { key: 'stream', label: 'Stream', value: 'All streams' },
  { key: 'learningArea', label: 'Learning Area', value: 'All learning areas' },
];

const AcademicIntelligenceShell = ({
  activePage,
  title = 'Academic Intelligence',
  description = 'Analyze performance, trends, learner risk, subjects and academic growth.',
  eyebrow = 'Academic Intelligence',
  breadcrumbs = ['Assessment', 'Academic Intelligence'],
  filters = DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS,
  headerActions = null,
  onNavigate,
  children,
}) => (
  <div className="min-h-[calc(100vh-140px)] bg-slate-50 p-4 md:p-6">
    <div className="mx-auto max-w-[1440px] space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {breadcrumbs?.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb}-${index}`}>
                <span className={index === breadcrumbs.length - 1 ? 'text-indigo-700' : ''}>
                  {crumb}
                </span>
                {index < breadcrumbs.length - 1 && <span className="text-slate-300">/</span>}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <BarChart3 size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-indigo-700">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
                {title}
              </h1>
              <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">
                {description}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto lg:max-w-2xl lg:items-end">
            <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 lg:justify-end">
              <Filter size={14} className="text-indigo-600" />
              <span>Filters will connect to live academic context when analytics data is available.</span>
            </div>
            {headerActions && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </div>

        {filters?.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {filters.map((filter) => (
              <div
                key={filter.key}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <label htmlFor={`academic-filter-${filter.key}`} className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                  {filter.label}
                </label>
                {filter.options?.length > 0 && filter.onChange ? (
                  <select
                    id={`academic-filter-${filter.key}`}
                    value={filter.value}
                    onChange={(event) => filter.onChange(event.target.value)}
                    className="mt-1 w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                  >
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="mt-1 block truncate text-sm font-bold text-slate-700">
                    {filter.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <nav aria-label="Academic Intelligence pages" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {ACADEMIC_INTELLIGENCE_NAV.map((item) => {
            const isActive = activePage === item.path;
            return (
              <button
                key={item.path}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                onClick={() => onNavigate?.(item.path)}
                className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-extrabold transition ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <section aria-label={`${title} content`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {children}
      </section>
    </div>
  </div>
);

export const AcademicIntelligenceComingSoon = ({ title, description }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
      <Search size={24} />
    </div>
    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-indigo-600">
      Coming soon
    </p>
    <h2 className="mt-2 text-xl font-extrabold text-slate-950">{title}</h2>
    <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">
      {description || 'This Academic Intelligence workspace is planned and will be wired to live assessment data when the analytics service is ready.'}
    </p>
  </div>
);

export default AcademicIntelligenceShell;
