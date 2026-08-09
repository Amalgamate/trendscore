/**
 * AnalyticsDashboard
 * School-wide attendance analytics — daily trend, weekly chart, at-risk list, late patterns.
 * Page key: 'analytics-dashboard'
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Clock, Users,
  Loader2, RefreshCw, Shield
} from 'lucide-react';
import api from '../../../../services/api';
import { useNotifications } from '../../hooks/useNotifications';

// ── Mini bar sparkline ─────────────────────────────────────────────────────────
const Sparkbar = ({ value, max = 100, color = 'bg-blue-400' }) => (
  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
    <div
      className={`${color} h-1.5 rounded-full transition-all duration-500`}
      style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
    />
  </div>
);

// ── Risk level badge ───────────────────────────────────────────────────────────
const RiskBadge = ({ level }) => {
  const map = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH:     'bg-orange-100 text-orange-700',
    MEDIUM:   'bg-amber-100 text-amber-700',
    LOW:      'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${map[level] ?? map.LOW}`}>
      {level}
    </span>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const AnalyticsDashboard = () => {
  const [overview, setOverview]       = useState(null);
  const [atRisk, setAtRisk]           = useState([]);
  const [latePatterns, setLatePatterns] = useState([]);
  const [violations, setViolations]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [activeTab, setActiveTab]     = useState('overview');
  const [runningEW, setRunningEW]     = useState(false);
  const { showSuccess, showError } = useNotifications();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ar, lp, viol] = await Promise.all([
        api.analytics.getOverview().catch(() => null),
        api.analytics.getAtRisk(28, 50).catch(() => null),
        api.analytics.getLatePatterns(14).catch(() => null),
        api.analytics.getViolations().catch(() => null),
      ]);
      if (ov?.success)   setOverview(ov.data);
      if (ar?.success)   setAtRisk(ar.data ?? []);
      if (lp?.success)   setLatePatterns(lp.data ?? []);
      if (viol?.success) setViolations(viol.data ?? []);
    } catch {
      showError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRunEarlyWarning = async () => {
    setRunningEW(true);
    try {
      const res = await api.analytics.runEarlyWarning();
      if (res?.success) {
        showSuccess(`Early warning check complete — ${res.data?.total ?? 0} new violations detected`);
        fetchAll();
      }
    } catch { showError('Early warning check failed'); }
    finally { setRunningEW(false); }
  };

  const handleResolveViolation = async (id) => {
    try {
      const res = await api.analytics.resolveViolation(id, 'Resolved via dashboard');
      if (res?.success) {
        showSuccess('Violation resolved');
        setViolations(prev => prev.filter(v => v.id !== id));
      }
    } catch { showError('Failed to resolve violation'); }
  };

  const today = overview?.today;
  const trend = overview?.trend ?? [];

  const TABS = [
    ['overview',   'Overview'],
    ['at-risk',    `At-Risk (${atRisk.length})`],
    ['late',       'Late Patterns'],
    ['violations', `Violations (${violations.length})`],
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3 tracking-tight">
            <BarChart3 className="text-indigo-600" size={28} />
            Attendance Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Presence trends, at-risk learners, and early warning violations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunEarlyWarning}
            disabled={runningEW || loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-60 shadow-lg shadow-indigo-600/20"
          >
            {runningEW ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            Run Checks
          </button>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Today's headline */}
      {today && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Attendance Rate', value: `${today.attendanceRate}%`, color: today.attendanceRate >= 80 ? 'text-emerald-600' : 'text-red-500' },
            { label: 'Present Today',   value: today.presentCount },
            { label: 'Absent Today',    value: today.absentCount },
            { label: 'Open Violations', value: overview?.openViolations ?? 0 },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 7-day trend sparkline */}
      {trend.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">7-Day Trend</p>
          <div className="flex items-end gap-1 h-16">
            {trend.slice(-7).map((d) => {
              const h = Math.max(4, Math.round((d.rate / 100) * 64));
              const c = d.rate >= 80 ? 'bg-emerald-400' : d.rate >= 60 ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.rate}%`}>
                  <div className={`w-full rounded-t-sm ${c}`} style={{ height: h }} />
                  <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`pb-3 px-4 text-sm font-medium transition-all ${
              activeTab === id ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      )}

      {/* Overview tab */}
      {!loading && activeTab === 'overview' && overview && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Grade Breakdown — Today</h3>
          </div>
          <div className="p-4 space-y-3">
            {(overview.gradeBreakdown ?? []).map(g => (
              <div key={g.grade} className="flex items-center gap-3">
                <span className="w-20 text-xs font-semibold text-gray-500">{g.grade}</span>
                <Sparkbar value={g.attendanceRate} max={100}
                  color={g.attendanceRate >= 80 ? 'bg-emerald-400' : g.attendanceRate >= 60 ? 'bg-amber-400' : 'bg-red-400'} />
                <span className="w-10 text-xs font-bold text-right text-gray-700">{g.attendanceRate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-risk tab */}
      {!loading && activeTab === 'at-risk' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {atRisk.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No at-risk learners detected</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 border-b">
                <tr>
                  <th className="p-4">Learner</th>
                  <th className="p-4">Grade</th>
                  <th className="p-4">Absence Rate</th>
                  <th className="p-4">Risk</th>
                  <th className="p-4">Last Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {atRisk.map(l => (
                  <tr key={l.learnerId} className="hover:bg-gray-50/50">
                    <td className="p-4">
                      <p className="text-sm font-semibold text-gray-900">{l.firstName} {l.lastName}</p>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{l.grade}{l.stream ? ' ' + l.stream : ''}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Sparkbar value={l.absenceRate} color="bg-red-400" />
                        <span className="text-xs font-bold text-red-600 w-8">{l.absenceRate}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{l.absenceCount}/{l.totalDays} days</p>
                    </td>
                    <td className="p-4"><RiskBadge level={l.riskLevel} /></td>
                    <td className="p-4 text-xs text-gray-400">{l.lastAbsenceDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Late patterns tab */}
      {!loading && activeTab === 'late' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {latePatterns.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No late-arrival patterns detected</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 border-b">
                <tr>
                  <th className="p-4">Grade</th>
                  <th className="p-4">Late Arrivals</th>
                  <th className="p-4">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {latePatterns.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="p-4 text-sm font-semibold text-gray-900">
                      {p.grade}{p.stream ? ' ' + p.stream : ''}
                    </td>
                    <td className="p-4">
                      <span className="text-lg font-bold text-amber-600">{p.lateCount}</span>
                      <span className="text-xs text-gray-400 ml-1">late arrivals</span>
                    </td>
                    <td className="p-4 text-xs text-gray-400">Last {p.periodDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Violations tab */}
      {!loading && activeTab === 'violations' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {violations.length === 0 ? (
            <div className="p-16 text-center text-gray-400">
              <Shield size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No open violations</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {violations.map(v => (
                <div key={v.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{v.rule?.ruleCode?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(v.detectedAt).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResolveViolation(v.id)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition"
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
