import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GitCompare, Loader2, MapPin, RefreshCw, School, ShieldCheck, X, ChevronRight } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../../services/api';

const BUCKET_STYLE = {
  DREAM: 'bg-violet-100 text-violet-700 border-violet-200',
  TARGET: 'bg-blue-100 text-blue-700 border-blue-200',
  SAFE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOCAL: 'bg-amber-100 text-amber-700 border-amber-200',
  ALTERNATIVE: 'bg-gray-100 text-gray-700 border-gray-200',
};

function MatchCard({ match, selected, onToggle, onAddShortlist, isShortlisted }) {
  const school = match.school;
  const breakdown = match.breakdown || {};
  return (
    <article className={`rounded-xl border p-3 ${selected ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-900">{school.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
            <MapPin size={9} /> {school.county}{school.subCounty ? ` · ${school.subCounty}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-indigo-700">{Math.round(match.score)}%</p>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${BUCKET_STYLE[match.bucket] || BUCKET_STYLE.ALTERNATIVE}`}>
            {match.bucket}
          </span>
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
        <button type="button" onClick={() => onAddShortlist(school)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${isShortlisted ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
          {isShortlisted ? '✓ Shortlisted' : '+ Shortlist'}
        </button>
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
    ['Cost context', (row) => row.school.annualCostNotes || 'Ask school'],
    ['Pathways', (row) => row.school.pathwayCodes?.join(', ') || 'Unknown'],
    ['Combinations', (row) => row.school.combinationCodes?.join(', ') || 'Unknown'],
    ['Clubs & activities', (row) => row.school.clubs?.join(', ') || 'Unknown'],
    ['Performance context', (row) => row.school.performanceNotes || 'Not published'],
    ['Transition support', (row) => row.school.transitionNotes || 'Not published'],
    ['Support', (row) => row.school.specialNeedsSupport?.join(', ') || 'Unknown'],
    ['Verification', (row) => row.school.verificationStatus || 'Unknown'],
  ];
  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-black text-gray-900">School comparison</p>
        <button type="button" onClick={onClose} aria-label="Close comparison"><X size={16} /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[620px] w-full text-left text-[11px]">
          <thead>
            <tr>
              <th className="p-2 text-gray-400">Field</th>
              {rows.map((row) => <th key={row.schoolId} className="p-2 text-gray-900">{row.school.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {fields.map(([label, value]) => (
              <tr key={label} className="border-t border-gray-100">
                <th className="p-2 text-gray-500">{label}</th>
                {rows.map((row) => <td key={row.schoolId} className="p-2 text-gray-700">{value(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SchoolsTab({ learnerId, schoolPreferences = [], schoolMatches, onChanged }) {
  const [matches, setMatches] = useState(schoolMatches);
  const [preferences, setPreferences] = useState(schoolPreferences);
  const [excluded, setExcluded] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    setPreferences(schoolPreferences || []);
  }, [schoolPreferences]);

  const load = useCallback(async () => {
    if (!learnerId) return;
    setLoading(true); setError('');
    try {
      const response = await pathwayPlannerAPI.getSchoolMatches(learnerId);
      setMatches(response?.data || []);
    } catch (err) { setError(err?.message || 'School matches are unavailable'); }
    finally { setLoading(false); }
  }, [learnerId]);

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
  const shortlistSet = useMemo(() => new Set(preferences.map((p) => p.schoolId)), [preferences]);

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  const addShortlist = async (school) => {
    if (shortlistSet.has(school.id)) return;
    try {
      const currentPrefs = preferences;
      const newPrefs = [...currentPrefs, { schoolId: school.id, rank: currentPrefs.length + 1, role: 'LEARNER' }];
      const response = await pathwayPlannerAPI.saveSchoolPreferences(learnerId, newPrefs);
      setPreferences(response?.data || newPrefs);
      onChanged?.();
    } catch (err) { setError(err?.message || 'Could not add to shortlist'); }
  };
  const compare = async () => {
    try { const response = await pathwayPlannerAPI.compareSchoolMatches(learnerId, selected); setComparison(response?.data || []); }
    catch (err) { setError(err?.message || 'Could not compare schools'); }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header with shortlist sidebar trigger */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-gray-900">
            <School size={16} className="text-indigo-600" /> Find Senior Schools
          </p>
          <p className="mt-0.5 text-[10px] text-gray-500">Eligibility is checked before fit scoring. Scores guide planning and do not predict admission.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={recalculate} disabled={recalculating || loading} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-60">
            <RefreshCw size={11} className={recalculating ? 'animate-spin' : ''} />
            {matches.length ? 'Refresh' : 'Find matches'}
          </button>
          <button type="button" onClick={() => setShowPreferences(!showPreferences)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-black text-gray-700 flex items-center gap-1.5">
            <ChevronRight size={12} className={showPreferences ? 'rotate-90' : ''} />
            Shortlist ({preferences.length})
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</div>}

      {/* Shortlist Sidebar */}
      {showPreferences && preferences.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 animate-slide-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase text-emerald-700">Your Shortlist</p>
            <button onClick={() => setShowPreferences(false)} className="text-emerald-700 hover:underline text-[10px]">Close</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {preferences.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between rounded-lg bg-white p-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-gray-900">#{pref.rank} {pref.school?.name}</p>
                  <p className="text-[9px] text-gray-500">{pref.school?.county}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <School size={22} className="mx-auto text-gray-300" />
          <p className="mt-2 text-xs font-bold text-gray-600">No calculated matches yet</p>
          <p className="text-[10px] text-gray-400">Choose a pathway and family preferences, then find matches.</p>
          <button onClick={recalculate} className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white">Find Matches</button>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {matches.map((match) => (
            <MatchCard
              key={match.schoolId}
              match={match}
              selected={selectedSet.has(match.schoolId)}
              onToggle={() => toggle(match.schoolId)}
              onAddShortlist={addShortlist}
              isShortlisted={shortlistSet.has(match.schoolId)}
            />
          ))}
        </div>
      )}

      {excluded.length > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer text-[11px] font-black text-amber-800">{excluded.length} ineligible school{excluded.length === 1 ? '' : 's'} filtered out</summary>
          <ul className="mt-2 space-y-1 text-[10px] text-amber-800">
            {excluded.slice(0, 12).map((item) => (
              <li key={item.schoolId}>• {item.school.name}: {item.breakdown.exclusions.join('; ')}</li>
            ))}
          </ul>
        </details>
      )}

      {selected.length >= 2 && (
        <button type="button" onClick={compare} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-black text-indigo-700">
          <GitCompare size={13} /> Compare {selected.length} schools
        </button>
      )}

      {comparison.length > 0 && <Comparison rows={comparison} onClose={() => setComparison([])} />}
    </div>
  );
}
