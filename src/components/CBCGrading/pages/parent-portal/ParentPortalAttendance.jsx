/**
 * ParentPortalAttendance — Family Attendance + Presence Timeline
 * Shows attendance summary AND the full-day presence timeline from the Presence Platform.
 *
 * API sources:
 *   dashboardAPI.getParentMetrics()           → child list with attendance summaries
 *   attendanceAPI.getLearnerSummary(id)        → term records (existing)
 *   api.presence.getLearnerTimeline(id, date)  → full-day presence timeline (Phase 2.0)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, ChevronDown, ChevronUp, CalendarDays, Clock3, FileEdit,
  ShieldCheck, TrendingUp, AlertTriangle, Activity, MapPin, Bus,
  Home, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { dashboardAPI, attendanceAPI } from '../../../../services/api';
import api from '../../../../services/api';
import { Skeleton } from '../../../ui';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const isoDate = (d) => d.toISOString().slice(0, 10);

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

const STATUS_COLORS = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT:  'bg-rose-100 text-rose-700',
  LATE:    'bg-amber-100 text-amber-700',
  EXCUSED: 'bg-blue-100 text-blue-700',
  SICK:    'bg-orange-100 text-orange-700',
};

// ── Presence Timeline mini-view ─────────────────────────────────────────────
const EVENT_ICONS = {
  CLASS_ATTENDANCE: Activity,
  GATE_ENTRY: MapPin,
  GATE_EXIT: MapPin,
  BUS_BOARDED: Bus,
  BUS_ALIGHTED: Bus,
  DORM_ROLL_CALL: Home,
};
const EVENT_COLORS = {
  CLASS_ATTENDANCE: 'bg-emerald-50 text-emerald-600',
  GATE_ENTRY: 'bg-blue-50 text-blue-600',
  GATE_EXIT: 'bg-slate-50 text-slate-500',
  BUS_BOARDED: 'bg-amber-50 text-amber-600',
  BUS_ALIGHTED: 'bg-amber-50 text-amber-500',
  DORM_ROLL_CALL: 'bg-indigo-50 text-indigo-600',
};

function PresenceTimelineMini({ learnerId }) {
  const [date, setDate]       = useState(isoDate(new Date()));
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTimeline = useCallback(async (d) => {
    if (!learnerId) return;
    setLoading(true);
    try {
      const res = await api.presence.getLearnerTimeline(learnerId, d);
      setEvents(res?.data?.events ?? []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [learnerId]);

  useEffect(() => { fetchTimeline(date); }, [fetchTimeline, date]);

  const shiftDate = (delta) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    const next = isoDate(d);
    if (next > isoDate(new Date())) return;
    setDate(next);
  };

  const isToday = date === isoDate(new Date());

  return (
    <div className="mx-3 mb-3 rounded-xl border border-indigo-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 border-b border-indigo-100">
        <div className="flex items-center gap-1.5 text-indigo-700">
          <Activity size={12} />
          <span className="text-[11px] font-bold">Today's Journey</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-indigo-100 text-indigo-400 transition">
            <ChevronLeft size={12} />
          </button>
          <span className="text-[10px] font-semibold text-indigo-600 min-w-[52px] text-center">
            {isToday ? 'Today' : date.slice(5).replace('-', ' ')}
          </span>
          <button onClick={() => shiftDate(1)} disabled={isToday}
            className="p-1 rounded hover:bg-indigo-100 text-indigo-400 transition disabled:opacity-30">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Events */}
      <div className="divide-y divide-gray-50">
        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[11px]">Loading…</span>
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="py-5 text-center">
            <Activity size={20} className="mx-auto text-gray-200 mb-1" />
            <p className="text-[11px] text-gray-400">No events recorded</p>
          </div>
        )}
        {!loading && events.map((ev) => {
          const Icon = EVENT_ICONS[ev.eventType] ?? Activity;
          const colorCls = EVENT_COLORS[ev.eventType] ?? 'bg-gray-50 text-gray-500';
          return (
            <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                <Icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-800 leading-tight">{ev.description}</p>
                {ev.location && <p className="text-[10px] text-gray-400 mt-0.5">{ev.location}</p>}
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{fmtTime(ev.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChildAttendanceCard({ child, onNavigate }) {
  const [detail, setDetail]     = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const loadDetail = useCallback(async () => {
    if (!child?.id || detail || fetchError) return;
    setLoading(true);
    try {
      const r = await attendanceAPI.getLearnerSummary(child.id);
      // API returns { success, data: { summary, records } }
      // fetchWithAuth returns the parsed body, so r = { success, data: { summary, records } }
      const payload = r?.data || r;
      setDetail(payload);
    } catch (e) {
      setFetchError('Could not load detailed records');
    } finally { setLoading(false); }
  }, [child?.id, detail, fetchError]);

  const toggle = () => {
    setExpanded(prev => {
      if (!prev) loadDetail();
      return !prev;
    });
  };

  const rate      = Math.round(Number(child.attendanceRate || 0));
  const barColor  = rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-600' : 'text-rose-600';
  const photoSrc  = getChildPhoto(child);
  const mood = rate >= 95
    ? { label: 'Excellent rhythm', icon: ShieldCheck, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
    : rate >= 85
      ? { label: 'Healthy attendance', icon: TrendingUp, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
      : { label: 'Needs attention', icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  const MoodIcon = mood.icon;

  // Use detail API data if available, else fall back to dashboard summary
  const summary  = detail?.summary || {};
  const records  = (detail?.records || []).slice(0, 15);
  const hasSummary = detail !== null;

  // Dashboard-level counts (from attendanceSummary on the child object)
  const dashPresent = child.attendanceSummary?.presentDays ?? null;
  const dashAbsent  = child.attendanceSummary?.absentDays  ?? null;
  const dashLate    = child.attendanceSummary?.lateDays ?? null;
  const dashTotal   = child.attendanceSummary?.totalDays
    ?? [dashPresent, dashAbsent, dashLate].reduce((sum, value) => sum + Number(value || 0), 0);
  const presentDays = hasSummary ? summary.present : dashPresent;
  const lateDays    = hasSummary ? summary.late : dashLate;
  const absentDays  = hasSummary ? summary.absent : dashAbsent;
  const totalDays   = hasSummary ? summary.total : dashTotal;

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
      <button onClick={toggle} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={child.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shadow-sm flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            style={{ display: photoSrc ? 'none' : 'flex' }}
            className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-500 text-blue-700 font-black text-lg items-center justify-center flex-shrink-0"
          >
            {child.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-950 truncate">{child.name}</p>
                <p className="text-[11px] font-semibold text-blue-700 truncate">{child.grade}{child.className ? ` · ${child.className}` : ''}</p>
              </div>
              {expanded
                ? <ChevronUp size={16} className="text-blue-500 flex-shrink-0 mt-1" />
                : <ChevronDown size={16} className="text-blue-500 flex-shrink-0 mt-1" />}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${rate}%` }} />
              </div>
              <span className={`text-xs font-black flex-shrink-0 ${textColor}`}>{rate}%</span>
            </div>

            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${mood.bg} ${mood.text} ${mood.border}`}>
              <MoodIcon size={12} />
              <span className="text-[10px] font-bold">{mood.label}</span>
            </div>
        </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-blue-50 bg-gradient-to-b from-blue-50/60 to-white">
          {loading ? (
            <div className="px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 p-3">
                {[
                  { label: 'Days', value: totalDays, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: CalendarDays },
                  { label: 'Present', value: presentDays, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck },
                  { label: 'Late', value: lateDays, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock3 },
                  { label: 'Absent', value: absentDays, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: AlertTriangle },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-2 text-center`}>
                    <s.icon size={13} className={`mx-auto mb-1 ${s.color}`} />
                    <p className={`text-lg font-black ${s.color}`}>
                      {s.value !== null && s.value !== undefined ? s.value : '—'}
                    </p>
                    <p className="text-[9px] font-semibold text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Presence Timeline mini-view */}
              <div className="px-0 pt-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-3">Full Day Journey</p>
                <PresenceTimelineMini learnerId={child.id} />
              </div>

              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('parent-portal-support');
                  }}
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileEdit size={14} className="text-blue-700" />
                    <span className="text-[11px] font-bold text-blue-900">Request absence</span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5">Sick note, travel or leave</p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('parent-portal-messages');
                  }}
                  className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-emerald-700" />
                    <span className="text-[11px] font-bold text-emerald-900">Ask class teacher</span>
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5">Confirm a record quickly</p>
                </button>
              </div>

              {/* Recent records */}
              {fetchError && (
                <p className="text-[10px] text-gray-400 text-center py-2 px-4">{fetchError}</p>
              )}
              {!fetchError && records.length > 0 ? (
                <div className="mx-3 mb-3 max-h-44 overflow-y-auto divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
                  {records.map((r, i) => (
                    <div key={r.id || i} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-gray-600">{fmtDate(r.date)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : !fetchError && (
                <p className="text-[10px] text-gray-400 text-center py-3 px-4">
                  No individual records available
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ParentPortalAttendance = ({ onNavigate }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load');
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const avg = children.length
    ? Math.round(children.reduce((s, c) => s + Number(c.attendanceRate || 0), 0) / children.length)
    : 0;
  const totalPresent = children.reduce((sum, child) => sum + Number(child.attendanceSummary?.presentDays || 0), 0);
  const totalAbsent = children.reduce((sum, child) => sum + Number(child.attendanceSummary?.absentDays || 0), 0);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-3">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3"><p className="text-xs text-rose-700">{error}</p></div>}

        {/* Family average tile */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-4 text-white">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Family Attendance</p>
                <p className="text-xs text-blue-100 mt-1">{children.length} child{children.length !== 1 ? 'ren' : ''} in view</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                <CalendarDays size={19} />
              </div>
            </div>

            {loading ? <Skeleton className="h-10 w-28 bg-white/20 mt-4" /> : (
              <div className="mt-4">
                <p className="text-4xl font-black tracking-tight">{avg}%</p>
                <p className="text-xs text-blue-100 mt-1">
                  {avg >= 95 ? 'Strong routine across the family.' : avg >= 85 ? 'Healthy week with room to improve.' : 'A few attendance gaps need attention.'}
                </p>
              </div>
            )}

            {!loading && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/12 ring-1 ring-white/15 px-3 py-2">
                  <p className="text-[10px] text-blue-100 font-bold uppercase">Present Days</p>
                  <p className="text-lg font-black">{totalPresent || '—'}</p>
                </div>
                <div className="rounded-xl bg-white/12 ring-1 ring-white/15 px-3 py-2">
                  <p className="text-[10px] text-blue-100 font-bold uppercase">Absences</p>
                  <p className="text-lg font-black">{totalAbsent || '—'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Per-child expandable cards */}
        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)
        ) : children.length > 0 ? (
          children.map(child => <ChildAttendanceCard key={child.id} child={child} onNavigate={onNavigate} />)
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentPortalAttendance;
