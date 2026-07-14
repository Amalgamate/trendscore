import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, ClipboardList, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { pathwayPlannerAPI } from '../../../../services/api';

const METRICS = [
  { key: 'awaitingCounsellor', label: 'Awaiting review', icon: ClipboardList, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'revisionRequired', label: 'Need revision', icon: AlertCircle, cls: 'text-rose-700 bg-rose-50 border-rose-200' },
  { key: 'overdueActions', label: 'Overdue actions', icon: ShieldAlert, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  { key: 'upcomingSessions', label: 'Upcoming sessions', icon: CalendarClock, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  { key: 'locked', label: 'Plans completed', icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
];

export default function CounsellorWorkspaceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await pathwayPlannerAPI.getCounsellorDashboard();
      setData(res?.data || null);
    } catch (e) {
      setError(e?.message || 'Failed to load counsellor dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center rounded-2xl border border-gray-200 bg-white py-8"><Loader2 size={18} className="animate-spin text-violet-600" /></div>;
  if (error) return <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><span>{error}</span><button type="button" onClick={load} className="font-bold">Retry</button></div>;
  if (!data) return null;

  return (
    <section className="space-y-3" aria-label="Counsellor dashboard">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {METRICS.map(metric => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className={`rounded-xl border p-3 ${metric.cls}`}>
              <div className="flex items-center justify-between"><Icon size={14} /><span className="text-lg font-black">{data.summary?.[metric.key] || 0}</span></div>
              <p className="mt-1 text-[10px] font-bold">{metric.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Approval progress</p>
          <div className="space-y-2">
            {(data.approvalProgress || []).map(item => (
              <div key={item.status} className="flex items-center justify-between text-xs"><span className="text-gray-600">{item.status.toLowerCase().replaceAll('_', ' ')}</span><span className="font-black text-gray-900">{item.count}</span></div>
            ))}
            {(data.approvalProgress || []).length === 0 && <p className="text-xs text-gray-400">No decision plans yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Intervention outcomes</p>
          <div className="space-y-2">
            {(data.interventionOutcomes || []).map(item => (
              <div key={item.status} className="flex items-center justify-between text-xs"><span className="text-gray-600">{item.status.toLowerCase().replaceAll('_', ' ')}</span><span className="font-black text-gray-900">{item.count}</span></div>
            ))}
            {(data.interventionOutcomes || []).length === 0 && <p className="text-xs text-gray-400">No intervention cases yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-gray-500">Pathway distribution</p>
          <div className="space-y-2">
            {(data.pathwayDistribution || []).map(item => (
              <div key={item.pathwayId} className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-gray-600">{item.pathway}</span><span className="font-black text-gray-900">{item.count}</span></div>
            ))}
            {(data.pathwayDistribution || []).length === 0 && <p className="text-xs text-gray-400">No pathway selections yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Upcoming sessions</p><button type="button" onClick={load} aria-label="Refresh dashboard"><RefreshCw size={11} className="text-gray-400" /></button></div>
          <div className="space-y-2">
            {(data.upcomingSessionList || []).map(item => (
              <div key={item.id} className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] font-bold text-gray-900">{item.learner?.firstName} {item.learner?.lastName}</p><p className="text-[10px] text-gray-500">{new Date(item.scheduledAt).toLocaleString('en-GB')}</p></div>
            ))}
            {(data.upcomingSessionList || []).length === 0 && <p className="text-xs text-gray-400">No upcoming sessions.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
