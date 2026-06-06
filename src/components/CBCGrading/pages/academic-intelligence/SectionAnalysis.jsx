import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Grid, LineChart, Trophy, User, Users } from 'lucide-react';
import { assessmentAPI } from '../../../../services/api';

const SECTION_DEFINITIONS = [
  { id: 'lower-primary', label: 'Lower Primary', grades: ['Grade 1', 'Grade 2', 'Grade 3', '1', '2', '3'] },
  { id: 'upper-primary', label: 'Upper Primary', grades: ['Grade 4', 'Grade 5', 'Grade 6', '4', '5', '6'] },
  { id: 'junior-school', label: 'Junior School', grades: ['Grade 7', 'Grade 8', 'Grade 9', '7', '8', '9'], helper: 'Supports Grades 7, 8 and 9' },
];

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.tests)) return value.tests;
  return [];
};

const normalizeGrade = (grade) => String(grade || '').replace(/^grade\s*/i, '').trim();
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

const inSection = (grade, section) => {
  const normalized = normalizeGrade(grade);
  return section.grades.some((candidate) => normalizeGrade(candidate) === normalized);
};

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

const EmptyState = ({ title, description }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
    <p className="text-sm font-extrabold text-slate-500">{title}</p>
    <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>
  </div>
);

const BarList = ({ rows, valueLabel = 'Average' }) => {
  if (!rows.length) {
    return <EmptyState title="No comparison data available" description="Comparison needs assessment results for this section." />;
  }

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
          <p className="mt-1 text-[10px] font-semibold text-slate-400">{row.count} records • {valueLabel}</p>
        </div>
      ))}
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

const buildTrend = (records) => aggregateRows(
  records.filter((record) => record.period),
  (record) => record.period
).sort((a, b) => a.label.localeCompare(b.label)).slice(-6);

const SectionAnalysis = ({ learners = [] }) => {
  const [activeSectionId, setActiveSectionId] = useState('lower-primary');
  const [state, setState] = useState({ loading: true, tests: [], results: [], error: null });
  const activeSection = SECTION_DEFINITIONS.find((section) => section.id === activeSectionId) || SECTION_DEFINITIONS[0];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const tests = toArray(await assessmentAPI.getTests());
        const resultGroups = await Promise.all(tests.slice(0, 30).map(async (test) => {
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

  const analytics = useMemo(() => {
    const sectionLearners = learners.filter((learner) => inSection(learner.grade, activeSection));
    const learnerMap = new Map(sectionLearners.map((learner) => [learner.id, learner]));
    const testMap = new Map(state.tests.map((test) => [getTestId(test), test]));
    const records = state.results.map((result) => {
      const test = testMap.get(getResultTestId(result));
      const learner = learnerMap.get(getResultLearnerId(result));
      const percent = getScorePercent(result, test);
      const rawDate = getTestDate(test);
      const date = rawDate ? new Date(rawDate) : null;
      if (!test || !learner || percent === null) return null;
      return {
        learner,
        test,
        percent,
        subject: getSubjectName(test),
        grade: learner.grade || test.grade || 'Unspecified grade',
        gender: learner.gender || learner.sex || 'Unspecified gender',
        period: date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : null,
      };
    }).filter(Boolean);

    const mean = records.length ? Math.round(records.reduce((sum, item) => sum + item.percent, 0) / records.length) : null;
    const assessedLearners = new Set(records.map((record) => record.learner.id)).size;
    const completion = sectionLearners.length ? Math.round((assessedLearners / sectionLearners.length) * 100) : null;
    const subjectRows = aggregateRows(records, (record) => record.subject);
    const gradeRows = aggregateRows(records, (record) => record.grade);
    const genderRows = aggregateRows(records, (record) => record.gender);
    const heatmapRows = aggregateRows(records, (record) => `${record.grade} • ${record.subject}`).slice(0, 12);
    const trendRows = buildTrend(records);
    const boys = genderRows.find((row) => /^male|boy/i.test(row.label));
    const girls = genderRows.find((row) => /^female|girl/i.test(row.label));
    const atRisk = records.filter((record) => record.percent < 40).length;

    return {
      sectionLearners,
      records,
      mean,
      assessedLearners,
      completion,
      subjectRows,
      gradeRows,
      genderRows,
      heatmapRows,
      trendRows,
      boysMean: boys?.average ?? null,
      girlsMean: girls?.average ?? null,
      bestSubject: subjectRows[0]?.label || 'No data',
      weakestSubject: subjectRows.length ? subjectRows[subjectRows.length - 1].label : 'No data',
      atRisk,
    };
  }, [activeSection, learners, state.results, state.tests]);

  const kpis = [
    { label: 'Section Mean', value: analytics.mean === null ? 'No score' : `${analytics.mean}%`, helper: 'Average from available result records.', icon: BarChart3 },
    { label: 'Learners Assessed', value: analytics.assessedLearners, helper: `${analytics.sectionLearners.length} learners in section scope.`, icon: Users },
    { label: 'Completion Rate', value: analytics.completion === null ? 'No learners' : `${analytics.completion}%`, helper: 'Assessed learners divided by learners in scope.', icon: Trophy },
    { label: 'Boys Mean', value: analytics.boysMean === null ? 'No score' : `${analytics.boysMean}%`, helper: 'Uses learner gender records where available.', icon: User },
    { label: 'Girls Mean', value: analytics.girlsMean === null ? 'No score' : `${analytics.girlsMean}%`, helper: 'Uses learner gender records where available.', icon: Users },
    { label: 'Best Subject', value: analytics.bestSubject, helper: 'Highest available subject average.', icon: Trophy },
    { label: 'Weakest Subject', value: analytics.weakestSubject, helper: 'Lowest available subject average.', icon: AlertTriangle },
    { label: 'Learners At Risk', value: analytics.atRisk, helper: 'Result records below 40%.', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {SECTION_DEFINITIONS.map((section) => {
            const active = section.id === activeSectionId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSectionId(section.id)}
                className={`rounded-full border px-4 py-2 text-sm font-extrabold transition ${
                  active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-indigo-50'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          {activeSection.helper || `${activeSection.label} analysis uses the configured grade scope.`}
        </p>
        {state.error && <p className="mt-2 text-sm font-bold text-rose-600">{state.error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <Card key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={BarChart3} title="Subject Comparison" description="Subject averages within the selected section.">
          {state.loading ? <EmptyState title="Loading subject data" description="Assessment records are being loaded." /> : <BarList rows={analytics.subjectRows} />}
        </Panel>
        <Panel icon={Users} title="Grade Comparison" description="Grade-level averages inside the selected section.">
          {state.loading ? <EmptyState title="Loading grade data" description="Assessment records are being loaded." /> : <BarList rows={analytics.gradeRows} />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={User} title="Gender Comparison" description="Boys and girls mean comparison where learner gender is available.">
          {state.loading ? <EmptyState title="Loading gender data" description="Assessment records are being loaded." /> : <BarList rows={analytics.genderRows} />}
        </Panel>
        <Panel icon={Grid} title="Section Heatmap" description="Grade by subject performance cells from available records.">
          {state.loading ? <EmptyState title="Loading heatmap data" description="Assessment records are being loaded." /> : (
            analytics.heatmapRows.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {analytics.heatmapRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-800">
                    <p className="truncate text-xs font-black uppercase tracking-[0.14em]">{row.label}</p>
                    <p className="mt-2 text-2xl font-black">{row.average}%</p>
                    <p className="text-xs font-bold opacity-80">{row.count} records</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No heatmap data available" description="Heatmap needs result records for this section." />
          )}
        </Panel>
      </div>

      <Panel icon={LineChart} title="Section Trend Analysis" description="Monthly section averages from dated assessment records.">
        {state.loading ? <EmptyState title="Loading trend data" description="Assessment records are being loaded." /> : <BarList rows={analytics.trendRows} valueLabel="Monthly average" />}
      </Panel>
    </div>
  );
};

export default SectionAnalysis;
