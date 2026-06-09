/**
 * FeeCollectionTrend — Fee Collection by Grade
 * Minimalist table widget. No charts, no gradients, just clean data.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, ArrowUpDown, ChevronDown } from 'lucide-react';
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
const JUNIOR_GRADE_KEYS = new Set(GRADE_ORDER);

const TERM_FALLBACK = [
  { term: 'TERM_1', label: 'Term 1', disabled: false, rows: [] },
  { term: 'TERM_2', label: 'Term 2', disabled: false, rows: [] },
  { term: 'TERM_3', label: 'Term 3', disabled: true, rows: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const kes = (v = 0) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
};
const gradeKey  = (raw = '') => raw.replace(/\s+/g, '_').toUpperCase();
const normalizeGradeKey = (raw = '') => {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return '';
  if (value.includes('PLAYGROUP') || value.includes('PLAY GROUP')) return 'PLAYGROUP';
  const pp = value.match(/\bPP\s*([12])\b/);
  if (pp) return `PP${pp[1]}`;
  const grade = value.match(/\bGRADE[_\s-]*(1[0-2]|[1-9])\b/);
  if (grade) return `GRADE_${grade[1]}`;
  return gradeKey(value);
};
const gradeLabel= (raw = '') => GRADE_LABELS[gradeKey(raw)] ?? raw.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim();
const normalizedGradeLabel = (raw = '') => GRADE_LABELS[normalizeGradeKey(raw)] ?? gradeLabel(raw);
const gradeIdx  = (raw = '') => { const i = GRADE_ORDER.indexOf(normalizeGradeKey(raw)); return i === -1 ? 99 : i; };

function buildRows(breakdown) {
  if (!breakdown?.length) return [];
  return breakdown
    .map(s => {
      const rawGrade = s.grade || s.name;
      const grade = normalizeGradeKey(rawGrade);
      const c = Number(s.collected ?? 0);
      const o = Number(s.bal       ?? 0);
      const t = Number(s.target    ?? 0) || c + o;
      return { raw: rawGrade, grade, label: normalizedGradeLabel(rawGrade), c, o, t };
    })
    .filter(r => JUNIOR_GRADE_KEYS.has(r.grade))
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
  const [data,    setData]    = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [sortKey, setSortKey] = useState('t');
  const [sortDir, setSortDir] = useState('desc');
  const [openTerms, setOpenTerms] = useState({ TERM_1: true, TERM_2: true, TERM_3: false });

  useEffect(() => {
    setBusy(true);
    dashboardAPI.getAdminMetrics('term')
      .then(r => { if (r?.success) setData(r.data); })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  const sort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const termSections = useMemo(() => {
    const apiTerms = data?.financials?.termBreakdown;
    if (Array.isArray(apiTerms) && apiTerms.length) return apiTerms;
    return TERM_FALLBACK.map((term, idx) => ({
      ...term,
      rows: idx === 0 ? data?.financials?.streamBreakdown || [] : [],
    }));
  }, [data]);

  const visibleRows = useMemo(() => termSections
    .filter(section => !(section.disabled || section.isFuture))
    .flatMap(section => buildRows(section.rows)), [termSections]);
  const tot = useMemo(() => visibleRows.reduce((s,r) => ({
    c: s.c + r.c, o: s.o + r.o, t: s.t + r.t
  }), { c:0, o:0, t:0 }), [visibleRows]);

  const isLoading = loading || busy;
  const toggleTerm = (term, disabled) => {
    if (disabled) return;
    setOpenTerms(prev => ({ ...prev, [term]: !prev[term] }));
  };

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
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {data?.context?.academicYear || new Date().getFullYear()}
        </p>
      </div>

      {/* Terms */}
      {isLoading ? (
        <div className="p-4 space-y-2 animate-pulse">
          {[...Array(6)].map((_,i) => <div key={i} className="h-8 bg-gray-50 rounded" />)}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {termSections.map((section) => {
            const disabled = Boolean(section.disabled || section.isFuture);
            const rows = sortRows(buildRows(section.rows), sortKey, sortDir);
            const termTotal = rows.reduce((s,r) => ({ c: s.c + r.c, o: s.o + r.o, t: s.t + r.t }), { c:0, o:0, t:0 });
            const isOpen = Boolean(openTerms[section.term]) && !disabled;

            return (
              <div key={section.term} className={disabled ? 'bg-gray-50/80 text-gray-400' : 'bg-white'}>
                <button
                  type="button"
                  onClick={() => toggleTerm(section.term, disabled)}
                  disabled={disabled}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left ${disabled ? 'cursor-not-allowed' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                    <span className="text-[11px] font-black uppercase tracking-widest">{section.label}</span>
                    {section.isActive && <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Current</span>}
                    {disabled && <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Not Started</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right text-[10px] font-bold shrink-0">
                    <span>{kes(termTotal.t)}</span>
                    <span className={disabled ? 'text-gray-400' : 'text-emerald-600'}>{kes(termTotal.c)}</span>
                    <span className={disabled ? 'text-gray-400' : 'text-amber-600'}>{kes(termTotal.o)}</span>
                  </div>
                </button>

                {isOpen && (
                  rows.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50/70">
                        <tr>
                          <Th k="label">Grade</Th>
                          <Th k="t"     right>Expected</Th>
                          <Th k="c"     right>Collected</Th>
                          <Th k="o"     right>Outstanding</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {rows.map((r, i) => (
                          <tr key={`${section.term}-${r.raw}-${i}`}
                            className="hover:bg-gray-50 transition-colors cursor-pointer group"
                            onClick={() => onNavigate?.('finance-fees')}>
                            <td className="px-3 py-2 font-semibold text-gray-800">{r.label}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{kes(r.t)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-600">{kes(r.c)}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${r.o > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{kes(r.o)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-4 pb-4 text-xs text-gray-400">No fee data for this term.</div>
                  )
                )}
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_repeat(3,minmax(80px,auto))] gap-3 px-3 py-2 bg-orange-50/40 border-t-2 border-gray-100 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Total</span>
            <span className="text-right font-semibold text-gray-600">{kes(tot.t)}</span>
            <span className="text-right font-black text-emerald-600">{kes(tot.c)}</span>
            <span className="text-right font-black text-amber-600">{kes(tot.o)}</span>
          </div>
        </div>
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
