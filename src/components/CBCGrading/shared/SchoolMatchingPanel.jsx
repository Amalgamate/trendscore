import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompare, Loader2, MapPin, RefreshCw, School, ShieldCheck, X } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../services/api';

const BUCKET_STYLE = {
  DREAM: 'bg-violet-100 text-violet-700 border-violet-200',
  TARGET: 'bg-blue-100 text-blue-700 border-blue-200',
  SAFE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOCAL: 'bg-amber-100 text-amber-700 border-amber-200',
  ALTERNATIVE: 'bg-gray-100 text-gray-700 border-gray-200',
};

function MatchCard({ match, selected, onToggle, onCorrection }) {
  const school = match.school;
  const breakdown = match.breakdown || {};
  return (
    <article className={`rounded-xl border p-3 ${selected ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-900">{school.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500"><MapPin size={9} /> {school.county}{school.subCounty ? ` · ${school.subCounty}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-indigo-700">{Math.round(match.score)}%</p>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${BUCKET_STYLE[match.bucket] || BUCKET_STYLE.ALTERNATIVE}`}>{match.bucket}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-600">{breakdown.explanation}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-600">{breakdown.confidence || 'UNKNOWN'} confidence</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-600">{school.schoolType?.replaceAll('_', ' ')}</span>
        {school.verified && <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700"><ShieldCheck size={9} /> Verified</span>}
      </div>
      {breakdown.warnings?.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
          <p className="font-black">Check before choosing</p>
          <p>{breakdown.warnings.slice(0, 2).join(' · ')}</p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onToggle} className={`flex-1 rounded-lg border py-1.5 text-[10px] font-black ${selected ? 'border-indigo-300 bg-indigo-100 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
          {selected ? 'Selected to compare' : 'Add to comparison'}
        </button>
        <button type="button" onClick={() => onCorrection(school)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold text-gray-500 hover:text-indigo-700">Report data</button>
      </div>
    </article>
  );
}

function Comparison({ rows, onClose }) {
  const fields = [
    ['Fit', (row) => `${Math.round(row.score)}% · ${row.bucket}`],
    ['Location', (row) => `${row.school.county}${row.school.subCounty ? `, ${row.school.subCounty}` : ''}`],
    ['Accommodation', (row) => row.school.schoolType?.replaceAll('_', ' ')],
    ['Gender', (row) => row.school.gender],
    ['Affordability', (row) => row.school.affordabilityBand || 'Unknown'],
    ['Pathways', (row) => row.school.pathwayCodes?.join(', ') || 'Unknown'],
    ['Combinations', (row) => row.school.combinationCodes?.join(', ') || 'Unknown'],
    ['Support', (row) => row.school.specialNeedsSupport?.join(', ') || 'Unknown'],
    ['Verification', (row) => row.school.verificationStatus || 'Unknown'],
  ];
  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-gray-900">School comparison</p><button type="button" onClick={onClose} aria-label="Close comparison"><X size={16} /></button></div>
      <div className="overflow-x-auto">
        <table className="min-w-[620px] w-full text-left text-[11px]">
          <thead><tr><th className="p-2 text-gray-400">Field</th>{rows.map((row) => <th key={row.schoolId} className="p-2 text-gray-900">{row.school.name}</th>)}</tr></thead>
          <tbody>{fields.map(([label, value]) => <tr key={label} className="border-t border-gray-100"><th className="p-2 text-gray-500">{label}</th>{rows.map((row) => <td key={row.schoolId} className="p-2 text-gray-700">{value(row)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function SchoolMatchingPanel({ learnerId, title = 'Your senior school matches' }) {
  const [matches, setMatches] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');
  const [correctionSchool, setCorrectionSchool] = useState(null);
  const [correction, setCorrection] = useState({ field: 'schoolType', suggestedValue: '', evidence: '', reason: '' });
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true); setError('');
    try {
      const response = await pathwayPlannerAPI.getSchoolMatches(learnerId);
      setMatches(response?.data || []);
    } catch (err) { setError(err?.message || 'School matches are unavailable'); }
    finally { setLoading(false); }
  }, [learnerId]);
  useEffect(() => { load(); }, [load]);

  const recalculate = async () => {
    setRecalculating(true); setError('');
    try {
      const response = await pathwayPlannerAPI.recalculateSchoolMatches(learnerId);
      setMatches(response?.data?.matches || []);
      setExcluded(response?.data?.excluded || []);
      setSelected([]); setComparison([]);
    } catch (err) { setError(err?.message || 'Could not calculate school matches'); }
    finally { setRecalculating(false); }
  };
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  const compare = async () => {
    try { const response = await pathwayPlannerAPI.compareSchoolMatches(learnerId, selected); setComparison(response?.data || []); }
    catch (err) { setError(err?.message || 'Could not compare schools'); }
  };
  const submitCorrection = async (event) => {
    event.preventDefault(); setSending(true);
    try {
      await pathwayPlannerAPI.submitSchoolCorrection(correctionSchool.id, correction);
      setCorrectionSchool(null); setCorrection({ field: 'schoolType', suggestedValue: '', evidence: '', reason: '' });
    } catch (err) { setError(err?.message || 'Could not submit the correction'); }
    finally { setSending(false); }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="flex items-center gap-2 text-sm font-black text-gray-900"><School size={16} className="text-indigo-600" /> {title}</p><p className="mt-0.5 text-[10px] text-gray-500">Eligibility is checked before fit scoring. Scores guide planning and do not predict admission.</p></div>
        <button type="button" onClick={recalculate} disabled={recalculating} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60"><RefreshCw size={11} className={recalculating ? 'animate-spin' : ''} /> {matches.length ? 'Refresh' : 'Find matches'}</button>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</div>}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" /></div> : matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center"><School size={22} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-bold text-gray-600">No calculated matches yet</p><p className="text-[10px] text-gray-400">Choose a pathway and family preferences, then find matches.</p></div>
      ) : <div className="grid gap-2 md:grid-cols-2">{matches.map((match) => <MatchCard key={match.schoolId} match={match} selected={selectedSet.has(match.schoolId)} onToggle={() => toggle(match.schoolId)} onCorrection={setCorrectionSchool} />)}</div>}
      {excluded.length > 0 && <details className="rounded-xl border border-amber-200 bg-amber-50 p-3"><summary className="cursor-pointer text-[11px] font-black text-amber-800">{excluded.length} ineligible school{excluded.length === 1 ? '' : 's'} filtered out</summary><ul className="mt-2 space-y-1 text-[10px] text-amber-800">{excluded.slice(0, 12).map((item) => <li key={item.schoolId}>• {item.school.name}: {item.breakdown.exclusions.join('; ')}</li>)}</ul></details>}
      {selected.length >= 2 && <button type="button" onClick={compare} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-black text-indigo-700"><GitCompare size={13} /> Compare {selected.length} schools</button>}
      {comparison.length > 0 && <Comparison rows={comparison} onClose={() => setComparison([])} />}
      {correctionSchool && <form onSubmit={submitCorrection} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"><div className="flex justify-between"><p className="text-xs font-black">Report incorrect data for {correctionSchool.name}</p><button type="button" onClick={() => setCorrectionSchool(null)}><X size={14} /></button></div><div className="grid gap-2 sm:grid-cols-2"><select value={correction.field} onChange={(e) => setCorrection((v) => ({ ...v, field: e.target.value }))} className="rounded-lg border border-gray-200 p-2 text-xs"><option value="schoolType">Accommodation</option><option value="county">County</option><option value="pathwayCodes">Pathways</option><option value="combinationCodes">Combinations</option><option value="phone">Phone</option><option value="website">Website</option></select><input required value={correction.suggestedValue} onChange={(e) => setCorrection((v) => ({ ...v, suggestedValue: e.target.value }))} placeholder="Correct value" className="rounded-lg border border-gray-200 p-2 text-xs" /></div><textarea required value={correction.evidence} onChange={(e) => setCorrection((v) => ({ ...v, evidence: e.target.value }))} placeholder="Evidence or source link/reference" className="w-full rounded-lg border border-gray-200 p-2 text-xs" /><textarea value={correction.reason} onChange={(e) => setCorrection((v) => ({ ...v, reason: e.target.value }))} placeholder="Why should this be corrected?" className="w-full rounded-lg border border-gray-200 p-2 text-xs" /><button disabled={sending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white">{sending ? 'Submitting…' : 'Submit for verification'}</button></form>}
    </section>
  );
}
