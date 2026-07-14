import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  Lock,
  RefreshCw,
  Send,
} from 'lucide-react';
import { pathwayPlannerAPI } from '../../../services/api';

const STATUS = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  SUBMITTED: { label: 'Awaiting parent review', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  PARENT_REVIEWED: { label: 'Awaiting counsellor review', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  COUNSELLOR_REVIEWED: { label: 'Awaiting approval', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  REVISION_REQUIRED: { label: 'Revision required', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  APPROVED: { label: 'Approved — awaiting lock', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LOCKED: { label: 'Final and locked', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const EMPTY_REVISION = {
  reasonCategory: 'PATHWAY_CHOICE',
  explanation: '',
  affectedSection: 'Pathway decision',
  requiredAction: '',
  dueDate: '',
};

function RevisionFields({ value, onChange }) {
  const update = (field, next) => onChange({ ...value, [field]: next });
  return (
    <div className="grid gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 sm:grid-cols-2">
      <label className="text-[10px] font-bold text-gray-600">
        Reason
        <select value={value.reasonCategory} onChange={e => update('reasonCategory', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-normal">
          <option value="PATHWAY_CHOICE">Pathway choice</option>
          <option value="SUBJECT_COMBINATION">Subject combination</option>
          <option value="CAREER_ALIGNMENT">Career alignment</option>
          <option value="SCHOOL_PREFERENCES">School preferences</option>
          <option value="MORE_COUNSELLING">More counselling needed</option>
        </select>
      </label>
      <label className="text-[10px] font-bold text-gray-600">
        Affected section
        <input value={value.affectedSection} onChange={e => update('affectedSection', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-normal" />
      </label>
      <label className="text-[10px] font-bold text-gray-600 sm:col-span-2">
        Why a revision is needed
        <textarea value={value.explanation} onChange={e => update('explanation', e.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-normal"
          placeholder="Explain the concern clearly…" />
      </label>
      <label className="text-[10px] font-bold text-gray-600">
        Required action
        <input value={value.requiredAction} onChange={e => update('requiredAction', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-normal"
          placeholder="What should the learner change?" />
      </label>
      <label className="text-[10px] font-bold text-gray-600">
        Due date (optional)
        <input type="date" value={value.dueDate} onChange={e => update('dueDate', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-normal" />
      </label>
    </div>
  );
}

function revisionIsComplete(revision) {
  return revision.reasonCategory.trim()
    && revision.explanation.trim()
    && revision.affectedSection.trim()
    && revision.requiredAction.trim();
}

function PlanSummary({ plan }) {
  const submission = plan?.submissions?.[0];
  const snapshot = submission?.snapshot || {};
  const selection = snapshot.selection;
  if (!submission) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Submitted plan v{submission.version}</p>
        <span className="text-[10px] text-gray-400">{new Date(submission.submittedAt).toLocaleDateString('en-GB')}</span>
      </div>
      <p className="mt-2 text-xs font-bold text-gray-900">{selection?.pathway?.name || 'Pathway not available'}</p>
      {selection?.combinationRule?.name && <p className="text-[11px] text-gray-600">{selection.combinationRule.name}</p>}
      {snapshot.learnerStatement && (
        <p className="mt-2 border-l-2 border-indigo-200 pl-2 text-[11px] leading-relaxed text-gray-600">
          “{snapshot.learnerStatement}”
        </p>
      )}
    </div>
  );
}

export default function DecisionPlanPanel({
  learnerId,
  mode,
  canApprove = false,
  canLock = false,
  onChanged,
}) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statement, setStatement] = useState('');
  const [outcome, setOutcome] = useState('APPROVE');
  const [comment, setComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState('COUNSELLOR_ONLY');
  const [revision, setRevision] = useState(EMPTY_REVISION);

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.getDecisionPlan(learnerId);
      setPlan(res?.data || null);
    } catch (e) {
      setError(e?.message || 'Failed to load the decision plan');
    } finally {
      setLoading(false);
    }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mode === 'student' && plan?.submissions?.[0]?.snapshot?.learnerStatement) {
      setStatement(plan.submissions[0].snapshot.learnerStatement);
    }
  }, [mode, plan]);

  const run = async (operation, message) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await operation();
      setPlan(res?.data || null);
      setSuccess(message);
      setOutcome('APPROVE');
      setComment('');
      setRevision(EMPTY_REVISION);
      onChanged?.(res?.data || null);
    } catch (e) {
      setError(e?.message || 'The decision plan could not be updated');
    } finally {
      setBusy(false);
    }
  };

  const unresolvedRevision = useMemo(
    () => plan?.revisions?.find(item => !item.resolvedAt),
    [plan],
  );
  const status = plan?.status || 'DRAFT';
  const statusConfig = STATUS[status] || STATUS.DRAFT;
  const needsRevision = outcome !== 'APPROVE';

  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4" aria-label="Decision plan">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600">
            <ClipboardCheck size={12} /> Decision Plan
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">Pathway, subjects, careers and school choices reviewed as one plan.</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[9px] font-black ${statusConfig.cls}`}>
          {statusConfig.label}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700" role="status">
          <CheckCircle2 size={13} /> {success}
        </div>
      )}

      <PlanSummary plan={plan} />

      {unresolvedRevision && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] font-black uppercase text-rose-700">Revision requested</p>
          <p className="mt-1 text-xs font-bold text-rose-800">{unresolvedRevision.affectedSection}</p>
          <p className="mt-1 text-[11px] text-rose-700">{unresolvedRevision.explanation}</p>
          <p className="mt-1 text-[11px] font-semibold text-rose-800">Action: {unresolvedRevision.requiredAction}</p>
        </div>
      )}

      {mode === 'student' && (!plan || ['DRAFT', 'REVISION_REQUIRED'].includes(status)) && (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-gray-600">
            Why this plan fits you
            <textarea value={statement} onChange={e => setStatement(e.target.value)} maxLength={2000} rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-normal focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Explain how your pathway and subjects support your goals…" />
          </label>
          <button type="button" disabled={busy || !statement.trim()}
            onClick={() => run(
              () => pathwayPlannerAPI.submitDecisionPlan(learnerId, { learnerStatement: statement.trim() }),
              'Decision plan submitted for parent review.',
            )}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {status === 'REVISION_REQUIRED' ? 'Submit revised plan' : 'Submit decision plan'}
          </button>
        </div>
      )}

      {mode === 'parent' && status === 'SUBMITTED' && (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-gray-600">
            Review outcome
            <select value={outcome} onChange={e => setOutcome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-normal">
              <option value="APPROVE">I have reviewed and support this plan</option>
              <option value="REQUEST_REVISION">Request a revision</option>
              <option value="NEEDS_COUNSELLING">Request more counselling</option>
            </select>
          </label>
          <label className="block text-[10px] font-bold text-gray-600">
            Comment (optional)
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-normal" />
          </label>
          {comment.trim() && (
            <select value={commentVisibility} onChange={e => setCommentVisibility(e.target.value)}
              aria-label="Parent comment visibility"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs">
              <option value="COUNSELLOR_ONLY">Comment visible to counsellor only</option>
              <option value="SHARED_WITH_STUDENT">Share comment with student</option>
            </select>
          )}
          {needsRevision && <RevisionFields value={revision} onChange={setRevision} />}
          <button type="button" disabled={busy || (needsRevision && !revisionIsComplete(revision))}
            onClick={() => run(
              () => pathwayPlannerAPI.reviewDecisionPlanAsParent(learnerId, {
                outcome,
                comment: comment.trim() || undefined,
                visibility: commentVisibility,
                revision: needsRevision ? { ...revision, dueDate: revision.dueDate || null } : undefined,
              }),
              outcome === 'APPROVE' ? 'Parent review completed.' : 'Revision request sent.',
            )}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Submit parent review
          </button>
        </div>
      )}

      {mode === 'counsellor' && status === 'PARENT_REVIEWED' && (
        <div className="space-y-2">
          <select value={outcome} onChange={e => setOutcome(e.target.value)} aria-label="Counsellor review outcome"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs">
            <option value="APPROVE">Professional review complete</option>
            <option value="REQUEST_REVISION">Request revision</option>
          </select>
          {needsRevision && <RevisionFields value={revision} onChange={setRevision} />}
          <button type="button" disabled={busy || (needsRevision && !revisionIsComplete(revision))}
            onClick={() => run(
              () => pathwayPlannerAPI.reviewDecisionPlanAsCounsellor(learnerId, {
                outcome,
                revision: needsRevision ? { ...revision, dueDate: revision.dueDate || null } : undefined,
              }),
              outcome === 'APPROVE' ? 'Counsellor review completed.' : 'Revision request sent.',
            )}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />} Submit counsellor review
          </button>
        </div>
      )}

      {mode === 'counsellor' && status === 'COUNSELLOR_REVIEWED' && canApprove && (
        <button type="button" disabled={busy}
          onClick={() => run(() => pathwayPlannerAPI.approveDecisionPlan(learnerId), 'Decision plan approved.')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve decision plan
        </button>
      )}

      {mode === 'counsellor' && status === 'APPROVED' && canLock && (
        <button type="button" disabled={busy}
          onClick={() => run(() => pathwayPlannerAPI.lockDecisionPlan(learnerId), 'Decision plan locked as final.')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Lock final decision plan
        </button>
      )}

      {plan && !(['REVISION_REQUIRED', 'DRAFT'].includes(status) && mode === 'student')
        && !(status === 'SUBMITTED' && mode === 'parent')
        && !(status === 'PARENT_REVIEWED' && mode === 'counsellor')
        && !(status === 'COUNSELLOR_REVIEWED' && mode === 'counsellor' && canApprove)
        && !(status === 'APPROVED' && mode === 'counsellor' && canLock) && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
            {status === 'LOCKED' ? <Lock size={12} /> : <Clock3 size={12} />}
            {status === 'LOCKED' ? 'This version is final and cannot be changed.' : 'The plan is waiting for the next reviewer.'}
          </p>
        )}

      <button type="button" onClick={load} disabled={loading || busy}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-50">
        <RefreshCw size={10} /> Refresh status
      </button>
    </section>
  );
}
