import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, Filter, Loader2, Search, ShieldAlert, Square } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../services/api';

const humanize = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function CounsellorInterventionQueue({ onOpenLearner }) {
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', assignedCounsellorId: '', grade: '' });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [data, setData] = useState({ items: [], counsellors: [] });
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState({ assignedCounsellorId: '', status: '', priority: '', dueDate: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.getInterventionQueue(appliedFilters);
      setData(res?.data || { items: [], counsellors: [] });
      setSelected([]);
    } catch (e) {
      setError(e?.message || 'Failed to load intervention queue');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { load(); }, [load]);

  const allSelected = data.items.length > 0 && selected.length === data.items.length;
  const hasBulkChange = useMemo(
    () => Object.values(bulk).some(value => value !== ''),
    [bulk],
  );
  const toggle = id => setSelected(current => current.includes(id)
    ? current.filter(item => item !== id)
    : [...current, id]);

  const applyBulk = async () => {
    if (!selected.length || !hasBulkChange) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await pathwayPlannerAPI.bulkUpdateInterventions({
        interventionIds: selected,
        assignedCounsellorId: bulk.assignedCounsellorId || undefined,
        status: bulk.status || undefined,
        priority: bulk.priority || undefined,
        dueDate: bulk.dueDate || undefined,
      });
      setMessage(`${selected.length} intervention${selected.length === 1 ? '' : 's'} updated.`);
      setBulk({ assignedCounsellorId: '', status: '', priority: '', dueDate: '' });
      await load();
    } catch (e) {
      setError(e?.message || 'Bulk update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3" aria-label="Intervention queue">
      <div className="flex items-start justify-between gap-3">
        <div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-600"><ShieldAlert size={12} /> Intervention Queue</p><p className="text-[11px] text-gray-500">Filter, assign and update cases in bulk.</p></div>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{data.items.length} cases</span>
      </div>

      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        <div className="relative md:col-span-2"><Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" /><input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Learner name or admission…" className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-2 text-xs" /></div>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-xs"><option value="">All statuses</option>{['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CANCELLED'].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
        <select value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-xs"><option value="">All priorities</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
        <select value={filters.assignedCounsellorId} onChange={e => setFilters({ ...filters, assignedCounsellorId: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-2 text-xs"><option value="">All counsellors</option>{data.counsellors.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select>
        <input value={filters.grade} onChange={e => setFilters({ ...filters, grade: e.target.value })} placeholder="Grade" className="rounded-lg border border-gray-200 px-2 py-2 text-xs" />
        <button type="button" onClick={() => setAppliedFilters(filters)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-white"><Filter size={11} /> Apply</button>
      </div>

      {selected.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 md:grid-cols-5">
          <select value={bulk.assignedCounsellorId} onChange={e => setBulk({ ...bulk, assignedCounsellorId: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="">Assign counsellor…</option>{data.counsellors.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select>
          <select value={bulk.status} onChange={e => setBulk({ ...bulk, status: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="">Change status…</option>{['OPEN', 'IN_PROGRESS', 'CANCELLED'].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
          <select value={bulk.priority} onChange={e => setBulk({ ...bulk, priority: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"><option value="">Change priority…</option>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
          <input type="date" value={bulk.dueDate} onChange={e => setBulk({ ...bulk, dueDate: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" aria-label="Bulk due date" />
          <button type="button" disabled={busy || !hasBulkChange} onClick={applyBulk} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60">{busy ? 'Updating…' : `Update ${selected.length} selected`}</button>
        </div>
      )}

      {error && <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700" role="alert"><AlertCircle size={12} />{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700" role="status">{message}</div>}

      {loading ? <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-violet-600" /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead><tr className="border-b border-gray-100 text-[10px] uppercase text-gray-400"><th className="p-2"><button type="button" onClick={() => setSelected(allSelected ? [] : data.items.map(item => item.id))} aria-label="Select all interventions">{allSelected ? <CheckSquare size={14} /> : <Square size={14} />}</button></th><th className="p-2">Learner</th><th className="p-2">Intervention</th><th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">Assigned</th><th className="p-2">Due</th></tr></thead>
            <tbody>{data.items.map(item => <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50"><td className="p-2"><button type="button" onClick={() => toggle(item.id)} aria-label={`Select ${item.learner?.firstName || 'case'}`}>{selected.includes(item.id) ? <CheckSquare size={14} className="text-violet-600" /> : <Square size={14} className="text-gray-300" />}</button></td><td className="p-2"><button type="button" onClick={() => onOpenLearner?.(item.learner)} className="font-bold text-violet-700 hover:underline">{item.learner?.firstName} {item.learner?.lastName}</button><p className="text-[10px] text-gray-400">{item.learner?.admissionNumber} · {item.learner?.grade}</p></td><td className="p-2"><p className="font-semibold text-gray-700">{humanize(item.interventionType)}</p><p className="max-w-[240px] truncate text-[10px] text-gray-500">{item.summary}</p></td><td className="p-2 font-bold text-gray-700">{humanize(item.priority)}</td><td className={`p-2 font-bold ${item.status === 'ESCALATED' ? 'text-rose-700' : 'text-gray-700'}`}>{humanize(item.status)}</td><td className="p-2 text-gray-600">{item.assignedCounsellor ? `${item.assignedCounsellor.firstName} ${item.assignedCounsellor.lastName}` : 'Unassigned'}</td><td className="p-2 text-gray-600">{item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : '—'}</td></tr>)}</tbody>
          </table>
          {data.items.length === 0 && <p className="py-6 text-center text-xs text-gray-400">No interventions match these filters.</p>}
        </div>
      )}
    </section>
  );
}
