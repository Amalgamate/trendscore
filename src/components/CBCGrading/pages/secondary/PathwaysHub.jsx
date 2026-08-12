import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  School,
  MapPin,
  X,
  Loader2,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api, { assessmentAPI, seniorPathwayAPI, pathwayPlannerAPI } from '../../../../services/api';
import { configAPI } from '../../../../services/api/config.api';
import EmptyState from '../../shared/EmptyState';
import PathwayAdminConsole from './PathwayAdminConsole';
import { PathwayGuideWelcome } from './PathwayGuide';

const Pill = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${className}`}>
    {children}
  </span>
);

// ─── School catalogue constants ───────────────────────────────────────────────

const SCHOOL_CATEGORIES = ['NATIONAL', 'EXTRA_COUNTY', 'COUNTY', 'SUB_COUNTY'];
const SCHOOL_TYPES      = ['BOARDING', 'DAY', 'DAY_AND_BOARDING'];
const GENDER_OPTS       = ['BOYS', 'GIRLS', 'MIXED'];
const PATHWAY_CODE_OPTS = [
  { code: 'STEM',            label: 'STEM' },
  { code: 'SOCIAL_SCIENCES', label: 'Social Sciences' },
  { code: 'ARTS_SPORTS',     label: 'Arts & Sports Science' },
];
const CATEGORY_CLS = {
  NATIONAL:     'bg-violet-50 border-violet-200 text-violet-700',
  EXTRA_COUNTY: 'bg-blue-50 border-blue-200 text-blue-700',
  COUNTY:       'bg-emerald-50 border-emerald-200 text-emerald-700',
  SUB_COUNTY:   'bg-gray-50 border-gray-200 text-gray-600',
};

const BLANK_SCHOOL = {
  name: '', knecCode: '', county: '', subCounty: '',
  schoolType: 'BOARDING', gender: 'MIXED', category: 'COUNTY',
  pathwayCodes: [], trackCodes: [], combinationCodes: [], minimumKcpeGrade: '', verified: false,
};

// ─── SchoolFormModal ──────────────────────────────────────────────────────────

function SchoolFormModal({ initial, onClose, onSaved }) {
  const [form, setForm]       = useState(initial ? { ...initial, minimumKcpeGrade: initial.minimumKcpeGrade ?? '' } : { ...BLANK_SCHOOL });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const togglePathway = (code) =>
    set('pathwayCodes', form.pathwayCodes.includes(code)
      ? form.pathwayCodes.filter(c => c !== code)
      : [...form.pathwayCodes, code]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.county.trim()) {
      setError('Name and County are required.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        minimumKcpeGrade: form.minimumKcpeGrade !== '' ? Number(form.minimumKcpeGrade) : null,
      };
      if (initial?.id) payload.id = initial.id;
      await pathwayPlannerAPI.upsertSeniorSchool(payload);
      onSaved();
    } catch (e) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Senior School Catalogue</p>
            <h2 className="text-base font-black text-gray-900">{initial ? 'Edit School' : 'Add School'}</h2>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700" role="alert">
              {error}
            </div>
          )}

          {/* Name + KNEC code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">School Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                required placeholder="e.g. Alliance High School"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">KNEC Code</label>
              <input value={form.knecCode} onChange={e => set('knecCode', e.target.value)}
                placeholder="e.g. N001"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* County + Sub-County */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">County *</label>
              <input value={form.county} onChange={e => set('county', e.target.value)}
                required placeholder="e.g. Nairobi"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Sub-County</label>
              <input value={form.subCounty} onChange={e => set('subCounty', e.target.value)}
                placeholder="e.g. Westlands"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* Category + Type + Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Category', key: 'category', opts: SCHOOL_CATEGORIES },
              { label: 'Type',     key: 'schoolType', opts: SCHOOL_TYPES },
              { label: 'Gender',   key: 'gender',     opts: GENDER_OPTS },
            ].map(({ label, key, opts }) => (
              <div key={key}>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</label>
                <select value={form[key]} onChange={e => set(key, e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-2 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {opts.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Min KCPE grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Min KCPE Grade</label>
              <input type="number" min={0} max={500} value={form.minimumKcpeGrade}
                onChange={e => set('minimumKcpeGrade', e.target.value)}
                placeholder="e.g. 400"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.verified}
                  onChange={e => set('verified', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">Verified school</span>
              </label>
            </div>
          </div>

          {/* Pathway codes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Pathways Offered</label>
            <div className="flex flex-wrap gap-2">
              {PATHWAY_CODE_OPTS.map(({ code, label }) => {
                const active = form.pathwayCodes.includes(code);
                return (
                  <button key={code} type="button" onClick={() => togglePathway(code)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-black transition-colors ${active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Track codes</label>
              <input value={(form.trackCodes || []).join(', ')} onChange={e => set('trackCodes', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="e.g. PURE_SCIENCES, APPLIED_SCIENCES" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Subject combination codes</label>
              <input value={(form.combinationCodes || []).join(', ')} onChange={e => set('combinationCodes', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Official combination codes" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : initial ? 'Update School' : 'Add School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── SchoolCatalogue ──────────────────────────────────────────────────────────

function SchoolCatalogue() {
  const [schools, setSchools]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [editing, setEditing]       = useState(null);   // null | BLANK_SCHOOL (add) | school object (edit)
  const [seeding, setSeeding]       = useState(false);
  const [seedMsg, setSeedMsg]       = useState('');

  // Filters
  const [query, setQuery]       = useState('');
  const [county, setCounty]     = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender]     = useState('');
  const [pathway, setPathway]   = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.searchSeniorSchools({
        ...(county   ? { county }   : {}),
        ...(category ? { category } : {}),
        ...(gender   ? { gender }   : {}),
        ...(pathway  ? { pathway }  : {}),
        page: pg, limit: 15,
      });
      setSchools(Array.isArray(res?.data) ? res.data : []);
      setTotal(res?.pagination?.total ?? 0);
      setTotalPages(res?.pagination?.pages ?? 1);
      setPage(pg);
    } catch (e) {
      setError(e?.message || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [county, category, gender, pathway]);

  useEffect(() => { load(1); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return schools;
    const q = query.toLowerCase();
    return schools.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.county || '').toLowerCase().includes(q) ||
      (s.knecCode || '').toLowerCase().includes(q)
    );
  }, [schools, query]);

  const handleSaved = () => {
    setEditing(null);
    load(page);
  };

  const doSeed = async () => {
    setSeedMsg(''); setSeeding(true);
    try {
      await pathwayPlannerAPI.seedSeniorSchools();
      setSeedMsg('Catalogue seeded successfully.');
      load(1);
    } catch (e) {
      setSeedMsg(e?.message || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      {editing && (
        <SchoolFormModal
          initial={editing === 'add' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Senior School Catalogue</p>
            <p className="text-sm font-black text-gray-900">{total} school{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={doSeed} disabled={seeding}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60">
              {seeding ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
              {seeding ? 'Seeding…' : 'Seed Catalogue'}
            </button>            <button type="button" onClick={() => setEditing('add')}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700">
              <Plus size={13} /> Add School
            </button>
            <button type="button" onClick={() => load(page)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {seedMsg && (
          <p className={`text-xs font-semibold ${seedMsg.includes('fail') || seedMsg.includes('Failed') ? 'text-rose-600' : 'text-emerald-600'}`}>
            {seedMsg}
          </p>
        )}

        {/* Search + filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search name, county, code…"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {[
            { label: 'Category', value: category, set: setCategory, opts: SCHOOL_CATEGORIES },
            { label: 'Gender',   value: gender,   set: setGender,   opts: GENDER_OPTS },
            { label: 'Pathway',  value: pathway,  set: setPathway,  opts: PATHWAY_CODE_OPTS.map(p => p.code) },
          ].map(({ label, value, set, opts }) => (
            <select key={label} value={value} onChange={e => set(e.target.value)}
              className="rounded-xl border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">All {label}s</option>
              {opts.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
            </select>
          ))}
          {(county || category || gender || pathway) && (
            <button type="button"
              onClick={() => { setCounty(''); setCategory(''); setGender(''); setPathway(''); }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 flex items-center gap-1">
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700" role="alert">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <School size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No schools found.</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Click "Seed Catalogue" to load the national school data, or add schools manually.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['School', 'County', 'Type / Gender', 'Category', 'Pathways', 'Min KCPE', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(school => (
                    <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-900 leading-tight">{school.name}</p>
                        {school.knecCode && (
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{school.knecCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-700">{school.county}</p>
                        {school.subCounty && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin size={9} />{school.subCounty}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold text-gray-700">{school.schoolType?.replace('_', ' ')}</p>
                        <p className="text-[10px] text-gray-400">{school.gender}</p>
                      </td>
                      <td className="px-4 py-3">
                        {school.category ? (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black ${CATEGORY_CLS[school.category] || CATEGORY_CLS.SUB_COUNTY}`}>
                            {school.category.replace('_', ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(school.pathwayCodes || []).map(p => (
                            <span key={p} className="rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">
                              {p.replace('_', ' ')}
                            </span>
                          ))}
                          {(!school.pathwayCodes?.length) && <span className="text-[10px] text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {school.minimumKcpeGrade ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1"><button type="button" onClick={() => setEditing(school)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors">
                          <Pencil size={11} /> Edit
                        </button><button type="button" onClick={async () => { await pathwayPlannerAPI.verifySeniorSchool(school.id, school.verified ? 'STALE' : 'TREND_SCORE_VERIFIED'); load(page); }} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${school.verified ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-700'}`}>{school.verified ? 'Verified' : 'Verify'}</button></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                <p className="text-[11px] text-gray-500">
                  Page {page} of {totalPages} · {total} total
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => load(page - 1)} disabled={page <= 1}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" onClick={() => load(page + 1)} disabled={page >= totalPages}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const subjectName = (subject) => subject?.officialName || subject?.name || subject?.officialCode || 'Unnamed subject';

const uniqueSubjects = (subjects = []) => {
  const seen = new Set();
  return subjects.filter((subject) => {
    const id = subject?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const PathwaysHub = ({ initialMode = 'overview', adminTab, adminReferenceType, menuAction, menuActionRequest, onNavigate, user }) => {
  const [loading, setLoading] = useState(true);
  const [pathways, setPathways] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(initialMode);
  const [catalog, setCatalog] = useState({ pathways: [], coreSubjects: [], supportSubjects: [] });
  const [offerings, setOfferings] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [savingOfferings, setSavingOfferings] = useState(false);
  const [seedingStarterData, setSeedingStarterData] = useState(false);
  const [starterDataMessage, setStarterDataMessage] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const handledMenuAction = useRef(null);
  const secondaryInstitution = String(user?.institutionType || '').toUpperCase() === 'SECONDARY';

  const loadOfferings = async () => {
    const [catalogResult, offeringsResult] = await Promise.allSettled([
      seniorPathwayAPI.getCatalog(),
      secondaryInstitution ? seniorPathwayAPI.getSchoolOfferings() : Promise.resolve({ data: [] }),
    ]);
    if (catalogResult.status !== 'fulfilled') throw catalogResult.reason;
    const catalogResp = catalogResult.value;
    const offeringsResp = offeringsResult.status === 'fulfilled' ? offeringsResult.value : { data: [] };
    const nextCatalog = catalogResp?.data || catalogResp || {};
    const nextOfferings = Array.isArray(offeringsResp?.data) ? offeringsResp.data : (Array.isArray(offeringsResp) ? offeringsResp : []);
    setCatalog({
      pathways: Array.isArray(nextCatalog.pathways) ? nextCatalog.pathways : [],
      coreSubjects: Array.isArray(nextCatalog.coreSubjects) ? nextCatalog.coreSubjects : [],
      supportSubjects: Array.isArray(nextCatalog.supportSubjects) ? nextCatalog.supportSubjects : [],
    });
    setOfferings(nextOfferings);
    setSelectedSubjectIds(new Set(nextOfferings.map((row) => row?.officialLearningArea?.id).filter(Boolean)));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.pathways.listPathways();
      const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      setPathways(rows);
      if (!selected && rows.length) setSelected(rows.find((p) => p.code !== 'CORE') || rows[0]);
      await loadOfferings();
    } catch (e) {
      setError(e?.message || 'Failed to load pathways');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PageRouter reuses this component between catalogue routes. Keep the view in
  // sync with the route so a dropdown selection always opens its target screen.
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const loadCategories = async () => {
      if (!selected?.code) return;
      try {
        const resp = await api.pathways.getPathwayCategories(selected.code);
        const catRows = resp?.data?.categories || resp?.categories || [];
        setCategories(Array.isArray(catRows) ? catRows : []);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, [selected?.code]);

  const visiblePathways = useMemo(
    () => pathways.filter((p) => p?.code && p.code !== 'CORE'),
    [pathways]
  );

  const catalogSubjects = useMemo(() => {
    const pathwaySubjects = (catalog.pathways || []).flatMap((pathway) =>
      (pathway.tracks || []).flatMap((track) =>
        (track.officialLearningAreas || []).map((subject) => ({
          ...subject,
          pathway: { id: pathway.id, code: pathway.code, name: pathway.name },
          track: { id: track.id, code: track.code, name: track.name },
        }))
      )
    );
    return uniqueSubjects([
      ...(catalog.coreSubjects || []).map((subject) => ({ ...subject, pathway: { code: 'CORE', name: 'Core' } })),
      ...pathwaySubjects,
      ...(catalog.supportSubjects || []).map((subject) => ({ ...subject, pathway: { code: 'SUPPORT', name: 'Support' } })),
    ]).sort((a, b) => subjectName(a).localeCompare(subjectName(b)));
  }, [catalog]);

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return catalogSubjects;
    return catalogSubjects.filter((subject) => {
      const haystack = `${subjectName(subject)} ${subject?.officialCode || ''} ${subject?.pathway?.name || ''} ${subject?.track?.name || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [catalogSubjects, subjectSearch]);

  const pathwayStats = useMemo(() => {
    const stats = new Map();
    for (const pathway of catalog.pathways || []) {
      const ids = uniqueSubjects((pathway.tracks || []).flatMap((track) => track.officialLearningAreas || [])).map((subject) => subject.id);
      const selectedCount = ids.filter((id) => selectedSubjectIds.has(id)).length;
      stats.set(pathway.code, { total: ids.length, selected: selectedCount, ids });
    }
    return stats;
  }, [catalog.pathways, selectedSubjectIds]);

  const offeredPathwayCount = useMemo(
    () => Array.from(pathwayStats.values()).filter((stat) => stat.selected > 0).length,
    [pathwayStats]
  );

  const seedCatalog = async () => {
    setError(null);
    try {
      await configAPI.seedPathways();
      await configAPI.seedLearningAreas();
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to run secondary bootstrap seed');
    }
  };

  const seedStarterData = async () => {
    setSeedingStarterData(true);
    setStarterDataMessage('');
    setError(null);
    try {
      await configAPI.seedPathways();
      await configAPI.seedLearningAreas();
      await configAPI.seedStreams();
      await configAPI.seedClasses();
      await pathwayPlannerAPI.seedSeniorSchools();
      await assessmentAPI.seedTransitionDemoScores();
      await load();
      setStarterDataMessage('Local transition demo is ready: classes, pathways, senior schools, and synthetic baseline scores have been created for eligible existing learners.');
    } catch (e) {
      setError(e?.message || 'Failed to set up starter pathway data');
    } finally {
      setSeedingStarterData(false);
    }
  };

  useEffect(() => {
    if (!menuAction || handledMenuAction.current === menuActionRequest) return;
    handledMenuAction.current = menuActionRequest;
    if (menuAction === 'seed') void seedCatalog();
    if (menuAction === 'refresh') void load();
    // Menu actions intentionally run once for each navigation event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAction, menuActionRequest]);

  const toggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const togglePathway = (pathwayCode) => {
    const stat = pathwayStats.get(pathwayCode);
    if (!stat) return;
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      const shouldSelectAll = stat.selected < stat.total;
      stat.ids.forEach((id) => {
        if (shouldSelectAll) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const saveOfferings = async () => {
    setSavingOfferings(true);
    setError(null);
    try {
      const resp = await seniorPathwayAPI.updateSchoolOfferings(Array.from(selectedSubjectIds));
      const nextOfferings = Array.isArray(resp?.data) ? resp.data : [];
      setOfferings(nextOfferings);
      setSelectedSubjectIds(new Set(nextOfferings.map((row) => row?.officialLearningArea?.id).filter(Boolean)));
      setMode('overview');
    } catch (e) {
      setError(e?.message || 'Failed to save school pathway offerings');
    } finally {
      setSavingOfferings(false);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    <div className="p-6 space-y-4">
      <PathwayGuideWelcome user={user} onNavigate={onNavigate} />
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('pathway-guide')}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <BookOpen size={16} />
            Pathway guide
          </button>
          {mode === 'overview' && ['SUPER_ADMIN', 'ADMIN'].includes(String(user?.role || '').toUpperCase()) && (
            <button
              type="button"
              onClick={seedStarterData}
              disabled={seedingStarterData}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {seedingStarterData ? 'Setting up…' : 'Set up starter data'}
            </button>
          )}
        </div>
      </div>

      {starterDataMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {starterDataMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm font-medium text-gray-600">
          Loading pathways…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : visiblePathways.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Pathways Found"
          message="Click Seed to load pathways and subjects."
        />
      ) : mode === 'admin' ? (
        <PathwayAdminConsole initialTab={adminTab} initialReferenceType={adminReferenceType} onNavigate={onNavigate} user={user} />
      ) : mode === 'schools' ? (
        <SchoolCatalogue />
      ) : mode === 'configure' && !secondaryInstitution ? (
        <EmptyState
          icon={BookOpen}
          title="School Offerings are for Senior Schools"
          message="Junior schools guide learners to a senior school; they do not configure Grade 10–12 subjects or Senior School tests."
        />
      ) : mode === 'configure' && secondaryInstitution ? (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">School pathway setup</div>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">Configure available SS pathways and subjects</h2>
                <p className="mt-1 text-sm font-medium text-gray-600">
                  Select only the Senior School subjects this school actually offers. Pathways become available when at least one subject is selected.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('overview')}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveOfferings}
                  disabled={savingOfferings}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {savingOfferings ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {(catalog.pathways || []).map((pathway) => {
                const stat = pathwayStats.get(pathway.code) || { selected: 0, total: 0 };
                const active = stat.selected > 0;
                return (
                  <button
                    key={pathway.id || pathway.code}
                    type="button"
                    onClick={() => togglePathway(pathway.code)}
                    className={`text-left rounded-2xl border p-4 transition ${active ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">{pathway.name}</div>
                      <Pill className={active ? 'bg-white border-indigo-200 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-600'}>
                        {active ? 'enabled' : 'off'}
                      </Pill>
                    </div>
                    <div className="mt-2 text-xs font-medium text-gray-600">
                      {stat.selected} of {stat.total} subjects selected
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Configure Subjects</div>
                <div className="text-sm font-semibold text-gray-900">{selectedSubjectIds.size} selected</div>
              </div>
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={subjectSearch}
                  onChange={(event) => setSubjectSearch(event.target.value)}
                  placeholder="Search subjects..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
            <div className="divide-y max-h-[520px] overflow-auto">
              {filteredSubjects.map((subject) => {
                const checked = selectedSubjectIds.has(subject.id);
                return (
                  <label key={subject.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubject(subject.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900">{subjectName(subject)}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Pill className="bg-slate-50 text-slate-700 border-slate-200">{subject.officialCode}</Pill>
                        {subject.pathway?.name && (
                          <Pill className="bg-indigo-50 text-indigo-800 border-indigo-200">{subject.pathway.name}</Pill>
                        )}
                        {subject.track?.name && (
                          <Pill className="bg-white text-gray-700 border-gray-200">{subject.track.name}</Pill>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
              {filteredSubjects.length === 0 && (
                <div className="px-4 py-10 text-center text-sm font-medium text-gray-600">
                  No subjects match this search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-indigo-700">School Configuration</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/80 border border-indigo-100 p-3">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-widest">Pathways Offered</div>
                <div className="mt-1 text-2xl font-semibold text-indigo-950">{offeredPathwayCount}</div>
              </div>
              <div className="rounded-xl bg-white/80 border border-indigo-100 p-3">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-widest">Subjects Offered</div>
                <div className="mt-1 text-2xl font-semibold text-indigo-950">{offerings.length}</div>
              </div>
              <div className="rounded-xl bg-white/80 border border-indigo-100 p-3">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-widest">Use In Tests</div>
                <div className="mt-1 text-sm font-semibold text-indigo-950">Only configured subjects appear in SS test setup.</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                <Layers size={16} />
                Pathways
              </div>
              <div className="mt-3 space-y-2">
                {visiblePathways.map((p) => {
                  const active = selected?.code === p.code;
                  const stat = pathwayStats.get(p.code);
                  return (
                    <button
                      key={p.id || p.code}
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`w-full text-left px-3 py-3 rounded-xl border transition ${
                        active
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{p.name || p.code}</div>
                        <Pill className={stat?.selected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'}>
                          {stat?.selected ? `${stat.selected} offered` : 'not set'}
                        </Pill>
                      </div>
                      {p.description && (
                        <div className="mt-1 text-xs font-medium text-gray-600 line-clamp-2">{p.description}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Category constraints</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{selected?.name || selected?.code}</div>
                </div>
                <Pill className="bg-slate-50 text-slate-700 border-slate-200">min/max rules</Pill>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(categories || []).map((c) => (
                  <div key={c.id || c.code} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <Pill className="bg-white border-gray-200 text-gray-700">{c.code}</Pill>
                    </div>
                    <div className="mt-2 text-xs font-medium text-gray-700">
                      Min: <span className="font-semibold">{c.minSelect}</span>
                      {' • '}
                      Max: <span className="font-semibold">{c.maxSelect == null ? '∞' : c.maxSelect}</span>
                    </div>
                    {c.description && <div className="mt-2 text-xs text-gray-600">{c.description}</div>}
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm font-medium text-gray-600">
                    No categories found for this pathway yet.
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">Offered subjects in this pathway</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {catalogSubjects
                    .filter((subject) => subject?.pathway?.code === selected?.code && selectedSubjectIds.has(subject.id))
                    .map((subject) => (
                      <Pill key={subject.id} className="bg-white border-emerald-200 text-emerald-700">
                        {subjectName(subject)}
                      </Pill>
                    ))}
                  {catalogSubjects.filter((subject) => subject?.pathway?.code === selected?.code && selectedSubjectIds.has(subject.id)).length === 0 && (
                    <span className="text-sm font-medium text-gray-600">No subjects configured for this pathway yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathwaysHub;
