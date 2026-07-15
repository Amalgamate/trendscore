/**
 * CareerExplorer.jsx — SPEC-005 Student Career Explorer
 * Route: student-career-explorer
 *
 * Tabs: Recommended | Browse | Saved
 * Each career card shows title, family, pathway, fit badge, save action.
 * Tapping a card opens CareerDetail inline.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, BookOpen, Loader2, AlertCircle,
  RefreshCw, Heart, HeartOff, ChevronRight, Compass,
  GraduationCap, Briefcase, ArrowLeft, X,
  GitCompare,
} from 'lucide-react';
import { dashboardAPI, careerAPI } from '../../../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PATHWAY_META = {
  STEM:            { label: 'STEM',             color: '#1d4ed8', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700'    },
  SOCIAL_SCIENCES: { label: 'Social Sciences',  color: '#b45309', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700'   },
  ARTS_SPORTS:     { label: 'Arts & Sports',    color: '#065f46', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};

const BUCKET_META = {
  STRONG_FIT:        { label: 'Strong Fit',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  GOOD_FIT:          { label: 'Good Fit',    cls: 'bg-blue-100 text-blue-700 border-blue-200'          },
  EXPLORE:           { label: 'Explore',     cls: 'bg-violet-100 text-violet-700 border-violet-200'    },
  ASPIRATIONAL:      { label: 'Aspirational',cls: 'bg-amber-100 text-amber-700 border-amber-200'       },
  ALTERNATIVE:       { label: 'Alternative', cls: 'bg-gray-100 text-gray-600 border-gray-200'          },
  INSUFFICIENT_DATA: { label: 'No Data',     cls: 'bg-gray-50 text-gray-400 border-gray-100'           },
};

const ROUTE_TYPE_LABEL = {
  DEGREE: 'Degree', DIPLOMA: 'Diploma', CERTIFICATE: 'Certificate',
  ARTISAN: 'Artisan', TVET: 'TVET', APPRENTICESHIP: 'Apprenticeship', OTHER: 'Other',
};

const Skel = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

// ─── CareerDetail ─────────────────────────────────────────────────────────────

function CareerDetail({ careerId, learnerId, savedIds, onSaveToggle, onBack }) {
  const [career, setCareer]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    setLoading(true);
    careerAPI.getCareer(careerId)
      .then(r => setCareer(r?.data || null))
      .catch(e => setError(e?.message || 'Failed to load career'))
      .finally(() => setLoading(false));
  }, [careerId]);

  const isSaved = savedIds.has(careerId);

  const toggleSave = async () => {
    setSaving(true);
    try {
      if (isSaved) {
        await careerAPI.removeCareer(learnerId, careerId);
      } else {
        await careerAPI.saveCareer(learnerId, careerId);
      }
      onSaveToggle(careerId, !isSaved);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const pathMeta = career?.recommendedPathway ? PATHWAY_META[career.recommendedPathway] : null;

  if (loading) return (
    <div className="p-4 space-y-3">
      <Skel className="h-8 w-56" />
      <Skel className="h-32 w-full" />
      <Skel className="h-20 w-full" />
    </div>
  );
  if (error) return <div className="p-4 text-xs text-rose-600">{error}</div>;
  if (!career) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button type="button" onClick={onBack}
          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 flex-shrink-0 mt-0.5">
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {career.family?.name || 'Career'}
          </p>
          <h2 className="text-lg font-black text-gray-900 leading-tight">{career.title}</h2>
          {pathMeta && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black mt-1 ${pathMeta.bg} ${pathMeta.border} ${pathMeta.text}`}>
              {pathMeta.label}
            </span>
          )}
        </div>
        <button type="button" onClick={toggleSave} disabled={saving}
          className={`flex-shrink-0 rounded-xl border px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-colors ${isSaved ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-500'}`}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : isSaved ? <HeartOff size={12} /> : <Heart size={12} />}
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Overview */}
      {career.shortSummary && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-sm text-gray-700 leading-relaxed">{career.shortSummary}</p>
        </div>
      )}

      {/* Full description */}
      {career.fullDescription && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">About this career</p>
          <p className="text-sm text-gray-700 leading-relaxed">{career.fullDescription}</p>
        </div>
      )}

      {/* Typical activities */}
      {career.typicalActivities?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
            <Briefcase size={10} /> Typical activities
          </p>
          <ul className="space-y-1.5">
            {career.typicalActivities.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-violet-400 mt-0.5">•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key skills */}
      {career.keySkills?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Key skills</p>
          <div className="flex flex-wrap gap-1.5">
            {career.keySkills.map((s, i) => (
              <span key={i} className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{s}</span>
            ))}
          </div>
        </div>
      )}

      {career.futureSkills?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Future skills to build</p>
          <div className="flex flex-wrap gap-1.5">{career.futureSkills.map((skill, index) => <span key={index} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{skill}</span>)}</div>
        </div>
      )}

      {(career.labourMarketNotes || career.salaryRangeNotes) && <div className="grid gap-2 sm:grid-cols-2">
        {career.labourMarketNotes && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Career outlook</p><p className="mt-1 text-[11px] leading-relaxed text-gray-700">{career.labourMarketNotes}</p></div>}
        {career.salaryRangeNotes && <div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Earnings context</p><p className="mt-1 text-[11px] leading-relaxed text-gray-700">{career.salaryRangeNotes}</p></div>}
      </div>}

      {/* Education routes */}
      {career.educationRoutes?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
            <GraduationCap size={10} /> Education routes
          </p>
          <div className="space-y-2">
            {career.educationRoutes.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[9px] font-black text-indigo-700">
                    {ROUTE_TYPE_LABEL[r.routeType] || r.routeType}
                  </span>
                  {r.qualificationTitle && (
                    <span className="text-xs font-bold text-gray-800">{r.qualificationTitle}</span>
                  )}
                </div>
                {r.minSubjectNotes && <p className="text-[11px] text-gray-600">{r.minSubjectNotes}</p>}
                {r.exampleInstitutions?.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    e.g. {r.exampleInstitutions.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternatives */}
      {career.alternativeCareerLinks?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Related careers</p>
          <div className="flex flex-wrap gap-1.5">
            {career.alternativeCareerLinks.map(a => (
              <span key={a.id} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                {a.alternative.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {career.successStory && <div className="rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Inspiration</p><p className="mt-1 text-[11px] leading-relaxed text-gray-700">{career.successStory}</p></div>}
    </div>
  );
}

// ─── CareerCard ───────────────────────────────────────────────────────────────

function CareerCard({ career, match, isSaved, onSelect, onSaveToggle, saving, compareSelected, onCompareToggle }) {
  const pathMeta   = career.recommendedPathway ? PATHWAY_META[career.recommendedPathway] : null;
  const bucketMeta = match ? (BUCKET_META[match.bucket] || BUCKET_META.INSUFFICIENT_DATA) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-200 transition-colors">
      <button type="button" onClick={() => onSelect(career.id)}
        className="w-full text-left px-4 py-3 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-inset">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">{career.title}</p>
            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{career.family?.name || '—'}</p>
          </div>
          <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
        </div>

        {career.shortSummary && (
          <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">{career.shortSummary}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {pathMeta && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${pathMeta.bg} ${pathMeta.border} ${pathMeta.text}`}>
              {pathMeta.label}
            </span>
          )}
          {bucketMeta && (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${bucketMeta.cls}`}>
              {bucketMeta.label}
            </span>
          )}
          {match && (
            <span className="text-[9px] font-bold text-gray-400">{Math.round(match.fitScore)}% fit</span>
          )}
        </div>
      </button>

      <div className="border-t border-gray-50 px-4 py-2 flex justify-between">
        <button type="button" onClick={() => onCompareToggle(career.id)}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black ${compareSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400 hover:text-indigo-600'}`}>
          <GitCompare size={11} /> {compareSelected ? 'Comparing' : 'Compare'}
        </button>
        <button type="button" onClick={() => onSaveToggle(career.id, !isSaved)} disabled={saving}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-[10px] font-black transition-colors ${isSaved ? 'text-rose-500 hover:text-rose-700' : 'text-gray-400 hover:text-rose-500'}`}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Heart size={11} fill={isSaved ? 'currentColor' : 'none'} />}
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CareerExplorer = ({ user, onNavigate }) => {
  const [tab, setTab]                 = useState('recommended'); // recommended | browse | saved
  const [learnerId, setLearnerId]     = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // recommended
  const [matches, setMatches]         = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError]   = useState(null);

  // browse
  const [careers, setCareers]         = useState([]);
  const [loadingCareers, setLoadingCareers] = useState(false);
  const [query, setQuery]             = useState('');
  const [filterPathway, setFilterPathway] = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  // saved
  const [saved, setSaved]             = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // save toggle state
  const [savingId, setSavingId]       = useState(null);
  const savedIds = useMemo(() => new Set(saved.map(s => s.careerId)), [saved]);

  // detail view
  const [detailCareerId, setDetailCareerId] = useState(null);
  const [compareIds, setCompareIds]         = useState([]);
  const [comparison, setComparison]         = useState([]);
  const [comparing, setComparing]           = useState(false);

  const toggleComparison = useCallback((careerId) => {
    setCompareIds((current) => current.includes(careerId)
      ? current.filter((id) => id !== careerId)
      : current.length < 4 ? [...current, careerId] : current);
    setComparison([]);
  }, []);

  const compareCareers = useCallback(async () => {
    if (compareIds.length < 2) return;
    setComparing(true);
    try {
      const response = await careerAPI.compareCareers(compareIds, learnerId);
      setComparison(response?.data || []);
    } finally { setComparing(false); }
  }, [compareIds, learnerId]);

  // ── Bootstrap: resolve learner id ───────────────────────────────────────────
  useEffect(() => {
    dashboardAPI.getStudentMetrics()
      .then(r => {
        const d = r?.data || r;
        const lid = d?.learner?.id || d?.learnerId || d?.profile?.id || null;
        setLearnerId(lid);
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false));
  }, []);

  // ── Load matches when learner is ready ──────────────────────────────────────
  const loadMatches = useCallback(async (recalc = false) => {
    if (!learnerId) return;
    setLoadingMatches(true); setMatchError(null);
    try {
      const res = recalc
        ? await careerAPI.recalculateMatches(learnerId)
        : await careerAPI.getLearnerMatches(learnerId);
      setMatches(Array.isArray(res?.data) ? res.data : []);
    } catch (e) { setMatchError(e?.message || 'Failed to load recommendations'); }
    finally { setLoadingMatches(false); }
  }, [learnerId]);

  useEffect(() => { if (learnerId) loadMatches(); }, [learnerId, loadMatches]);

  // ── Browse ───────────────────────────────────────────────────────────────────
  const loadCareers = useCallback(async (pg = 1) => {
    setLoadingCareers(true);
    try {
      const res = await careerAPI.listCareers({
        ...(query.trim() ? { query: query.trim() } : {}),
        ...(filterPathway ? { pathway: filterPathway } : {}),
        page: pg, limit: 12,
      });
      setCareers(Array.isArray(res?.data) ? res.data : []);
      setTotalPages(res?.pagination?.pages ?? 1);
      setPage(pg);
    } catch { setCareers([]); }
    finally { setLoadingCareers(false); }
  }, [query, filterPathway]);

  useEffect(() => { if (tab === 'browse') loadCareers(1); }, [tab, loadCareers]);

  // ── Saved ────────────────────────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    if (!learnerId) return;
    setLoadingSaved(true);
    try {
      const res = await careerAPI.getSavedCareers(learnerId);
      setSaved(Array.isArray(res?.data) ? res.data : []);
    } catch { setSaved([]); }
    finally { setLoadingSaved(false); }
  }, [learnerId]);

  useEffect(() => { if (tab === 'saved') loadSaved(); }, [tab, loadSaved]);

  // ── Save toggle ───────────────────────────────────────────────────────────────
  const handleSaveToggle = useCallback(async (careerId, shouldSave) => {
    if (!learnerId) return;
    setSavingId(careerId);
    try {
      if (shouldSave) {
        const res = await careerAPI.saveCareer(learnerId, careerId);
        setSaved(prev => [...prev.filter(s => s.careerId !== careerId), res?.data || { careerId }]);
      } else {
        await careerAPI.removeCareer(learnerId, careerId);
        setSaved(prev => prev.filter(s => s.careerId !== careerId));
      }
    } catch { /* silent */ }
    finally { setSavingId(null); }
  }, [learnerId]);

  if (loadingMeta) return (
    <div className="p-6 space-y-3">
      <Skel className="h-8 w-48" />
      <Skel className="h-24 w-full" />
      <Skel className="h-24 w-full" />
    </div>
  );

  if (detailCareerId) return (
    <div className="p-4">
      <CareerDetail
        careerId={detailCareerId}
        learnerId={learnerId}
        savedIds={savedIds}
        onSaveToggle={handleSaveToggle}
        onBack={() => setDetailCareerId(null)}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-[#06285a] px-4 pt-6 pb-10">
        <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
          <Compass size={11} /> Career Explorer
        </p>
        <h1 className="text-white text-2xl font-black">What careers fit me?</h1>
        <p className="text-white/60 text-[11px] mt-1">Based on your pathway recommendation and interests.</p>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        {/* Tab strip */}
        <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[
            { id: 'recommended', label: 'Recommended' },
            { id: 'browse',      label: 'Browse All'   },
            { id: 'saved',       label: `Saved (${savedIds.size})` },
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-[11px] font-black transition-colors ${tab === t.id ? 'bg-[#06285a] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {compareIds.length >= 2 && (
          <button type="button" onClick={compareCareers} disabled={comparing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-black text-indigo-700">
            {comparing ? <Loader2 size={13} className="animate-spin" /> : <GitCompare size={13} />} Compare {compareIds.length} careers
          </button>
        )}

        {comparison.length > 0 && (
          <div className="rounded-xl border border-indigo-200 bg-white p-3 overflow-x-auto">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-black text-gray-900">Career comparison</p><button type="button" onClick={() => { setComparison([]); setCompareIds([]); }} aria-label="Close comparison"><X size={15} /></button></div>
            <table className="min-w-[640px] w-full text-left text-[11px]">
              <thead><tr><th className="p-2 text-gray-400">Field</th>{comparison.map((career) => <th key={career.id} className="p-2 text-gray-900">{career.title}</th>)}</tr></thead>
              <tbody>{[
                ['Family', (career) => career.family?.name || 'Unknown'],
                ['Pathway', (career) => career.recommendedPathway?.replaceAll('_', ' ') || 'Unknown'],
                ['Track', (career) => career.recommendedTrackCode || 'Unknown'],
                ['Key skills', (career) => career.keySkills?.join(', ') || 'Unknown'],
                ['Work environment', (career) => career.workEnvironments?.join(', ') || 'Unknown'],
                ['Education routes', (career) => career.educationRoutes?.map((route) => route.routeType).join(', ') || 'Unknown'],
                ['Learner fit', (career) => career.learnerMatch ? `${Math.round(career.learnerMatch.fitScore)}% · ${career.learnerMatch.bucket}` : 'Not calculated'],
                ['Development areas', (career) => career.learnerMatch?.developmentAreas?.join(', ') || 'None recorded'],
              ].map(([label, value]) => <tr key={label} className="border-t border-gray-100"><th className="p-2 text-gray-500">{label}</th>{comparison.map((career) => <td key={career.id} className="p-2 align-top text-gray-700">{value(career)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}

        {/* ── Recommended tab ── */}
        {tab === 'recommended' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {matches.length} career{matches.length !== 1 ? 's' : ''} matched
              </p>
              <button type="button" onClick={() => loadMatches(true)} disabled={loadingMatches}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold text-gray-600 hover:bg-gray-50">
                <RefreshCw size={11} className={loadingMatches ? 'animate-spin' : ''} /> Recalculate
              </button>
            </div>

            {matchError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2" role="alert">
                <AlertCircle size={13} /> {matchError}
              </div>
            )}

            {loadingMatches ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skel key={i} className="h-28 w-full rounded-xl" />)}</div>
            ) : matches.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Compass size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No career matches yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Click Recalculate once your pathway recommendation is ready.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {matches.map(m => (
                  <CareerCard
                    key={m.careerId}
                    career={m.career}
                    match={m}
                    isSaved={savedIds.has(m.careerId)}
                    onSelect={setDetailCareerId}
                    onSaveToggle={handleSaveToggle}
                    saving={savingId === m.careerId}
                    compareSelected={compareIds.includes(m.careerId)}
                    onCompareToggle={toggleComparison}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Browse tab ── */}
        {tab === 'browse' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadCareers(1)}
                  placeholder="Search careers…"
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <select value={filterPathway} onChange={e => setFilterPathway(e.target.value)}
                className="rounded-xl border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">All Pathways</option>
                {Object.entries(PATHWAY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {loadingCareers ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skel key={i} className="h-28 w-full rounded-xl" />)}</div>
            ) : careers.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <BookOpen size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No careers found</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {careers.map(c => (
                    <CareerCard key={c.id} career={c} match={null}
                      isSaved={savedIds.has(c.id)}
                      onSelect={setDetailCareerId}
                      onSaveToggle={handleSaveToggle}
                      saving={savingId === c.id}
                      compareSelected={compareIds.includes(c.id)}
                      onCompareToggle={toggleComparison} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => loadCareers(page - 1)} disabled={page <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                    <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                    <button type="button" onClick={() => loadCareers(page + 1)} disabled={page >= totalPages}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Saved tab ── */}
        {tab === 'saved' && (
          <div className="space-y-2">
            {loadingSaved ? (
              <div className="space-y-2">{[1,2].map(i => <Skel key={i} className="h-28 w-full rounded-xl" />)}</div>
            ) : saved.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Heart size={24} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No saved careers yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Tap the heart on any career to save it.</p>
              </div>
            ) : saved.map(s => (
              <CareerCard key={s.careerId} career={s.career} match={null}
                isSaved={true}
                onSelect={setDetailCareerId}
                onSaveToggle={handleSaveToggle}
                saving={savingId === s.careerId}
                compareSelected={compareIds.includes(s.careerId)}
                onCompareToggle={toggleComparison} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CareerExplorer;
