/**
 * ParentPortalAttendance — Family Attendance
 * Shows family average + per-child breakdown using real API data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Calendar, CheckCircle2, XCircle,
  Clock, RefreshCw, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { dashboardAPI, attendanceAPI } from '../../../../services/api';
import MobileBottomNav from '../../dashboard/mobile/MobileBottomNav';

const fmt    = (n) => Number(n || 0).toLocaleString();
const fmtPct = (n) => `${Math.round(Number(n || 0))}%`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

const STATUS_COLORS = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT:  'bg-rose-100 text-rose-700',
  LATE:    'bg-amber-100 text-amber-700',
  EXCUSED: 'bg-blue-100 text-blue-700',
};

function ChildAttendanceCard({ child }) {
  const [detail, setDetail]     = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);

  const loadDetail = useCallback(async () => {
    if (!child?.id || detail) return;
    setLoading(true);
    try {
      const r = await attendanceAPI.getLearnerSummary(child.id);
      setDetail(r?.data || r);
    } catch { /* show dashboard data only */ }
    finally { setLoading(false); }
  }, [child?.id, detail]);

  const toggle = () => {
    setExpanded(prev => {
      if (!prev) loadDetail();
      return !prev;
    });
  };

  const rate = Math.round(Number(child.attendanceRate || 0));
  const barColor = rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-600' : 'text-rose-600';

  const summary = detail?.summary || detail || {};
  const records = (detail?.records || detail?.attendance || []).slice().reverse();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={toggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
          {child.name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{child.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${rate}%` }} />
            </div>
            <span className={`text-xs font-bold flex-shrink-0 ${textColor}`}>{fmtPct(rate)}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
                {[
                  { label: 'Present', value: summary.presentDays || 0, color: 'text-emerald-600' },
                  { label: 'Late',    value: summary.lateDays    || 0, color: 'text-amber-600'   },
                  { label: 'Absent',  value: summary.absentDays  || 0, color: 'text-rose-600'    },
                ].map((s) => (
                  <div key={s.label} className="text-center py-2.5 border-r border-gray-100 last:border-0">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Recent records */}
              {records.length > 0 ? (
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {records.slice(0, 10).map((r, i) => (
                    <div key={r.id || i} className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs text-gray-600">{fmtDate(r.date)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">No records available</p>
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
  const avgColor = avg >= 90 ? 'text-emerald-600' : avg >= 75 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => onNavigate('parent-portal-home')} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">Attendance</h1>
            <p className="text-[10px] text-gray-500">Family attendance overview</p>
          </div>
          <button onClick={load} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3"><p className="text-xs text-rose-700">{error}</p></div>}

        {/* Family average tile */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Family Average</p>
          {loading ? <Skeleton className="h-8 w-24" /> : (
            <div className="flex items-end gap-2">
              <p className={`text-3xl font-bold ${avgColor}`}>{avg}%</p>
              <p className="text-xs text-gray-500 pb-1">{children.length} child{children.length !== 1 ? 'ren' : ''}</p>
            </div>
          )}
        </div>

        {/* Per-child expandable cards */}
        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)
        ) : children.length > 0 ? (
          children.map(child => <ChildAttendanceCard key={child.id} child={child} />)
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}
      </div>

      <MobileBottomNav role="PARENT" currentPath="parent-portal-attendance" onNavigate={onNavigate} />
    </div>
  );
};

export default ParentPortalAttendance;
