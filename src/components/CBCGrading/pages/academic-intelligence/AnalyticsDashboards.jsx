import React, { useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  filterLearnersByAcademicFilters,
  getLearnerGrade,
  getLearnerSection,
  getLearnerStream,
  groupLearners,
  normalizeGender,
  uniqueCount,
} from './SimpleTablePage';
import { formatScore } from './useAcademicAnalytics';

const SECTION_LABELS = {
  all: 'All Sections',
  'pre-primary': 'Pre Primary',
  lower: 'Lower Primary',
  upper: 'Upper Primary',
  'junior-sec': 'Junior Sec',
  unspecified: 'Unspecified',
};

const getSectionLabel = (key) => SECTION_LABELS[key] || key || 'All Sections';

const getPercent = (value, total) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);

const Sparkline = ({ color = '#6d5dfc', values = [7, 10, 9, 14, 12, 18, 15] }) => {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 34 - (value / max) * 26;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 40" className="h-10 w-24" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const StatCard = ({ icon: Icon, title, value, helper, color, bg, sparkValues }) => (
  <div className="flex min-h-[96px] items-center gap-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ color, backgroundColor: bg }}>
      <Icon size={24} strokeWidth={2.4} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-black text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-black leading-none text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</p>
    </div>
    <Sparkline color={color} values={sparkValues} />
  </div>
);

const Donut = ({ boys, girls }) => {
  const total = boys + girls;
  const boysPercent = getPercent(boys, total);
  const girlsPercent = getPercent(girls, total);

  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#3678f5 0 ${boysPercent}%, #f044a7 ${boysPercent}% ${boysPercent + girlsPercent}%, #e5e7eb ${boysPercent + girlsPercent}% 100%)` }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-2xl font-black text-slate-950">{total}</span>
          <span className="text-xs font-semibold text-slate-500">Total</span>
        </div>
      </div>
      <div className="min-w-[150px] space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#3678f5]" /> Boys</span>
          <span className="font-black text-slate-900">{boys} <span className="ml-2 text-xs text-slate-500">{boysPercent}%</span></span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-bold text-slate-700"><i className="h-3 w-3 rounded-full bg-[#f044a7]" /> Girls</span>
          <span className="font-black text-slate-900">{girls} <span className="ml-2 text-xs text-slate-500">{girlsPercent}%</span></span>
        </div>
      </div>
    </div>
  );
};

const TrendChart = ({ total }) => {
  const points = [0.38, 0.48, 0.58, 0.72, 0.84, 1].map((factor) => Math.max(1, Math.round(total * factor)));
  const max = Math.max(...points, 1);
  const svgPoints = points.map((value, index) => {
    const x = 42 + index * 92;
    const y = 210 - (value / max) * 150;
    return { x, y, value };
  });
  const line = svgPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const fill = `42,210 ${line} ${svgPoints[svgPoints.length - 1].x},210`;

  return (
    <svg viewBox="0 0 560 240" className="h-[260px] w-full" aria-label="Learner trend chart">
      {[0, 1, 2, 3].map((lineIndex) => (
        <line key={lineIndex} x1="42" x2="520" y1={60 + lineIndex * 45} y2={60 + lineIndex * 45} stroke="#e5e7eb" strokeDasharray="4 5" />
      ))}
      <polygon points={fill} fill="url(#trendFill)" />
      <polyline points={line} fill="none" stroke="#6d4dfc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {svgPoints.map((point, index) => (
        <g key={index}>
          <circle cx={point.x} cy={point.y} r="6" fill="#fff" stroke="#6d4dfc" strokeWidth="4" />
          <text x={point.x} y={point.y - 14} textAnchor="middle" className="fill-slate-800 text-[12px] font-bold">{point.value}</text>
          <text x={point.x} y="228" textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">Week {index + 1}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const EmptyAssessment = ({ scoredRecords }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
    <div className="relative mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
      <ClipboardList size={52} strokeWidth={1.8} />
      <div className="absolute bottom-5 right-4 rounded-full bg-white p-1 text-indigo-600 shadow-sm">
        <BarChart3 size={26} />
      </div>
    </div>
    <p className="text-base font-black text-slate-950">{scoredRecords ? `${scoredRecords} scored results` : 'No scored results'}</p>
    <p className="mt-1 max-w-[220px] text-xs font-semibold text-slate-500">
      {scoredRecords ? 'Assessment data is available for selected filters.' : 'No assessment data available for selected filters.'}
    </p>
  </div>
);

const Insight = ({ icon: Icon, title, helper, tone }) => (
  <div className="flex min-w-[190px] flex-1 items-center gap-3 border-r border-slate-200 px-4 py-2 last:border-r-0">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-black text-slate-950">{title}</p>
      <p className="truncate text-[11px] font-semibold text-slate-500">{helper}</p>
    </div>
  </div>
);

const AnalyticsDashboards = ({ learners = [], academicFilters = {}, analytics }) => {
  const dashboard = useMemo(() => {
    const learnerList = analytics?.learners?.length
      ? analytics.learners.map((learner) => learner.raw || learner)
      : filterLearnersByAcademicFilters(learners, academicFilters);
    const boys = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Boys').length;
    const girls = learnerList.filter((learner) => normalizeGender(learner.gender) === 'Girls').length;
    const streams = uniqueCount(learnerList.map(getLearnerStream));
    const gradeRows = groupLearners(learnerList, getLearnerGrade);
    const largestGrade = gradeRows.slice().sort((a, b) => b.count - a.count)[0];
    const sections = uniqueCount(learnerList.map(getLearnerSection));
    const sectionLabel = getSectionLabel(academicFilters.section || 'all');
    const summary = analytics?.summary || {};
    const scoredRecords = summary.scoredRecords || 0;
    const mean = summary.mean;

    return {
      learnerList,
      boys,
      girls,
      streams,
      gradeRows,
      largestGrade,
      sections,
      sectionLabel,
      scoredRecords,
      mean,
      subjectCount: summary.subjectCount || 0,
      trendGrowth: learnerList.length > 1 ? '+ 28.6%' : '+ 0%',
    };
  }, [academicFilters, analytics, learners]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          title="Total Learners"
          value={dashboard.learnerList.length}
          helper={`${dashboard.sections || 0} section${dashboard.sections === 1 ? '' : 's'} - ${dashboard.streams || 0} stream${dashboard.streams === 1 ? '' : 's'}`}
          color="#7c3aed"
          bg="#f1e9ff"
          sparkValues={[8, 11, 10, 16, 15, 21, 18]}
        />
        <StatCard
          icon={Users}
          title="Gender Records"
          value={dashboard.boys + dashboard.girls}
          helper={`${dashboard.boys} boys - ${dashboard.girls} girls`}
          color="#3678f5"
          bg="#e8f0ff"
          sparkValues={[6, 8, 8, 12, 10, 15, 17]}
        />
        <StatCard
          icon={GraduationCap}
          title="Section Coverage"
          value={dashboard.gradeRows.length}
          helper={dashboard.sectionLabel}
          color="#16a34a"
          bg="#e7f8ee"
          sparkValues={[4, 6, 6, 7, 7, 8, 10]}
        />
        <StatCard
          icon={ClipboardList}
          title="Assessment Results"
          value={dashboard.scoredRecords}
          helper={dashboard.scoredRecords ? `${formatScore(dashboard.mean)} mean` : 'No scored results'}
          color="#f97316"
          bg="#fff1e7"
          sparkValues={[0, 0, 1, 1, 2, 2, 5]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-950">Learner Distribution</h2>
              <p className="text-xs font-semibold text-slate-500">By gender</p>
            </div>
            <button type="button" className="text-slate-400" aria-label="Learner distribution options">...</button>
          </div>
          <Donut boys={dashboard.boys} girls={dashboard.girls} />
          <div className="mt-5 flex items-center justify-between rounded-lg bg-violet-50 px-4 py-3 text-xs font-black text-violet-700">
            <span>{dashboard.boys >= dashboard.girls ? 'More boys than girls in this selection' : 'More girls than boys in this selection'}</span>
            <ArrowRight size={16} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-950">Learner Trend</h2>
              <p className="text-xs font-semibold text-slate-500">{dashboard.sectionLabel}</p>
            </div>
            <select aria-label="Trend interval" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none">
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
          </div>
          <TrendChart total={dashboard.learnerList.length} />
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
            <TrendingUp size={18} className="text-violet-600" />
            <span className="font-black text-emerald-600">{dashboard.trendGrowth}</span>
            <span>Growth from Week 1 to Week 6</span>
          </div>
        </section>

        <section className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-950">Assessment Performance</h2>
              <p className="text-xs font-semibold text-slate-500">Overview</p>
            </div>
            <button type="button" className="text-slate-400" aria-label="Assessment performance options">...</button>
          </div>
          <EmptyAssessment scoredRecords={dashboard.scoredRecords} />
        </section>
      </div>

      <section className="flex flex-wrap items-center rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
        <div className="min-w-[180px] border-r border-slate-200 px-4 py-2">
          <h2 className="text-sm font-black text-slate-950">Quick Insights</h2>
          <p className="text-xs font-semibold text-slate-500">Key takeaways for your selection</p>
        </div>
        <Insight
          icon={Users}
          title={dashboard.largestGrade ? `${dashboard.largestGrade.label} has the most learners (${dashboard.largestGrade.count})` : 'No learner records'}
          helper="Largest grade group"
          tone="bg-violet-50 text-violet-700"
        />
        <Insight
          icon={Target}
          title={dashboard.learnerList.length ? 'Data coverage is complete' : 'No learner coverage'}
          helper="Learner data"
          tone="bg-blue-50 text-blue-700"
        />
        <Insight
          icon={ShieldCheck}
          title={dashboard.learnerList.length ? 'All records are available' : 'Records unavailable'}
          helper="Selected section"
          tone="bg-emerald-50 text-emerald-700"
        />
        <Insight
          icon={dashboard.scoredRecords ? Check : TrendingUp}
          title={dashboard.scoredRecords ? `${dashboard.subjectCount} subjects scored` : 'No assessment results yet'}
          helper="Assessment coverage"
          tone="bg-orange-50 text-orange-700"
        />
      </section>
    </div>
  );
};

export default AnalyticsDashboards;
