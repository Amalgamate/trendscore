/**
 * ParentPortalBoarding
 *
 * Parent-facing boarding status page. Shows:
 *  - Tonight's dormitory roll call status (present / absent / on-exeat)
 *  - Active and recent exeat requests with full lifecycle status
 *  - Ability to submit a new exeat request
 *  - Boarding presence events from the timeline (dorm roll calls, exeat events)
 *
 * APIs used:
 *   dashboardAPI.getParentMetrics()            → children list
 *   boardingAPI.getLearnerAssignment(id)        → dorm + bed info
 *   boardingAPI.getExeats({ learnerId })        → exeat history
 *   boardingAPI.requestExeat(data)              → submit request
 *   presenceAPI.getLearnerTimeline(id, date)    → presence events (DORM_ROLL_CALL etc.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Home, CheckCircle2, AlertTriangle, Clock,
  ChevronRight, RefreshCw, Plus, X, Loader2,
  CalendarDays, Activity, Moon, Sunrise,
} from 'lucide-react';
import api, { dashboardAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';
import { useNotifications } from '../../hooks/useNotifications';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtTime = (ts) => ts
  ? new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })
  : '';

const isoDate = (d) => d.toISOString().slice(0, 10);

const EXEAT_STATUS_STYLE = {
  PENDING:   { cls: 'bg-amber-100 text-amber-700',   label: 'Pending' },
  APPROVED:  { cls: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
  DENIED:    { cls: 'bg-red-100 text-red-700',        label: 'Denied' },
  CANCELLED: { cls: 'bg-gray-100 text-gray-500',      label: 'Cancelled' },
};

const inputCls = 'w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition';
const selectCls = inputCls;

// ── Exeat request modal ───────────────────────────────────────────────────────

function ExeatModal({ learnerId, learnerName, parentPhone, onClose, onSuccess }) {
  const [form, setForm] = useState({
    exeatType: 'WEEKEND',
    departureDate: '',
    returnDate: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const { showError } = useNotifications();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.departureDate || !form.returnDate || !form.reason.trim()) {
      showError('Please fill in all fields');
      return;
    }
    if (new Date(form.returnDate) <= new Date(form.departureDate)) {
      showError('Return date must be after departure date');
      return;
    }
    setSaving(true);
    try {
      const res = await api.boarding.requestExeat({
        learnerId,
        requestedBy: 'PARENT',
        exeatType: form.exeatType,
        departureDate: form.departureDate,
        returnDate: form.returnDate,
        reason: form.reason.trim(),
        parentPhone,
      });
      if (res?.success) {
        onSuccess();
        onClose();
      } else {
        showError(res?.message || 'Failed to submit request');
      }
    } catch (err) {
      showError(err?.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Request Exeat Leave</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-sm text-indigo-800 font-medium">
            For: {learnerName}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Leave Type</label>
            <select className={selectCls} value={form.exeatType}
              onChange={e => setForm(p => ({ ...p, exeatType: e.target.value }))}>
              <option value="WEEKEND">Weekend Leave</option>
              <option value="MEDICAL">Medical</option>
              <option value="FAMILY">Family Event</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Departure Date</label>
              <input type="date" className={inputCls} required
                value={form.departureDate}
                min={isoDate(new Date())}
                onChange={e => setForm(p => ({ ...p, departureDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Return Date</label>
              <input type="date" className={inputCls} required
                value={form.returnDate}
                min={form.departureDate || isoDate(new Date())}
                onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Reason</label>
            <textarea className={inputCls} rows={3} required placeholder="Briefly explain the reason for this leave request…"
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl">
            <p className="text-xs text-amber-700 font-medium">
              Your request will be reviewed by the house master. You will receive an SMS when it is approved or denied.
            </p>
          </div>

          <div className="flex gap-3 pt-1 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Boarding status card for one child ────────────────────────────────────────

function ChildBoardingCard({ child, onNavigate }) {
  const [assignment, setAssignment]   = useState(null);
  const [exeats, setExeats]           = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showExeatModal, setShowExeatModal] = useState(false);
  const { showSuccess } = useNotifications();

  const load = useCallback(async () => {
    if (!child?.id) return;
    setLoading(true);
    try {
      const today = isoDate(new Date());
      const [assignRes, exeatRes, timelineRes] = await Promise.allSettled([
        api.boarding.getLearnerAssignment(child.id),
        api.boarding.getExeats({ learnerId: child.id }),
        api.presence.getLearnerTimeline(child.id, today),
      ]);

      if (assignRes.status === 'fulfilled') setAssignment(assignRes.value?.data ?? null);
      if (exeatRes.status === 'fulfilled')  setExeats(exeatRes.value?.data ?? []);
      if (timelineRes.status === 'fulfilled') {
        const boardingEvents = (timelineRes.value?.data?.events ?? []).filter(e =>
          ['DORM_ROLL_CALL', 'EXEAT_DEPARTED', 'EXEAT_RETURNED'].includes(e.eventType)
        );
        setTodayEvents(boardingEvents);
      }
    } finally {
      setLoading(false);
    }
  }, [child?.id]);

  useEffect(() => { load(); }, [load]);

  // Find tonight's roll call from today's events
  const nightRollCall = todayEvents.find(e =>
    e.eventType === 'DORM_ROLL_CALL' &&
    String(e.metadata?.session ?? '').toUpperCase() === 'NIGHT'
  );
  const morningRollCall = todayEvents.find(e =>
    e.eventType === 'DORM_ROLL_CALL' &&
    String(e.metadata?.session ?? '').toUpperCase() === 'MORNING'
  );

  // Active exeat (approved, departed, not yet returned)
  const activeExeat = exeats.find(ex =>
    ex.status === 'APPROVED' && ex.departedAt && !ex.returnedAt
  );
  const pendingExeat = exeats.find(ex => ex.status === 'PENDING');
  const recentExeats = exeats
    .filter(ex => ex.status !== 'PENDING')
    .slice(0, 3);

  const dormName  = assignment?.dormitory?.name ?? null;
  const bedNumber = assignment?.bed?.bedNumber ?? null;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-16" /></div>
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
        <div className="p-4">

          {/* Child name + dorm */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-bold text-gray-900 text-sm">{child.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {dormName
                  ? <>{dormName}{bedNumber ? ` · Bed ${bedNumber}` : ''}</>
                  : <span className="text-amber-600">No dormitory assigned</span>
                }
              </p>
            </div>
            {activeExeat && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full flex-shrink-0">
                On Leave
              </span>
            )}
          </div>

          {/* Today's roll call status */}
          {!activeExeat && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Morning Roll Call', event: morningRollCall, icon: Sunrise, session: 'MORNING' },
                { label: 'Night Roll Call',   event: nightRollCall,  icon: Moon,    session: 'NIGHT' },
              ].map(({ label, event, icon: Icon, session }) => {
                const status = event?.metadata?.rollCallStatus;
                const isPresent = event && (status === 'PRESENT' || !status);
                const isAbsent  = event && status === 'ABSENT';
                const pending   = !event;

                return (
                  <div key={session} className={`rounded-xl border p-3 ${
                    isPresent ? 'bg-emerald-50 border-emerald-100' :
                    isAbsent  ? 'bg-red-50 border-red-100' :
                    'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} className={isPresent ? 'text-emerald-600' : isAbsent ? 'text-red-500' : 'text-gray-400'} />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
                    </div>
                    {pending ? (
                      <p className="text-xs text-gray-400 font-medium">Not yet done</p>
                    ) : isPresent ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700">Present</span>
                      </div>
                    ) : isAbsent ? (
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={13} className="text-red-500" />
                        <span className="text-xs font-bold text-red-600">Absent</span>
                      </div>
                    ) : (
                      <p className="text-xs text-indigo-600 font-bold capitalize">{status}</p>
                    )}
                    {event && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(event.timestamp)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active exeat banner */}
          {activeExeat && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={13} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800">Currently On Leave</span>
              </div>
              <p className="text-[11px] text-amber-700">
                {activeExeat.exeatType} leave · Returns {fmtDate(activeExeat.returnDate)}
              </p>
              {activeExeat.departedAt && (
                <p className="text-[10px] text-amber-600 mt-0.5">Departed {fmtDate(activeExeat.departedAt)}</p>
              )}
            </div>
          )}

          {/* Pending exeat banner */}
          {pendingExeat && !activeExeat && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={13} className="text-blue-600" />
                <span className="text-xs font-bold text-blue-800">Exeat Request Pending</span>
              </div>
              <p className="text-[11px] text-blue-700">
                {pendingExeat.exeatType} · {fmtDate(pendingExeat.departureDate)} → {fmtDate(pendingExeat.returnDate)}
              </p>
              <p className="text-[10px] text-blue-500 mt-0.5">Awaiting house master approval</p>
            </div>
          )}

          {/* Exeat request button */}
          {!activeExeat && !pendingExeat && (
            <button
              onClick={() => setShowExeatModal(true)}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition"
            >
              <Plus size={13} />
              Request Leave / Exeat
            </button>
          )}

          {/* Recent exeats */}
          {recentExeats.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Recent Leave History</p>
              <div className="space-y-1.5">
                {recentExeats.map(ex => {
                  const style = EXEAT_STATUS_STYLE[ex.status] ?? EXEAT_STATUS_STYLE.CANCELLED;
                  return (
                    <div key={ex.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate">
                          {ex.exeatType} · {fmtDate(ex.departureDate)} → {fmtDate(ex.returnDate)}
                        </p>
                        {ex.denialReason && (
                          <p className="text-[10px] text-red-500 mt-0.5">Reason: {ex.denialReason}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${style.cls}`}>
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showExeatModal && (
        <ExeatModal
          learnerId={child.id}
          learnerName={child.name}
          parentPhone={child.primaryContactPhone || child.guardianPhone}
          onClose={() => setShowExeatModal(false)}
          onSuccess={() => { load(); }}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ParentPortalBoarding = ({ onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children ?? []);
      else setError(res?.message || 'Failed to load');
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => onNavigate('parent-portal-more')}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Boarding</h1>
            <p className="text-[10px] text-gray-500">Dormitory, roll call & leave</p>
          </div>
          <button type="button" onClick={load}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-600 flex-shrink-0" />
            <p className="text-xs text-rose-700 flex-1">{error}</p>
            <button onClick={load} className="text-[10px] font-bold text-rose-600 underline">Retry</button>
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
          <Home size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-indigo-800">Boarding Status</p>
            <p className="text-[11px] text-indigo-600 mt-0.5">
              Shows roll call attendance and leave requests for your child.
              You will receive an SMS when exeat requests are approved or denied.
            </p>
          </div>
        </div>

        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))
        ) : children.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
            <Home size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">No children linked</p>
            <p className="text-xs text-gray-400 mt-1">Contact the school to link your boarding child to this account.</p>
          </div>
        ) : (
          children.map(child => (
            <ChildBoardingCard key={child.id} child={child} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  );
};

export default ParentPortalBoarding;
