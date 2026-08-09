/**
 * ParentPortalSchools — Phase 4
 *
 * School matching + shortlist for parents (and students via parent portal).
 * Route: parent-portal-schools
 *
 * Left panel  — Search/filter the national SeniorSchool catalogue
 * Right panel — Ranked shortlist per child (saved to LearnerSchoolPreference)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Star, MapPin, Users, BookOpen,
  ChevronDown, Trash2, Plus, Loader2, School,
} from 'lucide-react';
import { dashboardAPI, pathwayPlannerAPI } from '../../../../services/api';
import { Skeleton } from '../../../ui';
import SchoolMatchingPanel from '../../shared/SchoolMatchingPanel';
import FamilySchoolPreferences from '../../shared/FamilySchoolPreferences';

const COUNTIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Nyeri','Meru',
  'Kakamega','Kisii','Machakos','Kilifi','Garissa','Embu','Kitui','Bungoma',
];
const SCHOOL_TYPES  = ['DAY','BOARDING','DAY_AND_BOARDING'];
const GENDER_OPTS   = ['MIXED','BOYS','GIRLS'];
const PATHWAY_OPTS  = [
  { code: 'STEM',            label: 'STEM' },
  { code: 'SOCIAL_SCIENCES', label: 'Social Sciences' },
  { code: 'ARTS_SPORTS',     label: 'Arts & Sports Science' },
];
const CATEGORY_CLS = {
  NATIONAL:     'bg-violet-100 text-violet-700 border-violet-200',
  EXTRA_COUNTY: 'bg-blue-100 text-blue-700 border-blue-200',
  COUNTY:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  SUB_COUNTY:   'bg-gray-100 text-gray-600 border-gray-200',
};

const CLASSIFICATION_CLS = {
  C1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  C2: 'bg-blue-100 text-blue-700 border-blue-200',
  C3: 'bg-amber-100 text-amber-700 border-amber-200',
  C4: 'bg-rose-100 text-rose-600 border-rose-200',
};

// ─── SchoolCard ───────────────────────────────────────────────────────────────
function SchoolCard({ school, onAdd, inShortlist }) {
  const catCls = CATEGORY_CLS[school.category] || CATEGORY_CLS.SUB_COUNTY;
  const clsCls = CLASSIFICATION_CLS[school.classification] || '';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{school.name}</p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin size={9} aria-hidden="true" />{school.county}{school.subCounty ? ` · ${school.subCounty}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {school.category && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${catCls}`}>
              {school.category.replace('_',' ')}
            </span>
          )}
          {school.classification && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${clsCls}`}
              title="GoK school readiness band: C1 = all pathways, C2 = 2 pathways, C3 = 1 pathway, C4 = not yet ready">
              {school.classification}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
          {school.schoolType?.replace('_',' ')}
        </span>
        <span className="rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
          {school.gender}
        </span>
        {(school.pathwayCodes || []).map(p => (
          <span key={p} className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
            {p.replace('_',' ')}
          </span>
        ))}
      </div>
      {school.minimumKcpeGrade != null && (
        <p className="text-[10px] text-gray-500">Min KCPE: <span className="font-bold">{school.minimumKcpeGrade}</span></p>
      )}
      <button type="button" onClick={() => onAdd(school)}
        disabled={inShortlist}
        className={`w-full rounded-lg py-1.5 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${inShortlist ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
        {inShortlist ? <><Star size={11} /> In Shortlist</> : <><Plus size={11} /> Add to Shortlist</>}
      </button>
    </div>
  );
}

// ─── ChildShortlistPanel ──────────────────────────────────────────────────────
function ChildShortlistPanel({ child, pendingAdds, onRemovePending, onSave, saving, refreshKey }) {
  const [saved, setSaved]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    pathwayPlannerAPI.getSchoolPreferences(child.id)
      .then(r => setSaved(r?.data || []))
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  }, [child.id, refreshKey]); // re-fetch whenever parent signals a save completed

  const removeSaved = async (prefId) => {
    // Optimistic removal — reload after
    setSaved(prev => prev.filter(p => p.id !== prefId));
    try {
      const remaining = saved.filter(p => p.id !== prefId);
      const prefs = remaining.map((p, i) => ({ schoolId: p.school?.id || p.schoolId, rank: i + 1 }));
      await pathwayPlannerAPI.saveSchoolPreferences(child.id, prefs);
    } catch {
      // Re-fetch to restore accurate state if the delete failed
      pathwayPlannerAPI.getSchoolPreferences(child.id)
        .then(r => setSaved(r?.data || []))
        .catch(() => {});
    }
  };

  const allItems = [
    ...saved.map(p => ({ ...p.school, rank: p.rank, source: p.source, prefId: p.id, saved: true })),
    ...pendingAdds.filter(s => !saved.some(p => p.school?.id === s.id))
      .map((s, i) => ({ ...s, rank: saved.length + i + 1, saved: false })),
  ].sort((a, b) => a.rank - b.rank);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-gray-900">{child.name?.split(' ')[0]}'s Shortlist</p>
          <p className="text-[10px] text-gray-500">{allItems.length} school{allItems.length !== 1 ? 's' : ''}</p>
        </div>
        {pendingAdds.length > 0 && (
          <button type="button" onClick={() => onSave(child.id, allItems)}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <Loader2 size={11} className="animate-spin" /> : null}
            {saving ? 'Saving\u2026' : 'Save Shortlist'}
          </button>
        )}
      </div>
      {loading ? (
        <div className="p-3 space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : allItems.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <School size={20} className="mx-auto mb-1.5 text-gray-300" aria-hidden="true" />
          <p className="text-xs text-gray-500">No schools added yet</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Search and add schools from the panel above</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {allItems.map((s, i) => (
            <div key={s.id || s.prefId} className={`flex items-center gap-3 px-4 py-2.5 ${!s.saved ? 'bg-indigo-50/40' : ''}`}>
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                <p className="text-[10px] text-gray-500">{s.county} · {s.schoolType?.replace('_',' ')}</p>
              </div>
              {s.saved ? (
                <button type="button" onClick={() => removeSaved(s.prefId)}
                  className="rounded-lg border border-gray-200 p-1 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                  aria-label={`Remove ${s.name} from shortlist`}>
                  <Trash2 size={11} />
                </button>
              ) : (
                <button type="button" onClick={() => onRemovePending(s.id)}
                  className="rounded-lg border border-gray-200 p-1 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                  aria-label={`Remove ${s.name}`}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const ParentPortalSchools = ({ onNavigate }) => {
  const [children, setChildren]     = useState([]);
  const [selectedChild, setChild]   = useState(null);
  const [schools, setSchools]       = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [searching, setSearching]   = useState(false);
  const [pending, setPending]       = useState([]); // schools staged for add
  const [saving, setSaving]         = useState(false);
  // Bump this to force ChildShortlistPanel to re-fetch from server
  const [shortlistRefreshKey, setShortlistRefreshKey] = useState(0);
  const [saveError, setSaveError]   = useState(null);

  // Filters — all sent to server
  const [query, setQuery]           = useState('');
  const [county, setCounty]         = useState('');
  const [schoolType, setType]       = useState('');
  const [gender, setGender]         = useState('');
  const [pathway, setPathway]       = useState('');
  const [classification, setClassification] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load children
  useEffect(() => {
    dashboardAPI.getParentMetrics()
      .then(r => {
        const kids = r?.data?.children || [];
        setChildren(kids);
        if (kids.length) setChild(kids[0]);
      })
      .catch(() => {});
  }, []);

  const search = useCallback(async (pg = 1) => {
    setSearching(true);
    try {
      const res = await pathwayPlannerAPI.searchSeniorSchools({
        // name query goes to the server so it searches the full catalogue
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(county ? { county } : {}),
        ...(schoolType ? { schoolType } : {}),
        ...(gender ? { gender } : {}),
        ...(pathway ? { pathway } : {}),
        ...(classification ? { classification } : {}),
        page: pg, limit: 12,
      });
      setSchools(Array.isArray(res?.data) ? res.data : []);
      setTotalPages(res?.pagination?.pages || 1);
      setPage(pg);
    } catch { setSchools([]); }
    finally { setSearching(false); }
  }, [query, county, schoolType, gender, pathway]);

  // Initial load
  useEffect(() => { search(1); }, []); // eslint-disable-line

  // Trigger server search when query text changes (debounced via blur/enter is fine
  // for mobile; if instant search is preferred, add a useEffect with debounce here)

  const addToPending = (school) => {
    setPending(prev => prev.some(s => s.id === school.id) ? prev : [...prev, school]);
  };
  const removePending = (id) => setPending(prev => prev.filter(s => s.id !== id));

  const saveShortlist = async (learnerId, allItems) => {
    setSaving(true); setSaveError(null);
    try {
      const prefs = allItems.map((s, i) => ({ schoolId: s.id, rank: i + 1 }));
      await pathwayPlannerAPI.saveSchoolPreferences(learnerId, prefs);
      setPending([]);
      // Signal ChildShortlistPanel to re-fetch saved list from server
      setShortlistRefreshKey(k => k + 1);
    } catch (e) {
      setSaveError(e?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  const inShortlist = (schoolId) => pending.some(s => s.id === schoolId);

  return (
    <div className="min-h-screen bg-[var(--app-page-bg)] pb-20">
      <div className="pt-1 space-y-4">

        {/* Child selector */}
        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {children.map(c => (
              <button key={c.id} type="button" onClick={() => setChild(c)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${selectedChild?.id === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'}`}>
                {c.name?.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {selectedChild && (
          <>
            <FamilySchoolPreferences learnerId={selectedChild.id} />
            <SchoolMatchingPanel learnerId={selectedChild.id} title={`${selectedChild.name?.split(' ')[0] || 'Learner'}'s personalised matches`} />
          </>
        )}

        {/* Search + filter bar */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search(1)}
                placeholder="Search by school name or county\u2026"
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Search schools" />
            </div>
            <button type="button" onClick={() => search(1)}
              className="rounded-xl border border-indigo-200 bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
              Search
            </button>
            <button type="button" onClick={() => setShowFilters(v => !v)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              Filters <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
              {[
                { label:'County',         value:county,         set:setCounty,         opts:COUNTIES.map(c=>({v:c,l:c}))         },
                { label:'Type',           value:schoolType,     set:setType,           opts:SCHOOL_TYPES.map(t=>({v:t,l:t.replace('_',' ')})) },
                { label:'Gender',         value:gender,         set:setGender,         opts:GENDER_OPTS.map(g=>({v:g,l:g}))      },
                { label:'Pathway',        value:pathway,        set:setPathway,        opts:PATHWAY_OPTS.map(p=>({v:p.code,l:p.label})) },
                { label:'Band (C1–C4)',   value:classification, set:setClassification, opts:['C1','C2','C3','C4'].map(c=>({v:c,l:`${c} — ${{C1:'All 3 pathways',C2:'2 pathways',C3:'1 pathway',C4:'Not yet ready'}[c]}`})) },
              ].map(({ label, value, set, opts }) => (
                <div key={label}>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">{label}</label>
                  <select value={value} onChange={e => set(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">All</option>
                    {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              <div className="col-span-2 flex gap-2 pt-1">
                <button type="button" onClick={() => search(1)}
                  className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700">
                  Apply Filters
                </button>
                <button type="button" onClick={() => { setCounty(''); setType(''); setGender(''); setPathway(''); setClassification(''); setQuery(''); search(1); }}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50">
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* School results */}
        {searching ? (
          <div className="grid grid-cols-1 gap-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : schools.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <School size={24} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">No schools found</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {schools.map(s => (
              <SchoolCard key={s.id} school={s} onAdd={addToPending} inShortlist={inShortlist(s.id)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => search(page - 1)} disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              ← Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => search(page + 1)} disabled={page >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              Next →
            </button>
          </div>
        )}

        {/* Child shortlist */}
        {selectedChild && (
          <ChildShortlistPanel
            child={selectedChild}
            pendingAdds={pending}
            onRemovePending={removePending}
            onSave={saveShortlist}
            saving={saving}
          />
        )}

      </div>
    </div>
  );
};

export default ParentPortalSchools;
