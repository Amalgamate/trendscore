import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import api, { seniorPathwayAPI } from '../../../../services/api';
import { configAPI } from '../../../../services/api/config.api';
import EmptyState from '../../shared/EmptyState';

const Pill = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${className}`}>
    {children}
  </span>
);

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

const PathwaysHub = () => {
  const [loading, setLoading] = useState(true);
  const [pathways, setPathways] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [mode, setMode] = useState('overview');
  const [catalog, setCatalog] = useState({ pathways: [], coreSubjects: [], supportSubjects: [] });
  const [offerings, setOfferings] = useState([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [savingOfferings, setSavingOfferings] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');

  const loadIntegrity = async () => {
    setIntegrityLoading(true);
    try {
      const resp = await api.pathways.getCatalogIntegrity();
      setIntegrity(resp?.data || resp || null);
    } catch (e) {
      setIntegrity({
        success: false,
        checkedAt: new Date().toISOString(),
        counts: { issues: 1, errors: 1, warnings: 0 },
        issues: [{ code: 'INTEGRITY_FETCH_FAILED', message: e?.message || 'Failed to load catalog health', severity: 'error' }],
      });
    } finally {
      setIntegrityLoading(false);
    }
  };

  const loadOfferings = async () => {
    const [catalogResp, offeringsResp] = await Promise.all([
      seniorPathwayAPI.getCatalog(),
      seniorPathwayAPI.getSchoolOfferings(),
    ]);
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
    loadIntegrity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSeeding(true);
    setError(null);
    try {
      await configAPI.seedPathways();
      await configAPI.seedLearningAreas();
      await load();
      await loadIntegrity();
    } catch (e) {
      setError(e?.message || 'Failed to run secondary bootstrap seed');
    } finally {
      setSeeding(false);
    }
  };

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
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode('configure')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-semibold uppercase tracking-widest hover:bg-indigo-100"
          >
            <Settings2 size={16} />
            Configure Pathways
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('configure');
              setSubjectSearch('');
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} />
            Add Subject
          </button>
          <button
            type="button"
            onClick={seedCatalog}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold uppercase tracking-widest shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            <BookOpen size={16} />
            {seeding ? 'Seeding…' : 'Seed'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await load();
              await loadIntegrity();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

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
      ) : mode === 'configure' ? (
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
          <div className={`rounded-2xl border p-4 ${
            integrity?.success ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">Catalog Health</div>
                <div className="mt-1 flex items-center gap-2">
                  {integrity?.success ? <CheckCircle2 size={18} className="text-emerald-600" /> : <ShieldAlert size={18} className="text-amber-700" />}
                  <span className={`text-sm font-semibold ${integrity?.success ? 'text-emerald-800' : 'text-amber-900'}`}>
                    {integrityLoading ? 'Checking integrity...' : (integrity?.success ? 'No critical integrity conflicts' : 'Catalog integrity needs attention')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Errors: {integrity?.counts?.errors || 0} • Warnings: {integrity?.counts?.warnings || 0}
                </p>
              </div>
              <button
                type="button"
                onClick={loadIntegrity}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={14} />
                Recheck
              </button>
            </div>

            {(integrity?.issues || []).length > 0 && (
              <div className="mt-3 space-y-2 max-h-40 overflow-auto pr-1">
                {integrity.issues.slice(0, 8).map((issue, idx) => (
                  <div key={`${issue.code}-${idx}`} className="rounded-xl border border-white/70 bg-white/70 p-3">
                    <div className="flex items-center gap-2">
                      {issue.severity === 'error' ? <AlertTriangle size={14} className="text-red-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">{issue.code}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-800">{issue.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

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
