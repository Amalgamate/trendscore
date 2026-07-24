import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, BarChart3, BookOpen, GraduationCap, Loader2, Users } from 'lucide-react';
import { lmsAPI } from '../../../../../services/api/lms.api';
import { configAPI } from '../../../../../services/api/config.api';
import { learnerAPI } from '../../../../../services/api/learner.api';
import { useNotifications } from '../../../hooks/useNotifications';

function StatCard({ label, value, icon: Icon, subtext }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
          {subtext ? <div className="mt-1 text-xs text-gray-500">{subtext}</div> : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-brand-purple/10 p-2 text-brand-purple">
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, description, children, right }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataTable({ columns, rows, emptyLabel = 'No data found.' }) {
  if (!rows?.length) {
    return <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((r, idx) => (
            <tr key={r.id || idx} className="hover:bg-gray-50/60">
              {columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-4 py-3 text-gray-800">
                  {c.render ? c.render(r) : String(r?.[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'assignments', label: 'Assignments', icon: BookOpen },
  { id: 'lessons', label: 'Lessons', icon: Activity },
  { id: 'class', label: 'Class', icon: Users },
  { id: 'learner', label: 'Learner', icon: GraduationCap },
];

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatPct = (v) => `${Math.round(safeNumber(v, 0))}%`;
const formatMinutes = (mins) => {
  const m = safeNumber(mins, 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}m`;
};

export default function LearningAnalyticsPage() {
  const { showError } = useNotifications();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [terms, setTerms] = useState([]);
  const [termId, setTermId] = useState('');

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');

  const [admissionNumber, setAdmissionNumber] = useState('');
  const [resolvedLearner, setResolvedLearner] = useState(null);

  const [overview, setOverview] = useState(null);
  const [assignmentAnalytics, setAssignmentAnalytics] = useState([]);
  const [lessonEngagement, setLessonEngagement] = useState([]);
  const [classAnalytics, setClassAnalytics] = useState(null);
  const [learnerAnalytics, setLearnerAnalytics] = useState(null);

  // Reset tab-specific datasets when key filters change to avoid showing stale data.
  useEffect(() => {
    setOverview(null);
    setAssignmentAnalytics([]);
    setClassAnalytics(null);
    setLearnerAnalytics(null);
    // Keep lessonEngagement cached because it is not term-scoped on the backend.
  }, [termId]);

  useEffect(() => {
    setClassAnalytics(null);
  }, [classId]);

  useEffect(() => {
    setResolvedLearner(null);
    setLearnerAnalytics(null);
  }, [admissionNumber]);

  // ─── Bootstrap: terms + classes ────────────────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      try {
        const [termsRes, classesRes] = await Promise.all([
          configAPI.getTermConfigs(),
          configAPI.getClasses(),
        ]);
        const termList = termsRes?.data || termsRes || [];
        const classList = classesRes?.data || classesRes || [];
        setTerms(termList);
        setClasses(classList);

        const active = termList.find((t) => t.isActive) || termList[0];
        if (active?.id) setTermId(active.id);
      } catch (e) {
        console.error('[LMS Analytics] bootstrap error:', e);
        showError('Failed to load terms/classes for analytics.');
      }
    };
    boot();
  }, [showError]);

  const termLabel = useMemo(() => {
    const t = terms.find((x) => x.id === termId);
    return t?.name || t?.label || t?.term || 'Selected Term';
  }, [terms, termId]);

  const runWithLoading = async (fn) => {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      const msg = e?.message || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = useCallback(async () => {
    if (!termId) throw new Error('Please select a term.');
    const res = await lmsAPI.getAnalyticsOverview({ termId });
    setOverview(res?.data || res);
  }, [termId]);

  const loadAssignmentAnalytics = useCallback(async () => {
    if (!termId) throw new Error('Please select a term.');
    const res = await lmsAPI.getAssignmentAnalytics({ termId });
    setAssignmentAnalytics(res?.data || res || []);
  }, [termId]);

  const loadLessonEngagement = useCallback(async () => {
    const res = await lmsAPI.getLessonEngagementStats();
    setLessonEngagement(res?.data || res || []);
  }, []);

  const loadClassAnalytics = useCallback(async () => {
    if (!termId) throw new Error('Please select a term.');
    if (!classId) throw new Error('Please select a class.');
    const res = await lmsAPI.getClassAnalytics(classId, { termId });
    setClassAnalytics(res?.data || res);
  }, [termId, classId]);

  const resolveLearnerByAdmission = useCallback(async () => {
    if (!admissionNumber.trim()) throw new Error('Enter an admission number.');
    const res = await learnerAPI.getByAdmissionNumber(admissionNumber.trim());
    const learner = res?.data || res;
    if (!learner?.id) throw new Error('Learner not found for that admission number.');
    setResolvedLearner(learner);
    return learner;
  }, [admissionNumber]);

  const loadLearnerAnalytics = useCallback(async () => {
    if (!termId) throw new Error('Please select a term.');
    const learner = resolvedLearner?.id ? resolvedLearner : await resolveLearnerByAdmission();
    const res = await lmsAPI.getLearnerAnalytics(learner.id, { termId });
    setLearnerAnalytics(res?.data || res);
  }, [termId, resolvedLearner, resolveLearnerByAdmission]);

  // Auto-load tab data when tab changes (and term selected)
  useEffect(() => {
    if (!termId) return;

    // Avoid auto-calling learner/class endpoints until user chooses a selector
    if (activeTab === 'overview') runWithLoading(loadOverview);
    if (activeTab === 'assignments') runWithLoading(loadAssignmentAnalytics);
    if (activeTab === 'lessons') runWithLoading(loadLessonEngagement);
    // class + learner are loaded on button click (needs extra filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, termId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Analytics for engagement, completion, lessons, and assignment submissions.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600">Term</label>
            <select
              className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-purple focus:outline-none"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
            >
              <option value="">{terms.length ? 'Select term...' : 'No terms found'}</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.label || t.term || t.id}{t.isActive ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex min-w-max gap-1 p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
                  isActive ? 'bg-brand-purple text-white' : 'text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global error / loading */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5" />
            <div>
              <div className="font-semibold">Error</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <Loader2 className="animate-spin text-brand-purple" size={22} />
          <span className="ml-2 text-sm text-gray-600">Loading analytics...</span>
        </div>
      ) : null}

      {!loading && activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Active lessons" value={safeNumber(overview?.totalActiveLessons)} icon={Activity} subtext={termLabel} />
            <StatCard label="Assignments" value={safeNumber(overview?.totalAssignments)} icon={BookOpen} subtext={termLabel} />
            <StatCard label="Avg completion" value={formatPct(overview?.avgCompletionRate)} icon={BarChart3} subtext={termLabel} />
            <StatCard label="Avg submissions" value={formatPct(overview?.avgSubmissionRate)} icon={BarChart3} subtext={termLabel} />
            <StatCard label="Learning time" value={formatMinutes(overview?.totalLearningTimeMinutes)} icon={Activity} subtext={termLabel} />
          </div>

          <Section
            title="Top lessons by engagement"
            description="Lessons with the highest session/view activity for the selected term."
            right={
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => runWithLoading(loadOverview)}
              >
                Refresh
              </button>
            }
          >
            <DataTable
              columns={[
                { key: 'title', label: 'Lesson' },
                { key: 'viewCount', label: 'Views' },
                { key: 'avgCompletionPct', label: 'Avg completion', render: (r) => formatPct(r.avgCompletionPct) },
              ]}
              rows={overview?.topLessonsByEngagement || []}
              emptyLabel="No engagement data yet for this term."
            />
          </Section>
        </div>
      ) : null}

      {!loading && activeTab === 'assignments' ? (
        <Section
          title="Assignment analytics"
          description="Submission rates, average marks, and marking backlog for the selected term."
          right={
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => runWithLoading(loadAssignmentAnalytics)}
            >
              Refresh
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'title', label: 'Assignment' },
              { key: 'totalEnrolled', label: 'Enrolled' },
              { key: 'submittedCount', label: 'Submitted' },
              { key: 'submissionRate', label: 'Submission rate', render: (r) => formatPct(r.submissionRate) },
              { key: 'avgMark', label: 'Avg mark', render: (r) => (r.avgMark === null || r.avgMark === undefined ? '—' : safeNumber(r.avgMark)) },
              { key: 'pendingMarkingCount', label: 'Pending marking' },
            ]}
            rows={assignmentAnalytics}
            emptyLabel="No assignment analytics found for this term."
          />
        </Section>
      ) : null}

      {!loading && activeTab === 'lessons' ? (
        <Section
          title="Lesson engagement"
          description="Views, completion %, and average time spent per lesson."
          right={
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => runWithLoading(loadLessonEngagement)}
            >
              Refresh
            </button>
          }
        >
          <DataTable
            columns={[
              { key: 'title', label: 'Lesson' },
              { key: 'viewCount', label: 'Views' },
              { key: 'avgCompletionPct', label: 'Avg completion', render: (r) => formatPct(r.avgCompletionPct) },
              { key: 'avgTimeSpentMins', label: 'Avg time', render: (r) => formatMinutes(r.avgTimeSpentMins) },
            ]}
            rows={lessonEngagement}
            emptyLabel="No lesson engagement data found yet."
          />
        </Section>
      ) : null}

      {!loading && activeTab === 'class' ? (
        <Section
          title="Class analytics"
          description="Pick a class to view aggregated progress signals for the selected term."
          right={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600">Class</label>
                <select
                  className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-purple focus:outline-none"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">{classes.length ? 'Select class...' : 'No classes found'}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.label || [c.grade, c.stream].filter(Boolean).join(' ') || c.id}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                onClick={() => runWithLoading(loadClassAnalytics)}
              >
                Load
              </button>
            </div>
          }
        >
          {classAnalytics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Lessons started" value={safeNumber(classAnalytics.totalLessonsStarted)} icon={Activity} subtext={termLabel} />
              <StatCard label="Lessons completed" value={safeNumber(classAnalytics.totalLessonsCompleted)} icon={Activity} subtext={termLabel} />
              <StatCard label="Avg completion" value={formatPct(classAnalytics.avgCompletionPct)} icon={BarChart3} subtext={termLabel} />
              <StatCard label="Learners active" value={safeNumber(classAnalytics.learnersActive)} icon={Users} subtext={termLabel} />
              <StatCard label="Total session time" value={formatMinutes(classAnalytics.totalSessionMinutes)} icon={Activity} subtext={termLabel} />
              <StatCard label="Avg session time" value={formatMinutes(classAnalytics.avgSessionMinutes)} icon={Activity} subtext={termLabel} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              Select a class and click “Load”.
            </div>
          )}
        </Section>
      ) : null}

      {!loading && activeTab === 'learner' ? (
        <Section
          title="Learner analytics"
          description="Enter an admission number to fetch the learner, then view analytics for the selected term."
          right={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-600">Admission number</label>
                <input
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder="e.g. 0123"
                  className="mt-1 w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-purple focus:outline-none"
                />
              </div>
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => runWithLoading(resolveLearnerByAdmission)}
              >
                Find learner
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                onClick={() => runWithLoading(loadLearnerAnalytics)}
              >
                Load analytics
              </button>
            </div>
          }
        >
          {resolvedLearner ? (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
              <span className="font-semibold">Learner:</span>{' '}
              {[resolvedLearner.firstName, resolvedLearner.lastName].filter(Boolean).join(' ') || 'Learner'}{' '}
              <span className="text-gray-500">({resolvedLearner.admissionNumber || resolvedLearner.id})</span>
            </div>
          ) : null}

          {learnerAnalytics ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Lessons started" value={safeNumber(learnerAnalytics.lessonsStarted)} icon={Activity} subtext={termLabel} />
              <StatCard label="Lessons completed" value={safeNumber(learnerAnalytics.lessonsCompleted)} icon={Activity} subtext={termLabel} />
              <StatCard label="Learning time" value={formatMinutes(learnerAnalytics.totalLearningMinutes)} icon={Activity} subtext={termLabel} />
              <StatCard label="Submission rate" value={formatPct(learnerAnalytics.assignmentSubmissionRate)} icon={BarChart3} subtext={termLabel} />
              <StatCard label="Average mark" value={learnerAnalytics.avgMark == null ? '—' : safeNumber(learnerAnalytics.avgMark)} icon={BarChart3} subtext={termLabel} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              Find a learner and click “Load analytics”.
            </div>
          )}
        </Section>
      ) : null}
    </div>
  );
}
