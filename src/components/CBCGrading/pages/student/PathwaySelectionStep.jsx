/**
 * PathwaySelectionStep — Phase 3
 *
 * Embedded inside PathwayPlanner as Step 4.
 * Allows a student to pick an approved subject combination and submit.
 * Only active if counsellor has unlocked selection.
 *
 * Flow:
 *   1. Load senior pathway catalog (pathways + tracks + official combinations)
 *   2. Load unlock status from /pathway-planner/learners/:id/unlock
 *   3. Student picks pathway → track → combination
 *   4. Submit → POST /pathway-planner/learners/:id/selection
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock, CheckCircle2, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react';
import api, { pathwayPlannerAPI } from '../../../../services/api';

const PATHWAY_META = {
  STEM:                    { icon: '🔬', color: '#1d4ed8', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800'    },
  SOCIAL_SCIENCES:         { icon: '📚', color: '#b45309', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800'   },
  ARTS_SPORTS:             { icon: '🎨', color: '#065f46', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
};

const PathwaySelectionStep = ({ learnerId, existingSelection, onSuccess }) => {
  const [catalog, setCatalog]         = useState(null);
  const [schoolOfferings, setSchoolOfferings] = useState([]);
  const [unlocked, setUnlocked]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [selectedPathwayId, setPathwayId]   = useState('');
  const [selectedTrackId, setTrackId]       = useState('');
  const [selectedComboId, setComboId]       = useState('');

  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone]               = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [catalogRes, unlockRes, offeringsRes] = await Promise.all([
        api.seniorPathways.getCatalog(),
        pathwayPlannerAPI.getSelectionUnlock(learnerId),
        api.seniorPathways.getSchoolOfferings(),
      ]);
      setCatalog(catalogRes?.data || null);
      setUnlocked(unlockRes?.data?.unlocked === true);
      setSchoolOfferings(Array.isArray(offeringsRes?.data) ? offeringsRes.data : []);

      // Pre-fill from existing selection
      if (existingSelection?.pathway?.id)        setPathwayId(existingSelection.pathway.id);
      if (existingSelection?.track?.id)          setTrackId(existingSelection.track.id);
      if (existingSelection?.combinationRule?.id) setComboId(existingSelection.combinationRule.id);
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [learnerId, existingSelection]);

  useEffect(() => { load(); }, [load]);

  // Derived
  const pathways   = (catalog?.pathways || []).filter(p => ['STEM','SOCIAL_SCIENCES','ARTS_SPORTS'].includes(p.code));
  const selPathway = pathways.find(p => p.id === selectedPathwayId);
  const tracks     = selPathway?.tracks || [];
  const selTrack   = tracks.find(t => t.id === selectedTrackId);

  const [combinations, setCombinations] = useState([]);
  useEffect(() => {
    if (!selectedPathwayId) { setCombinations([]); setComboId(''); return; }
    api.seniorPathways.getCombinations({ pathwayId: selectedPathwayId, ...(selectedTrackId ? { trackId: selectedTrackId } : {}) })
      .then(r => setCombinations(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setCombinations([]));
  }, [selectedPathwayId, selectedTrackId]);

  const offeredSubjectIds = new Set(
    schoolOfferings
      .map(offering => offering?.officialLearningArea?.id || offering?.officialLearningAreaId)
      .filter(Boolean)
  );
  const hasConfiguredOfferings = offeredSubjectIds.size > 0;
  const coreSubjectIds = (catalog?.coreSubjects || [])
    .filter(s => {
      const code = s.officialCode;
      const isStemPath = selPathway?.code === 'STEM';
      if (code === 'CORE_MATH') return isStemPath;
      if (code === 'ESS_MATH')  return !isStemPath;
      return ['ENG','KIS','CSL'].includes(code);
    })
    .map(s => s.id);

  const supportSubjectIds = (catalog?.supportSubjects || [])
    .filter(s => ['PE','ICT'].includes(s.officialCode))
    .map(s => s.id);

  const hasRequiredSchoolSubjects = [...coreSubjectIds, ...supportSubjectIds]
    .every(subjectId => offeredSubjectIds.has(subjectId));
  const combinationIsOffered = (combination) =>
    hasRequiredSchoolSubjects
    && (combination?.items || []).every(item => offeredSubjectIds.has(item?.officialLearningArea?.id));
  const availableCombinations = hasConfiguredOfferings
    ? combinations.filter(combinationIsOffered)
    : [];
  const selCombo = availableCombinations.find(c => c.id === selectedComboId);

  const optionalSubjectIds = (selCombo?.items || [])
    .map(i => i.officialLearningArea?.id).filter(Boolean);

  const canSubmit = hasConfiguredOfferings && hasRequiredSchoolSubjects && !!selectedPathwayId && !!selectedComboId && coreSubjectIds.length >= 4;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setSubmitError(null);
    try {
      await pathwayPlannerAPI.submitStudentSelection(learnerId, {
        pathwayId:            selectedPathwayId,
        trackId:              selectedTrackId || undefined,
        combinationRuleId:    selectedComboId,
        compulsorySubjectIds: coreSubjectIds,
        optionalSubjectIds,
        supportSubjectIds,
        selectionId:          existingSelection?.id,
      });
      setDone(true);
      onSuccess?.();
    } catch (e) {
      setSubmitError(e?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 size={20} className="animate-spin text-[#06285a]" />
    </div>
  );

  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700" role="alert">{error}</div>
  );

  if (!unlocked) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
      <Lock size={24} className="mx-auto mb-2 text-amber-500" />
      <p className="text-sm font-bold text-amber-800">Subject selection locked</p>
      <p className="text-xs text-amber-700 mt-1">
        Your teacher or counsellor needs to unlock this before you can choose your subjects.
      </p>
    </div>
  );

  if (done) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
      <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
      <p className="text-sm font-black text-emerald-800">Selection submitted!</p>
      <p className="text-xs text-emerald-700 mt-1">Your teacher will review and confirm your subject combination.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        Step 4 — Choose Your Subjects
      </p>

      {!hasConfiguredOfferings && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="alert">
          <p className="font-bold">Your school has not published its subject offerings yet.</p>
          <p className="mt-1 text-amber-800">Subject selection will open once the school lists the subjects it delivers. Please contact your school administrator or counsellor.</p>
        </div>
      )}

      {hasConfiguredOfferings && !hasRequiredSchoolSubjects && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900" role="alert">
          <p className="font-bold">Your school offerings are incomplete for this pathway.</p>
          <p className="mt-1 text-amber-800">The required core or support subjects have not all been listed by the school, so a subject combination cannot be submitted yet.</p>
        </div>
      )}

      {/* Pathway picker */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-700">1. Select Pathway</p>
        <div className="grid grid-cols-1 gap-2">
          {pathways.map(p => {
            const m = PATHWAY_META[p.code] || {};
            const active = selectedPathwayId === p.id;
            return (
              <button key={p.id} type="button"
                onClick={() => { setPathwayId(p.id); setTrackId(''); setComboId(''); }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? `${m.bg} ${m.border}` : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <span className="text-xl">{m.icon}</span>
                <div>
                  <p className={`text-sm font-black ${active ? m.text : 'text-gray-900'}`}>{p.name}</p>
                  {p.description && <p className="text-[11px] text-gray-500">{p.description}</p>}
                </div>
                {active && <CheckCircle2 size={14} className="ml-auto text-current flex-shrink-0" style={{color: m.color}} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Track picker */}
      {selectedPathwayId && tracks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">2. Select Track</p>
          <div className="grid grid-cols-1 gap-2">
            {tracks.map(t => (
              <button key={t.id} type="button"
                onClick={() => { setTrackId(t.id); setComboId(''); }}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${selectedTrackId===t.id ? 'bg-[#06285a]/5 border-[#06285a]/30' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                {selectedTrackId===t.id && <CheckCircle2 size={14} className="text-[#06285a]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Combination picker */}
      {availableCombinations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">3. Select Subject Combination</p>
          <div className="space-y-2">
            {availableCombinations.map(c => {
              const subjects = (c.items || []).map(i => i.officialLearningArea?.officialName).filter(Boolean);
              return (
                <button key={c.id} type="button"
                  onClick={() => setComboId(c.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${selectedComboId===c.id ? 'bg-[#06285a]/5 border-[#06285a]/30' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">{c.name}</p>
                    {selectedComboId===c.id && <CheckCircle2 size={14} className="text-[#06285a] flex-shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {subjects.map(s => (
                      <span key={s} className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">{s}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasConfiguredOfferings && selectedPathwayId && combinations.length > 0 && availableCombinations.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          This school does not currently offer an approved subject combination for the selected pathway and track. Choose another option or ask the school to update its offerings.
        </div>
      )}

      {/* Summary & submit */}
      {selCombo && (
        <div className="bg-[#06285a]/5 border border-[#06285a]/20 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#06285a] mb-2">Your Selection Summary</p>
          <p className="text-xs text-gray-700"><span className="font-bold">Pathway:</span> {selPathway?.name}</p>
          {selTrack && <p className="text-xs text-gray-700"><span className="font-bold">Track:</span> {selTrack.name}</p>}
          <p className="text-xs text-gray-700"><span className="font-bold">Combination:</span> {selCombo.name}</p>
          <p className="text-xs text-gray-500 mt-1">Core subjects (4) + selected combination (3) + support subjects will be included.</p>
        </div>
      )}

      {submitError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2" role="alert">
          <AlertCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{submitError}</p>
        </div>
      )}

      <button type="button" onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full rounded-xl bg-[#06285a] py-3 text-sm font-black text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06285a]">
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
        {submitting ? 'Submitting…' : 'Submit Subject Selection'}
      </button>
    </div>
  );
};

export default PathwaySelectionStep;
