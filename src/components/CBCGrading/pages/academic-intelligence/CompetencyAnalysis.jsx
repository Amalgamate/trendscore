import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, Layers, ListTree, Target, Trophy } from 'lucide-react';
import { assessmentAPI } from '../../../../services/api';

const FOUR_LEVELS = ['EE', 'ME', 'AE', 'BE'];
const EIGHT_LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8'];

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
const getLearningArea = (test, result) => result?.learningArea || result?.learningAreaName || test?.learningArea || test?.learningAreaName || test?.subject || test?.subjectName || 'Unspecified learning area';
const getStrand = (test, result) => result?.strand || result?.strandName || test?.strand || test?.strandName || test?.topic || 'Unspecified strand';
const getSubStrand = (test, result) => result?.subStrand || result?.subStrandName || result?.substrand || test?.subStrand || test?.subStrandName || test?.substrand || 'Unspecified sub-strand';
const getIndicator = (test, result) => result?.indicator || result?.indicatorName || result?.competency || result?.competencyName || result?.learningOutcome || test?.indicator || test?.competency || test?.learningOutcome || 'Unspecified competency';

const getScorePercent = (result, test) => {
  const explicitPercent = Number(result?.percentage ?? result?.percent ?? result?.scorePercent);
  if (Number.isFinite(explicitPercent)) return explicitPercent;
  const score = Number(result?.score ?? result?.marks ?? result?.mark ?? result?.obtainedMarks);
  const total = Number(result?.totalMarks ?? result?.maxMarks ?? test?.totalMarks ?? test?.maxMarks);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) return (score / total) * 100;
  return null;
};

const normalizeFourLevel = (value, percent) => {
  const raw = String(value || '').trim().toUpperCase();
  if (FOUR_LEVELS.includes(raw)) return { level: raw, source: 'recorded' };
  if (/EXCEED|EXCEEDING/.test(raw)) return { level: 'EE', source: 'recorded' };
  if (/MEET|MEETING/.test(raw)) return { level: 'ME', source: 'recorded' };
  if (/APPROACH|APPROACHING/.test(raw)) return { level: 'AE', source: 'recorded' };
  if (/BELOW/.test(raw)) return { level: 'BE', source: 'recorded' };
  if (percent === null) return { level: null, source: null };
  if (percent >= 80) return { level: 'EE', source: 'derived' };
  if (percent >= 60) return { level: 'ME', source: 'derived' };
  if (percent >= 40) return { level: 'AE', source: 'derived' };
  return { level: 'BE', source: 'derived' };
};

const normalizeEightLevel = (value) => {
  const numberValue = Number(value);
  if (Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= 8) return String(numberValue);
  const textValue = String(value || '').trim();
  return EIGHT_LEVELS.includes(textValue) ? textValue : null;
};

const aggregateRows = (records, getLabel) => {
  const grouped = new Map();
  records.forEach((record) => {
    const label = getLabel(record) || 'Unspecified';
    if (!grouped.has(label)) grouped.set(label, { label, total: 0, count: 0, beCount: 0, derivedCount: 0 });
    const bucket = grouped.get(label);
    bucket.total += record.percent ?? 0;
    bucket.count += 1;
    if (record.fourLevel === 'BE') bucket.beCount += 1;
    if (record.levelSource === 'derived') bucket.derivedCount += 1;
  });
  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      average: bucket.count ? Math.round(bucket.total / bucket.count) : null,
      beRate: bucket.count ? Math.round((bucket.beCount / bucket.count) * 100) : 0,
    }))
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

const RowList = ({ rows, emptyTitle, emptyDescription, showRisk = false }) => {
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
          <p className="mt-1 text-[10px] font-semibold text-slate-400">
            {row.count} records{showRisk ? ` • ${row.beRate}% BE` : ''}
          </p>
        </div>
      ))}
    </div>
  );
};

const Distribution = ({ rows, labels, emptyTitle, emptyDescription }) => {
  if (!rows.some((row) => row.count > 0)) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {labels.map((label) => {
        const row = rows.find((item) => item.label === label) || { count: 0 };
        const rate = total ? Math.round((row.count / total) * 100) : 0;
        return (
          <div key={label} className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">{label}</p>
            <p className="mt-2 text-3xl font-black">{row.count}</p>
            <p className="text-xs font-bold opacity-80">{rate}% of records</p>
          </div>
        );
      })}
    </div>
  );
};

const CompetencyAnalysis = ({ learners = [] }) => {
  const [filters, setFilters] = useState({ learningArea: 'all', strand: 'all', subStrand: 'all' });
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

  const baseRecords = useMemo(() => {
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
    const testMap = new Map(state.tests.map((test) => [getTestId(test), test]));
    return state.results.map((result) => {
      const test = testMap.get(getResultTestId(result));
      const learner = learnerMap.get(getResultLearnerId(result));
      const percent = getScorePercent(result, test);
      if (!test || !learner || percent === null) return null;
      const rawFourLevel = result?.rating || result?.level || result?.performanceLevel || result?.competencyLevel || result?.achievementLevel;
      const fourLevel = normalizeFourLevel(rawFourLevel, percent);
      const eightLevel = normalizeEightLevel(result?.cbcLevel || result?.level8 || result?.eightLevel || result?.numericLevel);
      return {
        learner,
        test,
        percent,
        learningArea: getLearningArea(test, result),
        strand: getStrand(test, result),
        subStrand: getSubStrand(test, result),
        indicator: getIndicator(test, result),
        fourLevel: fourLevel.level,
        levelSource: fourLevel.source,
        eightLevel,
      };
    }).filter(Boolean);
  }, [learners, state.results, state.tests]);

  const options = useMemo(() => {
    const scopedByLearningArea = baseRecords.filter((record) => filters.learningArea === 'all' || record.learningArea === filters.learningArea);
    const scopedByStrand = scopedByLearningArea.filter((record) => filters.strand === 'all' || record.strand === filters.strand);
    return {
      learningAreas: [...new Set(baseRecords.map((record) => record.learningArea))].sort(),
      strands: [...new Set(scopedByLearningArea.map((record) => record.strand))].sort(),
      subStrands: [...new Set(scopedByStrand.map((record) => record.subStrand))].sort(),
    };
  }, [baseRecords, filters.learningArea, filters.strand]);

  const analytics = useMemo(() => {
    const records = baseRecords.filter((record) => (
      (filters.learningArea === 'all' || record.learningArea === filters.learningArea)
      && (filters.strand === 'all' || record.strand === filters.strand)
      && (filters.subStrand === 'all' || record.subStrand === filters.subStrand)
    ));
    const strandRows = aggregateRows(records, (record) => record.strand);
    const subStrandRows = aggregateRows(records, (record) => record.subStrand);
    const indicatorRows = aggregateRows(records, (record) => record.indicator);
    const fourLevelRows = FOUR_LEVELS.map((label) => ({ label, count: records.filter((record) => record.fourLevel === label).length }));
    const eightLevelRows = EIGHT_LEVELS.map((label) => ({ label, count: records.filter((record) => record.eightLevel === label).length }));
    const weakestCompetencies = indicatorRows.slice().sort((a, b) => (a.average || 0) - (b.average || 0)).slice(0, 5);
    const interventionAreas = [...subStrandRows, ...indicatorRows]
      .filter((row) => row.beRate > 0 || (row.average !== null && row.average < 50))
      .sort((a, b) => b.beRate - a.beRate || (a.average || 0) - (b.average || 0))
      .slice(0, 6);
    const mean = records.length ? Math.round(records.reduce((sum, record) => sum + record.percent, 0) / records.length) : null;
    const derivedCount = records.filter((record) => record.levelSource === 'derived').length;

    return {
      records,
      mean,
      assessedLearners: new Set(records.map((record) => record.learner.id)).size,
      strandRows,
      subStrandRows,
      indicatorRows,
      fourLevelRows,
      eightLevelRows,
      weakestCompetencies,
      interventionAreas,
      derivedCount,
      beCount: records.filter((record) => record.fourLevel === 'BE').length,
    };
  }, [baseRecords, filters]);

  const kpis = [
    { label: 'Competency Mean', value: analytics.mean === null ? 'No score' : `${analytics.mean}%`, helper: 'Average from available competency records.', icon: BarChart3 },
    { label: 'Learners Assessed', value: analytics.assessedLearners, helper: 'Unique learners in competency records.', icon: Trophy },
    { label: 'Result Records', value: analytics.records.length, helper: 'Loaded records in selected scope.', icon: Target },
    { label: 'Strands Covered', value: analytics.strandRows.length, helper: 'Distinct strands in selected scope.', icon: Layers },
    { label: 'Sub-Strands Covered', value: analytics.subStrandRows.length, helper: 'Distinct sub-strands in selected scope.', icon: ListTree },
    { label: 'Competencies Covered', value: analytics.indicatorRows.length, helper: 'Distinct indicators/competencies.', icon: Target },
    { label: 'BE Records', value: analytics.beCount, helper: 'Below expectation records.', icon: AlertTriangle },
    { label: 'Derived Ratings', value: analytics.derivedCount, helper: 'Ratings inferred from percentage where no rating field exists.', icon: Filter },
  ];

  return (
    <div className="space-y-4 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Filter size={19} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Competency filters</h2>
            <p className="text-sm font-medium text-slate-500">Drill down by learning area, strand and sub-strand using existing assessment records.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={filters.learningArea} onChange={(event) => setFilters({ learningArea: event.target.value, strand: 'all', subStrand: 'all' })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All learning areas</option>
            {options.learningAreas.map((learningArea) => <option key={learningArea} value={learningArea}>{learningArea}</option>)}
          </select>
          <select value={filters.strand} onChange={(event) => setFilters((current) => ({ ...current, strand: event.target.value, subStrand: 'all' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All strands</option>
            {options.strands.map((strand) => <option key={strand} value={strand}>{strand}</option>)}
          </select>
          <select value={filters.subStrand} onChange={(event) => setFilters((current) => ({ ...current, subStrand: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <option value="all">All sub-strands</option>
            {options.subStrands.map((subStrand) => <option key={subStrand} value={subStrand}>{subStrand}</option>)}
          </select>
        </div>
        {state.error && <p className="mt-3 text-sm font-bold text-rose-600">{state.error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => <Card key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={Layers} title="Strand Drilldown" description="Strand performance from available competency records.">
          {state.loading ? <EmptyState title="Loading strand data" description="Assessment records are being loaded." /> : (
            <RowList rows={analytics.strandRows} showRisk emptyTitle="No strand data available" emptyDescription="Strand drilldown needs strand fields on tests or results." />
          )}
        </Panel>
        <Panel icon={ListTree} title="Sub-Strand Drilldown" description="Sub-strand performance from available competency records.">
          {state.loading ? <EmptyState title="Loading sub-strand data" description="Assessment records are being loaded." /> : (
            <RowList rows={analytics.subStrandRows} showRisk emptyTitle="No sub-strand data available" emptyDescription="Sub-strand drilldown needs sub-strand fields on tests or results." />
          )}
        </Panel>
      </div>

      <Panel icon={Target} title="Indicator / Competency Drilldown" description="Indicator and competency performance from existing assessment records.">
        {state.loading ? <EmptyState title="Loading competency data" description="Assessment records are being loaded." /> : (
          <RowList rows={analytics.indicatorRows} showRisk emptyTitle="No competency data available" emptyDescription="Competency drilldown needs indicator, competency or learning outcome fields." />
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={BarChart3} title="EE / ME / AE / BE Distribution" description="Recorded ratings where present; otherwise derived from real percentages.">
          {state.loading ? <EmptyState title="Loading rating distribution" description="Assessment records are being loaded." /> : (
            <Distribution rows={analytics.fourLevelRows} labels={FOUR_LEVELS} emptyTitle="No four-level distribution available" emptyDescription="Distribution needs ratings or scores that can be converted to percentages." />
          )}
        </Panel>
        <Panel icon={Trophy} title="Optional 8-Level CBC Display" description="Uses explicit 1-8 level fields only; no synthetic 8-level mapping is created.">
          {state.loading ? <EmptyState title="Loading 8-level display" description="Assessment records are being loaded." /> : (
            <Distribution rows={analytics.eightLevelRows} labels={EIGHT_LEVELS} emptyTitle="No 8-level CBC data available" emptyDescription="No explicit 1-8 CBC level fields were found in the loaded records." />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel icon={AlertTriangle} title="Weakest Competencies" description="Lowest-performing competencies and indicators in the selected scope.">
          <RowList rows={analytics.weakestCompetencies} showRisk emptyTitle="No weakest competencies available" emptyDescription="Weakest competencies need indicator or competency result records." />
        </Panel>
        <Panel icon={Target} title="Intervention Areas" description="Sub-strands and competencies with high BE rates or low averages.">
          <RowList rows={analytics.interventionAreas} showRisk emptyTitle="No intervention areas available" emptyDescription="Intervention areas need BE ratings or low percentage scores." />
        </Panel>
      </div>
    </div>
  );
};

export default CompetencyAnalysis;
