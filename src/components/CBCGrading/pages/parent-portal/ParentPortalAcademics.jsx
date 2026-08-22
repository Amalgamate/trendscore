/**
 * ParentPortalAcademics
 * First-class academic module for parents.
 * Child selector → performance snapshot → subjects → recent assessments → report cards
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, BookOpen, ChevronDown, ChevronRight,
  FileText, Loader2, TrendingUp,
} from 'lucide-react';
import { dashboardAPI, reportAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';
import { Skeleton } from '../../../ui';
import {
  summarizeAnalytics,
  scoreColor,
  termLabel,
  useLearnerResults,
} from '../results/useLearnerResults';
import { ResultsEmptyState, ResultsErrorState } from '../results/ResultsShared';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getChildPhoto = (c) => c?.photoUrl || c?.profilePicture || c?.photo || null;

// ─── ChildSelector ────────────────────────────────────────────────────────────
function ChildSelector({ children, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = children.find(c => c.id === selectedId) || children[0];
  if (!selected) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 text-left shadow-sm w-full sm:w-auto"
      >
        {getChildPhoto(selected) ? (
          <img src={getChildPhoto(selected)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#3B1FA3]/10 text-[#3B1FA3] font-black text-xs flex items-center justify-center flex-shrink-0">
            {(selected.name || '?')[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{selected.name}</p>
          <p className="text-[10px] text-gray-500">{selected.grade} · {selected.className || 'Class'}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && children.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {children.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelect(c.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${c.id === selectedId ? 'bg-[#3B1FA3]/5 text-[#3B1FA3] font-bold' : 'text-gray-700'}`}
            >
              {getChildPhoto(c) ? (
                <img src={getChildPhoto(c)} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#3B1FA3]/10 text-[#3B1FA3] font-black text-xs flex items-center justify-center">
                  {(c.name || '?')[0]}
                </div>
              )}
              <span className="truncate">{c.name}</span>
              <span className="text-[10px] text-gray-400 ml-auto">{c.grade}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PerformanceSnapshot ──────────────────────────────────────────────────────
function PerformanceSnapshot({ childId, year }) {
  const { loading, error, summary } = useLearnerResults(childId, year);

  if (loading) return <Skeleton className="h-24 rounded-2xl" />;
  if (error)   return <ResultsErrorState message={error} />;
  if (!summary.hasData) return null;

  const latest = summary.latest;
  const avg = latest?.avg ?? null;
  const trend = summary.trend;
  const color = avg != null ? scoreColor(avg) : 'text-gray-400';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#3B1FA3] to-indigo-600 p-4 text-white">
      <p className="text-[9px] font-bold uppercase tracking-wider text-white/60 mb-2">Performance snapshot</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[9px] text-white/60 uppercase tracking-wide">Overall</p>
          <p className="text-2xl font-black mt-0.5">{avg != null ? `${avg}%` : '—'}</p>
          <p className="text-[9px] text-white/60">{latest ? termLabel(latest.term) : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/60 uppercase tracking-wide">Trend</p>
          <p className={`text-2xl font-black mt-0.5 ${trend != null ? (trend >= 0 ? 'text-emerald-300' : 'text-rose-300') : ''}`}>
            {trend != null ? `${trend >= 0 ? '+' : ''}${trend}` : '—'}
          </p>
          <p className="text-[9px] text-white/60">vs last term</p>
        </div>
        <div>
          <p className="text-[9px] text-white/60 uppercase tracking-wide">Terms</p>
          <p className="text-2xl font-black mt-0.5">{summary.terms.length}/3</p>
          <p className="text-[9px] text-white/60">recorded</p>
        </div>
      </div>
    </div>
  );
}

// ─── SubjectGrid ──────────────────────────────────────────────────────────────
function SubjectGrid({ childId, year }) {
  const { loading, summary } = useLearnerResults(childId, year);
  const subjects = summary.latest?.subjects || [];

  if (loading) return <Skeleton className="h-32 rounded-2xl" />;
  if (!subjects.length) return null;

  const COLORS = [
    'text-[#3B1FA3]', 'text-emerald-600', 'text-amber-500',
    'text-blue-600', 'text-rose-500', 'text-teal-600',
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-bold text-gray-900 mb-3">Subjects</p>
      <div className="grid grid-cols-2 gap-2">
        {subjects.map((s, i) => {
          const pct = s.percentage != null ? Math.round(Number(s.percentage)) : null;
          return (
            <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-700 truncate mr-2">{s.name || `Subject ${i + 1}`}</p>
              <p className={`text-sm font-black flex-shrink-0 ${pct != null ? scoreColor(pct) : 'text-gray-400'}`}>
                {pct != null ? `${pct}%` : s.grade || '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── NavCard ──────────────────────────────────────────────────────────────────
function NavCard({ icon: Icon, label, sublabel, color, bgColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow w-full"
    >
      <div className={`w-10 h-10 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
      </div>
      <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

// ─── YearSelector ─────────────────────────────────────────────────────────────
function YearSelector({ value, onChange }) {
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700"
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ParentPortalAcademics({ onNavigate }) {
  const [children, setChildren]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [year, setYear]             = useState(String(new Date().getFullYear()));
  const [profileChild, setProfileChild] = useState(null);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getParentMetrics();
      const kids = res?.data?.children || [];
      setChildren(kids);
      if (kids.length) setSelectedId(kids[0].id);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  if (profileChild) {
    return <ParentChildProfile child={profileChild} onBack={() => setProfileChild(null)} initialTab="results" />;
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-24">
      <div className="px-4 py-4 space-y-4">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#3B1FA3]">Academics</p>
          <h1 className="text-xl font-black text-gray-900 mt-0.5">Academic Overview</h1>
          <p className="text-xs text-gray-500 mt-1">Track your children's learning progress.</p>
        </div>

        {/* Child selector + year */}
        {loading ? <Skeleton className="h-12 rounded-xl" /> : (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <ChildSelector children={children} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <YearSelector value={year} onChange={setYear} />
          </div>
        )}

        {/* Performance snapshot */}
        {selectedId && <PerformanceSnapshot childId={selectedId} year={year} />}

        {/* Subjects */}
        {selectedId && <SubjectGrid childId={selectedId} year={year} />}

        {/* Module nav cards */}
        <div className="space-y-2">
          <NavCard
            icon={FileText}
            label="Report Cards"
            sublabel="View & download official report cards"
            color="text-[#3B1FA3]"
            bgColor="bg-[#3B1FA3]/10"
            onClick={() => {
              const child = children.find(c => c.id === selectedId);
              if (child) setProfileChild(child);
            }}
          />
          <NavCard
            icon={BarChart3}
            label="Results & Performance"
            sublabel="All assessments and term results"
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            onClick={() => onNavigate('parent-portal-results')}
          />
          <NavCard
            icon={BookOpen}
            label="Assignments & Homework"
            sublabel="Pending and completed work"
            color="text-amber-600"
            bgColor="bg-amber-50"
            onClick={() => onNavigate('parent-portal-homework')}
          />
          <NavCard
            icon={TrendingUp}
            label="Academic Progress"
            sublabel="Term-by-term trends and growth"
            color="text-blue-600"
            bgColor="bg-blue-50"
            onClick={() => {
              const child = children.find(c => c.id === selectedId);
              if (child) setProfileChild(child);
            }}
          />
        </div>
      </div>
    </div>
  );
}
