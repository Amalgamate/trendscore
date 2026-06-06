import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, GraduationCap, LineChart, Target, TrendingUp, Users } from 'lucide-react';
import { assessmentAPI } from '../../../../services/api';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.tests)) return value.tests;
  return [];
};

const getTestId = (test) => test?.id || test?._id || test?.testId;
const getResultTestId = (result) => result?.testId || result?.test?.id || result?.assessmentTestId;
const getResultLearnerId = (result) => result?.learnerId || result?.learner?.id || result?.studentId;
const getSubjectName = (test) => test?.learningArea || test?.learningAreaName || test?.subject || test?.subjectName || test?.name || 'Unspecified subject';
const getTestDate = (test) => test?.assessmentDate || test?.date || test?.testDate || test?.createdAt;

const getScorePercent = (result, test) => {
  const explicitPercent = Number(result?.percentage ?? result?.percent ?? result?.scorePercent);
  if (Number.isFinite(explicitPercent)) return explicitPercent;
  const score = Number(result?.score ?? result?.marks ?? result?.mark ?? result?.obtainedMarks);
  const total = Number(result?.totalMarks ?? result?.maxMarks ?? test?.totalMarks ?? test?.maxMarks);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) return (score / total) * 100;
  return null;
};

const aggregateTrend = (records, getLabel) => {
  const grouped = new Map();
  records.forEach((record) => {
    const label = getLabel(record);
    if (!label) return;
    if (!grouped.has(label)) grouped.set(label, { label, total: 0, count: 0 });
    const bucket = grouped.get(label);
    bucket.total += record.percent;
    bucket.count += 1;
  });
  return [...grouped.values()]
    .map((bucket) => ({ ...bucket, average: bucket.count ? Math.round(bucket.total / bucket.count) : null }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const aggregateRows = (records, getLabel) => {
  const grouped = new Map();
  records.forEach((record) => {
    const label = getLabel(record) || 'Unspecified';
    if (!grouped.has(label)) grouped.set(label, { label, first: null, last: null, total: 0, count: 0 });
    const bucket = grouped.get(label);
    bucket.total += record.percent;
    bucket.count += 1;
    if (!bucket.first || record.period < bucket.first.period) bucket.first = record;
    if (!bucket.last || record.period > bucket.last.period) bucket.last = record;
  });
  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      average: bucket.count ? Math.round(bucket.total / bucket.count) : null,
      change: bucket.first && bucket.last ? Math.round(bucket.last.percent - bucket.first.percent) : null,
    }))
    .sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
    <p className="text-sm font-extrabold text-slate-500">{title}</p>
    <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>
  </div>
);

const Card = ({ icon: Icon, label, value, helper, tone = 'indigo' }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.indigo}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
  );
};

const Panel = ({ icon: Icon, title, description, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const TrendList = ({ rows, emptyTitle, emptyDescription }) => {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const max = Math.max(...rows.map((row) => row.average || 0), 100);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span className="truncate">{row.label}</span>
            <span>{row.average === null ? 'No score' : `${row.average}%`}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.average ? Math.max(6, (row.average / max) * 100) : 0}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.count} records</p>
        </div>
      ))}
    </div>
  );
};

const ChangeList = ({ rows, emptyTitle, emptyDescription }) => {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-800">{row.label}</p>
            <p className="text-xs font-semibold text-slate-400">{row.count} result records</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {row.change === null ? 'No trend' : `${row.change >= 0 ? '+' : ''}${row.change}%`}
          </span>
        </div>
      ))}
    </div>
  );
};

const GrowthTrends = ({ learners = [] }) => {
  const [filters, setFilters] = useState({ grade: 'all', stream: 'all', subject: 'all' });
  const [state, setState] = useState({ loading: true, tests: [], results: [], error: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const tests = toArray(await assessmentAPI.getTests());
        const resultGroups = await Promise.all(tests.slice(0, 35).map(async (test) => {
          const testId = getTestId(test);
          if (!testId) return [];
          try {
            return toArray(await assessmentAPI.getTestResults(testId));
          } catch {
            return [];
          }
        }));
        if (!cancelled) setState({ loading: false, tests, results: resultGroups.flat(), error: null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, tests: [], results: [], error: error?.message || 'Assessment data is unavailable.' });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const grades = [...new Set(learners.map((learner) => learner.grade).filter(Boolean))].sort();
    const streams = [...new Set(learners.map((learner) => learner.stream || learner.className).filter(Boolean))].sort();
    const subjects = [...new Set(state.tests.map(getSubjectName).filter(Boolean))].sort();
    return { grades, streams, subjects };
  }, [learners, state.tests]);

  const analytics = useMemo(() => {
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
    const testMap = new Map(state.tests.map((test) => [getTestId(test), test]));
    const records = state.results.map((result) => {
      const test = testMap.get(getResultTestId(result));
      const learner = learnerMap.get(getResultLearnerId(result));
      const percent = getScorePercent(result, test);
      const rawDate = getTestDate(test);
      const date = rawDate ? new Date(rawDate) : null;
      if (!test || !learner || percent === null || !date || Number.isNaN(date.getTime())) return null;
      return {
        learner,
        test,
        percent,
        subject: getSubjectName(test),
        grade: learner.grade || test.grade || 'Unspecified grade',
        stream: learner.stream || learner.className || test.stream || 'Unspecified stream',
        period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      };
    }).filter(Boolean).filter((record) => (
      (filters.grade === 'all' || record.grade === filters.grade)
      && (filters.stream === 'all' || record.stream === filters.stream)
      && (filters.subject === 'all' || record.subject === filters.subject)
    ));

    const overallTrend = aggregateTrend(records, (record) => record.period).slice(-8);
    const first = overallTrend[0];
    const last = overallTrend[overallTrend.length - 1];
    const overallChange = first && last ? last.average - first.average : null;
    const subjectRows = aggregateRows(records, (record) => record.subject).slice(0, 6);
    const gradeRows = aggregateRows(records, (record) => record.grade).slice(0, 6);
    const streamRows = aggregateRows(records, (record) => record.stream).slice(0, 6);
    const cohortRows = aggregateRows(records, (record) => `${record.grade} / ${record.stream}`).slice(0, 8);
    const declineAlerts = [...subjectRows, ...gradeRows, ...streamRows]
      .filter((row) => row.change !== null && row.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 6);

    return {
      records,
      overallTrend,
      overallChange,
      subjectRows,
      gradeRows,
      streamRows,
      cohortRows,
      declineAlerts,
      assessedLearners: new Set(records.map((record) => record.learner.id)).size,
      periods: new Set(records.map((record) => record.period)).size,
      currentMean: last?.average ?? null,
    };
  }, [filters, learners, state.results, state.tests]);

  const kpis = [
    { label: 'Current Mean', value: analytics.currentMean === null ? 'No score' : `${analytics.currentMean}%`, helper: 'Latest dated assessment period.', icon: BarChart3, tone: 'indigo' },
    { label: 'Overall Growth', value: analytics.overallChange === null ? 'No trend' : `${analytics.overallChange >= 0 ? '+' : ''}${analytics.overallChange}%`, helper: 'First to latest period in scope.', icon: TrendingUp, tone: analytics.overallChange >= 0 ? 'emerald' : 'rose' },
    { label: 'Assessed Learners', value: analytics.assessedLearners, helper: 'Unique learners in dated records.', icon: Users, tone: 'amber' },
    { label: 'Periods Covered', value: analytics.periods, helper: 'Distinct assessment months loaded.', icon: LineChart, tone: 'indigo' },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Filter size={19} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Growth filters</h2>
            <p className="text-sm font-medium text-slate-500">Filter growth trends by grade, stream and subject.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={filters.grade} onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All grades</option>
            {options.grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={filters.stream} onChange={(event) => setFilters((current) => ({ ...current, stream: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All streams</option>
            {options.streams.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
          </select>
          <select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All subjects</option>
            {options.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
        </div>
        {state.error && <p className="mt-3 text-sm font-bold text-rose-600">{state.error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <Card key={kpi.label} {...kpi} />)}
      </div>

      <Panel icon={LineChart} title="Overall Mean Trend" description="Monthly mean movement from dated assessment records.">
        {state.loading ? <EmptyState title="Loading trend data" description="Assessment records are being loaded." /> : <TrendList rows={analytics.overallTrend} emptyTitle="No overall trend available" emptyDescription="Overall trend needs dated assessment records." />}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel icon={BarChart3} title="Subject Trends" description="Subject-level growth or decline.">
          <ChangeList rows={analytics.subjectRows} emptyTitle="No subject trends available" emptyDescription="Subject trends need dated subject result records." />
        </Panel>
        <Panel icon={GraduationCap} title="Grade Trends" description="Grade-level growth or decline.">
          <ChangeList rows={analytics.gradeRows} emptyTitle="No grade trends available" emptyDescription="Grade trends need learner grade metadata." />
        </Panel>
        <Panel icon={Target} title="Stream Trends" description="Stream-level growth or decline.">
          <ChangeList rows={analytics.streamRows} emptyTitle="No stream trends available" emptyDescription="Stream trends need learner stream metadata." />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={Users} title="Cohort Growth" description="Grade and stream cohort growth movement.">
          <ChangeList rows={analytics.cohortRows} emptyTitle="No cohort growth available" emptyDescription="Cohort growth needs grade and stream metadata." />
        </Panel>
        <Panel icon={AlertTriangle} title="Decline Alerts" description="Areas with negative movement between first and latest dated record.">
          <ChangeList rows={analytics.declineAlerts} emptyTitle="No decline alerts" emptyDescription="No negative movement was detected in available trend records." />
        </Panel>
      </div>
    </div>
  );
};

export default GrowthTrends;
