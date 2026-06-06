import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, GraduationCap, Layers, Lightbulb, Target, Users } from 'lucide-react';
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

const getScorePercent = (result, test) => {
  const explicitPercent = Number(result?.percentage ?? result?.percent ?? result?.scorePercent);
  if (Number.isFinite(explicitPercent)) return explicitPercent;
  const score = Number(result?.score ?? result?.marks ?? result?.mark ?? result?.obtainedMarks);
  const total = Number(result?.totalMarks ?? result?.maxMarks ?? test?.totalMarks ?? test?.maxMarks);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) return (score / total) * 100;
  return null;
};

const getRiskLevel = (average, lowRate) => {
  if (average === null) return 'No data';
  if (average < 40 || lowRate >= 50) return 'High';
  if (average < 55 || lowRate >= 25) return 'Moderate';
  return 'On Track';
};

const getRiskTone = (level) => {
  if (level === 'High') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (level === 'Moderate') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (level === 'On Track') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

const aggregateRows = (records, getLabel) => {
  const grouped = new Map();
  records.forEach((record) => {
    const label = getLabel(record) || 'Unspecified';
    if (!grouped.has(label)) grouped.set(label, { label, total: 0, count: 0, lowCount: 0 });
    const bucket = grouped.get(label);
    bucket.total += record.percent;
    bucket.count += 1;
    if (record.percent < 40) bucket.lowCount += 1;
  });
  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      average: bucket.count ? Math.round(bucket.total / bucket.count) : null,
      lowRate: bucket.count ? Math.round((bucket.lowCount / bucket.count) * 100) : 0,
    }))
    .sort((a, b) => b.lowRate - a.lowRate || (a.average || 0) - (b.average || 0));
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

const RiskDistribution = ({ rows }) => {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyState title="No risk distribution available" description="Risk distribution needs learner-linked assessment result records." />;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className={`rounded-xl border p-4 ${getRiskTone(row.label)}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em]">{row.label}</p>
          <p className="mt-2 text-3xl font-black">{row.count}</p>
          <p className="text-xs font-bold opacity-80">{total ? Math.round((row.count / total) * 100) : 0}% of assessed learners</p>
        </div>
      ))}
    </div>
  );
};

const BarList = ({ rows, emptyTitle, emptyDescription }) => {
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const max = Math.max(...rows.map((row) => row.lowRate || 0), 100);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span className="truncate">{row.label}</span>
            <span>{row.lowRate}% low records</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(6, (row.lowRate / max) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.count} records, {row.average === null ? 'no mean' : `${row.average}% mean`}</p>
        </div>
      ))}
    </div>
  );
};

const LearnerRiskTable = ({ rows }) => {
  if (!rows.length) return <EmptyState title="No learners at risk" description="Learner risk needs assessment records below the risk threshold." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
          <tr>
            <th className="px-3 py-2">Learner</th>
            <th className="px-3 py-2">Grade</th>
            <th className="px-3 py-2">Stream</th>
            <th className="px-3 py-2">Mean</th>
            <th className="px-3 py-2">Low Records</th>
            <th className="px-3 py-2">Risk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-bold text-slate-800">{row.name}</td>
              <td className="px-3 py-3 font-semibold text-slate-500">{row.grade}</td>
              <td className="px-3 py-3 font-semibold text-slate-500">{row.stream}</td>
              <td className="px-3 py-3 font-bold text-slate-700">{row.average}%</td>
              <td className="px-3 py-3 font-semibold text-slate-500">{row.lowCount}/{row.count}</td>
              <td className="px-3 py-3">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${getRiskTone(row.level)}`}>{row.level}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LearnerRiskCenter = ({ learners = [] }) => {
  const [filters, setFilters] = useState({ grade: 'all', stream: 'all' });
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
    return { grades, streams };
  }, [learners]);

  const analytics = useMemo(() => {
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
    const testMap = new Map(state.tests.map((test) => [getTestId(test), test]));
    const records = state.results.map((result) => {
      const test = testMap.get(getResultTestId(result));
      const learner = learnerMap.get(getResultLearnerId(result));
      const percent = getScorePercent(result, test);
      if (!test || !learner || percent === null) return null;
      const stream = learner.stream || learner.className || test.stream || 'Unspecified stream';
      const grade = learner.grade || test.grade || 'Unspecified grade';
      return {
        learner,
        test,
        percent,
        subject: getSubjectName(test),
        grade,
        stream,
      };
    }).filter(Boolean).filter((record) => (
      (filters.grade === 'all' || record.grade === filters.grade)
      && (filters.stream === 'all' || record.stream === filters.stream)
    ));

    const learnerRows = aggregateRows(records, (record) => record.learner.id).map((row) => {
      const learner = learnerMap.get(row.label);
      const lowRate = row.count ? Math.round((row.lowCount / row.count) * 100) : 0;
      return {
        ...row,
        id: row.label,
        name: learner?.fullName || learner?.name || learner?.admissionNumber || 'Unnamed learner',
        grade: learner?.grade || 'Unspecified grade',
        stream: learner?.stream || learner?.className || 'Unspecified stream',
        lowRate,
        level: getRiskLevel(row.average, lowRate),
      };
    }).filter((row) => row.level !== 'On Track').slice(0, 12);

    const distribution = ['High', 'Moderate', 'On Track'].map((label) => {
      const count = aggregateRows(records, (record) => record.learner.id).filter((row) => getRiskLevel(row.average, row.count ? Math.round((row.lowCount / row.count) * 100) : 0) === label).length;
      return { label, count };
    });
    const subjectRows = aggregateRows(records, (record) => record.subject).slice(0, 6);
    const gradeRows = aggregateRows(records, (record) => record.grade).slice(0, 6);
    const streamRows = aggregateRows(records, (record) => record.stream).slice(0, 6);
    const highRiskCount = distribution.find((row) => row.label === 'High')?.count || 0;
    const moderateRiskCount = distribution.find((row) => row.label === 'Moderate')?.count || 0;
    const actions = [];
    if (highRiskCount) actions.push(`Schedule immediate review for ${highRiskCount} high-risk learner${highRiskCount === 1 ? '' : 's'}.`);
    if (subjectRows[0]) actions.push(`Check ${subjectRows[0].label}: ${subjectRows[0].lowRate}% of records are below 40%.`);
    if (gradeRows[0]) actions.push(`Review ${gradeRows[0].label}: current risk concentration is highest in this grade scope.`);
    if (!actions.length) actions.push('No risk actions available until learner-linked assessment records are present.');

    return {
      records,
      learnerRows,
      distribution,
      subjectRows,
      gradeRows,
      streamRows,
      assessedLearners: new Set(records.map((record) => record.learner.id)).size,
      highRiskCount,
      moderateRiskCount,
      actions,
    };
  }, [filters, learners, state.results, state.tests]);

  const kpis = [
    { label: 'High Risk', value: analytics.highRiskCount, helper: 'Learners below threshold or with high low-score rate.', icon: AlertTriangle, tone: 'rose' },
    { label: 'Moderate Risk', value: analytics.moderateRiskCount, helper: 'Learners with developing risk indicators.', icon: Target, tone: 'amber' },
    { label: 'Assessed Learners', value: analytics.assessedLearners, helper: 'Unique learners with result records.', icon: Users, tone: 'indigo' },
    { label: 'Result Records', value: analytics.records.length, helper: 'Loaded records in selected scope.', icon: BarChart3, tone: 'emerald' },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Filter size={19} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Risk filters</h2>
            <p className="text-sm font-medium text-slate-500">Filter learner risk by grade and stream using live assessment records.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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

      <Panel icon={Layers} title="Risk Distribution" description="Learners grouped by deterministic assessment risk thresholds.">
        {state.loading ? <EmptyState title="Loading risk distribution" description="Assessment records are being loaded." /> : <RiskDistribution rows={analytics.distribution} />}
      </Panel>

      <Panel icon={GraduationCap} title="Learners At Risk" description="Learners with high or moderate academic risk indicators.">
        {state.loading ? <EmptyState title="Loading learner risk table" description="Assessment records are being loaded." /> : <LearnerRiskTable rows={analytics.learnerRows} />}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel icon={BarChart3} title="Risk by Subject" description="Subjects with the highest concentration of low records.">
          <BarList rows={analytics.subjectRows} emptyTitle="No subject risk available" emptyDescription="Subject risk needs subject-linked result records." />
        </Panel>
        <Panel icon={Users} title="Risk by Grade" description="Grade-level risk concentration.">
          <BarList rows={analytics.gradeRows} emptyTitle="No grade risk available" emptyDescription="Grade risk needs learner grade metadata." />
        </Panel>
        <Panel icon={Target} title="Risk by Stream" description="Stream-level risk concentration.">
          <BarList rows={analytics.streamRows} emptyTitle="No stream risk available" emptyDescription="Stream risk needs learner stream metadata." />
        </Panel>
      </div>

      <Panel icon={Lightbulb} title="Suggested Actions" description="Rule-based intervention prompts from available risk data.">
        <div className="space-y-2">
          {analytics.actions.map((action) => (
            <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {action}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default LearnerRiskCenter;
