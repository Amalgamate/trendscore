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
  ChevronRight,
} from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../../services/api';

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
          "{snapshot.learnerStatement}"
        </p>
      )}
    </div>
  );
}

function StatusTimeline({ plan }) {
  const steps = [
    { key: 'DRAFT', label: 'Draft', icon: '📝' },
    { key: 'SUBMITTED', label: 'Submitted', icon: '📤' },
    { key: 'PARENT_REVIEWED', label: 'Parent reviewed', icon: '👨‍👩‍👧' },
    { key: 'COUNSELLOR_REVIEWED', label: 'Counsellor reviewed', icon: '👨‍🏫' },
    { key: 'APPROVED', label: 'Approved', icon: '✅' },
    { key: 'LOCKED', label: 'Locked', icon: '🔒' },
  ];
  const currentStatus = plan?.status || 'DRAFT';
  const currentIndex = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="relative pl-4 border-l border-gray-200 ml-2">
      {steps.map((step, index) => {
        const isCompleted = index <= currentIndex && currentStatus !== 'DRAFT';
        const isCurrent = step.key === currentStatus;
        const isFuture = index > currentIndex;

        return (
          <div key={step.key} className="relative pb-4 flex items-start gap-3">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
              isCompleted ? 'bg-emerald-500 text-white border-2 border-white' :
              isCurrent ? 'bg-indigo-500 text-white border-2 border-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {isCompleted ? '✓' : step.icon}
            </div>
            <div>
              <p className={`text-sm font-bold ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-emerald-700' : 'text-gray-400'}`}>
                {step.label}
              </p>
              {isCurrent && plan?.updatedAt && (
                <p className="text-[10px] text-gray-500">Updated {new Date(plan.updatedAt).toLocaleDateString('en-GB')}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DecisionPlanTab({
  learnerId,
  mode,
  decisionPlan,
  recommendation,
  selection,
  onChanged,
}) {
  const [plan, setPlan] = useState(decisionPlan);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statement, setStatement] = useState('');
  const [outcome, setOutcome] = useState('APPROVE');
  const [comment, setComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState('COUNSELLOR_ONLY');
  const [revision, setRevision] = useState(EMPTY_REVISION);

  // Sync with prop
  useEffect(() => {
    setPlan(decisionPlan);
  }, [decisionPlan]);

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
    if (mode === 'decision' && plan?.submissions?.[0]?.snapshot?.learnerStatement) {
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
      setError(e?.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  // No plan means this learner is creating their first draft. Treat it as
  // editable rather than leaving the statement disabled with no action.
  const studentCanEdit = !plan || plan?.status === 'DRAFT' || plan?.status === 'REVISION_REQUIRED';
  const isLocked = plan?.status === 'LOCKED';

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // Progress mode - show timeline and summary
  if (mode === 'progress') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Decision Plan Status</p>
          {plan?.status && (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${STATUS[plan.status]?.cls || STATUS.DRAFT.cls}`}>
              {STATUS[plan.status]?.label || plan.status}
            </span>
          )}
        </div>
        <StatusTimeline plan={plan} />
        {plan?.submissions?.[0] && <PlanSummary plan={plan} />}
        {!plan && <p className="text-center text-gray-500 py-8">No decision plan yet. Go to the Decision Plan tab to create one.</p>}
      </div>
    );
  }

  // Decision mode - full editor
  return (
    <div className="p-4 space-y-4">
      {/* Status header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Decision Plan</p>
          {plan?.status && (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${STATUS[plan.status]?.cls || STATUS.DRAFT.cls}`}>
              {STATUS[plan.status]?.label || plan.status}
            </span>
          )}
        </div>
        <StatusTimeline plan={plan} />
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">{success}</div>}

      {/* Student statement */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Your statement</p>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Explain your pathway choice, career aspirations, and why these schools fit you…"
          className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-normal text-gray-700"
          disabled={!studentCanEdit}
        />
        <p className="mt-1 text-[10px] text-gray-400 text-right">{statement.length}/1000</p>
      </div>

      {/* Current plan summary */}
      {plan?.submissions?.[0] && <PlanSummary plan={plan} />}

      {/* Actions based on status */}
      <div className="flex flex-wrap gap-2">
        {studentCanEdit && (
          <button
            type="button"
            onClick={() => run(
              () => pathwayPlannerAPI.submitDecisionPlan(learnerId, { learnerStatement: statement }),
              'Decision plan submitted for review'
            )}
            disabled={busy || !statement.trim()}
            className="flex-1 min-w-[160px] rounded-xl bg-[#06285a] py-2 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? 'Submitting…' : plan?.status === 'REVISION_REQUIRED' ? 'Resubmit' : 'Submit for review'}
          </button>
        )}

        {/* Parent actions */}
        {mode !== 'progress' && plan?.status === 'SUBMITTED' && (
          <>
            <button
              type="button"
              onClick={() => run(
                () => pathwayPlannerAPI.reviewDecisionPlanAsParent(learnerId, { action: 'APPROVE', comment, visibility: commentVisibility }),
                'Decision plan approved'
              )}
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {busy ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setOutcome('REVISION_REQUIRED')}
              disabled={busy}
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 disabled:opacity-60"
            >
              Request revision
            </button>
          </>
        )}

        {/* Counsellor actions */}
        {mode !== 'progress' && plan?.status === 'PARENT_REVIEWED' && (
          <>
            <button
              type="button"
              onClick={() => run(
                () => pathwayPlannerAPI.reviewDecisionPlanAsCounsellor(learnerId, { action: 'APPROVE', comment, visibility: commentVisibility }),
                'Decision plan approved'
              )}
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {busy ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setOutcome('REVISION_REQUIRED')}
              disabled={busy}
              className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 disabled:opacity-60"
            >
              Request revision
            </button>
          </>
        )}

        {/* Approve/Lock actions */}
        {plan?.status === 'APPROVED' && (
          <button
            type="button"
            onClick={() => run(
              () => pathwayPlannerAPI.lockDecisionPlan(learnerId),
              'Decision plan locked — no further changes'
            )}
            disabled={busy}
            className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? 'Locking…' : 'Lock plan'}
          </button>
        )}

        {/* Revision form */}
        {outcome === 'REVISION_REQUIRED' && (
          <div className="w-full">
            <RevisionFields value={revision} onChange={setRevision} />
            <button
              type="button"
              onClick={() => run(
                () => pathwayPlannerAPI.reviewDecisionPlanAsParent(learnerId, { action: 'REVISION_REQUIRED', ...revision }),
                'Revision requested'
              )}
              disabled={busy || !revisionIsComplete(revision)}
              className="mt-2 w-full rounded-xl bg-rose-600 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send revision request'}
            </button>
            <button
              type="button"
              onClick={() => { setOutcome('APPROVE'); setRevision(EMPTY_REVISION); }}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white py-2 text-sm font-black text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Refresh */}
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black text-gray-700 flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Action plan from latest submission */}
      {plan?.actionPlan?.items?.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Action plan</p>
          <div className="mt-2 space-y-2">
            {plan.actionPlan.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2">
                <div>
                  <p className={`text-[11px] font-bold ${item.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.title}</p>
                  <p className="text-[9px] text-gray-500">{item.assignedToRole} · {item.priority}{item.dueDate ? ` · due ${new Date(item.dueDate).toLocaleDateString()}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
