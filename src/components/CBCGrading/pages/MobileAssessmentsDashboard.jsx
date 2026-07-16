import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle,
  ClipboardList,
  FileText,
  Heart,
  PenLine,
  Settings,
  ShieldCheck,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { dashboardAPI } from '../../../services/api';
import { getCurrentAcademicYear, getCurrentTerm } from '../utils/academicYear';
import { getLearnerGrade, getLearnerStream, groupLearners, uniqueCount } from './academic-intelligence/SimpleTablePage';

const TERM_LABELS = {
  TERM_1: 'Term 1',
  TERM_2: 'Term 2',
  TERM_3: 'Term 3',
};

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

const getTermLabel = (term) => TERM_LABELS[term] || String(term || '').replace(/_/g, ' ') || 'Current Term';
const formatPercent = (value) => `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`;

const ProgressBar = ({ value = 0, tone = 'bg-violet-600' }) => (
  <div className="h-2 w-full rounded-full bg-slate-100">
    <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

const StatCard = ({ icon: Icon, label, value, helper, color, bg, progress, tone, gradient = 'from-slate-100 to-slate-200' }) => (
  <div className={`min-h-[112px] flex rounded-lg p-[1px] bg-gradient-to-br ${gradient} shadow-sm transition-all duration-300 hover:shadow-md`}>
    <div className="w-full min-h-[110px] rounded-[7px] bg-white p-4 flex flex-col justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: bg }}>
          <Icon size={24} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-slate-950">{value}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p>
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <ProgressBar value={progress} tone={tone} />
        </div>
      )}
    </div>
  </div>
);

const ActionTile = ({ icon: Icon, label, helper, tone, onClick, gradient = 'from-slate-100 to-slate-200' }) => (
  <div className={`min-h-[96px] flex rounded-lg p-[1px] bg-gradient-to-br ${gradient} shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}>
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full min-h-[94px] items-center gap-3 rounded-[7px] bg-white p-4 text-left"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={22} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-950">{label}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
      </div>
      <ArrowRight size={18} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" />
    </button>
  </div>
);

const SectionHeader = ({ title, helper, action }) => (
  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-base font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
    {action}
  </div>
);

const EmptyState = ({ title, helper, icon: Icon = ClipboardList }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
      <Icon size={28} />
    </div>
    <p className="text-sm font-black text-slate-950">{title}</p>
    <p className="mt-1 max-w-[260px] text-xs font-semibold text-slate-500">{helper}</p>
  </div>
);

const ReadinessDonut = ({ ready = 0, pending = 0, rate = 0 }) => (
  <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
    <div
      className="relative flex h-40 w-40 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#16a34a 0 ${rate}%, #f97316 ${rate}% 100%)` }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-2xl font-black text-slate-950">{formatPercent(rate)}</span>
        <span className="text-xs font-semibold text-slate-500">Ready</span>
      </div>
    </div>
    <div className="min-w-[170px] space-y-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#16a34a]" /> Report ready</span>
        <span className="font-black text-slate-900">{ready}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#f97316]" /> Still pending</span>
        <span className="font-black text-slate-900">{pending}</span>
      </div>
    </div>
  </div>
);

const GradeReadinessTable = ({ rows = [] }) => {
  if (!rows.length) return <EmptyState title="No grade setup found" helper="Create tests for the selected period to start tracking readiness." icon={BookOpen} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
            <th className="py-2 pr-3">Grade</th>
            <th className="py-2 pr-3">Learners</th>
            <th className="py-2 pr-3">Tests</th>
            <th className="py-2 pr-3">Mark Entry</th>
            <th className="py-2 pr-3">Reports</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr key={row.grade} className="border-b border-slate-50 last:border-0">
              <td className="py-3 pr-3 font-black text-slate-950">{String(row.grade).replace(/_/g, ' ')}</td>
              <td className="py-3 pr-3 font-semibold text-slate-600">{row.learners}</td>
              <td className="py-3 pr-3 font-semibold text-slate-600">{row.tests}</td>
              <td className="min-w-[180px] py-3 pr-3">
                <div className="flex items-center gap-3">
                  <ProgressBar value={row.completionRate} tone={row.pending ? 'bg-orange-500' : 'bg-emerald-600'} />
                  <span className="w-12 text-right font-black text-slate-700">{formatPercent(row.completionRate)}</span>
                </div>
              </td>
              <td className="py-3 pr-3 font-semibold text-slate-600">{row.reportReadyLearners}/{row.learners}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SubjectBacklog = ({ rows = [] }) => {
  const visible = rows.filter((row) => row.expected > 0).slice(0, 6);
  if (!visible.length) return <EmptyState title="No subject backlog" helper="There are no configured subject tests for this selection yet." icon={ClipboardList} />;

  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <div key={row.subject} className="rounded-lg border border-slate-100 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{row.subject}</p>
              <p className="text-xs font-semibold text-slate-500">{row.tests} test{row.tests === 1 ? '' : 's'} - {row.pending} pending entries</p>
            </div>
            <span className="text-sm font-black text-slate-900">{formatPercent(row.completionRate)}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={row.completionRate} tone={row.pending ? 'bg-orange-500' : 'bg-emerald-600'} />
          </div>
        </div>
      ))}
    </div>
  );
};

const MobileAssessmentsDashboard = ({ learners = [], onNavigate }) => {
  const [filters, setFilters] = useState({
    academicYear: getCurrentAcademicYear(),
    term: getCurrentTerm(),
    testType: 'all',
  });
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fallback = useMemo(() => {
    const learnerList = Array.isArray(learners) ? learners : [];
    const grades = groupLearners(learnerList, getLearnerGrade);
    const streams = uniqueCount(learnerList.map(getLearnerStream));
    return { learners: learnerList.length, grades: grades.length, streams };
  }, [learners]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardAPI.getAssessmentOperations(filters);
      setDashboard(response?.data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load assessment dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.academicYear, filters.term, filters.testType]);

  const summary = dashboard?.summary || {};
  const go = (page) => () => onNavigate?.(page);

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[var(--app-page-bg)] p-3 md:p-5">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-950">
              <span>Assessment</span>
              <span className="font-black">-</span>
              <span className="font-black uppercase tracking-[0.12em] text-indigo-800">Report Readiness</span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">Live mark-entry completion, missing results, and report readiness for the selected period.</p>
          </div>
          <div className="flex min-w-max flex-wrap items-center gap-3">
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select
                aria-label="Academic year"
                className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none"
                value={filters.academicYear}
                onChange={(event) => setFilters((current) => ({ ...current, academicYear: Number(event.target.value) }))}
              >
                {[filters.academicYear, filters.academicYear - 1, filters.academicYear + 1].filter(Boolean).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select
                aria-label="Term"
                className="min-w-[126px] bg-transparent text-sm font-semibold text-slate-950 outline-none"
                value={filters.term}
                onChange={(event) => setFilters((current) => ({ ...current, term: event.target.value }))}
              >
                {Object.entries(TERM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex h-11 items-center border border-slate-300 bg-white px-4">
              <select
                aria-label="Exam type"
                className="min-w-[150px] bg-transparent text-sm font-semibold text-slate-950 outline-none"
                value={filters.testType}
                onChange={(event) => setFilters((current) => ({ ...current, testType: event.target.value }))}
              >
                {EXAM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Learners in Scope" value={summary.learners ?? fallback.learners} helper={`${fallback.grades} grades - ${fallback.streams} streams`} color="#7c3aed" bg="#f1e9ff" gradient="from-violet-500/30 via-indigo-500/15 to-purple-500/30" />
          <StatCard icon={BookOpen} label="Tests Configured" value={summary.tests ?? 0} helper={`${summary.subjects ?? 0} learning areas`} color="#3678f5" bg="#e8f0ff" gradient="from-blue-500/30 via-indigo-500/15 to-cyan-500/30" />
          <StatCard icon={ClipboardList} label="Mark Entry" value={formatPercent(summary.markEntryCompletionRate)} helper={`${summary.accountedEntries ?? 0}/${summary.expectedEntries ?? 0} entries accounted`} color="#16a34a" bg="#e7f8ee" progress={summary.markEntryCompletionRate || 0} tone="bg-emerald-600" gradient="from-emerald-500/30 via-teal-500/15 to-green-500/30" />
          <StatCard icon={FileText} label="Report Ready" value={formatPercent(summary.reportReadyRate)} helper={`${summary.reportReadyLearners ?? 0} learners ready`} color="#f97316" bg="#fff1e7" progress={summary.reportReadyRate || 0} tone="bg-orange-500" gradient="from-orange-500/30 via-amber-500/15 to-yellow-500/30" />
        </section>

        {loading && (
          <div className="rounded-lg border border-slate-100 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">Loading live assessment metrics...</div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionTile icon={PenLine} label="Record Summative" helper="Enter learner scores by class and subject." tone="bg-blue-50 text-blue-700" onClick={go('assess-summative-assessment')} gradient="from-blue-500/20 to-indigo-600/20 hover:from-blue-500/50 hover:to-indigo-600/50" />
          <ActionTile icon={CheckCircle} label="Record Formative" helper="Capture continuous classroom assessment." tone="bg-emerald-50 text-emerald-700" onClick={go('assess-formative')} gradient="from-emerald-500/20 to-green-600/20 hover:from-emerald-500/50 hover:to-green-600/50" />
          <ActionTile icon={FileText} label="Assessment Matrix" helper="Review completion and report readiness." tone="bg-orange-50 text-orange-700" onClick={go('assess-summary-report')} gradient="from-orange-500/20 to-amber-600/20 hover:from-orange-500/50 hover:to-amber-600/50" />
          <ActionTile icon={Star} label="Core Competencies" helper="Assess CBC competency development." tone="bg-yellow-50 text-yellow-700" onClick={go('assess-core-competencies')} gradient="from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/50 hover:to-amber-500/50" />
          <ActionTile icon={Heart} label="National Values" helper="Record values and conduct development." tone="bg-rose-50 text-rose-700" onClick={go('assess-values')} gradient="from-rose-500/20 to-pink-600/20 hover:from-rose-500/50 hover:to-pink-600/50" />
          <ActionTile icon={Target} label="Summative Tests" helper="Create and manage exams or tests." tone="bg-violet-50 text-violet-700" onClick={go('assess-summative-tests')} gradient="from-violet-500/20 to-purple-600/20 hover:from-violet-500/50 hover:to-purple-600/50" />
          <ActionTile icon={Settings} label="Learning Areas" helper="Manage subjects and learning areas." tone="bg-slate-100 text-slate-700" onClick={go('assess-learning-areas')} gradient="from-slate-300/20 to-slate-400/20 hover:from-slate-400/50 hover:to-slate-500/50" />
          <ActionTile icon={ShieldCheck} label="Performance Scales" helper="Manage grading rubrics and levels." tone="bg-teal-50 text-teal-700" onClick={go('assess-performance-scale')} gradient="from-teal-500/20 to-emerald-600/20 hover:from-teal-500/50 hover:to-emerald-600/50" />
        </section>
      </div>
    </div>
  );
};

export default MobileAssessmentsDashboard;
