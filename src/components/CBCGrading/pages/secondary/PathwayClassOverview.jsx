/**
 * PathwayClassOverview — Phase 5
 *
 * School admin bulk view: for every class, how many students are at each
 * pathway journey stage. Quick drill-down to the counsellor workbench.
 *
 * Route: sec-pathway-overview
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, ChevronRight, BarChart2, CheckCircle2, Loader2,
  Search, SlidersHorizontal, ChevronDown, ArrowUpDown,
} from 'lucide-react';
import { classAPI, pathwayPlannerAPI } from '../../../../services/api';
import { PathwayGuideWelcome } from './PathwayGuide';

const STATUS_COLORS = {
  NONE:      '#9ca3af',
  DRAFT:     '#6b7280',
  SUBMITTED: '#3b82f6',
  APPROVED:  '#10b981',
  LOCKED:    '#7c3aed',
};

const PATHWAY_COLORS = {
  STEM:            '#1d4ed8',
  SOCIAL_SCIENCES: '#b45309',
  ARTS_SPORTS:     '#065f46',
};

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold text-gray-600 w-6 text-right">{value}</span>
    </div>
  );
}

const PATHWAY_LABELS = {
  STEM: 'STEM',
  SOCIAL_SCIENCES: 'Social Sciences',
  ARTS_SPORTS: 'Arts & Sports',
};

function LearnerJourney({ row }) {
  if (!row.readiness?.hasRecommendation) return { label: 'Profile learner', tone: 'bg-slate-100 text-slate-600' };
  if (!row.readiness?.hasCareer) return { label: 'Explore careers', tone: 'bg-violet-50 text-violet-700' };
  if (!row.readiness?.hasSchool) return { label: 'Shortlist schools', tone: 'bg-sky-50 text-sky-700' };
  if (!row.readiness?.hasDecision) return { label: 'Complete plan', tone: 'bg-amber-50 text-amber-700' };
  if (row.needsReview) return { label: 'Needs review', tone: 'bg-rose-50 text-rose-700' };
  return { label: 'On track', tone: 'bg-emerald-50 text-emerald-700' };
}

function LearnerTable({ rows, total, distribution, onDrill, cls }) {
  const [query, setQuery] = useState('');
  const [pathway, setPathway] = useState('');
  const [journey, setJourney] = useState('');
  const [sortBy, setSortBy] = useState('attention');
  const [expandedId, setExpandedId] = useState(null);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...rows]
      .filter((row) => !normalized || `${row.firstName} ${row.lastName} ${row.admissionNumber || ''}`.toLowerCase().includes(normalized))
      .filter((row) => !pathway || row.recommendedPathway === pathway)
      .filter((row) => {
        if (!journey) return true;
        if (journey === 'attention') return !row.readiness?.hasCareer || !row.readiness?.hasSchool || row.needsReview;
        return LearnerJourney({ row }).label === journey;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        if (sortBy === 'confidence') return (a.confidenceScore ?? -1) - (b.confidenceScore ?? -1);
        const aAttention = !a.readiness?.hasCareer || !a.readiness?.hasSchool || a.needsReview ? 0 : 1;
        const bAttention = !b.readiness?.hasCareer || !b.readiness?.hasSchool || b.needsReview ? 0 : 1;
        return aAttention - bAttention || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [rows, query, pathway, journey, sortBy]);

  const summaryChips = [
    { code: '', label: `${total} learners`, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
    ...Object.entries(distribution || {}).map(([code, count]) => ({
      code,
      label: `${count} ${PATHWAY_LABELS[code] || code}`,
      tone: code === 'ARTS_SPORTS' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : code === 'STEM' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700',
    })),
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black text-slate-900">Learner transition queue</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Search, filter and expand a learner to see their next pathway action.</p>
        </div>
        <button type="button" onClick={() => onDrill(cls)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-50">
          Open workbench <ChevronRight size={12} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {summaryChips.map((chip) => <button key={chip.label} type="button" onClick={() => setPathway(chip.code)} className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition-colors ${chip.tone} ${pathway === chip.code ? 'ring-2 ring-violet-300 ring-offset-1' : ''}`}>{chip.label}</button>)}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px_145px]">
        <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search learner or admission number" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-violet-400" /></label>
        <label className="relative"><SlidersHorizontal size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={pathway} onChange={(event) => setPathway(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-7 text-xs"><option value="">All pathways</option>{Object.entries(PATHWAY_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" /></label>
        <select value={journey} onChange={(event) => setJourney(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">All stages</option><option value="attention">Needs attention</option><option value="Explore careers">Explore careers</option><option value="Shortlist schools">Shortlist schools</option><option value="Complete plan">Complete plan</option><option value="Needs review">Needs review</option><option value="On track">On track</option></select>
        <label className="relative"><ArrowUpDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs"><option value="attention">Priority first</option><option value="confidence">Lowest confidence</option><option value="name">Name A–Z</option></select></label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-[850px] w-full text-left">
          <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-500"><tr><th className="w-8 px-3 py-2.5" /><th className="px-3 py-2.5">Learner</th><th className="px-3 py-2.5">Recommendation</th><th className="px-3 py-2.5">Confidence</th><th className="px-3 py-2.5">Journey</th><th className="px-3 py-2.5">Selection</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const stage = LearnerJourney({ row });
              const isExpanded = expandedId === row.learnerId;
              return <React.Fragment key={row.learnerId}><tr className="text-xs hover:bg-violet-50/30"><td className="px-3 py-3"><button type="button" onClick={() => setExpandedId(isExpanded ? null : row.learnerId)} className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronRight size={14} className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'} /></button></td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[10px] font-black text-violet-700">{`${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`}</span><span><b className="block text-slate-800">{row.firstName} {row.lastName}</b><small className="text-[10px] text-slate-400">{row.admissionNumber || 'No admission no.'}</small></span></div></td><td className="px-3 py-3">{row.recommendedPathway ? <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: `${PATHWAY_COLORS[row.recommendedPathway] || '#64748b'}18`, color: PATHWAY_COLORS[row.recommendedPathway] || '#475569' }}>{PATHWAY_LABELS[row.recommendedPathway] || row.recommendedPathway}</span> : <span className="text-[10px] text-slate-400">Awaiting scores</span>}</td><td className="px-3 py-3 font-black text-slate-700">{row.confidenceScore == null ? '—' : `${Math.round(Number(row.confidenceScore))}%`}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${stage.tone}`}>{stage.label}</span></td><td className="max-w-[160px] px-3 py-3 text-[10px] text-slate-500">{row.combinationName || row.selectedPathwayName || 'Not selected'}</td><td className="px-3 py-3 text-right"><button type="button" onClick={() => onDrill(cls)} className="font-black text-violet-700 hover:text-violet-900">Open</button></td></tr>{isExpanded && <tr className="bg-slate-50/80"><td colSpan="7" className="px-5 py-3"><div className="grid gap-2 sm:grid-cols-4"><div className="rounded-lg bg-white p-2"><p className="text-[9px] font-black uppercase text-slate-400">Career exploration</p><p className="mt-1 text-xs font-bold text-slate-700">{row.readiness?.hasCareer ? 'Completed' : 'Not started'}</p></div><div className="rounded-lg bg-white p-2"><p className="text-[9px] font-black uppercase text-slate-400">School shortlist</p><p className="mt-1 text-xs font-bold text-slate-700">{row.readiness?.hasSchool ? 'Completed' : 'Not started'}</p></div><div className="rounded-lg bg-white p-2"><p className="text-[9px] font-black uppercase text-slate-400">Decision plan</p><p className="mt-1 text-xs font-bold text-slate-700">{row.decisionStatus || 'Not started'}</p></div><div className="rounded-lg bg-white p-2"><p className="text-[9px] font-black uppercase text-slate-400">Parent preference</p><p className="mt-1 text-xs font-bold text-slate-700">{row.parentPreference ? (PATHWAY_LABELS[row.parentPreference] || row.parentPreference) : 'Not provided'}</p></div></div></td></tr>}</React.Fragment>;
            })}
            {visibleRows.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-xs text-slate-400">No learners match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClassRow({ cls, onDrill, junior }) {
  const [distrib, setDistrib]   = useState(null);
  const [learners, setLearners] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (distrib) return;
    setLoading(true);
    try {
      const [distributionResult, learnersResult] = await Promise.allSettled([
        pathwayPlannerAPI.getClassDistribution(cls.id),
        pathwayPlannerAPI.getClassLearners(cls.id, { limit: 100 }),
      ]);
      setDistrib(distributionResult.status === 'fulfilled' ? distributionResult.value?.data || null : null);
      setLearners(learnersResult.status === 'fulfilled' ? learnersResult.value?.data || [] : []);
    } catch { setDistrib(null); setLearners([]); }
    finally { setLoading(false); }
  }, [cls.id, distrib]);

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) load();
  };

  // Distribution is loaded lazily only after a class is expanded. Use the
  // enrolment count returned by the class list for the collapsed card so a
  // populated class never appears empty while its detail request is pending.
  const total = distrib?.learnerCount ?? cls?._count?.enrollments ?? 0;
  const withRec = distrib?.recommendationCoverage ?? 0;
  const selStatus = distrib?.selectionStatus ?? {};
  const transition = distrib?.transitionReadiness ?? {};
  const senior = distrib?.seniorProgress ?? {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button type="button" onClick={handleExpand}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-inset">
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{cls.name || cls.classCode}</p>
          <p className="text-[10px] text-gray-500">
            {cls.grade?.replace('_',' ')} · {total} learners
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {distrib && (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black text-emerald-700">
              {withRec}/{total} profiled
            </span>
          )}
          <ChevronRight size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          {loading && <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-violet-500" /></div>}

          {!loading && !distrib && (
            <p className="text-xs text-gray-400 italic text-center py-2">No pathway data yet for this class.</p>
          )}

          {!loading && distrib && (
            <>
              {junior && <LearnerTable rows={learners} total={total} distribution={distrib.recommendations} onDrill={onDrill} cls={cls} />}

              {/* Recommendation coverage */}
              {!junior && <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <BarChart2 size={10} aria-hidden="true" /> Pathway Recommendations
                </p>
                {Object.entries(distrib.recommendations || {}).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No recommendations generated yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(distrib.recommendations || {}).map(([p, count]) => (
                      <div key={p}>
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: PATHWAY_COLORS[p] || '#374151' }}>
                          {p.replace('_',' ')}
                        </p>
                        <ProgressBar value={count} max={total} color={PATHWAY_COLORS[p] || '#6b7280'} />
                      </div>
                    ))}
                  </div>
                )}
              </div>}

              {/* Stage-specific progress */}
              {!junior && <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={10} aria-hidden="true" /> {junior ? 'Transition Readiness' : 'Selection Journey'}
                </p>
                <div className="space-y-1.5">
                  {(['NONE','DRAFT','SUBMITTED','APPROVED','LOCKED']).map(s => {
                    const count = selStatus[s] ?? 0;
                    if (count === 0 && s === 'NONE') return null;
                    return (
                      <div key={s}>
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: STATUS_COLORS[s] }}>{s}</p>
                        <ProgressBar value={count} max={total} color={STATUS_COLORS[s]} />
                      </div>
                    );
                  })}
                </div>
              </div>}

              {!junior && <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ['Actions complete', `${senior.actionItems?.completed || 0}/${senior.actionItems?.total || 0}`],
                    ['Open interventions', senior.interventions?.open || 0],
                    ['Escalated', senior.interventions?.escalated || 0],
                    ['Pathway mismatch', senior.pathwayMismatch || 0],
                  ].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-2"><p className="text-[8px] font-black uppercase tracking-wider text-gray-400">{label}</p><p className="mt-0.5 text-sm font-black text-gray-800">{value}</p></div>)}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[['Track distribution', senior.tracks], ['Combination distribution', senior.combinations]].map(([label, values]) => <div key={label} className="rounded-lg border border-gray-100 p-2"><p className="text-[9px] font-black uppercase text-gray-400">{label}</p><div className="mt-1 space-y-1">{Object.entries(values || {}).length === 0 ? <p className="text-[10px] text-gray-400">No records yet</p> : Object.entries(values).map(([name, count]) => <div key={name} className="flex justify-between gap-2 text-[10px]"><span className="truncate text-gray-600">{name}</span><b>{count}</b></div>)}</div></div>)}
                </div>
              </div>}

              {!junior && <button type="button" onClick={() => onDrill(cls)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-100 transition-colors">
                <ChevronRight size={11} aria-hidden="true" /> Open Counsellor Workbench
              </button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PathwayClassOverview = ({ onNavigate, user, embedded = false }) => {
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const junior = String(user?.institutionType || '').toUpperCase() !== 'SECONDARY';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await classAPI.getAll({ institutionType: junior ? 'PRIMARY_CBC' : 'SECONDARY', limit: 200 });
      const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const stageRows = junior
        ? rows.filter((row) => ['GRADE7', 'GRADE8', 'GRADE9'].includes(String(row.grade || '').toUpperCase().replace(/[\s_-]+/g, '')))
        : rows;
      setClasses(stageRows.sort((a, b) => String(a.grade || '').localeCompare(String(b.grade || '')) || String(a.name || '').localeCompare(String(b.name || ''))));
    } catch (e) {
      setError(e?.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [junior]);

  useEffect(() => { load(); }, [load]);
  const grades = useMemo(() => [...new Set(classes.map((item) => item.grade).filter(Boolean))].sort(), [classes]);
  const visibleClasses = useMemo(() => classes.filter((item) => {
    const matchesGrade = !gradeFilter || item.grade === gradeFilter;
    const haystack = `${item.name || ''} ${item.classCode || ''}`.toLowerCase();
    return matchesGrade && haystack.includes(query.trim().toLowerCase());
  }), [classes, gradeFilter, query]);

  const drillToWorkbench = (cls) => {
    if (onNavigate) onNavigate('sec-pathway-counsellor', { classId: cls?.id });
  };

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 space-y-4'}>
      {!embedded && <PathwayGuideWelcome user={user} onNavigate={onNavigate} />}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900">{junior ? 'Junior Transition Centre' : 'Senior Pathway Progress Centre'}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {junior ? 'Grade 7–9 readiness for pathway, career and senior-school decisions' : 'Class-by-class summary of pathway execution, approval and completion'}
          </p>
        </div>
        <button type="button" onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
          <RefreshCw size={13} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_180px]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by class name" className="rounded-lg border border-gray-200 p-2 text-xs" />
        <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="rounded-lg border border-gray-200 p-2 text-xs"><option value="">All grades</option>{grades.map((grade) => <option key={grade} value={grade}>{String(grade).replace('_', ' ')}</option>)}</select>
      </div>

      {/* Summary legend */}
      <div className="flex flex-wrap gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        {(junior ? [
          { label: 'Recommendation', color: '#1d4ed8' },
          { label: 'Career explored', color: '#7c3aed' },
          { label: 'School shortlist', color: '#db2777' },
          { label: 'Decision review', color: '#0d9488' },
        ] : [
          { label: 'Not Started', color: STATUS_COLORS.NONE      },
          { label: 'Draft',       color: STATUS_COLORS.DRAFT     },
          { label: 'Submitted',   color: STATUS_COLORS.SUBMITTED  },
          { label: 'Approved',    color: STATUS_COLORS.APPROVED   },
          { label: 'Locked',      color: STATUS_COLORS.LOCKED     },
        ]).map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
            <span className="text-[10px] font-semibold text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-violet-500" />
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700" role="alert">{error}</div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <BarChart2 size={24} className="mx-auto mb-2 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">No {junior ? 'Grade 7–9' : 'secondary'} classes found</p>
        </div>
      )}

      {!loading && !error && classes.length > 0 && visibleClasses.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs text-gray-500">No classes match these filters.</div>
      )}

      {!loading && !error && visibleClasses.length > 0 && (
        <div className="space-y-2">
          {visibleClasses.map(cls => (
            <ClassRow key={cls.id} cls={cls} onDrill={drillToWorkbench} junior={junior} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PathwayClassOverview;
