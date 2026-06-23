/**
 * ParentPortalResults
 * Screen 1: Family view — Academic Overview with term selector, summary stats,
 *           per-child performance rows with real recharts BarChart of subject scores.
 * Screen 2: Child detail — opens ParentChildProfile on child row tap.
 *
 * DATA SOURCE: dashboardAPI.getParentMetrics()
 *   child.subjects = [{name, score, grade, title}]  — real summative results
 *   child.averageScore computed from subjects
 *   No scoreHistory available from backend → no sparkline; bar chart per child instead.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Bell, ChevronDown, ChevronRight,
  Star, AlertCircle as AlertIcon, BarChart2, BookOpen,
  TrendingUp, ClipboardList, FileText, RefreshCw, Users,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { dashboardAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';

const fmtPct = (n) => `${Math.round(Number(n || 0))}%`;

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

function scoreColor(n) {
  const v = Number(n || 0);
  if (v >= 70) return 'text-emerald-600';
  if (v >= 50) return 'text-amber-500';
  return 'text-rose-600';
}

function barFill(score) {
  const n = Number(score || 0);
  if (n >= 70) return '#10b981';
  if (n >= 50) return '#f59e0b';
  return '#ef4444';
}

// ─── Subject Bar Chart (real data) ───────────────────────────────────────────
// Uses child.subjects from dashboard API — real summative results.

function SubjectBarChart({ subjects }) {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-[10px] text-gray-400">No assessment data yet</p>
      </div>
    );
  }

  const data = subjects.slice(0, 6).map(s => ({
    name: (s.name || s.learningArea || '').split(' ')[0].substring(0, 5),
    score: Math.round(Number(s.score || 0)),
  }));

  return (
    <ResponsiveContainer width="100%" height={52}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={8}>
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg shadow">
                {payload[0].payload.name}: {payload[0].value}%
              </div>
            ) : null
          }
        />
        {data.map((d, i) => (
          <Bar key={i} dataKey="score" radius={[3, 3, 0, 0]}>
            <Cell key={`cell-${i}`} fill={barFill(d.score)} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResultsHeader({ onBack, messages = [] }) {
  const unread = messages.filter(m => m.unread || m.isUnread).length;
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 py-3">
        {onBack ? (
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-8" />
        )}
        <h1 className="text-base font-bold text-gray-900">Results</h1>
        <button className="w-8 h-8 flex items-center justify-center relative">
          <Bell size={18} className="text-gray-600" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function TermSelector({ value, onChange }) {
  const terms = ['Current Term', 'Term 1 2025', 'Term 2 2025', 'Term 3 2024'];
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3B1FA3] cursor-pointer"
      >
        {terms.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar({ children, loading }) {
  // Compute family average from real subject scores
  const allScores = children.flatMap(c => (c.subjects || []).map(s => Number(s.score || 0)));
  const avg = allScores.length > 0
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 0;
  const totalAssessments = children.reduce((s, c) => s + (c.subjects || []).length, 0);

  const items = [
    { value: avg > 0 ? `${avg}%` : '—',             label: 'Family Average',  sub: avg >= 70 ? 'Good' : avg >= 50 ? 'Average' : avg > 0 ? 'Needs Work' : 'No data yet', purple: true },
    { value: String(children.length),                label: 'Children',        sub: 'All Active',   purple: false },
    { value: String(totalAssessments),               label: 'Assessments',     sub: 'Completed',    purple: false },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="grid grid-cols-3 gap-2 mt-1">
        {items.map((item, i) => (
          <div key={i}>
            {loading ? <Skeleton className="h-6 w-12 mb-1" /> : (
              <p className={`text-xl font-bold ${item.purple ? 'text-[#3B1FA3]' : 'text-gray-900'}`}>{item.value}</p>
            )}
            <p className="text-[10px] font-semibold text-gray-700">{item.label}</p>
            <p className="text-[10px] text-gray-400">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Child Performance Row ────────────────────────────────────────────────────
// Shows: avatar, name/grade, real subject bar chart, overall average score.

function ChildPerformanceRow({ child, onSelect }) {
  const subjects = child.subjects || [];
  const avg = subjects.length > 0
    ? Math.round(subjects.reduce((s, sub) => s + Number(sub.score || 0), 0) / subjects.length)
    : Math.round(Number(child.averageScore || 0));
  const col = scoreColor(avg);

  return (
    <button
      onClick={() => onSelect(child)}
      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 active:scale-[0.99] transition-all text-left"
    >
      <div className="flex items-center gap-3 mb-2">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#3B1FA3]/10 text-[#3B1FA3] font-bold text-sm flex items-center justify-center flex-shrink-0">
          {child.name?.[0] || '?'}
        </div>
        {/* Name + grade */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{child.name}</p>
          <p className="text-[10px] text-gray-400">{child.grade} · {child.className || 'Class'}</p>
        </div>
        {/* Score */}
        <div className="text-right flex-shrink-0">
          {avg > 0 ? (
            <p className={`text-sm font-bold ${col}`}>{avg}%</p>
          ) : (
            <p className="text-xs text-gray-400">No data</p>
          )}
        </div>
        <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
      </div>

      {/* Subject scores — real bar chart OR empty state */}
      {subjects.length > 0 ? (
        <div className="mt-1">
          <SubjectBarChart subjects={subjects} />
          {/* Subject name labels */}
          <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(subjects.length, 6)}, 1fr)` }}>
            {subjects.slice(0, 6).map((s, i) => (
              <div key={i} className="text-center">
                <p className={`text-[10px] font-bold ${scoreColor(s.score)}`}>{Math.round(Number(s.score || 0))}%</p>
                <p className="text-[9px] text-gray-400 truncate">{(s.name || '').split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-400 text-center">No assessment records yet</p>
        </div>
      )}
    </button>
  );
}

// ─── Top / Needs Support ─────────────────────────────────────────────────────
// Derived entirely from real child.subjects data.

function PerformanceCallouts({ children }) {
  if (!children?.length) return null;

  const withAvg = children.map(c => {
    const subs = c.subjects || [];
    const avg  = subs.length > 0
      ? Math.round(subs.reduce((s, sub) => s + Number(sub.score || 0), 0) / subs.length)
      : null;
    return { ...c, _avg: avg };
  }).filter(c => c._avg !== null);

  if (withAvg.length < 2) return null;

  const sorted    = [...withAvg].sort((a, b) => b._avg - a._avg);
  const top       = sorted[0];
  const needsHelp = sorted[sorted.length - 1];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <Star size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Top Performer</p>
          <p className="text-xs font-semibold text-gray-900 truncate">{top.name?.split(' ')[0]}</p>
          <p className={`text-xs font-bold ${scoreColor(top._avg)}`}>{top._avg}%</p>
        </div>
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
        <AlertIcon size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Needs Support</p>
          <p className="text-xs font-semibold text-gray-900 truncate">{needsHelp.name?.split(' ')[0]}</p>
          <p className={`text-xs font-bold ${scoreColor(needsHelp._avg)}`}>{needsHelp._avg}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
// Uses real subject data: counts children with avg >= 70.

function InsightCard({ children }) {
  if (!children?.length) return null;

  const withAvg = children.map(c => {
    const subs = c.subjects || [];
    return subs.length > 0
      ? Math.round(subs.reduce((s, sub) => s + Number(sub.score || 0), 0) / subs.length)
      : null;
  }).filter(v => v !== null);

  const passing  = withAvg.filter(v => v >= 70).length;
  const total    = withAvg.length;
  const familyAvg = total > 0
    ? Math.round(withAvg.reduce((s, v) => s + v, 0) / total)
    : null;

  const message = total === 0
    ? 'Keep encouraging consistent study habits. Small efforts, big results!'
    : passing === total
    ? `Great job! All ${total} ${total === 1 ? 'child is' : 'children are'} performing above 70%.`
    : passing > 0
    ? `${passing} out of ${total} ${total === 1 ? 'child is' : 'children are'} performing well. Keep supporting the others.`
    : 'Focus on consistent study habits. Every small effort counts!';

  return (
    <div className="bg-[#3B1FA3]/5 border border-[#3B1FA3]/20 rounded-xl p-3 flex items-start gap-2">
      <BarChart2 size={16} className="text-[#3B1FA3] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#3B1FA3] mb-0.5">Insight</p>
        <p className="text-xs text-gray-700">{message}</p>
        {familyAvg !== null && (
          <p className="text-[10px] text-gray-500 mt-1">Family average: <span className={`font-bold ${scoreColor(familyAvg)}`}>{familyAvg}%</span></p>
        )}
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function ResultsQuickActions({ onSelectView }) {
  const actions = [
    { id: 'child',       label: 'By Child',    icon: Users        },
    { id: 'subject',     label: 'By Subject',  icon: BookOpen     },
    { id: 'pathways',    label: 'Pathways',    icon: TrendingUp   },
    { id: 'assessments', label: 'Assessments', icon: ClipboardList },
    { id: 'reports',     label: 'Reports',     icon: FileText     },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-gray-900">Quick Actions</p>
        <button className="text-xs text-[#3B1FA3] font-semibold">View all</button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => onSelectView?.(a.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-3 hover:bg-gray-50 transition-colors min-w-[64px]"
            >
              <div className="w-8 h-8 rounded-lg bg-[#3B1FA3]/10 flex items-center justify-center">
                <Icon size={15} className="text-[#3B1FA3]" />
              </div>
              <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalResults = ({ onNavigate }) => {
  const [metrics, setMetrics]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [term, setTerm]                 = useState('Current Term');
  const [selectedChild, setSelectedChild] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setMetrics(res.data);
      else setError(res?.message || 'Failed to load');
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const children = metrics?.children || [];
  const messages = metrics?.messages || [];

  // ── Child detail view ──
  if (selectedChild) {
    return (
      <ParentChildProfile child={selectedChild} onBack={() => setSelectedChild(null)} initialTab="results" />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-20">
      <ResultsHeader messages={messages} />

      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {/* Title + term selector */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-0.5">Academic Overview (Family)</h2>
          <p className="text-xs text-gray-500 mb-3">Overview of your children's academic performance.</p>
          <TermSelector value={term} onChange={setTerm} />
        </div>

        {/* Summary */}
        <SummaryBar children={children} loading={loading} />

        {/* Performance trend header */}
        {!loading && children.length > 0 && (
          <>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Children Performance</p>
              <div className="space-y-2.5">
                {children.map(child => (
                  <ChildPerformanceRow key={child.id} child={child} onSelect={setSelectedChild} />
                ))}
              </div>
            </div>

            <PerformanceCallouts children={children} />
            <InsightCard children={children} />
            <ResultsQuickActions />
          </>
        )}

        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!loading && children.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No children linked</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ParentPortalResults;
