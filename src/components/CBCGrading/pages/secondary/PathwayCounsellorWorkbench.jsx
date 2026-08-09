/**
 * PathwayCounsellorWorkbench — Phase 2
 *
 * Head of Curriculum / Head Teacher view for guiding learner pathway decisions.
 * Tabs: Class View (distribution chart) | Learner Detail (scoring breakdown, notes, unlock)
 *
 * Route: sec-pathway-counsellor
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, ChevronLeft, ChevronRight, BarChart2, MessageSquare,
  Lock, Unlock, CheckCircle2, AlertCircle, Loader2,
  Send, RefreshCw, ArrowLeft, FlaskConical, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import { pathwayPlannerAPI, pathwayAPI, learnerAPI, classAPI, seniorPathwayAPI } from '../../../../services/api';
import { generatePathwayPlanPDF } from '../../../../utils/pathwayPlanPDF';
import DecisionPlanPanel from '../../shared/DecisionPlanPanel';
import PathwayConversation from '../../shared/PathwayConversation';
import CounsellorCaseManagementPanel from './CounsellorCaseManagementPanel';
import CounsellorWorkspaceDashboard from './CounsellorWorkspaceDashboard';
import CounsellorEvidencePanel from './CounsellorEvidencePanel';
import CounsellorInterventionQueue from './CounsellorInterventionQueue';
import SelectionStatusChip from '../../shared/SelectionStatusChip';

// ─── helpers ──────────────────────────────────────────────────────────────────
const PATHWAY_COLORS = {
  STEM: '#1d4ed8', 'Social Sciences': '#b45309',
  'Arts and Sports Science': '#065f46', 'Analysis Pending': '#6b7280',
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const NOTE_TYPES = ['GENERAL', 'RECOMMENDATION', 'APPROVAL', 'CONCERN'];
const NOTE_VISIBILITIES = [
  { value: 'COUNSELLOR_ONLY', label: 'Counsellor only' },
  { value: 'SHARED_WITH_STUDENT', label: 'Share with student' },
  { value: 'SHARED_WITH_PARENT', label: 'Share with parent' },
  { value: 'SCHOOL_TEAM_VISIBLE', label: 'School team' },
];
const NOTE_VISIBILITY_LABELS = {
  COUNSELLOR_ONLY: 'Counsellor only',
  SHARED_WITH_STUDENT: 'Shared with student',
  COUNSELLOR_AND_LEARNER: 'Shared with student',
  LEARNER_VISIBLE: 'Shared with student',
  SHARED_WITH_PARENT: 'Shared with parent',
  PARENT_VISIBLE: 'Shared with parent',
  SCHOOL_TEAM_VISIBLE: 'School team',
};
const NOTE_VISIBILITY_HELP = {
  COUNSELLOR_ONLY: 'Only authorised pathway counsellors can read this note. No family notification will be sent.',
  SHARED_WITH_STUDENT: 'The student can read this note and will be notified.',
  SHARED_WITH_PARENT: 'Linked parents can read this note and will be notified.',
  SCHOOL_TEAM_VISIBLE: 'Authorised school staff can read this note. No family notification will be sent.',
};

// ─── Selection status chips use the shared SelectionStatusChip component ─────

// ─── ConfidenceBar ────────────────────────────────────────────────────────────
const ConfidenceBar = ({ value = 0 }) => {
  const pct = Math.min(100, Math.max(0, value));
  const col = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color: col }}>{pct}%</span>
    </div>
  );
};

// ─── NoteCard ─────────────────────────────────────────────────────────────────
const NoteCard = ({ note }) => {
  const TYPE_CLS = {
    GENERAL:        'bg-gray-50 border-gray-200',
    RECOMMENDATION: 'bg-blue-50 border-blue-200',
    APPROVAL:       'bg-emerald-50 border-emerald-200',
    CONCERN:        'bg-rose-50 border-rose-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${TYPE_CLS[note.noteType] || TYPE_CLS.GENERAL}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
            {note.author?.firstName} {note.author?.lastName} · {note.noteType}
          </span>
          <span className="rounded-full border border-gray-200 bg-white/70 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
            {NOTE_VISIBILITY_LABELS[note.visibility] || 'Counsellor only'}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(note.createdAt)}</span>
      </div>
      <p className="text-xs text-gray-700">{note.note}</p>
    </div>
  );
};

// ─── LearnerDetail ────────────────────────────────────────────────────────────
function LearnerDetail({ learnerId, onBack, user }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [noteText, setNoteText]   = useState('');
  const [noteType, setNoteType]   = useState('GENERAL');
  const [noteVisibility, setNoteVisibility] = useState('COUNSELLOR_ONLY');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockNote, setUnlockNote] = useState('');
  const [teacherRec, setTeacherRec] = useState('');
  const [savingRec, setSavingRec] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [lockingId, setLockingId]     = useState(null);
  const [workflowError, setWorkflowError] = useState(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [requestingRevisionId, setRequestingRevisionId] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overridePathway, setOverridePathway] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideError, setOverrideError] = useState(null);
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  // ─── KJSEA score entry ────────────────────────────────────────────────────
  // The KJSEA is Kenya's national Grade 9 exam. Entering scores here enriches
  // the pathway recommendation with official national evidence (nationalExam input,
  // 50% weight in the scoring engine alongside school summative results).
  const KJSEA_SUBJECTS = [
    { key: 'Mathematics',         label: 'Mathematics' },
    { key: 'English',             label: 'English' },
    { key: 'Kiswahili',           label: 'Kiswahili' },
    { key: 'Integrated Science',  label: 'Integrated Science' },
    { key: 'Social Studies',      label: 'Social Studies' },
    { key: 'Creative Arts',       label: 'Creative Arts & Sports' },
    { key: 'Pre-Technical Studies', label: 'Pre-Technical Studies' },
    { key: 'Agriculture',         label: 'Agriculture' },
  ];
  const EMPTY_KJSEA = Object.fromEntries(KJSEA_SUBJECTS.map(s => [s.key, '']));
  const [kjseaScores, setKjseaScores]     = useState(EMPTY_KJSEA);
  const [kjseaExpanded, setKjseaExpanded] = useState(false);
  const [kjseaRunning, setKjseaRunning]   = useState(false);
  const [kjseaResult, setKjseaResult]     = useState(null);
  const [kjseaError, setKjseaError]       = useState(null);

  // Pre-fill KJSEA scores from analysisPayload if stored
  useEffect(() => {
    if (!data?.latestRecommendation?.analysisPayload?.nationalExam) return;
    const stored = data.latestRecommendation.analysisPayload.nationalExam;
    setKjseaScores(prev => ({ ...prev, ...Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, String(v)])) }));
  }, [data]);

  const runKjseaReadiness = async () => {
    const nationalExam = Object.fromEntries(
      Object.entries(kjseaScores)
        .filter(([, v]) => v !== '' && !isNaN(Number(v)))
        .map(([k, v]) => [k, Number(v)])
    );
    if (Object.keys(nationalExam).length === 0) {
      setKjseaError('Enter at least one subject score to run the analysis.');
      return;
    }
    setKjseaRunning(true); setKjseaError(null); setKjseaResult(null);
    try {
      const res = await pathwayAPI.getTransitionReadiness(learnerId, {
        nationalExam,
        teacherRecommendation: teacherRec || undefined,
      });
      setKjseaResult(res?.data || null);
    } catch (e) {
      setKjseaError(e?.message || 'Could not run readiness analysis');
    } finally {
      setKjseaRunning(false);
    }
  };

  const downloadPDF = async () => {
    if (!data) return;
    setGeneratingPDF(true);
    try {
      const { learner: l, latestRecommendation: rec, selection: sel, counsellorNotes: notes, evidence } = data;
      const schoolPreferences = evidence?.schoolPreferences || [];
      // Build a recommendation shape that matches what generatePathwayPlanPDF expects
      const recommendation = rec ? {
        predictedPathway:     rec.recommendedPathway  || rec.finalApprovedPathway || 'Analysis Pending',
        confidence:           rec.confidenceScore     ?? 0,
        justification:        rec.analysisPayload?.justification || '',
        careerRecommendations: rec.analysisPayload?.careerRecommendations || [],
        clusterBreakdown:     rec.analysisPayload?.clusterBreakdown || {},
      } : null;
      await generatePathwayPlanPDF({
        learner: {
          id:              l.id,
          firstName:       l.firstName,
          lastName:        l.lastName,
          admissionNumber: l.admissionNumber,
          grade:           l.grade,
          institutionType: l.institutionType,
        },
        recommendation,
        selection:        sel,
        schoolPreferences,
        counsellorNotes:  notes || [],
      });
    } catch (e) {
      console.error('[CounsellorWorkbench] PDF export failed:', e?.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.getCounsellorSummary(learnerId);
      const d = res?.data || null;
      setData(d);
      // Pre-fill teacher recommendation if one already exists
      if (d?.latestRecommendation?.teacherRecommendation) {
        setTeacherRec(d.latestRecommendation.teacherRecommendation);
      }
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setOverridePathway(data?.latestRecommendation?.finalApprovedPathway || '');
  }, [data?.latestRecommendation?.finalApprovedPathway]);

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true); setNoteError(null);
    try {
      await pathwayPlannerAPI.addCounsellorNote(learnerId, {
        note: noteText,
        noteType,
        visibility: noteVisibility,
      });
      setNoteText('');
      setNoteType('GENERAL');
      setNoteVisibility('COUNSELLOR_ONLY');
      await load();
    } catch (e) { setNoteError(e?.message || 'Failed to save note'); }
    finally { setSavingNote(false); }
  };

  const doUnlock = async () => {    setUnlocking(true);
    try {
      await pathwayPlannerAPI.unlockSelection(learnerId, { notes: unlockNote || undefined });
      setUnlockNote(''); await load();
    } catch (e) { setError(e?.message); }
    finally { setUnlocking(false); }
  };

  const doApprove = async (selectionId) => {
    setApprovingId(selectionId); setWorkflowError(null);
    try {
      await seniorPathwayAPI.approveSelection(selectionId);
      await load();
    } catch (e) { setWorkflowError(e?.message || 'Failed to approve selection'); }
    finally { setApprovingId(null); }
  };

  const doLock = async (selectionId) => {
    setLockingId(selectionId); setWorkflowError(null);
    try {
      await seniorPathwayAPI.lockSelection(selectionId);
      await load();
    } catch (e) { setWorkflowError(e?.message || 'Failed to lock selection'); }
    finally { setLockingId(null); }
  };

  const doRequestRevision = async (selectionId) => {
    if (!revisionReason.trim()) return;
    setRequestingRevisionId(selectionId); setWorkflowError(null);
    try {
      await seniorPathwayAPI.requestRevision(selectionId, revisionReason.trim());
      setRevisionReason(''); setShowRevisionForm(false);
      await load();
    } catch (e) { setWorkflowError(e?.message || 'Failed to return selection for revision'); }
    finally { setRequestingRevisionId(null); }
  };

  const doOverrideFinalizedPathway = async () => {
    if (!overridePathway || overrideReason.trim().length < 10) return;
    setOverriding(true); setOverrideError(null); setOverrideSuccess(false);
    try {
      await pathwayAPI.overrideFinalizedDecision(learnerId, overridePathway, overrideReason.trim());
      setOverrideReason(''); setShowOverrideForm(false); setOverrideSuccess(true);
      await load();
    } catch (e) { setOverrideError(e?.message || 'Failed to override the finalized pathway'); }
    finally { setOverriding(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={22} className="animate-spin text-violet-600" />
    </div>
  );
  if (error) return <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700">{error}</div>;
  if (!data) return null;

  const { learner, latestRecommendation: rec, selection, counsellorNotes: notes, selectionUnlocked, evidence } = data;
  const predPathway = rec?.finalApprovedPathway || rec?.recommendedPathway || 'No recommendation yet';
  const canOverrideFinalized = ['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(String(user?.role || '').toUpperCase());

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
        <ArrowLeft size={14} /> Back to class
      </button>

      {/* Learner header */}
      <div className="bg-white rounded-2xl border border-violet-200 p-4 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-violet-100 border-2 border-violet-300 flex items-center justify-center text-violet-700 font-black text-lg flex-shrink-0">
          {learner.firstName?.[0]}{learner.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-gray-900">{learner.firstName} {learner.lastName}</p>
          <p className="text-[11px] text-violet-600 font-semibold">{learner.admissionNumber} · {learner.grade?.replace('_',' ')}</p>
        </div>
        <SelectionStatusChip status={selection?.status || 'NONE'} />
      </div>

      {/* Recommendation card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {rec?.finalApprovedPathway ? 'Finalized Pathway' : 'Recommended Pathway'}
          </p>
          {rec?.finalApprovedPathway && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600"><Lock size={10} /> Finalized</span>}
        </div>
        <p className="text-lg font-black" style={{ color: PATHWAY_COLORS[predPathway] || '#374151' }}>{predPathway}</p>
        {rec?.confidenceScore != null && <ConfidenceBar value={rec.confidenceScore} />}
        {rec?.analysisPayload?.clusterBreakdown && (
          <div className="pt-2 space-y-1.5">
            {[['STEM','#1d4ed8'],['Social','#b45309'],['Arts','#065f46']].map(([k,c]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-[10px] w-24 text-gray-500">{k}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${rec.analysisPayload.clusterBreakdown[k]||0}%`, background: c }} />
                </div>
                <span className="text-[10px] font-bold text-gray-600 w-8 text-right">{rec.analysisPayload.clusterBreakdown[k]||0}%</span>
              </div>
            ))}
          </div>
        )}

        {overrideSuccess && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-700" role="status">
            The finalized pathway was overridden and the reason was added to its audit history.
          </p>
        )}

        {rec?.finalApprovedPathway && canOverrideFinalized && !showOverrideForm && (
          <button
            type="button"
            onClick={() => { setShowOverrideForm(true); setOverrideError(null); setOverrideSuccess(false); }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100"
          >
            <RefreshCw size={12} /> Override finalized pathway
          </button>
        )}

        {rec?.finalApprovedPathway && canOverrideFinalized && showOverrideForm && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div>
              <p className="text-xs font-black text-amber-900">Administrative override</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-amber-800">
                This changes a locked decision, records your identity and reason, and notifies the learner’s linked users.
              </p>
            </div>
            {overrideError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700" role="alert">{overrideError}</p>}
            <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
              New final pathway
              <select
                value={overridePathway}
                onChange={(e) => setOverridePathway(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="STEM">STEM</option>
                <option value="SOCIAL_SCIENCES">Social Sciences</option>
                <option value="ARTS_SPORTS">Arts &amp; Sports</option>
              </select>
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
              Required reason
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Explain why this finalized decision must change (at least 10 characters)…"
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs normal-case text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doOverrideFinalizedPathway}
                disabled={overriding || overrideReason.trim().length < 10 || overridePathway === rec.finalApprovedPathway}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {overriding ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {overriding ? 'Applying override…' : 'Confirm override'}
              </button>
              <button
                type="button"
                onClick={() => { setShowOverrideForm(false); setOverrideReason(''); setOverrideError(null); setOverridePathway(rec.finalApprovedPathway); }}
                disabled={overriding}
                className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selection status */}
      {selection && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Subject Selection</p>
          <p className="text-sm font-black text-gray-900">{selection.pathway?.name}</p>
          {selection.combinationRule && <p className="text-[11px] text-gray-500">{selection.combinationRule.name}</p>}
          {selection.items?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selection.items.map(item => (
                <span key={item.id} className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                  {item.officialLearningArea?.officialName}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <CounsellorEvidencePanel evidence={evidence} />

      {/* ── KJSEA national exam scores ───────────────────────────────────── */}
      {/* Only show for Grade 7–9 learners (junior transition context) */}
      {['GRADE_7','GRADE_8','GRADE_9'].includes(learner.grade) && (
        <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setKjseaExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-indigo-50/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FlaskConical size={15} className="text-indigo-500 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-gray-900">KJSEA Scores</p>
                <p className="text-[10px] text-gray-500">
                  Enter national exam results to enrich the pathway recommendation with official evidence.
                </p>
              </div>
            </div>
            {kjseaExpanded
              ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
              : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
          </button>

          {kjseaExpanded && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Scores should be percentages (0–100). Leave a subject blank if not available.
                These feed directly into the recommendation engine alongside school summative results.
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KJSEA_SUBJECTS.map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={kjseaScores[key]}
                      onChange={e => setKjseaScores(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="0–100"
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
                    />
                  </label>
                ))}
              </div>

              {kjseaError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-700" role="alert">
                  {kjseaError}
                </div>
              )}

              <button
                type="button"
                onClick={runKjseaReadiness}
                disabled={kjseaRunning}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {kjseaRunning
                  ? <><Loader2 size={12} className="animate-spin" /> Running analysis&hellip;</>
                  : <><FlaskConical size={12} /> Run pathway readiness</>}
              </button>

              {kjseaResult && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                    Readiness result
                  </p>
                  {/* Ranking */}
                  <div className="space-y-1">
                    {(kjseaResult.ranking || []).map((item, i) => (
                      <div key={item.pathway} className="flex items-center gap-2">
                        <span className={`text-[10px] font-black w-5 ${i === 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                          #{i + 1}
                        </span>
                        <span className="flex-1 text-[11px] font-semibold text-gray-800">
                          {item.pathway.replace('_', ' ')}
                        </span>
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(item.score, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700 w-8 text-right">
                          {item.score}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Mismatch warning */}
                  {kjseaResult.recommendation?.mismatchWarning && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
                      <span className="font-black">Note: </span>
                      {kjseaResult.recommendation.mismatchWarning}
                    </div>
                  )}
                  <p className="text-[9px] text-indigo-600 italic">
                    This result is for counsellor reference only. Use it to inform a conversation — it does not automatically update the learner&rsquo;s recommendation record.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approve / Lock workflow (only when selection exists and not already locked) */}
      {selection && selection.status !== 'LOCKED' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <CheckCircle2 size={11} /> Selection Workflow
          </p>

          {workflowError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-700 flex items-start gap-2" role="alert">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {workflowError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Approve — visible when status is SUBMITTED */}
            {selection.status === 'SUBMITTED' && (
              <button
                type="button"
                onClick={() => doApprove(selection.id)}
                disabled={!!approvingId}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {approvingId ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {approvingId ? 'Approving…' : 'Approve Selection'}
              </button>
            )}

            {/* Lock — visible when status is APPROVED */}
            {selection.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => doLock(selection.id)}
                disabled={!!lockingId}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {lockingId ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                {lockingId ? 'Locking…' : 'Lock Selection'}
              </button>
            )}

            {/* Return for Revision — visible when status is SUBMITTED or APPROVED */}
            {(selection.status === 'SUBMITTED' || selection.status === 'APPROVED') && !showRevisionForm && (
              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <AlertCircle size={12} /> Return for Revision
              </button>
            )}

            {/* Info when DRAFT — nudge counsellor to wait for student submission */}
            {selection.status === 'DRAFT' && (
              <p className="text-[11px] text-gray-500 italic">
                Waiting for the learner to submit their selection before it can be approved.
              </p>
            )}

            {/* REJECTED — show the latest revision reason and wait for resubmission */}
            {selection.status === 'REJECTED' && (() => {
              const latestRejection = (selection.approvals || []).find(a => a.status === 'REJECTED');
              return (
                <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-rose-700 mb-1">Returned for revision</p>
                  {latestRejection?.comment && (
                    <p className="text-xs text-rose-700">“{latestRejection.comment}”</p>
                  )}
                  <p className="text-[11px] text-gray-500 italic mt-1.5">
                    Waiting for the learner to revise and resubmit their selection.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Revision reason form */}
          {showRevisionForm && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <textarea
                value={revisionReason}
                onChange={e => setRevisionReason(e.target.value)}
                placeholder="Explain what the learner needs to revise…"
                rows={2}
                className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => doRequestRevision(selection.id)}
                  disabled={!!requestingRevisionId || !revisionReason.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {requestingRevisionId ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                  {requestingRevisionId ? 'Sending…' : 'Send Back for Revision'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRevisionForm(false); setRevisionReason(''); }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unlock selection */}
      <div className={`rounded-2xl border p-4 ${selectionUnlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          {selectionUnlocked
            ? <><Unlock size={14} className="text-emerald-600" /><p className="text-sm font-black text-emerald-700">Selection Unlocked</p></>
            : <><Lock size={14} className="text-amber-700" /><p className="text-sm font-black text-amber-700">Selection Locked</p></>}
        </div>
        <p className="text-[11px] text-gray-600 mb-3">
          {selectionUnlocked
            ? 'This learner can submit their own subject combination.'
            : 'Unlock to allow this learner to submit their subject combination through the student portal.'}
        </p>
        {!selectionUnlocked && (
          <div className="space-y-2">
            <textarea value={unlockNote} onChange={e => setUnlockNote(e.target.value)}
              placeholder="Optional note to learner…" rows={2}
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <button type="button" onClick={doUnlock} disabled={unlocking}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-60">
              {unlocking ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
              {unlocking ? 'Unlocking…' : 'Unlock Subject Selection'}
            </button>
          </div>
        )}
      </div>

      {/* Counsellor notes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <MessageSquare size={11} /> Counsellor Notes ({notes?.length || 0})
        </p>
        {notes?.map(n => <NoteCard key={n.id} note={n} />)}
        {(!notes || notes.length === 0) && (
          <p className="text-xs text-gray-400 italic">No notes yet.</p>
        )}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {noteError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{noteError}</span>
            </div>
          )}
          <div className="flex gap-2">
            <select value={noteType} onChange={e => setNoteType(e.target.value)}
              aria-label="Note type"
              className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
              {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={noteVisibility} onChange={e => setNoteVisibility(e.target.value)}
              aria-label="Note visibility"
              className="rounded-xl border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
              {NOTE_VISIBILITIES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] leading-relaxed text-gray-500" aria-live="polite">
            {NOTE_VISIBILITY_HELP[noteVisibility]}
          </p>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Add a counsellor note…" rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
          <button type="button" onClick={submitNote} disabled={savingNote || !noteText.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60">
            {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {savingNote ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>

      <PathwayConversation learnerId={learnerId} />

      <DecisionPlanPanel
        learnerId={learnerId}
        mode="counsellor"
        canApprove={['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(String(user?.role || '').toUpperCase())}
        canLock={['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(String(user?.role || '').toUpperCase())}
      />

      <CounsellorCaseManagementPanel learnerId={learnerId} />

      {/* Download the full learner plan as PDF */}
      <button
        type="button"
        onClick={downloadPDF}
        disabled={generatingPDF}
        className="w-full rounded-2xl border border-[#06285a]/20 bg-[#06285a]/5 py-3 text-xs font-black text-[#06285a] flex items-center justify-center gap-2 hover:bg-[#06285a]/10 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06285a]"
      >
        {generatingPDF
          ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Generating PDF\u2026</>
          : <><Download size={13} aria-hidden="true" /> Download Learner Plan (PDF)</>}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const PathwayCounsellorWorkbench = ({ onNavigate, initialClassId, user }) => {
  const [tab, setTab]                   = useState(initialClassId ? 'class' : 'search');
  const junior = String(user?.institutionType || '').toUpperCase() !== 'SECONDARY';
  const institutionType = junior ? 'PRIMARY_CBC' : 'SECONDARY';

  // ── Learner Search state ──────────────────────────────────────────────────
  const [query, setQuery]               = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [selectedLearner, setSelected]  = useState(null);
  const [filterGrade, setFilterGrade]   = useState('');

  // ── Class view state ──────────────────────────────────────────────────────
  const [classes, setClasses]           = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [classLearners, setClassLearners] = useState([]);
  const [classLearnersLoading, setClassLearnersLoading] = useState(false);
  const [classMeta, setClassMeta]       = useState(null);
  const [classPagination, setClassPagination] = useState(null);
  const [classPage, setClassPage]       = useState(1);
  const [distrib, setDistrib]           = useState(null);
  const [classFilterPathway, setClassFilterPathway]     = useState('');
  const [classFilterStatus, setClassFilterStatus]       = useState('');
  const [classFilterReadiness, setClassFilterReadiness] = useState('');

  const PATHWAYS = [
    { code: 'STEM', label: 'STEM' },
    { code: 'SOCIAL_SCIENCES', label: 'Social Sciences' },
    { code: 'ARTS_SPORTS', label: 'Arts & Sports' },
  ];
  const STATUSES = ['NONE','DRAFT','SUBMITTED','APPROVED','LOCKED'];
  const GRADES_JUNIOR = ['GRADE_7','GRADE_8','GRADE_9'];
  const READINESS_FILTERS = [
    { code: 'no_recommendation', label: 'No recommendation yet' },
    { code: 'no_career',         label: 'No career explored' },
    { code: 'no_school',         label: 'No school shortlisted' },
    { code: 'needs_review',      label: 'Decision needs review' },
  ];

  // Load classes
  useEffect(() => {
    classAPI.getAll({ institutionType, limit: 100 })
      .then(r => {
        const rows = r?.data || r || [];
        setClasses(junior ? rows.filter((c) => GRADES_JUNIOR.includes(String(c.grade || '').toUpperCase())) : rows);
      })
      .catch(() => {});
  }, [institutionType, junior]);

  // Load per-learner list + aggregate when class or filters change
  const loadClassLearners = useCallback(async (classId, params = {}) => {
    if (!classId) return;
    setClassLearnersLoading(true);
    try {
      const [lr, dr] = await Promise.allSettled([
        pathwayPlannerAPI.getClassLearners(classId, params),
        pathwayPlannerAPI.getClassDistribution(classId),
      ]);
      if (lr.status === 'fulfilled') { setClassLearners(lr.value?.data || []); setClassMeta(lr.value?.meta || null); setClassPagination(lr.value?.pagination || null); }
      if (dr.status === 'fulfilled') setDistrib(dr.value?.data || null);
    } catch { setClassLearners([]); }
    finally { setClassLearnersLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedClass) loadClassLearners(selectedClass, {
      ...(classFilterPathway   ? { pathway: classFilterPathway }     : {}),
      ...(classFilterStatus    ? { status: classFilterStatus }       : {}),
      ...(classFilterReadiness ? { readiness: classFilterReadiness } : {}),
      page: classPage,
      limit: 50,
    });
  }, [selectedClass, classFilterPathway, classFilterStatus, classFilterReadiness, classPage, loadClassLearners]);

  const doSearch = useCallback(async () => {
    if (!query.trim() && !filterGrade) return;
    setSearching(true);
    try {
      const res = await learnerAPI.getAll({ search: query || undefined, grade: filterGrade || undefined, institutionType, limit: 50 });
      let rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (junior) rows = rows.filter((l) => GRADES_JUNIOR.includes(String(l.grade || '').toUpperCase()));
      setSearchResults(rows);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [institutionType, junior, query, filterGrade]);

  if (selectedLearner) {
    return (
      <div className="p-6">
        <LearnerDetail learnerId={selectedLearner.id} onBack={() => setSelected(null)} user={user} />
      </div>
    );
  }

  const PATHWAY_COLORS_MAP = { STEM: '#1d4ed8', SOCIAL_SCIENCES: '#b45309', ARTS_SPORTS: '#065f46' };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">
            {junior ? 'Transition Counsellor Workbench' : 'Pathway Counsellor Workbench'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {junior
              ? 'Review recommendations, track readiness and guide learners to senior school decisions'
              : 'Review pathway selections, add notes and unlock subject selection'}
          </p>
        </div>
      </div>

      <CounsellorWorkspaceDashboard />
      <CounsellorInterventionQueue onOpenLearner={setSelected} />

      {/* Tab strip */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['search','Learner Search'],['class','Class View']].map(([k,l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab===k ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Learner Search tab ─────────────────────────────────────────────── */}
      {tab === 'search' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="Search by name or admission number…"
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <button type="button" onClick={doSearch} disabled={searching}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60">
                {searching ? <Loader2 size={13} className="animate-spin" /> : 'Search'}
              </button>
            </div>
            {junior && (
              <div className="flex flex-wrap gap-2 items-center">
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">All grades</option>
                  {GRADES_JUNIOR.map(g => <option key={g} value={g}>{g.replace('_',' ')}</option>)}
                </select>
                {filterGrade && (
                  <button type="button" onClick={() => setFilterGrade('')}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {searchResults.map(l => (
              <button key={l.id} type="button" onClick={() => setSelected(l)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-gray-900">{l.firstName} {l.lastName}</p>
                  <p className="text-[11px] text-gray-500">{l.admissionNumber} · {l.grade?.replace('_',' ')}</p>
                </div>
                <ChevronRight size={14} className="text-gray-400" aria-hidden="true" />
              </button>
            ))}
            {searchResults.length === 0 && (query || filterGrade) && !searching && (
              <p className="text-xs text-gray-400 text-center py-6">No learners found.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Class View tab ─────────────────────────────────────────────────── */}
      {tab === 'class' && (
        <div className="space-y-4">
          {/* Selector + filters */}
          <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setClassPage(1); }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="">Select a class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name || c.classCode} — {c.grade?.replace('_',' ')}</option>)}
            </select>
            {selectedClass && (
              <div className="flex flex-wrap gap-2">
                <select value={classFilterPathway} onChange={e => { setClassFilterPathway(e.target.value); setClassPage(1); }}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">All pathways</option>
                  {PATHWAYS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
                <select value={classFilterStatus} onChange={e => { setClassFilterStatus(e.target.value); setClassPage(1); }}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">All statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={classFilterReadiness} onChange={e => { setClassFilterReadiness(e.target.value); setClassPage(1); }}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">All readiness</option>
                  {READINESS_FILTERS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
                {(classFilterPathway || classFilterStatus || classFilterReadiness) && (
                  <button type="button" onClick={() => { setClassFilterPathway(''); setClassFilterStatus(''); setClassFilterReadiness(''); setClassPage(1); }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Junior summary banner */}
          {junior && distrib && selectedClass && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Profiled',          value: distrib.recommendationCoverage,                         of: distrib.learnerCount, cls: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
                { label: 'Career explored',   value: distrib.transitionReadiness?.careerExplored ?? 0,        of: distrib.learnerCount, cls: 'border-violet-200 bg-violet-50 text-violet-700' },
                { label: 'School shortlisted',value: distrib.transitionReadiness?.schoolShortlisted ?? 0,     of: distrib.learnerCount, cls: 'border-sky-200 bg-sky-50 text-sky-700' },
                { label: 'Plan submitted',    value: distrib.transitionReadiness?.decisionSubmitted ?? 0,     of: distrib.learnerCount, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                { label: 'Parent reviewed',   value: distrib.transitionReadiness?.parentReviewed ?? 0,        of: distrib.learnerCount, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
                { label: 'Needs review',      value: (distrib.selectionStatus?.SUBMITTED ?? 0) + (distrib.decisionStatus?.COUNSELLOR_REVIEWED ?? 0), of: null, cls: 'border-rose-200 bg-rose-50 text-rose-700' },
              ].map(({ label, value, of, cls }) => (
                <div key={label} className={`rounded-xl border p-3 ${cls}`}>
                  <p className="text-[9px] font-black uppercase tracking-wider opacity-70">{label}</p>
                  <p className="mt-0.5 text-xl font-black">
                    {value}{of != null && <span className="text-[11px] font-semibold opacity-60"> / {of}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {classLearnersLoading && <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-violet-600" aria-hidden="true" /></div>}

          {/* Empty state */}
          {!classLearnersLoading && selectedClass && classLearners.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center">
              <Users size={22} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
              <p className="text-sm text-gray-500">
                {classFilterPathway || classFilterStatus || classFilterReadiness ? 'No learners match these filters.' : 'No learners enrolled in this class.'}
              </p>
            </div>
          )}

          {/* Learner table */}
          {!classLearnersLoading && classLearners.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {classMeta && (
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-gray-700">{classMeta.className} · {classMeta.grade?.replace('_',' ')}</p>
                  <p className="text-[11px] text-gray-500">
                    {classMeta.filtered === classMeta.total ? `${classMeta.total} learner${classMeta.total !== 1 ? 's' : ''}` : `${classMeta.filtered} of ${classMeta.total}`}
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Learner','Grade','Pathway','Conf.','Status','Readiness',''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {classLearners.map((row) => {
                      const pct = Math.min(100, Math.max(0, row.confidenceScore ?? 0));
                      const confColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
                      const r = row.readiness;
                      return (
                        <tr key={row.learnerId}
                          onClick={() => setSelected({ id: row.learnerId, firstName: row.firstName, lastName: row.lastName, admissionNumber: row.admissionNumber, grade: row.grade })}
                          className={`cursor-pointer hover:bg-violet-50/40 transition-colors ${row.needsReview ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="text-sm font-bold text-gray-900">{row.firstName} {row.lastName}</p>
                            <p className="text-[10px] text-gray-400">{row.admissionNumber}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{row.grade?.replace('_',' ')}</td>
                          <td className="px-4 py-3">
                            {row.recommendedPathway
                              ? <span className="text-xs font-bold" style={{ color: PATHWAY_COLORS_MAP[row.recommendedPathway] || '#6b7280' }}>{row.recommendedPathway.replace('_',' ')}</span>
                              : <span className="text-[10px] text-gray-300 italic">None</span>}
                          </td>
                          <td className="px-4 py-3">
                            {row.confidenceScore != null
                              ? <div className="flex items-center gap-1.5 w-16">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: confColor }} />
                                  </div>
                                  <span className="text-[10px] font-bold" style={{ color: confColor }}>{pct}%</span>
                                </div>
                              : <span className="text-[10px] text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <SelectionStatusChip status={row.selectionStatus} size="xs" />
                            {row.needsReview && <p className="mt-0.5 text-[9px] text-amber-600 font-bold">Needs review</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1" title={`Rec: ${r.hasRecommendation ? '✓' : '✗'} Career: ${r.hasCareer ? '✓' : '✗'} School: ${r.hasSchool ? '✓' : '✗'} Plan: ${r.hasDecision ? '✓' : '✗'}`}>
                              {[r.hasRecommendation, r.hasCareer, r.hasSchool, r.hasDecision].map((done, i) => (
                                <span key={i} className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black border ${done ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                  {done ? '✓' : '\u00B7'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-300" aria-hidden="true" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {classPagination?.pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                  <p className="text-[10px] font-semibold text-gray-500">Page {classPagination.page} of {classPagination.pages}</p>
                  <div className="flex gap-1">
                    <button type="button" title="Previous page" aria-label="Previous page" disabled={classPage <= 1} onClick={() => setClassPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 disabled:opacity-40"><ChevronLeft size={14} /></button>
                    <button type="button" title="Next page" aria-label="Next page" disabled={classPage >= classPagination.pages} onClick={() => setClassPage((current) => current + 1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 disabled:opacity-40"><ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PathwayCounsellorWorkbench;
