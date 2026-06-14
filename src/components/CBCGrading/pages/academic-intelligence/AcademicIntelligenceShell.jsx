import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  GitBranch,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  ShieldAlert,
  SplitSquareHorizontal,
  Target,
  Users,
} from 'lucide-react';
import { getAcademicYearOptions, getCurrentAcademicYear, getCurrentTerm } from '../../utils/academicYear';
import { useAcademicAnalytics } from './useAcademicAnalytics';

export const ACADEMIC_INTELLIGENCE_NAV = [
  { path: 'academic-intelligence', label: 'Analytics Dashboards', shortLabel: 'Analytics', icon: LayoutDashboard },
  { path: 'academic-section-analysis', label: 'Section Analysis', shortLabel: 'Sections', icon: SplitSquareHorizontal },
  { path: 'academic-subject-intelligence', label: 'Subject Analysis', shortLabel: 'Subjects', icon: BarChart3 },
  { path: 'academic-gender-analysis', label: 'Gender Analysis', shortLabel: 'Gender', icon: Users },
  { path: 'academic-stream-analysis', label: 'Stream Analysis', shortLabel: 'Streams', icon: GitBranch },
  { path: 'academic-competency-analysis', label: 'Competency Analysis', shortLabel: 'Competencies', icon: Target },
  { path: 'academic-learner-risk', label: 'Learner Risk', shortLabel: 'Risk', icon: ShieldAlert },
  { path: 'academic-growth-trends', label: 'Growth Trends', shortLabel: 'Growth', icon: LineChart },
  { path: 'academic-ai-insights', label: 'AI Insights', shortLabel: 'AI', icon: Bot },
  { path: 'academic-top-bottom-performers', label: 'Top / Bottom Performers', shortLabel: 'Rankings', icon: ListOrdered },
];

const YEAR_OPTIONS = getAcademicYearOptions().map((option) => ({ value: String(option.value), label: option.label }));

const GRADE_OPTIONS = [
  { value: 'all', label: 'Grade' },
  { value: 'playgroup', label: 'Playgroup' },
  { value: 'pp1', label: 'PP1' },
  { value: 'pp2', label: 'PP2' },
  { value: 'grade-1', label: 'Grade 1' },
  { value: 'grade-2', label: 'Grade 2' },
  { value: 'grade-3', label: 'Grade 3' },
  { value: 'grade-4', label: 'Grade 4' },
  { value: 'grade-5', label: 'Grade 5' },
  { value: 'grade-6', label: 'Grade 6' },
  { value: 'grade-7', label: 'Grade 7' },
  { value: 'grade-8', label: 'Grade 8' },
  { value: 'grade-9', label: 'Grade 9' },
];

const TERM_OPTIONS = [
  { value: 'TERM_1', label: 'Term 1' },
  { value: 'TERM_2', label: 'Term 2' },
  { value: 'TERM_3', label: 'Term 3' },
];

const SECTION_OPTIONS = [
  { value: 'all', label: 'Section' },
  { value: 'pre-primary', label: 'Pre Primary' },
  { value: 'lower', label: 'Lower' },
  { value: 'upper', label: 'Upper' },
  { value: 'junior-sec', label: 'Junior Sec' },
];

const EXAM_TYPE_OPTIONS = [
  { value: 'all', label: 'All Test Types' },
  { value: 'OPENER', label: 'Opener' },
  { value: 'CAT', label: 'CAT' },
  { value: 'MID_TERM', label: 'Mid Term' },
  { value: 'END_TERM', label: 'End Term' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MOCK', label: 'Mock' },
  { value: 'OTHER', label: 'Other' },
];

const DEFAULT_CLASS_OPTIONS = [
  { value: 'all', label: 'Class' },
  { value: 'stream-a', label: 'Stream A' },
  { value: 'stream-b', label: 'Stream B' },
  { value: 'stream-c', label: 'Stream C' },
  { value: 'stream-d', label: 'Stream D' },
];

export const DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS = [
  { key: 'year', label: 'Year', options: YEAR_OPTIONS },
  { key: 'section', label: 'Section', options: SECTION_OPTIONS },
  { key: 'term', label: 'Term', options: TERM_OPTIONS },
  { key: 'testType', label: 'Test Type', options: EXAM_TYPE_OPTIONS },
];

const getLearnerClass = (learner) => learner?.stream || learner?.className || learner?.section || learner?.class || '';

const toFilterValue = (value) => String(value || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');

const getClassOptions = (learners = []) => {
  const options = [...new Set((learners || []).map(getLearnerClass).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map((label) => ({ value: toFilterValue(label), label }));

  return options.length ? [{ value: 'all', label: 'Class' }, ...options] : DEFAULT_CLASS_OPTIONS;
};

const getSubjectOptions = (analytics) => {
  const options = [...new Map((analytics?.results || [])
    .filter((result) => result?.subjectKey && result?.subject)
    .map((result) => [result.subjectKey, { value: result.subjectKey, label: result.subject }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label));

  return [{ value: 'all', label: 'Subject' }, ...options];
};

const getFiltersForPage = (activePage, filters, classOptions) => {
  if (filters) return filters;
  if (activePage === 'academic-section-analysis') {
    return [
      { key: 'year', label: 'Year', options: YEAR_OPTIONS },
      { key: 'section', label: 'Section', options: SECTION_OPTIONS },
      { key: 'term', label: 'Term', options: TERM_OPTIONS },
      { key: 'testType', label: 'Test Type', options: EXAM_TYPE_OPTIONS },
    ];
  }
  if (activePage === 'academic-ai-insights') {
    return DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS;
  }
  if (activePage === 'academic-subject-intelligence') {
    return [
      { key: 'year', label: 'Year', options: YEAR_OPTIONS },
      { key: 'term', label: 'Term', options: TERM_OPTIONS },
      { key: 'grade', label: 'Grade', options: GRADE_OPTIONS },
      { key: 'classScope', label: 'Class', options: classOptions },
      { key: 'testType', label: 'Test Type', options: EXAM_TYPE_OPTIONS },
    ];
  }
  if (activePage === 'academic-gender-analysis') {
    return [
      { key: 'year', label: 'Year', options: YEAR_OPTIONS },
      { key: 'term', label: 'Term', options: TERM_OPTIONS },
      { key: 'grade', label: 'Grade', options: GRADE_OPTIONS },
      { key: 'classScope', label: 'Class', options: classOptions },
      { key: 'testType', label: 'Test Type', options: EXAM_TYPE_OPTIONS },
    ];
  }
  if (activePage === 'academic-competency-analysis') {
    return DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS.map((filter) => {
      if (filter.key === 'testType') return { ...filter, label: 'Assessment Type' };
      return filter;
    });
  }
  return DEFAULT_ACADEMIC_INTELLIGENCE_FILTERS;
};

const AcademicIntelligenceShell = ({
  activePage,
  title = 'Reports & Growth',
  filters,
  headerActions = null,
  onNavigate,
  children,
}) => {
  const activeItem = ACADEMIC_INTELLIGENCE_NAV.find((item) => item.path === activePage) || ACADEMIC_INTELLIGENCE_NAV[0];
  const childLearners = React.isValidElement(children) ? children.props?.learners : [];
  const classOptions = useMemo(() => getClassOptions(childLearners), [childLearners]);
  const pageFilters = useMemo(() => getFiltersForPage(activePage, filters, classOptions), [activePage, classOptions, filters]);
  const [filterValues, setFilterValues] = useState({
    year: String(getCurrentAcademicYear()),
    term: getCurrentTerm(),
    section: 'all',
    grade: 'all',
    classScope: 'all',
    subject: 'all',
    testType: 'all',
  });

  const handleFilterChange = (key, value) => {
    setFilterValues((current) => ({ ...current, [key]: value }));
  };
  const analytics = useAcademicAnalytics({ learners: childLearners, filters: filterValues });
  const subjectOptions = useMemo(() => getSubjectOptions(analytics), [analytics]);
  const visiblePageFilters = useMemo(() => {
    if (!['academic-subject-intelligence', 'academic-gender-analysis'].includes(activePage)) return pageFilters;

    const hasSubjectFilter = pageFilters.some((filter) => filter.key === 'subject');
    if (hasSubjectFilter) {
      return pageFilters.map((filter) => (filter.key === 'subject' ? { ...filter, options: subjectOptions } : filter));
    }

    const testTypeIndex = pageFilters.findIndex((filter) => filter.key === 'testType');
    const subjectFilter = { key: 'subject', label: 'Subject', options: subjectOptions };
    if (testTypeIndex === -1) return [...pageFilters, subjectFilter];

    return [
      ...pageFilters.slice(0, testTypeIndex),
      subjectFilter,
      ...pageFilters.slice(testTypeIndex),
    ];
  }, [activePage, pageFilters, subjectOptions]);
  const content = React.isValidElement(children)
    ? React.cloneElement(children, { academicFilters: filterValues, analytics })
    : children;

  return (
    <div className="min-h-[calc(100vh-96px)] bg-slate-50">
      <div className="mx-auto max-w-[1500px] space-y-3 p-2 md:p-3">
          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm md:hidden">
            <label htmlFor="academic-intelligence-mobile-nav" className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Reports & Growth
            </label>
            <select
              id="academic-intelligence-mobile-nav"
              value={activeItem.path}
              onChange={(event) => onNavigate?.(event.target.value)}
              className="w-full bg-transparent text-sm font-black text-slate-800 outline-none"
            >
              {ACADEMIC_INTELLIGENCE_NAV.map((item) => (
                <option key={item.path} value={item.path}>{item.label}</option>
              ))}
            </select>
          </div>

          <section className="overflow-x-auto border-b border-slate-200 bg-white px-3 py-3">
            <div className="flex min-w-max items-center justify-center gap-4">
                {visiblePageFilters.map((filter) => (
                  <label key={filter.key} htmlFor={`academic-filter-${filter.key}`} className="flex h-11 items-center border border-slate-300 bg-white px-4">
                    <select
                      id={`academic-filter-${filter.key}`}
                      aria-label={filter.label}
                      value={filterValues[filter.key] || 'all'}
                      onChange={(event) => handleFilterChange(filter.key, event.target.value)}
                      className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none"
                    >
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {headerActions && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {headerActions}
                  </div>
                )}
            </div>
          </section>

          <section aria-label={`${title} content`} className="min-w-0">
            {(analytics.loading || analytics.error) && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                {analytics.loading && <span>Loading academic records...</span>}
                {analytics.error && <span className="text-amber-700">{analytics.error}</span>}
              </div>
            )}
            {content}
          </section>
      </div>
    </div>
  );
};

export const AcademicIntelligenceComingSoon = ({ title }) => (
  <div className="space-y-2 bg-slate-50">
    <div className="grid gap-2 md:grid-cols-3">
      {[
        { label: 'Report', value: title },
        { label: 'Records', value: '0' },
        { label: 'Status', value: 'Pending data' },
      ].map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
          <p className="mt-1 truncate text-xl font-black text-slate-950">{item.value}</p>
        </div>
      ))}
    </div>
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          <tr>
            <th className="px-3 py-2">Metric</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <td className="px-3 py-2 font-bold text-slate-800">Available rows</td>
            <td className="px-3 py-2 font-black text-slate-600">0</td>
          </tr>
          <tr>
            <td className="px-3 py-2 font-bold text-slate-800">Export ready</td>
            <td className="px-3 py-2 font-black text-slate-600">No</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

export default AcademicIntelligenceShell;
