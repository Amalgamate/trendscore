import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, LineChart, Target, Trophy, User, Users } from 'lucide-react';
import { assessmentAPI } from '../../../../services/api';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.tests)) return value.tests;
  return [];
};

const normalizeGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (/^m|boy/.test(gender)) return 'Boys';
  if (/^f|girl/.test(gender)) return 'Girls';
  return 'Unspecified';
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

const aggregateGenderMatrix = (records, getLabel) => aggregateRows(records, getLabel).map((row) => {
  const scoped = records.filter((record) => getLabel(record) === row.label);
  const genderRows = aggregateRows(scoped, (record) => record.gender);
  const boys = genderRows.find((item) => item.label === 'Boys');
  const girls = genderRows.find((item) => item.label === 'Girls');
  const gap = boys?.average !== undefined && girls?.average !== undefined ? Math.abs(boys.average - girls.average) : null;
  return {
    ...row,
    boysAverage: boys?.average ?? null,
    girlsAverage: girls?.average ?? null,
    gap,
  };
});

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

const GenderBarList = ({ rows, emptyTitle, emptyDescription }) => {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const max = Math.max(...rows.flatMap((row) => [row.boysAverage || 0, row.girlsAverage || 0]), 100);
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-extrabold text-slate-800">{row.label}</p>
            <p className="text-xs font-bold text-slate-400">{row.count} records</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Boys', value: row.boysAverage, color: 'bg-indigo-500' },
              { label: 'Girls', value: row.girlsAverage, color: 'bg-fuchsia-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
                  <span>{item.label}</span>
                  <span>{item.value === null ? 'No score' : `${item.value}%`}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value ? Math.max(6, (item.value / max) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            Gap: {row.gap === null ? 'No comparable gender data' : `${row.gap}%`}
          </p>
        </div>
      ))}
    </div>
  );
};

const SimpleBarList = ({ rows, emptyTitle, emptyDescription }) => {
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

const GenderAnalysis = ({ learners = [] }) => {
  const [filters, setFilters] = useState({ grade: 'all', subject: 'all' });
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
    const subjects = [...new Set(state.tests.map(getSubjectName).filter(Boolean))].sort();
    return { grades, subjects };
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
        grade: learner.grade || test.grade || 'Unspecified grade',
        gender: normalizeGender(learner.gender || learner.sex),
        period: date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : null,
      };
    }).filter(Boolean).filter((record) => (
      (filters.grade === 'all' || record.grade === filters.grade)
      && (filters.subject === 'all' || record.subject === filters.subject)
    ));

    const genderRows = aggregateRows(records, (record) => record.gender);
    const boys = genderRows.find((row) => row.label === 'Boys');
    const girls = genderRows.find((row) => row.label === 'Girls');
    const gap = boys?.average !== undefined && girls?.average !== undefined ? Math.abs(boys.average - girls.average) : null;
    const subjectRows = aggregateGenderMatrix(records, (record) => record.subject);
    const gradeRows = aggregateGenderMatrix(records, (record) => record.grade);
    const trendRows = aggregateGenderMatrix(records.filter((record) => record.period), (record) => record.period)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-6);
    const strongestGap = [...subjectRows, ...gradeRows].filter((row) => row.gap !== null).sort((a, b) => b.gap - a.gap)[0];
    const atRiskRows = aggregateRows(records.filter((record) => record.percent < 40), (record) => record.gender);
    const recommendations = [];

    if (strongestGap) {
      recommendations.push(`Review ${strongestGap.label}: the current gender gap is ${strongestGap.gap}%.`);
    }
    if (boys?.average !== undefined && girls?.average !== undefined) {
      const lowerGroup = boys.average <= girls.average ? 'boys' : 'girls';
      recommendations.push(`Prioritize targeted support for ${lowerGroup}; their current mean is lower in the selected context.`);
    }
    if (!recommendations.length) {
      recommendations.push('No gender recommendations available until comparable boys and girls result data is present.');
    }

    return {
      records,
      genderRows,
      boysMean: boys?.average ?? null,
      girlsMean: girls?.average ?? null,
      gap,
      assessedLearners: new Set(records.map((record) => record.learner.id)).size,
      subjectRows,
      gradeRows,
      trendRows,
      atRiskRows,
      strongestGap: strongestGap?.label || 'No data',
      recommendations,
    };
  }, [filters, learners, state.results, state.tests]);

  const kpis = [
    { label: 'Boys Mean', value: analytics.boysMean === null ? 'No score' : `${analytics.boysMean}%`, helper: 'Uses learner gender metadata.', icon: User },
    { label: 'Girls Mean', value: analytics.girlsMean === null ? 'No score' : `${analytics.girlsMean}%`, helper: 'Uses learner gender metadata.', icon: Users },
    { label: 'Gender Gap', value: analytics.gap === null ? 'No data' : `${analytics.gap}%`, helper: 'Difference between boys and girls mean.', icon: Target },
    { label: 'Learners Assessed', value: analytics.assessedLearners, helper: 'Unique learners with result records.', icon: Trophy },
    { label: 'Result Records', value: analytics.records.length, helper: 'Loaded assessment records in scope.', icon: BarChart3 },
    { label: 'Largest Gap Area', value: analytics.strongestGap, helper: 'Highest comparable gap by subject or grade.', icon: AlertTriangle },
    { label: 'Boys At Risk', value: analytics.atRiskRows.find((row) => row.label === 'Boys')?.count || 0, helper: 'Records below 40%.', icon: AlertTriangle },
    { label: 'Girls At Risk', value: analytics.atRiskRows.find((row) => row.label === 'Girls')?.count || 0, helper: 'Records below 40%.', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Filter size={19} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Gender filters</h2>
            <p className="text-sm font-medium text-slate-500">Filter gender equity analysis by grade and subject.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select value={filters.grade} onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All grades</option>
            {options.grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={User} title="Gender KPI Summary" description="Overall boys and girls means for the selected academic context.">
          {state.loading ? <EmptyState title="Loading gender summary" description="Assessment records are being loaded." /> : (
            <SimpleBarList rows={analytics.genderRows} emptyTitle="No gender summary available" emptyDescription="Gender summary needs learner gender and assessment result records." />
          )}
        </Panel>
        <Panel icon={BarChart3} title="Subject Gender Comparison" description="Subject-level boys and girls mean comparison.">
          {state.loading ? <EmptyState title="Loading subject gender data" description="Assessment records are being loaded." /> : (
            <GenderBarList rows={analytics.subjectRows} emptyTitle="No subject gender data available" emptyDescription="Subject comparison needs boys and girls assessment records." />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={Users} title="Grade Gender Comparison" description="Grade-level boys and girls performance comparison.">
          {state.loading ? <EmptyState title="Loading grade gender data" description="Assessment records are being loaded." /> : (
            <GenderBarList rows={analytics.gradeRows} emptyTitle="No grade gender data available" emptyDescription="Grade comparison needs learner grade, gender and result records." />
          )}
        </Panel>
        <Panel icon={LineChart} title="Gender Trend" description="Monthly boys and girls averages from dated assessments.">
          {state.loading ? <EmptyState title="Loading gender trend" description="Assessment records are being loaded." /> : (
            <GenderBarList rows={analytics.trendRows} emptyTitle="No gender trend available" emptyDescription="Trend needs dated assessment records with gender metadata." />
          )}
        </Panel>
      </div>

      <Panel icon={Target} title="Gender Recommendations" description="Deterministic support prompts from comparable gender data.">
        <div className="space-y-2">
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

export default GenderAnalysis;
