/**
 * PathwayPlanner — Student-facing pathway journey
 *
 * Shows the authenticated student:
 *   Step 1 — Pathway recommendation (predicted pathway, confidence bar,
 *             cluster score breakdown, career suggestions, growth tips)
 *   Step 2 — Selection status (if SECONDARY: current LearnerPathwaySelection
 *             status, pathway + combination name, locked indicator)
 *   Step 3 — Subject combination preview (read-only; teacher/admin selects)
 *
 * Data is fetched from:
 *   dashboardAPI.getStudentMetrics()    → learnerId, grade, institutionType
 *   pathwayAPI.getRecommendation()      → deterministic CBC pathway prediction
 *   seniorPathwayAPI.getLearnerSelection() → current selection (SECONDARY only)
 *
 * All data is real — no placeholders. Honest empty states when nothing exists.
 *
 * Pathway Planner — Phase 1, Task 1.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap, ChevronDown, ChevronUp,
  Star, TrendingUp, BookOpen, Lightbulb,
  Lock, AlertCircle,
  Loader2, GraduationCap, Download,
} from 'lucide-react';
import { dashboardAPI, pathwayAPI, seniorPathwayAPI, pathwayPlannerAPI, careerAPI } from '../../../../services/api';
import PathwaySelectionStep from './PathwaySelectionStep';
import DiscoverMePanel from '../../shared/DiscoverMePanel';
import { generatePathwayPlanPDF } from '../../../../utils/pathwayPlanPDF';
import DecisionPlanPanel from '../../shared/DecisionPlanPanel';
import SchoolMatchingPanel from '../../shared/SchoolMatchingPanel';
import StudentPathwayWorkspace from '../../shared/StudentPathwayWorkspace';
import SelectionStatusChip from '../../shared/SelectionStatusChip';

// ─── Constants ────────────────────────────────────────────────────────────────

const PATHWAY_META = {
  STEM: {
    label: 'STEM',
    sub: 'Science, Technology, Engineering & Mathematics',
    color: '#1d4ed8',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    bar: 'bg-blue-500',
    icon: '🔬',
  },
  'Social Sciences': {
    label: 'Social Sciences',
    sub: 'Languages, Humanities, Business & Law',
    color: '#b45309',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    bar: 'bg-amber-500',
    icon: '📚',
  },
  'Arts and Sports Science': {
    label: 'Arts & Sports Science',
    sub: 'Creative Arts, Performing Arts & Sports',
    color: '#065f46',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    bar: 'bg-emerald-500',
    icon: '🎨',
  },
};
PATHWAY_META.SOCIAL_SCIENCES = PATHWAY_META['Social Sciences'];
PATHWAY_META.ARTS_SPORTS = PATHWAY_META['Arts and Sports Science'];

// STATUS_CONFIG for selection chips is now provided by SelectionStatusChip shared component.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveLearnerId(metrics) {
  return (
    metrics?.learner?.id ||
    metrics?.learnerId ||
    metrics?.profile?.id ||
    null
  );
}

function resolveGrade(metrics) {
  return metrics?.learner?.grade || metrics?.grade || metrics?.profile?.grade || '';
}

function resolveInstitutionType(metrics) {
  return (
    metrics?.learner?.institutionType ||
    metrics?.institutionType ||
    metrics?.profile?.institutionType ||
    ''
  );
}

function isSecondary(institutionType, grade) {
  const g = String(grade || '').toUpperCase();
  const it = String(institutionType || '').toUpperCase();
  return it === 'SECONDARY' || ['GRADE10', 'GRADE11', 'GRADE12', 'GRADE_10', 'GRADE_11', 'GRADE_12'].includes(g);
}

function isJuniorTransitionGrade(grade) {
  const value = String(grade || '').toUpperCase().replace(/[\s_-]+/g, '');
  return ['GRADE7', 'GRADE8', 'GRADE9'].includes(value);
}

function normalizePathwayCode(value) {
  return String(value || '').toUpperCase().replace(/&/g, 'AND').replace(/[\s-]+/g, '_');
}

function currentTermAndYear() {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  const term = m <= 4 ? 'TERM_1' : m <= 8 ? 'TERM_2' : 'TERM_3';
  return { term, academicYear: y };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skel = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />
);

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value = 0 }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confidence</span>
        <span className="text-sm font-black" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Cluster Bar ──────────────────────────────────────────────────────────────

function ClusterBreakdown({ breakdown = {} }) {
  const clusters = [
    { key: 'STEM',   label: 'STEM',          color: '#1d4ed8', score: breakdown.STEM  || 0 },
    { key: 'Social', label: 'Social Sci.',   color: '#b45309', score: breakdown.Social || 0 },
    { key: 'Arts',   label: 'Arts & Sports', color: '#065f46', score: breakdown.Arts   || 0 },
  ];
  return (
    <div className="space-y-2">
      {clusters.map(({ key, label, color, score }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-semibold text-gray-600">{label}</span>
            <span className="text-[11px] font-bold text-gray-800">{score}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(score, 100)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Career Card ──────────────────────────────────────────────────────────────

function CareerList({ careers = [] }) {
  if (!careers.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {careers.map((c, i) => (
        <span
          key={i}
          className="rounded-full border border-[#06285a]/20 bg-[#06285a]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#06285a]"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ─── Growth Tips ──────────────────────────────────────────────────────────────

function GrowthTips({ tips = [] }) {
  if (!tips.length) return null;
  return (
    <ul className="space-y-1.5">
      {tips.map((tip, i) => (
        <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
          <Star size={11} className="flex-shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Selection Status Card ────────────────────────────────────────────────────

function SelectionStatusCard({ selection }) {
  if (!selection) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
        <BookOpen size={20} className="mx-auto mb-1.5 text-gray-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-500">No subject selection yet</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Your teacher or school will guide you through pathway selection.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${selection.status === 'LOCKED' ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Selection Status</p>
          <SelectionStatusChip status={selection.status} />
        </div>
        {selection.locked && (
          <Lock size={16} className="text-violet-500 flex-shrink-0 mt-0.5" aria-label="Selection locked" />
        )}
      </div>
      {selection.pathway && (
        <p className="mt-2 text-sm font-bold text-gray-900">{selection.pathway.name}</p>
      )}
      {selection.track && (
        <p className="text-[11px] text-gray-500">{selection.track.name}</p>
      )}
      {selection.combinationRule && (
        <p className="text-[11px] text-gray-500 mt-0.5">
          Combination: <span className="font-semibold">{selection.combinationRule.name}</span>
        </p>
      )}
      {selection.items?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {selection.items.map((item) => (
            <span
              key={item.id}
              className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700"
            >
              {item.officialLearningArea?.officialName || item.officialLearningArea?.officialCode}
            </span>
          ))}
        </div>
      )}
      {selection.status === 'REJECTED' && (() => {
        const latestRejection = (selection.approvals || []).find(a => a.status === 'REJECTED');
        return latestRejection?.comment ? (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5">
            <p className="text-[10px] font-bold text-rose-700 mb-0.5">Your counsellor asked you to revise:</p>
            <p className="text-[11px] text-rose-700">“{latestRejection.comment}”</p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PathwayPlanner = ({ user, onNavigate, brandingSettings }) => {
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [learnerId, setLearnerId]           = useState(null);
  const [grade, setGrade]                   = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [metricsError, setMetricsError]     = useState(null);

  const [loadingRec, setLoadingRec]   = useState(false);
  const [recommendation, setRec]      = useState(null);
  const [recError, setRecError]       = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const [loadingSel, setLoadingSel]   = useState(false);
  const [selection, setSelection]     = useState(null);
  const [activeStep, setActiveStep]   = useState(0);
  const [workspaceRefresh, setWorkspaceRefresh] = useState(0);

  // ── PDF export state ──────────────────────────────────────────────────────
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // ── Step 4: combination picker state ─────────────────────────────────────
  const [combinations, setCombinations]       = useState([]);
  const [selectedComboId, setSelectedComboId] = useState('');
  const [combinationImpact, setCombinationImpact] = useState(null);

  // ── Step 1: resolve learner from dashboard metrics ────────────────────────
  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setMetricsError(null);
    try {
      const res = await dashboardAPI.getStudentMetrics();
      const d   = res?.data || res;
      const lid = resolveLearnerId(d);
      setLearnerId(lid);
      setGrade(resolveGrade(d));
      setInstitutionType(resolveInstitutionType(d));
    } catch (e) {
      setMetricsError(e?.message || 'Failed to load your profile');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // ── Step 2: pathway recommendation ───────────────────────────────────────
  const loadRecommendation = useCallback(async (lid, instType, gradeVal) => {
    if (!lid) return;
    setLoadingRec(true);
    setRecError(null);
    try {
      const secondary = isSecondary(instType, gradeVal);
      const { term, academicYear } = currentTermAndYear();
      const res = secondary
        ? await pathwayAPI.getTransitionDecisionHistory(lid)
        : await pathwayAPI.getRecommendation(lid, { term, academicYear });
      // Shape: { success, data: { learner, prediction: { predictedPathway, confidence, ... }, recommendation } }
      const rawPayload = res?.data || res || null;
      const latestHistorical = secondary && Array.isArray(rawPayload) ? rawPayload[0] : null;
      const payload = latestHistorical ? {
        predictedPathway: latestHistorical.finalApprovedPathway || latestHistorical.recommendedPathway,
        confidence: latestHistorical.confidenceScore || 0,
        justification: 'Historical transition recommendation retained for senior pathway tracking.',
        careerRecommendations: [], growthAreas: [], clusterBreakdown: {},
      } : rawPayload;
      // Surface the prediction sub-object as the rec; fall back to the top-level object
      // if the shape differs (e.g. future refactors).
      const rec = payload?.prediction ?? payload;
      setRec(rec);
    } catch (e) {
      const msg = String(e?.message || '');
      // Grade 10–12 learners get a 400 from the recommendation endpoint —
      // show a helpful message rather than a red error.
      if (msg.toLowerCase().includes('grade 7') || msg.toLowerCase().includes('grade10') || msg.includes('400')) {
        setRec({ predictedPathway: 'Analysis Pending', confidence: 0, justification: '', careerRecommendations: [], growthAreas: [], clusterBreakdown: {} });
      } else {
        setRecError(msg || 'Recommendation unavailable');
      }
    } finally {
      setLoadingRec(false);
    }
  }, []);

  // ── Step 3: senior pathway selection (SECONDARY only) ────────────────────
  const loadSelection = useCallback(async (lid, instType, gradeVal) => {
    if (!lid) return;
    if (!isSecondary(instType, gradeVal)) return;
    setLoadingSel(true);
    try {
      const res = await seniorPathwayAPI.getLearnerSelection(lid);
      setSelection(res?.data || null);
    } catch {
      setSelection(null);
    } finally {
      setLoadingSel(false);
    }
  }, []);

  useEffect(() => {
    if (learnerId) {
      loadRecommendation(learnerId, institutionType, grade);
      loadSelection(learnerId, institutionType, grade);
    }
  }, [learnerId, grade, institutionType, loadRecommendation, loadSelection]);

  // Reference combinations are used for junior exploration. Senior selection is
  // handled by the dedicated PathwaySelectionStep shown at the top of the page.
  useEffect(() => {
    if (!learnerId) return;
    let cancelled = false;
    Promise.allSettled([
      seniorPathwayAPI.getCombinations(),
    ]).then(([combosRes]) => {
      if (cancelled) return;
      if (combosRes.status === 'fulfilled') setCombinations(combosRes.value?.data || []);
    });
    return () => { cancelled = true; };
  }, [learnerId, institutionType, grade]);

  useEffect(() => {
    if (!learnerId || !selectedComboId) { setCombinationImpact(null); return; }
    let cancelled = false;
    careerAPI.getSavedCareers(learnerId)
      .then((response) => {
        const careerIds = (response?.data || []).map((item) => item.careerId);
        if (!careerIds.length) return null;
        return careerAPI.getCombinationImpact(learnerId, careerIds, [selectedComboId]);
      })
      .then((response) => { if (!cancelled) setCombinationImpact(response?.data?.[0] || null); })
      .catch(() => { if (!cancelled) setCombinationImpact(null); });
    return () => { cancelled = true; };
  }, [learnerId, selectedComboId]);

  const meta = PATHWAY_META[recommendation?.predictedPathway] || null;
  const isSecondaryStudent = isSecondary(institutionType, grade);
  const isJuniorStudent = isJuniorTransitionGrade(grade);
  const journeySteps = useMemo(() => isSecondaryStudent ? [
    { id: 'evidence', label: 'Evidence', short: 'Review your pathway evidence' },
    { id: 'selection', label: 'Combination', short: 'Confirm your subject combination' },
    { id: 'progress', label: 'Progress', short: 'Track actions and support' },
    { id: 'decision', label: 'Decision plan', short: 'Submit for review' },
  ] : [
    { id: 'discover', label: 'Discover Me', short: 'Tell us about your interests' },
    { id: 'recommendation', label: 'Recommendation', short: 'Understand your pathway fit' },
    { id: 'careers', label: 'Careers', short: 'Explore future possibilities' },
    { id: 'combinations', label: 'Combinations', short: 'Compare subject options' },
    { id: 'schools', label: 'Schools', short: 'Build a senior-school shortlist' },
    { id: 'decision', label: 'Decision plan', short: 'Share your plan for review' },
  ], [isSecondaryStudent]);
  const activeStepId = journeySteps[activeStep]?.id || journeySteps[0].id;
  const goToStep = (index) => setActiveStep(Math.max(0, Math.min(journeySteps.length - 1, index)));
  const goNext = () => goToStep(activeStep + 1);
  const handleDiscoverMeSaved = () => {
    setWorkspaceRefresh((value) => value + 1);
    loadRecommendation(learnerId, institutionType, grade);
    goNext();
  };
  const pending = recommendation?.predictedPathway === 'Analysis Pending' || !recommendation?.predictedPathway;
  const juniorCombinations = useMemo(() => {
    const recommended = normalizePathwayCode(recommendation?.predictedPathway);
    const pathwayAliases = recommended === 'SOCIAL_SCIENCES' || recommended === 'SOCIAL_SCIENCE'
      ? ['SOCIAL_SCIENCES', 'SOCIAL_SCIENCE']
      : recommended.includes('ARTS') ? ['ARTS_SPORTS', 'ARTS_AND_SPORTS_SCIENCE'] : [recommended];
    const matched = combinations.filter((combo) => pathwayAliases.includes(normalizePathwayCode(combo.pathway?.code || combo.pathway?.name)));
    return (matched.length ? matched : combinations).slice(0, 12);
  }, [combinations, recommendation?.predictedPathway]);

  // ── PDF export ────────────────────────────────────────────────────────────
  const downloadPDF = useCallback(async () => {
    if (!learnerId) return;
    setGeneratingPDF(true);
    try {
      // Fetch extra data needed for the PDF that may not be in local state
      const [schoolPrefRes, notesRes] = await Promise.allSettled([
        pathwayPlannerAPI.getSchoolPreferences(learnerId),
        pathwayPlannerAPI.getCounsellorNotes(learnerId),
      ]);
      const schoolPreferences = schoolPrefRes.status === 'fulfilled' ? (schoolPrefRes.value?.data || []) : [];
      const counsellorNotes   = notesRes.status === 'fulfilled'      ? (notesRes.value?.data || [])       : [];

      // Build learner object from metrics data
      const learner = {
        id:              learnerId,
        firstName:       user?.firstName || '',
        lastName:        user?.lastName  || '',
        admissionNumber: user?.username  || '',
        grade,
        institutionType,
      };

      await generatePathwayPlanPDF({
        learner,
        recommendation,
        selection,
        schoolPreferences,
        counsellorNotes,
        brandingSettings: brandingSettings ?? undefined,
      });
    } catch (e) {
      console.error('[PathwayPlanner] PDF export failed:', e?.message);
    } finally {
      setGeneratingPDF(false);
    }
  }, [learnerId, recommendation, selection, grade, institutionType, user, brandingSettings]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (loadingMetrics) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-[#06285a] px-4 pt-6 pb-8">
          <Skel className="h-6 w-40 mb-2" />
          <Skel className="h-8 w-56" />
        </div>
        <div className="px-4 -mt-4 space-y-3">
          <Skel className="h-40 w-full rounded-2xl" />
          <Skel className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-rose-400" />
          <p className="text-sm font-semibold text-gray-700">{metricsError}</p>
          <button
            type="button"
            onClick={loadMetrics}
            className="mt-3 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── Header ── */}
      <div className="bg-[#06285a] px-4 pt-6 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-0.5">
              My Future
            </p>
            <h1 className="text-white text-2xl font-black">Pathway Planner</h1>
            {grade && (
              <p className="text-white/60 text-[11px] mt-1">
                {String(grade).replace('GRADE_', 'Grade ').replace('GRADE', 'Grade ')}
                {isSecondaryStudent ? ' · Senior Secondary' : ' · Junior Secondary'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('pathway-guide')}
            className="shrink-0 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[10px] font-black text-white hover:bg-white/20"
          >
            Pathway Guide
          </button>
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">

        {/* Guided journey: one decision at a time, with a live progress report. */}
        {learnerId && (
          <StudentPathwayWorkspace
            learnerId={learnerId}
            recommendation={recommendation}
            selection={selection}
            stage={isSecondaryStudent ? 'senior' : 'junior'}
            summaryOnly
            refreshKey={workspaceRefresh}
          />
        )}

        <section className="rounded-2xl border border-[#06285a]/10 bg-white p-3 shadow-sm" aria-label="Pathway journey steps">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06285a]/60">Your pathway journey</p>
              <p className="mt-1 text-xs font-bold text-gray-800">{journeySteps[activeStep]?.short}</p>
            </div>
            <span className="rounded-full bg-[#06285a]/5 px-2.5 py-1 text-[10px] font-black text-[#06285a]">Step {activeStep + 1} of {journeySteps.length}</span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#06285a] transition-all" style={{ width: `${((activeStep + 1) / journeySteps.length) * 100}%` }} />
          </div>
          <div className={`grid gap-1.5 ${isSecondaryStudent ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'}`} role="tablist" aria-label="Pathway steps">
            {journeySteps.map((step, index) => (
              <button key={step.id} type="button" role="tab" aria-selected={activeStep === index} onClick={() => goToStep(index)}
                className={`rounded-xl border px-1.5 py-2 text-center transition-colors ${activeStep === index ? 'border-[#06285a] bg-[#06285a] text-white shadow-sm' : index < activeStep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-[#06285a]/30'}`}>
                <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[9px] font-black">{index < activeStep ? '✓' : index + 1}</span>
                <span className="mt-1 block truncate text-[9px] font-black">{step.label}</span>
              </button>
            ))}
          </div>
        </section>

        {isSecondaryStudent && activeStepId === 'selection' && (
          <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">My senior pathway</p>
              <p className="mt-1 text-[11px] text-gray-600">Track your current combination, approvals, actions and support before reviewing your earlier transition evidence.</p>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400"><BookOpen size={11} aria-hidden="true" /> Current subject combination</p>
              {loadingSel ? <Skel className="h-24 w-full rounded-xl" /> : <SelectionStatusCard selection={selection} />}
            </div>
            {learnerId && !loadingSel && <PathwaySelectionStep learnerId={learnerId} existingSelection={selection} onSuccess={() => loadSelection(learnerId, institutionType, grade)} />}
          </section>
        )}

        {/* ── Recommendation card ── */}
        {activeStepId === (isSecondaryStudent ? 'evidence' : 'recommendation') && <div className={`rounded-2xl overflow-hidden border shadow-sm ${meta ? `${meta.bg} ${meta.border}` : 'bg-white border-gray-200'}`}>

          {/* Card header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {meta && (
                  <span className="text-2xl" role="img" aria-label={meta.label}>{meta.icon}</span>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Recommended Pathway
                  </p>
                  {loadingRec ? (
                    <Skel className="h-6 w-40 mt-1" />
                  ) : recError ? (
                    <p className="text-sm font-semibold text-rose-600 mt-1">{recError}</p>
                  ) : pending ? (
                    <p className="text-sm font-bold text-gray-500 mt-1">Analysis Pending</p>
                  ) : (
                    <p className={`text-lg font-black mt-0.5 ${meta?.text || 'text-gray-900'}`}>
                      {recommendation.predictedPathway}
                    </p>
                  )}
                  {meta && !loadingRec && !pending && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{meta.sub}</p>
                  )}
                </div>
              </div>

              {!loadingRec && !pending && recommendation && (
                <button
                  type="button"
                  onClick={() => setShowDetails(v => !v)}
                  aria-expanded={showDetails}
                  className="flex-shrink-0 rounded-xl border border-gray-200 bg-white/70 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06285a]"
                >
                  {showDetails ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                  {showDetails ? 'Less' : 'Details'}
                </button>
              )}
            </div>

            {/* Confidence bar */}
            {!loadingRec && !pending && recommendation?.confidence != null && (
              <div className="mt-3">
                <ConfidenceBar value={recommendation.confidence} />
              </div>
            )}
          </div>

          {/* Expandable details */}
          {showDetails && !loadingRec && recommendation && !pending && (
            <div className="border-t border-white/50 px-4 py-3 space-y-4 bg-white/60">

              {/* Cluster breakdown */}
              {recommendation.clusterBreakdown && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} aria-hidden="true" /> Subject Cluster Scores
                  </p>
                  <ClusterBreakdown breakdown={recommendation.clusterBreakdown} />
                </div>
              )}

              {/* Justification */}
              {recommendation.justification && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Lightbulb size={11} aria-hidden="true" /> Why this pathway?
                  </p>
                  <p className="text-[12px] text-gray-700 leading-relaxed">{recommendation.justification}</p>
                </div>
              )}

              {/* Career suggestions */}
              {recommendation.careerRecommendations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    <Star size={11} aria-hidden="true" /> Career Paths
                  </p>
                  <CareerList careers={recommendation.careerRecommendations} />
                </div>
              )}

              {/* Growth tips */}
              {recommendation.growthAreas?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                    <Zap size={11} aria-hidden="true" /> How to Grow
                  </p>
                  <GrowthTips tips={recommendation.growthAreas} />
                </div>
              )}
            </div>
          )}

          {/* Pending state */}
          {!loadingRec && pending && !recError && (
            <div className="px-4 pb-4">
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <GraduationCap size={20} className="mx-auto mb-1.5 text-gray-300" aria-hidden="true" />
                <p className="text-xs text-gray-500">
                  No results recorded yet for this term. Results will appear once your teacher enters them.
                </p>
              </div>
            </div>
          )}
        </div>}

        {/* ── Discover Me — interests & strengths feed the 15% learner-interest weight ── */}
        {learnerId && !isSecondaryStudent && activeStepId === 'discover' && (
          <DiscoverMePanel
            learnerId={learnerId}
            onSaved={handleDiscoverMeSaved}
          />
        )}

        {isJuniorStudent && activeStepId === 'careers' && (
          <section className="space-y-4 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Step 3 · Career studio</p>
              <h2 className="mt-1 text-lg font-black text-gray-900">Explore the futures that excite you</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">Browse careers, open the details, compare your favourites, and save the ones you want to discuss with your parent or counsellor.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {['Browse every career family', 'Compare up to four choices', 'Save a shortlist for review'].map((item, index) => <div key={item} className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-lg font-black text-rose-600">0{index + 1}</p><p className="mt-1 text-[11px] font-bold text-gray-800">{item}</p></div>)}
            </div>
            <button type="button" onClick={() => onNavigate?.('student-career-explorer')} className="w-full rounded-xl bg-rose-600 py-3 text-xs font-black text-white shadow-sm hover:bg-rose-700">Open Career Explorer</button>
            <p className="text-center text-[10px] text-gray-400">Your saved careers will appear in the progress report when you return.</p>
          </section>
        )}

        {isJuniorStudent && activeStepId === 'combinations' && (
          <section className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Explore subject combinations</p>
              <p className="mt-1 text-[11px] text-gray-600">These are planning options for senior school. Exploring one does not submit or lock a subject selection.</p>
            </div>
            {juniorCombinations.length === 0 ? <p className="text-xs text-gray-400">Combination reference data is not available yet.</p> : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{juniorCombinations.map((combo) => <label key={combo.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selectedComboId === combo.id ? 'border-violet-300 bg-violet-50' : 'border-gray-200'}`}><input type="radio" name="junior-combination" checked={selectedComboId === combo.id} onChange={() => setSelectedComboId(combo.id)} className="mt-1 text-violet-600" /><div><p className="text-xs font-black text-gray-900">{combo.name}</p><p className="text-[10px] text-gray-500">{combo.pathway?.name} › {combo.track?.name}</p><div className="mt-1 flex flex-wrap gap-1">{(combo.items || []).map((item) => <span key={item.id || item.officialLearningArea?.id} className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-gray-600">{item.officialLearningArea?.officialName}</span>)}</div></div></label>)}</div>
            )}
            {combinationImpact?.careers?.length > 0 && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3"><p className="text-[10px] font-black uppercase text-indigo-700">Career door analysis</p><div className="mt-2 space-y-1">{combinationImpact.careers.map((item) => <div key={item.career.id} className="flex justify-between gap-2 rounded-lg bg-white p-2"><div><p className="text-[10px] font-bold text-gray-800">{item.career.title}</p><p className="text-[9px] text-gray-500">{item.explanation}</p></div><span className={`h-fit rounded-full px-2 py-0.5 text-[8px] font-black ${item.classification.includes('SUPPORTS') ? 'bg-emerald-100 text-emerald-700' : item.classification === 'MAY_RESTRICT' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{item.classification.replaceAll('_', ' ')}</span></div>)}</div></div>}
            <button type="button" onClick={() => goToStep(journeySteps.findIndex((step) => step.id === 'careers'))} className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-[11px] font-black text-violet-700">Return to Career Studio</button>
          </section>
        )}

        {/* ── Decision Plan lifecycle ── */}
        {isJuniorStudent && learnerId && activeStepId === 'decision' && (
          <StudentPathwayWorkspace learnerId={learnerId} recommendation={recommendation} selection={selection} stage="junior" refreshKey={workspaceRefresh} />
        )}

        {isJuniorStudent && learnerId && activeStepId === 'schools' && (
          <SchoolMatchingPanel learnerId={learnerId} title="Find Senior Schools" />
        )}

        {isSecondaryStudent && learnerId && activeStepId === 'progress' && (
          <>
            <StudentPathwayWorkspace learnerId={learnerId} recommendation={recommendation} selection={selection} stage="senior" refreshKey={workspaceRefresh} />
            <details className="rounded-2xl border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer text-xs font-black text-gray-700">Previous school decision and alternatives</summary>
              <div className="mt-3"><SchoolMatchingPanel learnerId={learnerId} title="Senior school alternatives" /></div>
            </details>
          </>
        )}

        {isJuniorStudent && learnerId && activeStepId === 'decision' && (
          <DecisionPlanPanel learnerId={learnerId} mode="student" onChanged={() => setWorkspaceRefresh((value) => value + 1)} />
        )}

        {isSecondaryStudent && learnerId && activeStepId === 'decision' && (
          <DecisionPlanPanel learnerId={learnerId} mode="student" onChanged={() => setWorkspaceRefresh((value) => value + 1)} />
        )}


        {/* ── Download Plan PDF ── */}
        {!pending && recommendation && (
          <button
            type="button"
            onClick={downloadPDF}
            disabled={generatingPDF}
            className="w-full rounded-2xl border border-[#06285a]/20 bg-[#06285a]/5 py-3 text-sm font-black text-[#06285a] flex items-center justify-center gap-2 hover:bg-[#06285a]/10 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06285a]"
          >
            {generatingPDF
              ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Generating PDF…</>
              : <><Download size={14} aria-hidden="true" /> Download Pathway Plan (PDF)</>}
          </button>
        )}

        <section className="flex items-center justify-between gap-3 rounded-2xl border border-[#06285a]/10 bg-white p-3 shadow-sm">
          <button type="button" onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 0} className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">← Back</button>
          <p className="text-center text-[10px] font-semibold text-gray-500">{activeStep === journeySteps.length - 1 ? 'Your plan is ready for review.' : `Next: ${journeySteps[activeStep + 1]?.label}`}</p>
          <button type="button" onClick={goNext} disabled={activeStep === journeySteps.length - 1} className="rounded-xl bg-[#06285a] px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Continue →</button>
        </section>

      </div>
    </div>
  );
};

export default PathwayPlanner;
