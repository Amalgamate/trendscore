import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Grid,
  LineChart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { assessmentAPI, dashboardAPI } from '../../../../services/api';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.tests)) return value.tests;
  return [];
};

const filterLearners = (learners = [], filters = {}) => learners.filter((learner) => {
  const grade = learner.grade;
  const stream = learner.stream || learner.className;
  const matchesGrade = filters.grade === 'all' || !filters.grade || grade === filters.grade;
  const matchesStream = filters.stream === 'all' || !filters.stream || stream === filters.stream;
  return matchesGrade && matchesStream;
});

const buildAssessmentParams = (filters = {}) => {
  const params = {};
  if (filters.grade && filters.grade !== 'all') params.grade = filters.grade;
  if (filters.stream && filters.stream !== 'all') params.stream = filters.stream;
  if (filters.learningArea && filters.learningArea !== 'all') params.learningArea = filters.learningArea;
  return params;
};

const getTestId = (test) => test?.id || test?._id || test?.testId;
const getResultTestId = (result) => result?.testId || result?.test?.id || result?.assessmentTestId;
const getResultLearnerId = (result) => result?.learnerId || result?.learner?.id || result?.studentId;
const getSubjectName = (test) => (
  test?.learningArea
  || test?.learningAreaName
  || test?.subject
  || test?.subjectName
  || test?.name
  || 'Unspecified subject'
);
const getTestDate = (test) => test?.assessmentDate || test?.date || test?.testDate || test?.createdAt;

const getScorePercent = (result, test) => {
  const explicitPercent = Number(result?.percentage ?? result?.percent ?? result?.scorePercent);
  if (Number.isFinite(explicitPercent)) return explicitPercent;

  const score = Number(result?.score ?? result?.marks ?? result?.mark ?? result?.obtainedMarks);
  const total = Number(result?.totalMarks ?? result?.maxMarks ?? test?.totalMarks ?? test?.maxMarks);
  if (Number.isFinite(score) && Number.isFinite(total) && total > 0) {
    return (score / total) * 100;
  }
  return null;
};

const buildHeatmapRows = ({ tests, results, learners }) => {
  const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
  const testMap = new Map(tests.map((test) => [getTestId(test), test]));
  const grouped = new Map();

  results.forEach((result) => {
    const test = testMap.get(getResultTestId(result));
    const percent = getScorePercent(result, test);
    if (!test || percent === null) return;

    const learner = learnerMap.get(getResultLearnerId(result));
    const section = learner?.stream || learner?.className || learner?.grade || test?.stream || test?.grade || 'Unspecified section';
    const subject = getSubjectName(test);
    const key = `${section}::${subject}`;

    if (!grouped.has(key)) {
      grouped.set(key, { section, subject, total: 0, count: 0 });
    }
    const bucket = grouped.get(key);
    bucket.total += percent;
    bucket.count += 1;
  });

  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      average: bucket.count > 0 ? Math.round(bucket.total / bucket.count) : null,
    }))
    .sort((a, b) => a.section.localeCompare(b.section) || a.subject.localeCompare(b.subject))
    .slice(0, 12);
};

const buildTrendRows = ({ tests, results }) => {
  const testMap = new Map(tests.map((test) => [getTestId(test), test]));
  const grouped = new Map();

  results.forEach((result) => {
    const test = testMap.get(getResultTestId(result));
    const percent = getScorePercent(result, test);
    const rawDate = getTestDate(test);
    const date = rawDate ? new Date(rawDate) : null;
    if (!test || percent === null || !date || Number.isNaN(date.getTime())) return;

    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped.has(period)) {
      grouped.set(period, { period, total: 0, count: 0 });
    }
    const bucket = grouped.get(period);
    bucket.total += percent;
    bucket.count += 1;
  });

  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      average: bucket.count > 0 ? Math.round(bucket.total / bucket.count) : null,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-6);
};

const buildSectionCards = ({ learners, tests, results }) => {
  const learnerSections = new Map();
  learners.forEach((learner) => {
    const section = learner.stream || learner.className || learner.grade || 'Unspecified section';
    if (!learnerSections.has(section)) {
      learnerSections.set(section, { section, learnerCount: 0, resultCount: 0, total: 0 });
    }
    learnerSections.get(section).learnerCount += 1;
  });

  const learnerMap = new Map(learners.map((learner) => [learner.id, learner]));
  const testMap = new Map(tests.map((test) => [getTestId(test), test]));
  results.forEach((result) => {
    const test = testMap.get(getResultTestId(result));
    const percent = getScorePercent(result, test);
    if (percent === null) return;

    const learner = learnerMap.get(getResultLearnerId(result));
    const section = learner?.stream || learner?.className || learner?.grade || test?.stream || test?.grade || 'Unspecified section';
    if (!learnerSections.has(section)) {
      learnerSections.set(section, { section, learnerCount: 0, resultCount: 0, total: 0 });
    }
    const bucket = learnerSections.get(section);
    bucket.resultCount += 1;
    bucket.total += percent;
  });

  return [...learnerSections.values()]
    .map((section) => ({
      ...section,
      average: section.resultCount > 0 ? Math.round(section.total / section.resultCount) : null,
    }))
    .sort((a, b) => {
      if (a.average === null && b.average !== null) return 1;
      if (a.average !== null && b.average === null) return -1;
      return (b.average || 0) - (a.average || 0);
    })
    .slice(0, 6);
};

const EmptyPanel = ({ icon: Icon, title, description, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const KpiCard = ({ icon: Icon, label, value, helper, tone = 'indigo', loading }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {loading ? '...' : value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone] || tones.indigo}`}>
          <Icon size={21} />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{helper}</p>
    </div>
  );
};

const getHeatmapTone = (average) => {
  if (average === null) return 'bg-slate-100 text-slate-400 border-slate-200';
  if (average >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (average >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (average >= 40) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-800 border-rose-200';
};

const PerformanceHeatmap = ({ rows, loading }) => (
  <div className="mt-5">
    {loading ? (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    ) : rows.length > 0 ? (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div
            key={`${row.section}-${row.subject}`}
            className={`rounded-xl border p-3 ${getHeatmapTone(row.average)}`}
          >
            <p className="truncate text-xs font-black uppercase tracking-[0.14em]">{row.section}</p>
            <p className="mt-1 truncate text-sm font-extrabold">{row.subject}</p>
            <p className="mt-3 text-2xl font-black">{row.average}%</p>
            <p className="text-xs font-bold opacity-80">{row.count} result records</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-slate-500">No heatmap data available</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          The matrix will appear after assessment tests and result records are available for the selected filters.
        </p>
      </div>
    )}
  </div>
);

const PerformanceTrend = ({ rows, loading }) => {
  const maxAverage = Math.max(...rows.map((row) => row.average || 0), 100);

  if (loading) {
    return (
      <div className="mt-5 flex h-52 items-end gap-3 rounded-xl bg-slate-50 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex-1 animate-pulse rounded-t-lg bg-slate-200" style={{ height: `${35 + index * 8}%` }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-slate-500">No trend data available</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          Trend lines need dated assessment tests with recorded result scores.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 flex h-56 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {rows.map((row) => (
        <div key={row.period} className="flex h-full flex-1 flex-col justify-end gap-2 text-center">
          <div className="flex flex-1 items-end">
            <div
              className="w-full rounded-t-xl bg-indigo-500"
              style={{ height: `${Math.max(8, (row.average / maxAverage) * 100)}%` }}
              title={`${row.period}: ${row.average}%`}
            />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">{row.average}%</p>
            <p className="text-[10px] font-bold text-slate-400">{row.period}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const SectionPerformanceCards = ({ sections, loading }) => {
  if (loading) {
    return (
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-slate-500">No sections available</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          Section performance needs learner section data and assessment results.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {sections.map((section) => (
        <div key={section.section} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-950">{section.section}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {section.learnerCount} learners • {section.resultCount} result records
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-950">
                {section.average === null ? 'No score' : `${section.average}%`}
              </p>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Average
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const normalizeInsight = (insight, index) => ({
  id: insight?.id || insight?._id || `insight-${index}`,
  title: insight?.title || insight?.name || insight?.type || 'Insight signal',
  description: insight?.description || insight?.message || insight?.summary || 'Insight details were returned without a description.',
  severity: insight?.severity || insight?.level || 'info',
});

const buildAlertCards = ({ insightState, assessmentState, scopedLearners }) => {
  const apiInsights = insightState.insights.map(normalizeInsight);
  const dataNotices = [];

  if (!assessmentState.loading && assessmentState.tests.length === 0) {
    dataNotices.push({
      id: 'missing-tests',
      title: 'No assessment tests found',
      description: 'The dashboard cannot calculate school performance until assessment tests exist for the selected context.',
      severity: 'warning',
    });
  }

  if (!assessmentState.loading && assessmentState.tests.length > 0 && assessmentState.results.length === 0) {
    dataNotices.push({
      id: 'missing-results',
      title: 'No recorded marks found',
      description: 'Assessment tests exist, but no result records were loaded for the selected context.',
      severity: 'warning',
    });
  }

  if (scopedLearners.length === 0) {
    dataNotices.push({
      id: 'missing-learners',
      title: 'No learners in selected scope',
      description: 'Adjust the dashboard filters or confirm learner grade and stream records are available.',
      severity: 'info',
    });
  }

  return [...dataNotices, ...apiInsights].slice(0, 6);
};

const getAlertTone = (severity) => {
  const normalized = String(severity || '').toLowerCase();
  if (['critical', 'high', 'error'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-800';
  if (['warning', 'medium'].includes(normalized)) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['success', 'positive', 'low'].includes(normalized)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return 'border-indigo-200 bg-indigo-50 text-indigo-800';
};

const InsightAlertCards = ({ alerts, loading, error }) => {
  if (loading) {
    return (
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0 && !error) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-extrabold text-slate-500">No insights available yet</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">
          Insight cards will appear when the dashboard insights API or academic data checks return signals.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          <p className="text-sm font-extrabold">Insight API unavailable</p>
          <p className="mt-1 text-xs font-semibold">{error}</p>
        </div>
      )}
      {alerts.map((alert) => (
        <div key={alert.id} className={`rounded-xl border px-4 py-3 ${getAlertTone(alert.severity)}`}>
          <p className="text-sm font-extrabold">{alert.title}</p>
          <p className="mt-1 text-xs font-semibold opacity-80">{alert.description}</p>
        </div>
      ))}
    </div>
  );
};

const ExecutiveDashboard = ({ learners = [], filters = {} }) => {
  const [assessmentState, setAssessmentState] = useState({
    loading: true,
    tests: [],
    results: [],
    error: null,
  });
  const [insightState, setInsightState] = useState({
    loading: true,
    insights: [],
    error: null,
  });

  const scopedLearners = useMemo(
    () => filterLearners(Array.isArray(learners) ? learners : [], filters),
    [learners, filters]
  );

  useEffect(() => {
    let cancelled = false;
    const loadAssessments = async () => {
      setAssessmentState((current) => ({ ...current, loading: true, error: null }));
      try {
        const testsResponse = await assessmentAPI.getTests(buildAssessmentParams(filters));
        const tests = toArray(testsResponse);
        const resultGroups = await Promise.all(
          tests.slice(0, 20).map(async (test) => {
            const testId = test.id || test._id;
            if (!testId) return [];
            try {
              return toArray(await assessmentAPI.getTestResults(testId));
            } catch {
              return [];
            }
          })
        );
        if (!cancelled) {
          setAssessmentState({
            loading: false,
            tests,
            results: resultGroups.flat(),
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAssessmentState({
            loading: false,
            tests: [],
            results: [],
            error: error?.message || 'Assessment data is unavailable.',
          });
        }
      }
    };
    loadAssessments();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const loadInsights = async () => {
      setInsightState((current) => ({ ...current, loading: true, error: null }));
      try {
        const response = await dashboardAPI.getInsights();
        if (!cancelled) {
          setInsightState({
            loading: false,
            insights: toArray(response),
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setInsightState({
            loading: false,
            insights: [],
            error: error?.message || 'Insight data is unavailable.',
          });
        }
      }
    };
    loadInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = [
    {
      label: 'Learners In Scope',
      value: scopedLearners.length,
      helper: scopedLearners.length > 0 ? 'Filtered from current learner records.' : 'No learners match the selected filters.',
      icon: BarChart3,
      tone: 'indigo',
      loading: false,
    },
    {
      label: 'Assessment Tests',
      value: assessmentState.tests.length,
      helper: assessmentState.error || (assessmentState.tests.length > 0 ? 'Loaded from assessment tests API.' : 'No assessment tests found for this context.'),
      icon: ShieldCheck,
      tone: 'emerald',
      loading: assessmentState.loading,
    },
    {
      label: 'Recorded Marks',
      value: assessmentState.results.length,
      helper: assessmentState.results.length > 0 ? 'Loaded from available test result records.' : 'No recorded marks found from loaded tests.',
      icon: AlertTriangle,
      tone: 'amber',
      loading: assessmentState.loading,
    },
    {
      label: 'Insight Signals',
      value: insightState.insights.length,
      helper: insightState.error || (insightState.insights.length > 0 ? 'Loaded from dashboard insights API.' : 'No insight signals returned yet.'),
      icon: Sparkles,
      tone: 'rose',
      loading: insightState.loading,
    },
  ];
  const heatmapRows = useMemo(() => buildHeatmapRows({
    tests: assessmentState.tests,
    results: assessmentState.results,
    learners: scopedLearners,
  }), [assessmentState.results, assessmentState.tests, scopedLearners]);
  const trendRows = useMemo(() => buildTrendRows({
    tests: assessmentState.tests,
    results: assessmentState.results,
  }), [assessmentState.results, assessmentState.tests]);
  const sectionCards = useMemo(() => buildSectionCards({
    learners: scopedLearners,
    tests: assessmentState.tests,
    results: assessmentState.results,
  }), [assessmentState.results, assessmentState.tests, scopedLearners]);
  const alertCards = useMemo(() => buildAlertCards({
    insightState,
    assessmentState,
    scopedLearners,
  }), [assessmentState, insightState, scopedLearners]);

  return (
  <div className="space-y-4 bg-slate-50 p-4 md:p-6">
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-indigo-700">
        Executive dashboard skeleton
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-slate-950">
        Academic command view
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-medium text-slate-600">
        This page now has the permanent dashboard structure. The next chunks will wire KPI,
        heatmap, trend, section and insight widgets to real academic data or explicit empty states.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <EmptyPanel
        icon={Grid}
        title="Performance Heatmap"
        description="A section-by-subject matrix will appear here when performance aggregation is connected."
      >
        <PerformanceHeatmap rows={heatmapRows} loading={assessmentState.loading} />
      </EmptyPanel>

      <EmptyPanel
        icon={LineChart}
        title="Performance Trend"
        description="Term-over-term movement will render here once historical assessment data is available."
      >
        <PerformanceTrend rows={trendRows} loading={assessmentState.loading} />
      </EmptyPanel>
    </div>

    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <EmptyPanel
        icon={BarChart3}
        title="Section Performance"
        description="Section cards will summarize grade, stream and class performance using real records."
      >
        <SectionPerformanceCards sections={sectionCards} loading={assessmentState.loading} />
      </EmptyPanel>

      <EmptyPanel
        icon={Sparkles}
        title="Insights & Alerts"
        description="Executive alerts will only appear when the analytics engine returns explainable signals."
      >
        <InsightAlertCards
          alerts={alertCards}
          loading={insightState.loading}
          error={insightState.error}
        />
      </EmptyPanel>
    </div>
  </div>
  );
};

export default ExecutiveDashboard;
