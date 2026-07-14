/**
 * ParentPortalResults
 * Screen 1: Family view — Academic Overview with year selector, summary stats,
 *           per-child performance rows with a real recharts BarChart of subject scores.
 * Screen 2: Child detail — opens ParentChildProfile on child row tap.
 *
 * DATA SOURCES:
 *   dashboardAPI.getParentMetrics()        — list of children (id, name, grade, photo)
 *   useLearnerResults(id, year)            — real cross-term, cross-subject results for
 *     one child (Batch 1 endpoint; server enforces parent-own-children-only access).
 *
 * Grading vocabulary (canonical — see results/useLearnerResults glossary):
 *   cbcGrade   — PRIMARY grade badge (EE/ME/AE/BE)
 *   percentage — supporting numeric detail
 *   grade      — legacy 8-4-4 label; never computed or displayed here
 *
 * Empty state shown honestly when no results exist for the selected year.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp,
  Star, AlertCircle as AlertIcon, BarChart2, FileText,
  Users, MessageSquare,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { dashboardAPI, reportAPI } from '../../../../services/api';
import ParentChildProfile from '../parent/ParentChildProfile';
import { Skeleton } from '../../../ui';
import {
  summarizeAnalytics,
  scoreColor,
  barFill,
  termLabel,
} from '../results/useLearnerResults';
import {
  ResultsLoadingState,
  ResultsErrorState,
  ResultsEmptyState,
  TermAccordion,
  YearSelector,
} from '../results/ResultsShared';

const getChildPhoto = (child) => child?.photoUrl || child?.profilePicture || child?.photo || child?.imageUrl || null;

function SubjectBarChart({ subjects }) {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <p className="text-[10px] text-gray-400">No assessment data yet</p>
      </div>
    );
  }

  const data = subjects.slice(0, 6).map(s => ({
    name: (s.name || '').split(' ')[0].substring(0, 5),
    score: Math.round(Number(s.percentage || 0)),
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

// ─── Header ──────────────────────────────────────────────────────────────────
// YearSelector is imported from results/ResultsShared

// ─── Child Performance Row ────────────────────────────────────────────────────

function ChildPerformanceRow({ child, entry, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const photoSrc = getChildPhoto(child);

  const loading = entry?.loading;
  const loadError = entry?.error;
  const summary = entry?.data ? summarizeAnalytics(entry.data) : { hasData: false, terms: [] };

  const avg = summary.latest?.avg ?? null;
  const col = avg !== null ? scoreColor(avg) : 'text-gray-400';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-[1px] active:scale-[0.99] transition-all text-left">
      <div className="rounded-2xl bg-white p-4">
        <button type="button" onClick={() => setExpanded(value => !value)} className="w-full flex items-start gap-3 text-left">
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
            {child.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-950 truncate">{child.name}</p>
                <p className="text-[10px] font-semibold text-blue-700">
                  {child.grade}{summary.latest ? ` · ${termLabel(summary.latest.term)}` : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {loading ? (
                  <Skeleton className="h-5 w-10 rounded" />
                ) : avg !== null ? (
                  <>
                    <p className={`text-xl font-black ${col}`}>{avg}%</p>
                    <p className="text-[9px] text-gray-400">latest term avg</p>
                  </>
                ) : (
                  <p className="text-[10px] font-semibold text-gray-400">No results yet</p>
                )}
              </div>
              {expanded
                ? <ChevronUp size={15} className="text-blue-500 flex-shrink-0 mt-1" />
                : <ChevronDown size={15} className="text-blue-500 flex-shrink-0 mt-1" />}
            </div>

            {!loading && summary.hasData && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-blue-500">This Term</p>
                  <p className="text-xs font-black text-blue-800">{termLabel(summary.latest.term)}</p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-indigo-500">Vs Previous Term</p>
                  {summary.trend !== null ? (
                    <p className={`text-xs font-black ${summary.trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {summary.trend >= 0 ? '+' : ''}{summary.trend} pts
                    </p>
                  ) : (
                    <p className="text-xs font-black text-gray-400">First term on record</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            )}

            {!loading && loadError && (
              <ResultsErrorState message={`Couldn't load results: ${loadError}`} />
            )}

            {!loading && !loadError && !summary.hasData && (
              <ResultsEmptyState />
            )}

            {!loading && summary.hasData && (
              <>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
                  <SubjectBarChart subjects={summary.latest.subjects} />
                  <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(summary.latest.subjects.length, 6)}, 1fr)` }}>
                    {summary.latest.subjects.slice(0, 6).map((s, i) => (
                      <div key={i} className="text-center">
                        <p className={`text-[10px] font-bold ${scoreColor(s.percentage)}`}>{s.percentage}%</p>
                        <p className="text-[9px] text-gray-400 truncate">{(s.name || '').split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-term accordions — shared component */}
                {[...summary.terms].reverse().map((term, i) => (
                  <div key={term.term}>
                    <TermAccordion term={term} defaultOpen={i === 0} highlight={i === 0} />
                    {i === 0 && (
                      <div className="px-1 pt-1">
                        <button
                          type="button"
                          onClick={() => onSelect(child)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700"
                        >
                          <FileText size={11} />
                          View full report
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top / Needs Support ─────────────────────────────────────────────────────
// Compares the parent's own children against each other using real latest-term
// averages only. Does not compare against any other family's data.

function PerformanceCallouts({ children, analytics }) {
  if (!children?.length) return null;

  const withAvg = children
    .map(c => {
      const summary = analytics[c.id]?.data ? summarizeAnalytics(analytics[c.id].data) : { hasData: false };
      return { ...c, _avg: summary.hasData ? summary.latest.avg : null };
    })
    .filter(c => c._avg !== null);

  if (withAvg.length < 2) return null;

  const sorted    = [...withAvg].sort((a, b) => b._avg - a._avg);
  const top       = sorted[0];
  const needsHelp = sorted[sorted.length - 1];

  if (top._avg === needsHelp._avg) return null;

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
// Uses only real, currently-loaded data. No placeholder/demo copy.

function InsightCard({ children, analytics }) {
  if (!children?.length) return null;

  const withAvg = children
    .map(c => {
      const summary = analytics[c.id]?.data ? summarizeAnalytics(analytics[c.id].data) : { hasData: false };
      return summary.hasData ? summary.latest.avg : null;
    })
    .filter(v => v !== null);

  const total = withAvg.length;
  if (total === 0) return null; // nothing real to say yet — say nothing rather than invent encouragement copy tied to fake numbers

  const passing = withAvg.filter(v => v >= 70).length;
  const familyAvg = Math.round(withAvg.reduce((s, v) => s + v, 0) / total);

  const message = passing === total
    ? `Great job! All ${total} ${total === 1 ? 'child is' : 'children are'} performing above 70% this term.`
    : passing > 0
    ? `${passing} out of ${total} ${total === 1 ? 'child is' : 'children are'} performing above 70% this term.`
    : 'Consistent study habits make a real difference — every small effort counts.';

  return (
    <div className="bg-[#3B1FA3]/5 border border-[#3B1FA3]/20 rounded-xl p-3 flex items-start gap-2">
      <BarChart2 size={16} className="text-[#3B1FA3] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#3B1FA3] mb-0.5">Insight</p>
        <p className="text-xs text-gray-700">{message}</p>
        <p className="text-[10px] text-gray-500 mt-1">Family average (latest term): <span className={`font-bold ${scoreColor(familyAvg)}`}>{familyAvg}%</span></p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ParentPortalResults = ({ onNavigate }) => {
  const [children, setChildren]           = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [error, setError]                 = useState(null);
  const [year, setYear]                   = useState(String(new Date().getFullYear()));
  const [selectedChild, setSelectedChild] = useState(null);
  const [analytics, setAnalytics]         = useState({}); // { [childId]: { loading, error, data } }

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true); setError(null);
    try {
      const res = await dashboardAPI.getParentMetrics();
      if (res?.success) setChildren(res.data?.children || []);
      else setError(res?.message || 'Failed to load');
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoadingChildren(false); }
  }, []);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  // Fetch each child's real results whenever the child list or selected year changes.
  useEffect(() => {
    if (children.length === 0) return;
    let cancelled = false;

    setAnalytics(prev => {
      const next = { ...prev };
      children.forEach(c => { next[c.id] = { ...(next[c.id] || {}), loading: true, error: null }; });
      return next;
    });

    children.forEach(async (c) => {
      try {
        const res = await reportAPI.getLearnerAnalytics(c.id, { academicYear: year });
        if (cancelled) return;
        setAnalytics(prev => ({ ...prev, [c.id]: { loading: false, error: null, data: res?.data || null } }));
      } catch (e) {
        if (cancelled) return;
        setAnalytics(prev => ({ ...prev, [c.id]: { loading: false, error: e?.message || 'Failed to load results', data: null } }));
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children.map(c => c.id).join(','), year]);

  // ── Child detail view ──
  if (selectedChild) {
    return (
      <ParentChildProfile child={selectedChild} onBack={() => setSelectedChild(null)} initialTab="results" />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">Academic Year</p>
          <YearSelector value={year} onChange={setYear} />
        </div>

        {!loadingChildren && children.length > 0 && (
          <>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">Children Performance</p>
              <div className="space-y-2.5">
                {children.map(child => (
                  <ChildPerformanceRow
                    key={child.id}
                    child={child}
                    entry={analytics[child.id]}
                    onSelect={setSelectedChild}
                  />
                ))}
              </div>
            </div>

            <PerformanceCallouts children={children} analytics={analytics} />
            <InsightCard children={children} analytics={analytics} />
          </>
        )}

        {loadingChildren && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!loadingChildren && children.length === 0 && (
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
