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
  Search, Users, ChevronRight, BarChart2, MessageSquare,
  Lock, Unlock, CheckCircle2, AlertCircle, Loader2,
  Send, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { pathwayPlannerAPI, pathwayAPI, learnerAPI, classAPI, seniorPathwayAPI } from '../../../../services/api';
import DecisionPlanPanel from '../../shared/DecisionPlanPanel';
import CounsellorCaseManagementPanel from './CounsellorCaseManagementPanel';
import CounsellorWorkspaceDashboard from './CounsellorWorkspaceDashboard';
import CounsellorEvidencePanel from './CounsellorEvidencePanel';
import CounsellorInterventionQueue from './CounsellorInterventionQueue';

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

// ─── StatusPill ───────────────────────────────────────────────────────────────
const STATUS_CLS = {
  DRAFT:     'bg-gray-100 text-gray-600 border-gray-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED:  'bg-rose-100 text-rose-700 border-rose-200',
  LOCKED:    'bg-violet-100 text-violet-700 border-violet-200',
  NONE:      'bg-gray-50 text-gray-400 border-gray-100',
};
const StatusPill = ({ status = 'NONE' }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[status] || STATUS_CLS.NONE}`}>
    {status}
  </span>
);

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

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={22} className="animate-spin text-violet-600" />
    </div>
  );
  if (error) return <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700">{error}</div>;
  if (!data) return null;

  const { learner, latestRecommendation: rec, selection, counsellorNotes: notes, selectionUnlocked, evidence } = data;
  const predPathway = rec?.recommendedPathway || 'No recommendation yet';

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
        <StatusPill status={selection?.status || 'NONE'} />
      </div>

      {/* Recommendation card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recommended Pathway</p>
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

      <DecisionPlanPanel
        learnerId={learnerId}
        mode="counsellor"
        canApprove={['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER', 'HEAD_OF_CURRICULUM'].includes(String(user?.role || '').toUpperCase())}
        canLock={['SUPER_ADMIN', 'ADMIN', 'HEAD_TEACHER'].includes(String(user?.role || '').toUpperCase())}
      />

      <CounsellorCaseManagementPanel learnerId={learnerId} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const PathwayCounsellorWorkbench = ({ onNavigate, initialClassId, user }) => {
  const [tab, setTab]                   = useState(initialClassId ? 'class' : 'search');
  const [query, setQuery]               = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [selectedLearner, setSelected]  = useState(null);
  const [classes, setClasses]           = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [distrib, setDistrib]           = useState(null);
  const [distribLoading, setDistribLoading] = useState(false);
  const junior = String(user?.institutionType || '').toUpperCase() !== 'SECONDARY';
  const institutionType = junior ? 'PRIMARY_CBC' : 'SECONDARY';

  // Load classes for the distribution tab
  useEffect(() => {
    classAPI.getAll({ institutionType, limit: 100 })
      .then(r => {
        const rows = r?.data || r || [];
        setClasses(junior ? rows.filter((item) => ['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(String(item.grade || '').toUpperCase())) : rows);
      })
      .catch(() => {});
  }, [institutionType, junior]);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await learnerAPI.getAll({ search: query, institutionType, limit: 20 });
      const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSearchResults(junior ? rows.filter((item) => ['GRADE_7', 'GRADE_8', 'GRADE_9'].includes(String(item.grade || '').toUpperCase())) : rows);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [institutionType, junior, query]);

  const loadDistrib = useCallback(async (classId) => {
    if (!classId) return;
    setDistribLoading(true);
    try {
      const res = await pathwayPlannerAPI.getClassDistribution(classId);
      setDistrib(res?.data || null);
    } catch { setDistrib(null); }
    finally { setDistribLoading(false); }
  }, []);

  useEffect(() => { if (selectedClass) loadDistrib(selectedClass); }, [selectedClass, loadDistrib]);

  if (selectedLearner) {
    return (
      <div className="p-6">
        <LearnerDetail learnerId={selectedLearner.id} onBack={() => setSelected(null)} user={user} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">{junior ? 'Transition Counsellor Workbench' : 'Pathway Counsellor Workbench'}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{junior ? 'Review recommendations, family decisions and senior-school readiness' : 'Review pathway recommendations, add notes and unlock subject selection'}</p>
        </div>
        <button type="button" onClick={() => setSelected(null)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <CounsellorWorkspaceDashboard />

      <CounsellorInterventionQueue onOpenLearner={setSelected} />

      {/* Tab strip */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['search','Learner Search'],['class','Class Distribution']].map(([k,l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab===k ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search learner by name or admission number…"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <button type="button" onClick={doSearch} disabled={searching}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60">
              {searching ? <Loader2 size={13} className="animate-spin" /> : 'Search'}
            </button>
          </div>
          <div className="space-y-2">
            {searchResults.map(l => (
              <button key={l.id} type="button" onClick={() => setSelected(l)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-gray-900">{l.firstName} {l.lastName}</p>
                  <p className="text-[11px] text-gray-500">{l.admissionNumber} · {l.grade?.replace('_',' ')}</p>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            ))}
            {searchResults.length === 0 && query && !searching && (
              <p className="text-xs text-gray-400 text-center py-6">No results found.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'class' && (
        <div className="space-y-4">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="">Select a class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name || c.classCode}</option>)}
          </select>
          {distribLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-600" /></div>}
          {distrib && !distribLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5"><BarChart2 size={11} /> Pathway Recommendations</p>
                {Object.entries(distrib.recommendations || {}).map(([p, count]) => (
                  <div key={p} className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: PATHWAY_COLORS[p] || '#374151' }}>{p}</span>
                    <span className="text-sm font-black text-gray-900">{count}</span>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 mt-2">{distrib.recommendationCoverage} / {distrib.learnerCount} learners have a recommendation</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5"><CheckCircle2 size={11} /> Selection Status</p>
                {Object.entries(distrib.selectionStatus || {}).map(([s, count]) => (
                  <div key={s} className="flex items-center justify-between mb-2">
                    <StatusPill status={s} />
                    <span className="text-sm font-black text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PathwayCounsellorWorkbench;
