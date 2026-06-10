import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardList,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { dashboardAPI } from '../../../../services/api';
import {
  filterLearnersByAcademicFilters,
  getLearnerGrade,
  getLearnerSection,
  getLearnerStream,
  groupLearners,
  normalizeGender,
  uniqueCount,
} from './SimpleTablePage';

const SECTION_LABELS = {
  all: 'All Sections',
  'pre-primary': 'Pre Primary',
  lower: 'Lower Primary',
  upper: 'Upper Primary',
  'junior-sec': 'Junior Sec',
  unspecified: 'Unspecified',
};

const getSectionLabel = (key) => SECTION_LABELS[key] || key || 'All Sections';
const formatPercent = (value) => `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`;
const formatScore = (value) => (value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(1)}%`);

const ProgressBar = ({ value = 0, tone = 'bg-violet-600', track = 'bg-slate-100' }) => (
  <div className={`h-2 w-full rounded-full ${track}`}>
    <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
  </div>
);

const StatCard = ({ icon: Icon, title, value, helper, cardClass, progress, tone }) => (
  <div className={`relative min-h-[128px] overflow-hidden p-5 text-white shadow-sm ${cardClass}`}>
    <div className="relative z-10 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.18em] text-white/70">{title}</p>
        <p className="mt-3 text-4xl font-black leading-none tracking-tight text-white">{value}</p>
        <p className="mt-2 truncate text-[11px] font-semibold leading-snug text-white/70">{helper}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/30 bg-white/20 text-white/90">
        <Icon size={19} strokeWidth={2.4} />
      </div>
    </div>
    {progress !== undefined && (
      <div className="relative z-10 mt-5">
        <ProgressBar value={progress} tone={tone} track="bg-white/25" />
      </div>
    )}
    <div className="pointer-events-none absolute -bottom-5 -right-5 text-white/10">
      <Icon size={96} strokeWidth={1} />
    </div>
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

const Insight = ({ icon: Icon, title, helper, tone }) => (
  <div className="flex min-w-[210px] flex-1 items-center gap-3 border-r border-slate-200 px-4 py-2 last:border-r-0">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs font-black text-slate-950">{title}</p>
      <p className="truncate text-[11px] font-semibold text-slate-500">{helper}</p>
    </div>
  </div>
);

const StreamPerformance = ({ rows = [] }) => {
  const visible = rows.filter((row) => row.learners > 0).slice(0, 7);
  if (!visible.length) return <EmptyState title="No stream performance yet" helper="Scores will appear here once marks are entered." icon={BarChart3} />;

  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-100 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{row.label}</p>
              <p className="text-xs font-semibold text-slate-500">{row.learners} learners - {row.atRisk} need attention</p>
            </div>
            <span className="text-sm font-black text-slate-900">{formatScore(row.mean)}</span>
          </div>
          <ProgressBar value={row.mean || 0} tone={(row.mean || 0) >= 60 ? 'bg-emerald-600' : (row.mean || 0) >= 50 ? 'bg-blue-600' : 'bg-orange-500'} />
        </div>
      ))}
    </div>
  );
};

const SubjectTable = ({ rows = [] }) => {
  const visible = rows.filter((row) => row.scored > 0 || row.expected > 0).slice(0, 8);
  if (!visible.length) return <EmptyState title="No subject evidence" helper="Create tests and record marks to compare learning areas." icon={ClipboardList} />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
            <th className="py-2 pr-3">Subject</th>
            <th className="py-2 pr-3">Mean</th>
            <th className="py-2 pr-3">Scored</th>
            <th className="py-2 pr-3">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.subject} className="border-b border-slate-50 last:border-0">
              <td className="max-w-[220px] truncate py-3 pr-3 font-black text-slate-950">{row.subject}</td>
              <td className="py-3 pr-3 font-semibold text-slate-700">{formatScore(row.mean)}</td>
              <td className="py-3 pr-3 font-semibold text-slate-600">{row.scored}/{row.expected}</td>
              <td className="min-w-[170px] py-3 pr-3">
                <div className="flex items-center gap-3">
                  <ProgressBar value={row.completionRate} tone={row.pending ? 'bg-orange-500' : 'bg-emerald-600'} />
                  <span className="w-12 text-right font-black text-slate-700">{formatPercent(row.completionRate)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AchievementDistribution = ({ rows = [] }) => {
  if (!rows.length) return <EmptyState title="No achievement bands" helper="Bands appear after scored records are available." icon={Target} />;

  return (
    <div className="space-y-3">
      {rows.slice(0, 7).map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="font-black text-slate-900">{row.label}</span>
            <span className="font-semibold text-slate-500">{row.count} records</span>
          </div>
          <ProgressBar value={row.rate} tone="bg-violet-600" />
        </div>
      ))}
    </div>
  );
};

const AtRiskLearners = ({ rows = [] }) => {
  if (!rows.length) return <EmptyState title="No risk list for this view" helper="Learners with low means or missing entries will appear here." icon={ShieldCheck} />;

  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((row) => (
        <div key={row.learnerId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-slate-950">{row.name}</p>
            <p className="text-[11px] font-semibold text-slate-500">{row.grade} {row.stream || ''} - {row.admissionNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-slate-900">{formatScore(row.mean)}</p>
            <p className="text-[11px] font-semibold text-orange-600">{row.missing} missing</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const AnalyticsDashboards = ({ learners = [], academicFilters = {}, analytics }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const queryFilters = useMemo(() => ({
    academicYear: academicFilters.academicYear,
    term: academicFilters.term,
    section: academicFilters.section,
    grade: academicFilters.grade,
    stream: academicFilters.stream,
    testType: academicFilters.testType,
  }), [academicFilters]);

  const fallback = useMemo(() => {
    const learnerList = analytics?.learners?.length
      ? analytics.learners.map((learner) => learner.raw || learner)
      : filterLearnersByAcademicFilters(learners, academicFilters);
    const boys = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Boys').length;
    const girls = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Girls').length;
    const streams = uniqueCount(learnerList.map(getLearnerStream));
    const gradeRows = groupLearners(learnerList, getLearnerGrade);
    const sections = uniqueCount(learnerList.map(getLearnerSection));

    return {
      learnerList,
      boys,
      girls,
      streams,
      gradeRows,
      sections,
      largestGrade: gradeRows.slice().sort((a, b) => b.count - a.count)[0],
      summary: analytics?.summary || {},
    };
  }, [academicFilters, analytics, learners]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardAPI.getAcademicIntelligence(queryFilters);
      setDashboard(response?.data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load academic intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters.academicYear, queryFilters.term, queryFilters.section, queryFilters.grade, queryFilters.stream, queryFilters.testType]);

  const summary = dashboard?.summary || {};
  const scoredRecords = summary.scoredEntries ?? fallback.summary.scoredRecords ?? 0;
  const mean = summary.mean ?? fallback.summary.mean;
  const subjectRows = dashboard?.subjectRows || [];
  const streamRows = dashboard?.streamRows || [];
  const achievementRows = dashboard?.achievementRows || [];
  const atRiskRows = dashboard?.atRiskLearners || [];
  const sectionLabel = getSectionLabel(academicFilters.section || 'all');
  const highestSubject = summary.highestSubject;
  const lowestSubject = summary.lowestSubject;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-sm font-black text-slate-950">Reports & Growth Overview</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Performance, coverage, achievement bands, and learner risk from scored report data.</p>
        </div>
        <button type="button" onClick={loadDashboard} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:border-violet-300 hover:text-violet-700">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          title="Learners in Scope"
          value={summary.learners ?? fallback.learnerList.length}
          helper={`${fallback.sections || 0} sections - ${fallback.streams || 0} streams`}
          cardClass="bg-[#172554]"
        />
        <StatCard
          icon={BarChart3}
          title="Mean Score"
          value={formatScore(mean)}
          helper={`${scoredRecords} scored records`}
          cardClass="bg-[#0F766E]"
          progress={mean || 0}
          tone="bg-white"
        />
        <StatCard
          icon={GraduationCap}
          title="Subject Coverage"
          value={summary.subjects ?? fallback.summary.subjectCount ?? 0}
          helper={`${summary.tests ?? 0} tests configured`}
          cardClass="bg-[#1B5E20]"
        />
        <StatCard
          icon={Target}
          title="Learners Needing Attention"
          value={summary.atRiskLearners ?? atRiskRows.length}
          helper={`${summary.pendingEntries ?? 0} missing result entries`}
          cardClass="bg-[#C2410C]"
          progress={summary.markEntryCompletionRate || 0}
          tone="bg-white"
        />
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-100 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">Loading live academic intelligence...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr_1fr]">
          <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader title="Stream Performance" helper={sectionLabel} />
            <StreamPerformance rows={streamRows} />
          </section>

          <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader title="Subject Performance" helper="Mean score and report coverage by learning area." />
            <SubjectTable rows={subjectRows} />
          </section>

          <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <SectionHeader title="Achievement Distribution" helper={`${scoredRecords} scored records`} />
            <AchievementDistribution rows={achievementRows} />
          </section>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <SectionHeader title="Learners to Review" helper="Low mean scores or incomplete report evidence." />
          <AtRiskLearners rows={atRiskRows} />
        </section>

        <section className="flex flex-wrap items-center rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
          <div className="min-w-[180px] border-r border-slate-200 px-4 py-2">
            <h2 className="text-sm font-black text-slate-950">Quick Insights</h2>
            <p className="text-xs font-semibold text-slate-500">Key takeaways for this report view</p>
          </div>
          <Insight
            icon={TrendingUp}
            title={highestSubject ? `${highestSubject.subject} leads at ${formatScore(highestSubject.mean)}` : 'No leading subject yet'}
            helper="Strongest learning area"
            tone="bg-emerald-50 text-emerald-700"
          />
          <Insight
            icon={TrendingDown}
            title={lowestSubject ? `${lowestSubject.subject} needs support at ${formatScore(lowestSubject.mean)}` : 'No weak subject yet'}
            helper="Lowest learning area"
            tone="bg-orange-50 text-orange-700"
          />
          <Insight
            icon={ShieldCheck}
            title={`${formatPercent(summary.reportReadyRate)} report-ready`}
            helper={`${summary.reportReadyLearners ?? 0} learners complete`}
            tone="bg-blue-50 text-blue-700"
          />
          <Insight
            icon={scoredRecords ? Check : ClipboardList}
            title={scoredRecords ? `${scoredRecords} records scored` : 'No scored results yet'}
            helper="Assessment evidence"
            tone="bg-violet-50 text-violet-700"
          />
        </section>
      </div>
    </div>
  );
};

export default AnalyticsDashboards;
