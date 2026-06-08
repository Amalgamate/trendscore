/**
 * FeeCollectionTrend — Fee Collection by Grade
 * Minimalist table widget. No charts, no gradients, just clean data.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, ArrowUpDown } from 'lucide-react';
import { dashboardAPI } from '../../../../../services/api';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const GRADE_LABELS = {
  PLAYGROUP: 'Play Group', PLAY_GROUP: 'Play Group',
  PP1: 'PP 1', PP2: 'PP 2',
  GRADE_1: 'Grade 1', GRADE_2: 'Grade 2', GRADE_3: 'Grade 3',
  GRADE_4: 'Grade 4', GRADE_5: 'Grade 5', GRADE_6: 'Grade 6',
  GRADE_7: 'Grade 7', GRADE_8: 'Grade 8', GRADE_9: 'Grade 9',
};
const GRADE_ORDER = ['PLAYGROUP','PLAY_GROUP','PP1','PP2',
  'GRADE_1','GRADE_2','GRADE_3','GRADE_4','GRADE_5',
  'GRADE_6','GRADE_7','GRADE_8','GRADE_9'];

const FILTERS    = ['Today', 'This Month', 'This Term'];
const FILTER_API = { Today: 'today', 'This Month': 'month', 'This Term': 'term' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const kes = (v = 0) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
};
const gradeKey  = (raw = '') => raw.replace(/\s+/g, '_').toUpperCase();
const gradeLabel= (raw = '') => GRADE_LABELS[gradeKey(raw)] ?? raw.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();
const gradeIdx  = (raw = '') => { const i = GRADE_ORDER.indexOf(gradeKey(raw)); return i === -1 ? 99 : i; };
const ratePct   = (c, t)     => t > 0 ? Math.min(100, Math.round((Number(c)/Number(t))*100)) : 0;

const rateStyle = (pct) =>
  pct >= 80 ? 'text-emerald-600' :
  pct >= 50 ? 'text-amber-600'   : 'text-rose-600';

function buildRows(filter, breakdown, stats) {
  if (filter === 'Today' || !breakdown?.length) {
    const c = Number(stats?.feeCollected ?? 0);
    const o = Number(stats?.feePending   ?? 0);
    return [{ raw:'', label: filter==='Today' ? 'All Grades' : 'All Grades', c, o, t: c+o, rate: ratePct(c, c+o) }];
  }
  return breakdown
    .map(s => {
      const c = Number(s.collected ?? 0);
      const o = Number(s.bal       ?? 0);
      const t = Number(s.target    ?? 0) || c + o;
      return { raw: s.name, label: gradeLabel(s.name), c, o, t, rate: ratePct(c, t) };
    })
    .filter(r => r.t > 0 || r.c > 0)
    .sort((a, b) => gradeIdx(a.raw) - gradeIdx(b.raw));
}

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    const av = key === 'label' ? gradeIdx(a.raw) : Number(a[key]);
    const bv = key === 'label' ? gradeIdx(b.raw) : Number(b[key]);
    return dir === 'asc' ? av - bv : bv - av;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
const FeeCollectionTrend = ({ loading = false, onNavigate }) => {
  const [filter,  setFilter]  = useState('This Term');
  const [data,    setData]    = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [sortKey, setSortKey] = useState('t');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setBusy(true);
    dashboardAPI.getAdminMetrics(FILTER_API[filter] ?? 'term')
      .then(r => { if (r?.success) setData(r.data); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [filter]);

  const sort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const rows = useMemo(() =>
    sortRows(buildRows(filter, data?.financials?.streamBreakdown, data?.stats), sortKey, sortDir),
    [filter, data, sortKey, sortDir]
  );

  const tot = useMemo(() => rows.reduce((s,r) => ({
    c: s.c + r.c, o: s.o + r.o, t: s.t + r.t
  }), { c:0, o:0, t:0 }), [rows]);

  const isLoading = loading || busy;

  const Th = ({ k, children, right }) => (
    <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => sort(k)} className={`inline-flex items-center gap-1 hover:text-gray-600 transition-colors ${sortKey===k ? 'text-brand-purple' : ''}`}>
        {children}
        <ArrowUpDown size={10} strokeWidth={2.5} />
      </button>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <p className="text-xs font-black uppercase tracking-widest text-gray-700">Fee by Grade</p>
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${f===filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-4 space-y-2 animate-pulse">
          {[...Array(6)].map((_,i) => <div key={i} className="h-8 bg-gray-50 rounded" />)}
        </div>
      ) : rows.length === 0 || rows.every(r => !r.t && !r.c) ? (
        <div className="py-10 text-center text-xs text-gray-400">No fee data for this period.</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50/70">
            <tr>
              <Th k="label">Grade</Th>
              <Th k="t"     right>Expected</Th>
              <Th k="c"     right>Collected</Th>
              <Th k="o"     right>Outstanding</Th>
              <Th k="rate"  right>Rate</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r, i) => (
              <tr key={i}
                className="hover:bg-gray-50 transition-colors cursor-pointer group"
                onClick={() => onNavigate?.('finance-fees')}>
                <td className="px-3 py-2 font-semibold text-gray-800">{r.label}</td>
                <td className="px-3 py-2 text-right text-gray-500">{kes(r.t)}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-600">{kes(r.c)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.o > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{kes(r.o)}</td>
                <td className={`px-3 py-2 text-right font-black ${rateStyle(r.rate)}`}>{r.rate}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100">
              <td className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">Total</td>
              <td className="px-3 py-2 text-right font-semibold text-gray-500">{kes(tot.t)}</td>
              <td className="px-3 py-2 text-right font-black text-emerald-600">{kes(tot.c)}</td>
              <td className="px-3 py-2 text-right font-black text-amber-600">{kes(tot.o)}</td>
              <td className={`px-3 py-2 text-right font-black ${rateStyle(ratePct(tot.c, tot.t))}`}>{ratePct(tot.c, tot.t)}%</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 flex justify-end">
        <button onClick={() => onNavigate?.('finance-fees')}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-brand-purple transition-colors group">
          View Fees <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default FeeCollectionTrend;
