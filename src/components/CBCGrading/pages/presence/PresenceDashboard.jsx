/**
 * PresenceDashboard
 * Admin-facing school presence overview with snapshot, absent list, and at-risk.
 * Page key: 'presence-dashboard'
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Users, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, Search
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = 'blue', icon: Icon }) => {
  const clr = {
    blue:  'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red:   'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-500 border-slate-100',
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${clr}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
        <p className="text-xs font-medium text-gray-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

// ── Grade row ──────────────────────────────────────────────────────────────────
const GradeRow = ({ grade, presentToday, totalLearners, attendanceRate }) => {
  const barW = `${attendanceRate}%`;
  const color = attendanceRate >= 80 ? 'bg-emerald-400' : attendanceRate >= 60 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-20 text-xs font-semibold text-gray-500 truncate">{grade}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: barW }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-12 text-right">{attendanceRate}%</span>
      <span className="text-xs text-gray-400 w-16 text-right">{presentToday}/{totalLearners}</span>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const PresenceDashboard = () => {
  const [snapshot, setSnapshot]         = useState(null);
  const [absentList, setAbsentList]     = useState([]);
  const [gradeBreakdown, setGradeBreakdown] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [absentSearch, setAbsentSearch] = useState('');
  const { showError } = useNotifications();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, absent, grade] = await Promise.all([
        api.presence.getSchoolSnapshot().catch(() => null),
        api.presence.getAbsentToday().catch(() => null),
        api.analytics.getByGrade().catch(() => null),
      ]);
      if (snap?.success)   setSnapshot(snap.data);
      if (absent?.success) setAbsentList(absent.data?.learners ?? []);
      if (grade?.success)  setGradeBreakdown(grade.data ?? []);
    } catch {
      showError('Failed to load presence data');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredAbsent = absentList.filter(l =>
    !absentSearch ||
    `${l.firstName} ${l.lastName}`.toLowerCase().includes(absentSearch.toLowerCase()) ||
    l.admissionNumber?.toLowerCase().includes(absentSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3 tracking-tight">
            <Activity className="text-blue-600" size={28} />
            Presence Overview
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Today's school-wide presence snapshot — updated in real time.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Snapshot cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users}        label="Total Learners"    value={snapshot?.totalLearners}   color="blue" />
        <StatCard icon={CheckCircle2} label="Present Today"     value={snapshot?.presentCount}    color="green"
          sub={snapshot ? `${snapshot.attendanceRate}% attendance rate` : undefined} />
        <StatCard icon={AlertTriangle}label="Absent / Unmarked" value={snapshot ? (snapshot.absentCount + snapshot.unmarkedCount) : undefined} color="red"
          sub={snapshot ? `${snapshot.absentCount} absent · ${snapshot.unmarkedCount} unmarked` : undefined} />
        <StatCard icon={Clock}        label="Staff Present"     value={snapshot?.staffPresent}    color="slate"
          sub={snapshot?.staffAbsent ? `${snapshot.staffAbsent} absent` : undefined} />
      </div>

      {/* Grade breakdown + absent list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Grade breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Attendance by Grade</h2>
          </div>
          <div className="p-4">
            {loading && <div className="h-24 flex items-center justify-center text-gray-400 text-sm animate-pulse">Loading…</div>}
            {!loading && gradeBreakdown.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No grade data available</p>
            )}
            {!loading && gradeBreakdown.map(g => (
              <GradeRow key={g.grade} {...g} />
            ))}
          </div>
        </div>

        {/* Absent / unmarked list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Absent / Unmarked ({absentList.length})
            </h2>
            <div className="relative flex-1 max-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={absentSearch}
                onChange={e => setAbsentSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {loading && <div className="p-6 text-center text-gray-400 text-sm animate-pulse">Loading…</div>}
            {!loading && filteredAbsent.length === 0 && (
              <div className="p-8 text-center">
                {absentList.length === 0
                  ? <><CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={28} /><p className="text-sm font-medium text-gray-600">All learners accounted for</p></>
                  : <p className="text-sm text-gray-400">No results match "{absentSearch}"</p>
                }
              </div>
            )}
            {!loading && filteredAbsent.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50">
                <div className="w-7 h-7 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {l.firstName?.[0]}{l.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {l.firstName} {l.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {l.admissionNumber} · {l.grade}{l.stream ? ' ' + l.stream : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresenceDashboard;
