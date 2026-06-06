import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, Grid, LineChart, Search, Target, Trophy, User, Users } from 'lucide-react';
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
const getStrandName = (test, result) => result?.strand || result?.strandName || test?.strand || test?.strandName || test?.topic || 'Unspecified strand';
const getTestDate = (test) => test?.assessmentDate || test?.date || test?.testDate || test?.createdAt;

const getScorePercent = (result, test) => {
  const explicitPercent = Number(result?.percentage ?? result?.percent ?? result?.scorePercent);
  if (Number.isFinite(explicitPercent)) return explicitPercent;
  const score = Number(result?.score ?? result?.marks ?? result?.mark ?? result?.obtainedMarks);
  const total = Number(result?.totalMarks ?? result?.maxMarks ?? test?.totalMarks ?? test?.maxMarks);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) return (score / total) * 100;
  return null;
};

const aggregateRows = (records, getLabel) => {
  const grouped = new Map();
  records.forEach((record) => {
    const label = getLabel(record) || 'Unspecified';
    if (!grouped.has(label)) grouped.set(label, { label, total: 0, count: 0 });
    const bucket = grouped.get(label);
    bucket.total += record.percent;
    bucket.count += 1;
  });
  return [...grouped.values()]
    .map((bucket) => ({ ...bucket, average: bucket.count ? Math.round(bucket.total / bucket.count) : null }))
    .sort((a, b) => (b.average || 0) - (a.average || 0));
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
    <p className="text-sm font-extrabold text-slate-500">{title}</p>
    <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>
  </div>
);

const Card = ({ icon: Icon, label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon size={19} />
      </div>
    </div>
    <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
  </div>
);

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

const BarList = ({ rows, emptyTitle, emptyDescription }) => {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const max = Math.max(...rows.map((row) => row.average || 0), 100);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span className="truncate">{row.label}</span>
            <span>{row.average === null ? 'No score' : `${row.average}%`}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.average ? Math.max(6, (row.average / max) * 100) : 0}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.count} result records</p>
        </div>
      ))}
    </div>
  );
};

const SubjectIntelligence = ({ learners = [] }) => {
  const [filters, setFilters] = useState({ subject: 'all', grade: 'all', stream: 'all' });
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
    const subjects = [...new Set(state.tests.map(getSubjectName).filter(Boolean))].sort();
    const grades = [...new Set(learners.map((learner) => learner.grade).filter(Boolean))].sort();
    const streams = [...new Set(learners.map((learner) => learner.stream || learner.className).filter(Boolean))].sort();
    return { subjects, grades, streams };
  }, [learners, state.tests]);

  const analytics = useMemo(() => {
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
    const testMap = new Map(state.tests.map((test) => [getTestId(test), test]));
    const records = state.results.map((result) => {
      const test = testMap.get(getResultTestId(result));
      const learner = learnerMap.get(getResultLearnerId(result));
      const percent = getScorePercent(result, test);
      if (!test || !learner || percent === null) return null;
      const rawDate = getTestDate(test);
      const date = rawDate ? new Date(rawDate) : null;
      return {
        learner,
        test,
        percent,
        subject: getSubjectName(test),
        strand: getStrandName(test, result),
        grade: learner.grade || test.grade || 'Unspecified grade',
        stream: learner.stream || learner.className || test.stream || 'Unspecified stream',
        gender: learner.gender || learner.sex || 'Unspecified gender',
        period: date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : null,
      };
    }).filter(Boolean).filter((record) => (
      (filters.subject === 'all' || record.subject === filters.subject)
      && (filters.grade === 'all' || record.grade === filters.grade)
      && (filters.stream === 'all' || record.stream === filters.stream)
    ));

    const subjectMean = records.length ? Math.round(records.reduce((sum, item) => sum + item.percent, 0) / records.length) : null;
    const learnerCount = new Set(records.map((record) => record.learner.id)).size;
    const gradeRows = aggregateRows(records, (record) => record.grade);
    const streamRows = aggregateRows(records, (record) => record.stream);
    const genderRows = aggregateRows(records, (record) => record.gender);
    const strandRows = aggregateRows(records, (record) => record.strand);
    const trendRows = aggregateRows(records.filter((record) => record.period), (record) => record.period).sort((a, b) => a.label.localeCompare(b.label)).slice(-6);
    const boys = genderRows.find((row) => /^male|boy/i.test(row.label));
    const girls = genderRows.find((row) => /^female|girl/i.test(row.label));
    const gap = boys?.average !== undefined && girls?.average !== undefined ? Math.abs(boys.average - girls.average) : null;
    const weakestAreas = strandRows.slice().sort((a, b) => (a.average || 0) - (b.average || 0)).slice(0, 4);
    const recommendations = weakestAreas.length
      ? weakestAreas.map((area) => `Review ${area.label}: current average is ${area.average}%.`)
      : ['No strand-level recommendations available until strand result data is present.'];

    return {
      records,
      subjectMean,
      learnerCount,
      gradeRows,
      streamRows,
      genderRows,
      strandRows,
      trendRows,
      boysMean: boys?.average ?? null,
      girlsMean: girls?.average ?? null,
      gap,
      atRisk: records.filter((record) => record.percent < 40).length,
      weakestAreas,
      recommendations,
    };
  }, [filters, learners, state.results, state.tests]);

  const selectedSubjectLabel = filters.subject === 'all' ? 'All subjects' : filters.subject;
  const kpis = [
    { label: 'Subject Mean', value: analytics.subjectMean === null ? 'No score' : `${analytics.subjectMean}%`, helper: selectedSubjectLabel, icon: BarChart3 },
    { label: 'Learners Assessed', value: analytics.learnerCount, helper: 'Unique learners with result records.', icon: Users },
    { label: 'Result Records', value: analytics.records.length, helper: 'Loaded assessment result records.', icon: Target },
    { label: 'Gender Gap', value: analytics.gap === null ? 'No data' : `${analytics.gap}%`, helper: 'Difference between boys and girls mean.', icon: User },
    { label: 'Boys Mean', value: analytics.boysMean === null ? 'No score' : `${analytics.boysMean}%`, helper: 'Uses learner gender records.', icon: User },
    { label: 'Girls Mean', value: analytics.girlsMean === null ? 'No score' : `${analytics.girlsMean}%`, helper: 'Uses learner gender records.', icon: Users },
    { label: 'At Risk', value: analytics.atRisk, helper: 'Result records below 40%.', icon: AlertTriangle },
    { label: 'Weakest Area', value: analytics.weakestAreas[0]?.label || 'No data', helper: 'Lowest strand average.', icon: Trophy },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Filter size={19} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Subject filters</h2>
            <p className="text-sm font-medium text-slate-500">Filter deep subject analytics by subject, grade and stream.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={filters.subject} onChange={(event) => setFilters((current) => ({ ...current, subject: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All subjects</option>
            {options.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          <select value={filters.grade} onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All grades</option>
            {options.grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
          <select value={filters.stream} onChange={(event) => setFilters((current) => ({ ...current, stream: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All streams</option>
            {options.streams.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
          </select>
        </div>
        {state.error && <p className="mt-3 text-sm font-bold text-rose-600">{state.error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <Card key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={User} title="Gender Gap Section" description="Boys and girls mean for the selected subject context.">
          {state.loading ? <EmptyState title="Loading gender data" description="Assessment records are being loaded." /> : <BarList rows={analytics.genderRows} emptyTitle="No gender data available" emptyDescription="Gender comparison needs learner gender and subject result records." />}
        </Panel>
        <Panel icon={BarChart3} title="Grade Comparison" description="Grade-level subject performance.">
          {state.loading ? <EmptyState title="Loading grade data" description="Assessment records are being loaded." /> : <BarList rows={analytics.gradeRows} emptyTitle="No grade data available" emptyDescription="Grade comparison needs subject result records." />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={Grid} title="Stream Comparison" description="Stream-level subject performance.">
          {state.loading ? <EmptyState title="Loading stream data" description="Assessment records are being loaded." /> : <BarList rows={analytics.streamRows} emptyTitle="No stream data available" emptyDescription="Stream comparison needs stream and result records." />}
        </Panel>
        <Panel icon={LineChart} title="Trend Over Time" description="Monthly subject averages from dated tests.">
          {state.loading ? <EmptyState title="Loading trend data" description="Assessment records are being loaded." /> : <BarList rows={analytics.trendRows} emptyTitle="No trend data available" emptyDescription="Trend needs dated subject result records." />}
        </Panel>
      </div>

      <Panel icon={Target} title="Strand Performance" description="Strand and topic performance for the selected subject context.">
        {state.loading ? <EmptyState title="Loading strand data" description="Assessment records are being loaded." /> : <BarList rows={analytics.strandRows} emptyTitle="No strand data available" emptyDescription="Strand performance needs strand or topic fields on tests/results." />}
      </Panel>

      <Panel icon={Search} title="Weakest Areas & Recommendations" description="Lowest-performing strands and deterministic support prompts.">
        {analytics.weakestAreas.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {analytics.weakestAreas.map((area) => (
              <div key={area.label} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <p className="text-sm font-extrabold">{area.label}</p>
                <p className="mt-1 text-xs font-semibold">{area.average}% average from {area.count} records.</p>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No weak areas available" description="Weak areas need strand result records." />}
        <div className="mt-4 space-y-2">
          {analytics.recommendations.map((recommendation) => (
            <div key={recommendation} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {recommendation}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default SubjectIntelligence;
