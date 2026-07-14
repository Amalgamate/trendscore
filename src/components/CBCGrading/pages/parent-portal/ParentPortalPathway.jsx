/**
 * ParentPortalPathway — Parent-facing pathway view
 *
 * Per-child expandable cards. Each card shows:
 *   - Recommended pathway (from deterministic scoring engine)
 *   - Confidence bar + cluster breakdown
 *   - Career suggestions for the recommended pathway
 *   - Selection status (SECONDARY learners only)
 *   - Parent preference input (radio: STEM / Social Sciences / Arts / No preference)
 *     Saves via pathwayAPI.saveTransitionDecision({ parentPreference })
 *
 * Data sources:
 *   dashboardAPI.getParentMetrics()         → children list
 *   pathwayAPI.getRecommendation(id, ...)   → deterministic pathway prediction
 *   seniorPathwayAPI.getLearnerSelection()  → selection status (SECONDARY)
 *   pathwayAPI.saveTransitionDecision()     → save parent preference
 *
 * Pathway Planner — Phase 1, Task 3.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Star, TrendingUp,
  BookOpen, CheckCircle2, Lock, Clock,
  Users, Loader2, AlertCircle, Heart,
} from 'lucide-react';
import { dashboardAPI, pathwayAPI, seniorPathwayAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';
import DecisionPlanPanel from '../../shared/DecisionPlanPanel';
import ParentCareerReviewPanel from '../../shared/ParentCareerReviewPanel';
import StudentPathwayWorkspace from '../../shared/StudentPathwayWorkspace';

// ─── Constants ────────────────────────────────────────────────────────────────

const PATHWAY_META = {
  STEM: {
    label: 'STEM',
    icon: '🔬',
    color: '#1d4ed8',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
  },
  'Social Sciences': {
    label: 'Social Sciences',
    icon: '📚',
    color: '#b45309',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
  },
  'Arts and Sports Science': {
    label: 'Arts & Sports Science',
    icon: '🎨',
    color: '#065f46',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
  },
};

const PREFERENCE_OPTIONS = [
  { value: 'STEM',                   label: '🔬 STEM' },
  { value: 'Social Sciences',        label: '📚 Social Sciences' },
  { value: 'Arts and Sports Science',label: '🎨 Arts & Sports Science' },
  { value: '',                        label: 'No preference yet' },
];

const STATUS_CONFIG = {
  DRAFT:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: Clock },
  SUBMITTED: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700 border-blue-200',      icon: TrendingUp },
  APPROVED:  { label: 'Approved',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  REJECTED:  { label: 'Needs Revision', cls: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertCircle },
  LOCKED:    { label: 'Locked',    cls: 'bg-violet-100 text-violet-700 border-violet-200', icon: Lock },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentTermAndYear() {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  const term = m <= 4 ? 'TERM_1' : m <= 8 ? 'TERM_2' : 'TERM_3';
  return { term, academicYear: y };
}

function isSecondary(child) {
  const it = String(child?.institutionType || '').toUpperCase();
  const g  = String(child?.grade || '').toUpperCase().replace('_', '');
  return it === 'SECONDARY' || ['GRADE10','GRADE11','GRADE12'].includes(g);
}

function isJuniorTransition(child) {
  const grade = String(child?.grade || '').toUpperCase().replace(/[_\s-]/g, '');
  return ['GRADE7', 'GRADE8', 'GRADE9'].includes(grade);
}

function getPhoto(child) {
  return child?.photoUrl || child?.profilePicture || child?.photo || null;
}

// ─── ConfidenceBar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value = 0 }) {
  const pct = Math.min(100, Math.max(0, value));
  const col = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
      </div>
      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: col }}>{pct}%</span>
    </div>
  );
}

// ─── ClusterBar ───────────────────────────────────────────────────────────────

function ClusterBar({ label, value = 0, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-bold text-gray-700">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(value,100)}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Family Preferences (structured search criteria) ─────────────────────────

const BUDGET_BAND_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const BOARDING_OPTIONS = [
  { value: '', label: 'No preference' },
  { value: 'DAY', label: 'Day' },
  { value: 'BOARDING', label: 'Boarding' },
  { value: 'EITHER', label: 'Either' },
];

function FamilyPreferencesForm({ childId }) {
  const [criteria, setCriteria]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState(null);
  const [countiesInput, setCountiesInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await seniorPathwayAPI.getSearchCriteria(childId);
        if (cancelled) return;
        const data = res?.data || null;
        setCriteria({
          budgetBand: data?.budgetBand || '',
          boardingPreference: data?.boardingPreference || '',
          faithPreference: data?.faithPreference || '',
          notes: data?.notes || '',
        });
        setCountiesInput((data?.preferredCounties || []).join(', '));
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load preferences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [childId]);

  const update = (field, value) => setCriteria(c => ({ ...c, [field]: value }));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const preferredCounties = countiesInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await seniorPathwayAPI.updateSearchCriteria(childId, {
        budgetBand: criteria.budgetBand || null,
        boardingPreference: criteria.boardingPreference || null,
        preferredCounties,
        faithPreference: criteria.faithPreference || null,
        notes: criteria.notes || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!criteria) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-2">
        Family School Preferences
      </p>
      <p className="text-[11px] text-gray-600 mb-2">
        Helps your counsellor tailor senior school suggestions. Optional.
      </p>

      {error && <p className="text-[11px] text-rose-600 mb-2">{error}</p>}

      <div className="space-y-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Budget band</label>
          <select
            value={criteria.budgetBand}
            onChange={e => update('budgetBand', e.target.value)}
            className="w-full rounded-lg border border-gray-200 text-[12px] py-1.5 px-2"
          >
            {BUDGET_BAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Boarding preference</label>
          <select
            value={criteria.boardingPreference}
            onChange={e => update('boardingPreference', e.target.value)}
            className="w-full rounded-lg border border-gray-200 text-[12px] py-1.5 px-2"
          >
            {BOARDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Preferred counties</label>
          <input
            type="text"
            value={countiesInput}
            onChange={e => setCountiesInput(e.target.value)}
            placeholder="e.g. Nairobi, Kiambu, Nakuru"
            className="w-full rounded-lg border border-gray-200 text-[12px] py-1.5 px-2"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Comma-separated</p>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Faith preference</label>
          <input
            type="text"
            value={criteria.faithPreference}
            onChange={e => update('faithPreference', e.target.value)}
            placeholder="e.g. Catholic, Muslim, no preference"
            className="w-full rounded-lg border border-gray-200 text-[12px] py-1.5 px-2"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Other notes</label>
          <textarea
            value={criteria.notes}
            onChange={e => update('notes', e.target.value)}
            rows={2}
            placeholder="Special needs, distance limits, non-negotiables…"
            className="w-full rounded-lg border border-gray-200 text-[12px] py-1.5 px-2"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-indigo-600 py-2 text-[11px] font-black text-white hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {saving ? <Loader2 size={12} className="inline animate-spin mr-1" aria-hidden="true" /> : null}
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Preferences'}
      </button>
    </div>
  );
}

// ─── Child Pathway Card ───────────────────────────────────────────────────────

function ChildPathwayCard({ child, onNavigate }) {
  const [expanded, setExpanded]         = useState(false);
  const [rec, setRec]                   = useState(null);
  const [selection, setSelection]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [savingPref, setSavingPref]     = useState(false);
  const [preference, setPreference]     = useState('');
  const [prefSaved, setPrefSaved]       = useState(false);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    if (loading || rec) return;
    setLoading(true); setError(null);
    try {
      const { term, academicYear } = currentTermAndYear();
      const [recRes, selRes] = await Promise.allSettled([
        isSecondary(child) ? pathwayAPI.getTransitionDecisionHistory(child.id) : pathwayAPI.getRecommendation(child.id, { term, academicYear }),
        isSecondary(child) ? seniorPathwayAPI.getLearnerSelection(child.id) : Promise.resolve(null),
      ]);
      if (recRes.status === 'fulfilled') {
        // Shape: { success, data: { learner, prediction: {...}, recommendation } }
        const payload = recRes.value?.data || recRes.value || null;
        const historical = isSecondary(child) && Array.isArray(payload) ? payload[0] : null;
        setRec(historical ? { predictedPathway: historical.finalApprovedPathway || historical.recommendedPathway, confidence: historical.confidenceScore || 0, justification: 'Transition recommendation retained as context for senior progress.' } : (payload?.prediction ?? payload ?? null));
      }
      if (selRes.status === 'fulfilled' && selRes.value) {
        setSelection(selRes.value?.data || null);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load pathway data');
    } finally {
      setLoading(false);
    }
  }, [child, loading, rec]);

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) load();
  };

  const savePreference = async () => {
    setSavingPref(true);
    try {
      await pathwayAPI.saveTransitionDecision(child.id, { parentPreference: preference || null });
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 3000);
    } catch (e) {
      setError(e?.message || 'Failed to save preference');
    } finally {
      setSavingPref(false);
    }
  };

  const meta = PATHWAY_META[rec?.predictedPathway] || null;
  const pending = !rec?.predictedPathway || rec.predictedPathway === 'Analysis Pending';
  const photoSrc = getPhoto(child);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={handleExpand}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B1FA3] focus-visible:ring-inset"
      >
        {photoSrc ? (
          <img src={photoSrc} alt={child.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-300 flex-shrink-0"
            onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}
          />
        ) : null}
        <div
          style={{ display: photoSrc ? 'none' : 'flex' }}
          className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-indigo-300 text-indigo-700 font-bold text-sm items-center justify-center flex-shrink-0"
        >
          {child.name?.[0] || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{child.name}</p>
          <p className="text-[10px] font-semibold text-indigo-600">
            {child.grade?.replace('_',' ')} · {isSecondary(child) ? 'Senior Secondary' : 'Junior Secondary'}
          </p>
        </div>

        {/* Pathway pill (preview) */}
        {meta && !pending && (
          <span className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black flex-shrink-0 ${meta.bg} ${meta.border} ${meta.text}`}>
            {meta.icon} {meta.label}
          </span>
        )}

        {expanded
          ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" aria-hidden="true" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3" role="alert">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          {!loading && rec && (
            <>
              {/* Recommendation */}
              <div className={`rounded-xl border p-3 ${meta ? `${meta.bg} ${meta.border}` : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Recommended Pathway</p>
                {pending ? (
                  <p className="text-sm font-semibold text-gray-500">Analysis Pending — no results yet</p>
                ) : (
                  <>
                    <p className={`text-base font-black ${meta?.text || 'text-gray-900'}`}>
                      {meta?.icon} {rec.predictedPathway}
                    </p>
                    <div className="mt-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Confidence</p>
                      <ConfidenceBar value={rec.confidence} />
                    </div>
                  </>
                )}
              </div>

              {/* Cluster breakdown */}
              {!pending && rec.clusterBreakdown && (
                <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
                    <TrendingUp size={10} aria-hidden="true" /> Subject Cluster Scores
                  </p>
                  <ClusterBar label="STEM"           value={rec.clusterBreakdown.STEM}   color="#1d4ed8" />
                  <ClusterBar label="Social Sciences" value={rec.clusterBreakdown.Social} color="#b45309" />
                  <ClusterBar label="Arts & Sports"  value={rec.clusterBreakdown.Arts}   color="#065f46" />
                </div>
              )}

              {/* Career suggestions */}
              {!pending && rec.careerRecommendations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
                    <Star size={10} aria-hidden="true" /> Career Paths
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rec.careerRecommendations.map((c, i) => (
                      <span key={i} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection status (secondary only) */}
              {isSecondary(child) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
                    <BookOpen size={10} aria-hidden="true" /> Subject Selection Status
                  </p>
                  {selection ? (() => {
                    const cfg = STATUS_CONFIG[selection.status] || STATUS_CONFIG.DRAFT;
                    const Icon = cfg.icon;
                    return (
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${cfg.cls}`}>
                          <Icon size={10} aria-hidden="true" /> {cfg.label}
                        </span>
                        {selection.pathway && (
                          <p className="mt-1.5 text-sm font-bold text-gray-900">{selection.pathway.name}</p>
                        )}
                        {selection.combinationRule && (
                          <p className="text-[11px] text-gray-500">
                            Combination: {selection.combinationRule.name}
                          </p>
                        )}
                        {selection.status === 'REJECTED' && (() => {
                          const latestRejection = (selection.approvals || []).find(a => a.status === 'REJECTED');
                          return latestRejection?.comment ? (
                            <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5">
                              <p className="text-[10px] font-bold text-rose-700 mb-0.5">Counsellor asked for a revision:</p>
                              <p className="text-[11px] text-rose-700">“{latestRejection.comment}”</p>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })() : (
                    <p className="text-xs text-gray-400">No selection recorded yet.</p>
                  )}
                </div>
              )}

              {isJuniorTransition(child) && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-700">Senior school transition</p>
                  <p className="mt-1 text-[11px] text-gray-600">Compare matching senior schools, record family requirements and build a shortlist together.</p>
                  <button type="button" onClick={() => onNavigate?.('parent-portal-schools')}
                    className="mt-2 rounded-lg bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800">
                    Open school shortlist
                  </button>
                </div>
              )}

              {/* Family school preferences belong to the junior transition journey. */}
              {isJuniorTransition(child) && (
                <FamilyPreferencesForm childId={child.id} />
              )}

              {/* Parent preference */}
              {isJuniorTransition(child) && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2 flex items-center gap-1">
                  <Heart size={10} aria-hidden="true" /> Your Preference
                </p>
                <p className="text-[11px] text-gray-600 mb-2">
                  Your input is shared with the school counsellor as part of the decision.
                </p>
                <div className="space-y-1.5">
                  {PREFERENCE_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`pref-${child.id}`}
                        value={opt.value}
                        checked={preference === opt.value}
                        onChange={() => setPreference(opt.value)}
                        className="h-3.5 w-3.5 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-[12px] font-semibold text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={savePreference}
                  disabled={savingPref}
                  className="mt-3 w-full rounded-xl bg-rose-600 py-2 text-[11px] font-black text-white hover:bg-rose-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {savingPref ? <Loader2 size={12} className="inline animate-spin mr-1" aria-hidden="true" /> : null}
                  {savingPref ? 'Saving…' : prefSaved ? '✓ Saved' : 'Save Preference'}
                </button>
              </div>}
            </>
          )}

          {!loading && !rec && !error && (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
              <BookOpen size={20} className="mx-auto mb-1.5 text-gray-300" aria-hidden="true" />
              <p className="text-xs text-gray-500">No pathway data yet.</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Results will appear once your child's teacher enters them.</p>
            </div>
          )}

          {!loading && isSecondary(child) && <StudentPathwayWorkspace learnerId={child.id} recommendation={rec} selection={selection} mode="parent" />}

          {!loading && (isJuniorTransition(child) || isSecondary(child)) && (
            <>
              <DecisionPlanPanel learnerId={child.id} mode="parent" />
              {isJuniorTransition(child) && <ParentCareerReviewPanel learnerId={child.id} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalPathway = ({ onNavigate }) => {
  const [children, setChildren]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load');
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-3">

        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-black text-indigo-900">New to pathway planning?</p>
            <p className="text-[10px] text-indigo-700">Follow a simple guide for supporting your child.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('pathway-guide')}
            className="shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
          >
            Pathway Guide
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3" role="alert">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2.5">
            {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        )}

        {!loading && children.length === 0 && !error && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}

        {!loading && children.length > 0 && (
          <div className="space-y-2.5">
            {children.map(child => (
              <ChildPathwayCard key={child.id} child={child} onNavigate={onNavigate} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default ParentPortalPathway;
