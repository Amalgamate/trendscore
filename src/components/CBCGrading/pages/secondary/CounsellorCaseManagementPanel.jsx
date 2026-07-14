import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../services/api';

const TABS = [
  { id: 'actions', label: 'Actions', icon: ClipboardList },
  { id: 'sessions', label: 'Sessions', icon: CalendarPlus },
  { id: 'interventions', label: 'Interventions', icon: ShieldAlert },
];

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const INTERVENTION_TYPES = [
  'LOW_CONFIDENCE', 'ACADEMIC_MISMATCH', 'INTEREST_MISMATCH',
  'PARENT_STUDENT_CONFLICT', 'NO_VALID_COMBINATION', 'NO_ELIGIBLE_SCHOOL',
  'INCOMPLETE_ASSESSMENT', 'REPEATED_INDECISION', 'MISSED_DEADLINE', 'SUPPORT_NEED',
];

const EMPTY_ACTION = {
  title: '', description: '', assignedToRole: 'STUDENT', priority: 'NORMAL', category: '', dueDate: '',
};
const EMPTY_SESSION = {
  scheduledAt: '', durationMinutes: 30, mode: 'IN_PERSON', priority: 'MEDIUM',
  purpose: '', location: '', onlineLink: '', visibility: 'COUNSELLOR_ONLY',
};
const EMPTY_INTERVENTION = {
  interventionType: 'LOW_CONFIDENCE', priority: 'NORMAL', summary: '', dueDate: '',
};

const humanize = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = value => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled';

function StatusChip({ value }) {
  const resolved = ['COMPLETED', 'RESOLVED'].includes(value);
  const warning = ['URGENT', 'FOLLOW_UP_REQUIRED', 'NO_SHOW', 'ESCALATED'].includes(value);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${resolved
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : warning
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
      {humanize(value)}
    </span>
  );
}

export default function CounsellorCaseManagementPanel({ learnerId }) {
  const [tab, setTab] = useState('actions');
  const [data, setData] = useState({ actionPlan: null, sessions: [], interventions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [action, setAction] = useState(EMPTY_ACTION);
  const [session, setSession] = useState(EMPTY_SESSION);
  const [intervention, setIntervention] = useState(EMPTY_INTERVENTION);
  const [sessionUpdates, setSessionUpdates] = useState({});
  const [interventionUpdates, setInterventionUpdates] = useState({});
  const [escalationReasons, setEscalationReasons] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.getCaseManagement(learnerId);
      setData(res?.data || { actionPlan: null, sessions: [], interventions: [] });
    } catch (e) {
      setError(e?.message || 'Failed to load case management');
    } finally {
      setLoading(false);
    }
  }, [learnerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setShowCreate(false); setSuccess(null); }, [tab]);

  const mutate = async (operation, message) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      await operation();
      setSuccess(message);
      setShowCreate(false);
      await load();
      return true;
    } catch (e) {
      setError(e?.message || 'The case could not be updated');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createAction = async () => {
    const saved = await mutate(
      () => pathwayPlannerAPI.createActionItem(learnerId, { ...action, dueDate: action.dueDate || null }),
      'Action item created.',
    );
    if (saved) setAction(EMPTY_ACTION);
  };

  const createSession = async () => {
    const saved = await mutate(
      () => pathwayPlannerAPI.createCounsellingSession(learnerId, {
        ...session,
        scheduledAt: session.scheduledAt || null,
        durationMinutes: Number(session.durationMinutes),
      }),
      'Counselling session scheduled.',
    );
    if (saved) setSession(EMPTY_SESSION);
  };

  const createIntervention = async () => {
    const saved = await mutate(
      () => pathwayPlannerAPI.createIntervention(learnerId, {
        ...intervention,
        dueDate: intervention.dueDate || null,
      }),
      'Intervention added to the queue.',
    );
    if (saved) setIntervention(EMPTY_INTERVENTION);
  };

  const actions = data.actionPlan?.items || [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3" aria-label="Counsellor case management">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Case Management</p>
          <p className="text-[11px] text-gray-500">Follow-ups, counselling sessions and interventions.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(value => !value)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-black text-white">
          <Plus size={12} /> Add {tab === 'actions' ? 'action' : tab === 'sessions' ? 'session' : 'intervention'}
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map(item => {
          const Icon = item.icon;
          const count = item.id === 'actions' ? actions.length : data[item.id]?.length || 0;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold ${tab === item.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'}`}>
              <Icon size={11} /> {item.label} ({count})
            </button>
          );
        })}
      </div>

      {error && <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert"><AlertCircle size={13} />{error}</div>}
      {success && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700" role="status"><CheckCircle2 size={13} />{success}</div>}
      {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-violet-600" /></div>}

      {!loading && showCreate && tab === 'actions' && (
        <div className="grid gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 sm:grid-cols-2">
          <input value={action.title} onChange={e => setAction({ ...action, title: e.target.value })} placeholder="Action title"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs sm:col-span-2" />
          <textarea value={action.description} onChange={e => setAction({ ...action, description: e.target.value })} placeholder="Guidance or expected outcome" rows={2}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs sm:col-span-2" />
          <select value={action.assignedToRole} onChange={e => setAction({ ...action, assignedToRole: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            <option value="STUDENT">Assign to student</option><option value="PARENT">Assign to parent</option><option value="COUNSELLOR">Assign to counsellor</option>
          </select>
          <select value={action.priority} onChange={e => setAction({ ...action, priority: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            {PRIORITIES.map(value => <option key={value} value={value}>{humanize(value)}</option>)}
          </select>
          <input type="date" value={action.dueDate} onChange={e => setAction({ ...action, dueDate: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <input value={action.category} onChange={e => setAction({ ...action, category: e.target.value })} placeholder="Category (optional)" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <button type="button" disabled={busy || !action.title.trim()} onClick={createAction}
            className="rounded-lg bg-violet-600 py-2 text-xs font-black text-white disabled:opacity-60 sm:col-span-2">{busy ? 'Saving…' : 'Create action'}</button>
        </div>
      )}

      {!loading && showCreate && tab === 'sessions' && (
        <div className="grid gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 sm:grid-cols-2">
          <input type="datetime-local" value={session.scheduledAt} onChange={e => setSession({ ...session, scheduledAt: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <input type="number" min="5" max="480" value={session.durationMinutes} onChange={e => setSession({ ...session, durationMinutes: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" aria-label="Duration in minutes" />
          <input value={session.purpose} onChange={e => setSession({ ...session, purpose: e.target.value })} placeholder="Session purpose"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs sm:col-span-2" />
          <select value={session.mode} onChange={e => setSession({ ...session, mode: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            <option value="IN_PERSON">In person</option><option value="VIRTUAL">Virtual</option><option value="PHONE">Phone</option>
          </select>
          <select value={session.priority} onChange={e => setSession({ ...session, priority: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(value => <option key={value} value={value}>{humanize(value)}</option>)}
          </select>
          <input value={session.location} onChange={e => setSession({ ...session, location: e.target.value })} placeholder="Location" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <input value={session.onlineLink} onChange={e => setSession({ ...session, onlineLink: e.target.value })} placeholder="Online link" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <button type="button" disabled={busy || !session.purpose.trim() || !session.scheduledAt} onClick={createSession}
            className="rounded-lg bg-violet-600 py-2 text-xs font-black text-white disabled:opacity-60 sm:col-span-2">{busy ? 'Scheduling…' : 'Schedule session'}</button>
        </div>
      )}

      {!loading && showCreate && tab === 'interventions' && (
        <div className="grid gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 sm:grid-cols-2">
          <select value={intervention.interventionType} onChange={e => setIntervention({ ...intervention, interventionType: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            {INTERVENTION_TYPES.map(value => <option key={value} value={value}>{humanize(value)}</option>)}
          </select>
          <select value={intervention.priority} onChange={e => setIntervention({ ...intervention, priority: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">
            {PRIORITIES.map(value => <option key={value} value={value}>{humanize(value)}</option>)}
          </select>
          <textarea value={intervention.summary} onChange={e => setIntervention({ ...intervention, summary: e.target.value })} placeholder="Describe why intervention is required" rows={2}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs sm:col-span-2" />
          <input type="date" value={intervention.dueDate} onChange={e => setIntervention({ ...intervention, dueDate: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
          <button type="button" disabled={busy || !intervention.summary.trim()} onClick={createIntervention}
            className="rounded-lg bg-rose-600 py-2 text-xs font-black text-white disabled:opacity-60">{busy ? 'Saving…' : 'Create intervention'}</button>
        </div>
      )}

      {!loading && tab === 'actions' && (
        <div className="space-y-2">
          {actions.map(item => (
            <div key={item.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-gray-900">{item.title}</p><p className="text-[10px] text-gray-500">Assigned to {humanize(item.assignedToRole)} · Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : 'not set'}</p></div><div className="flex gap-1"><StatusChip value={item.priority} /><StatusChip value={item.status} /></div></div>
              {item.description && <p className="mt-1 text-[11px] text-gray-600">{item.description}</p>}
              {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
                <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => mutate(() => pathwayPlannerAPI.updateActionItem(learnerId, item.id, { status: 'IN_PROGRESS' }), 'Action marked in progress.')} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold">Start</button><button type="button" disabled={busy} onClick={() => mutate(() => pathwayPlannerAPI.updateActionItem(learnerId, item.id, { status: 'COMPLETED' }), 'Action completed.')} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">Complete</button></div>
              )}
            </div>
          ))}
          {actions.length === 0 && <p className="py-4 text-center text-xs text-gray-400">No action items yet.</p>}
        </div>
      )}

      {!loading && tab === 'sessions' && (
        <div className="space-y-2">
          {(data.sessions || []).map(item => {
            const update = sessionUpdates[item.id] || {
              status: item.status,
              outcomeSummary: item.outcomeSummary || '',
              nextActions: item.nextActions || '',
              followUpAt: item.followUpAt ? new Date(item.followUpAt).toISOString().slice(0, 16) : '',
            };
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-gray-900">{item.purpose || item.reason || 'Counselling session'}</p><p className="text-[10px] text-gray-500">{dateLabel(item.scheduledAt)} · {humanize(item.mode)}</p></div><StatusChip value={item.status} /></div>
                {!['COMPLETED', 'CANCELLED'].includes(item.status) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={update.status} onChange={e => setSessionUpdates({ ...sessionUpdates, [item.id]: { ...update, status: e.target.value } })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="FOLLOW_UP_REQUIRED">Follow-up required</option><option value="NO_SHOW">No show</option><option value="CANCELLED">Cancelled</option></select>
                    <input value={update.outcomeSummary} onChange={e => setSessionUpdates({ ...sessionUpdates, [item.id]: { ...update, outcomeSummary: e.target.value } })} placeholder="Outcome summary" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <input value={update.nextActions} onChange={e => setSessionUpdates({ ...sessionUpdates, [item.id]: { ...update, nextActions: e.target.value } })} placeholder="Next actions" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <input type="datetime-local" value={update.followUpAt} onChange={e => setSessionUpdates({ ...sessionUpdates, [item.id]: { ...update, followUpAt: e.target.value } })} aria-label="Follow-up date" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <button type="button" disabled={busy || (update.status === 'COMPLETED' && !update.outcomeSummary.trim())} onClick={() => mutate(() => pathwayPlannerAPI.updateCounsellingSession(learnerId, item.id, { ...update, followUpAt: update.followUpAt || null }), 'Session updated.')} className="rounded-lg bg-violet-600 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-60 sm:col-span-2">Save outcome and follow-up</button>
                  </div>
                )}
              </div>
            );
          })}
          {(data.sessions || []).length === 0 && <p className="py-4 text-center text-xs text-gray-400">No counselling sessions yet.</p>}
        </div>
      )}

      {!loading && tab === 'interventions' && (
        <div className="space-y-2">
          {(data.interventions || []).map(item => {
            const update = interventionUpdates[item.id] || { status: item.status, outcome: item.outcome || '', resolutionNotes: item.resolutionNotes || '' };
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-gray-900">{humanize(item.interventionType)}</p><p className="text-[11px] text-gray-600">{item.summary}</p></div><div className="flex gap-1"><StatusChip value={item.priority} /><StatusChip value={item.status} /></div></div>
                {item.escalationReason && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700"><strong>Escalated:</strong> {item.escalationReason}</div>}
                {!['RESOLVED', 'CANCELLED', 'ESCALATED'].includes(item.status) && (
                  <div className="flex gap-2">
                    <input value={escalationReasons[item.id] || ''} onChange={e => setEscalationReasons({ ...escalationReasons, [item.id]: e.target.value })} placeholder="Reason for administrator escalation" className="min-w-0 flex-1 rounded-lg border border-rose-200 px-2 py-1.5 text-xs" />
                    <button type="button" disabled={busy || !(escalationReasons[item.id] || '').trim()} onClick={() => mutate(() => pathwayPlannerAPI.escalateCase(learnerId, { interventionId: item.id, reason: escalationReasons[item.id] }), 'Case escalated to school administrators.')} className="rounded-lg bg-rose-700 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60">Escalate</button>
                  </div>
                )}
                {!['RESOLVED', 'CANCELLED'].includes(item.status) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={update.status} onChange={e => setInterventionUpdates({ ...interventionUpdates, [item.id]: { ...update, status: e.target.value } })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs">{item.status === 'ESCALATED' && <option value="ESCALATED" disabled>Escalated</option>}<option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CANCELLED">Cancelled</option></select>
                    <input value={update.outcome} onChange={e => setInterventionUpdates({ ...interventionUpdates, [item.id]: { ...update, outcome: e.target.value } })} placeholder="Outcome" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <input value={update.resolutionNotes} onChange={e => setInterventionUpdates({ ...interventionUpdates, [item.id]: { ...update, resolutionNotes: e.target.value } })} placeholder="Resolution notes" className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    <button type="button" disabled={busy || (update.status === 'RESOLVED' && !update.outcome.trim())} onClick={() => mutate(() => pathwayPlannerAPI.updateIntervention(learnerId, item.id, update), 'Intervention updated.')} className="rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-60">Save intervention</button>
                  </div>
                )}
              </div>
            );
          })}
          {(data.interventions || []).length === 0 && <p className="py-4 text-center text-xs text-gray-400">No intervention cases yet.</p>}
        </div>
      )}
    </section>
  );
}
