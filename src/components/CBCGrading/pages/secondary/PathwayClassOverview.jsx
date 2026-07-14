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
  RefreshCw, ChevronRight, BarChart2,
  CheckCircle2, Loader2,
} from 'lucide-react';
import { classAPI, pathwayPlannerAPI } from '../../../../services/api';

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

function ClassRow({ cls, onDrill, junior }) {
  const [distrib, setDistrib]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (distrib) return;
    setLoading(true);
    try {
      const res = await pathwayPlannerAPI.getClassDistribution(cls.id);
      setDistrib(res?.data || null);
    } catch { setDistrib(null); }
    finally { setLoading(false); }
  }, [cls.id, distrib]);

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) load();
  };

  const total = distrib?.learnerCount ?? 0;
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
              {/* Recommendation coverage */}
              <div>
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
              </div>

              {/* Stage-specific progress */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={10} aria-hidden="true" /> {junior ? 'Transition Readiness' : 'Selection Journey'}
                </p>
                {junior ? <div className="space-y-1.5">{[
                  ['Recommendation ready', transition.recommendationReady, '#1d4ed8'],
                  ['Career explored', transition.careerExplored, '#7c3aed'],
                  ['School shortlisted', transition.schoolShortlisted, '#db2777'],
                  ['Decision submitted', transition.decisionSubmitted, '#0d9488'],
                  ['Parent reviewed', transition.parentReviewed, '#059669'],
                  ['Counsellor reviewed', transition.counsellorReviewed, '#047857'],
                ].map(([label, count, color]) => <div key={label}><p className="text-[10px] font-semibold mb-0.5" style={{ color }}>{label}</p><ProgressBar value={count || 0} max={total} color={color} /></div>)}</div> : <div className="space-y-1.5">
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
                </div>}
              </div>

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

              <button type="button" onClick={() => onDrill(cls)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-700 hover:bg-violet-100 transition-colors">
                <ChevronRight size={11} aria-hidden="true" /> Open Counsellor Workbench
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PathwayClassOverview = ({ onNavigate, user }) => {
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
    <div className="p-6 space-y-4">
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
